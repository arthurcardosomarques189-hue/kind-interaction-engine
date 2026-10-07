import { useRef, useState } from 'react';
import { Upload, FileVideo, X, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createCortesProject } from '@/lib/cortes-project.functions';
import { supabase } from '@/integrations/supabase/client';
import type { CortesProject } from '@/lib/cortes-project';

export function CortesUpload({ onCreated }: { onCreated: (project: CortesProject) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectFile(next: File | undefined) {
    if (!next) return;
    setError(null);
    if (!next.type.startsWith('video/')) {
      setError('Escolha um arquivo de vídeo.');
      return;
    }
    setFile(next);
  }

  async function createProject() {
    if (!file) return;
    setBusy(true);
    setError(null);

    try {
      const project = await createCortesProject({
        data: { title: file.name.replace(/\.[^/.]+$/, '') },
      });

      const path = `${project.user_id}/${project.id}/original-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('cortes-videos')
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        throw new Error('Não foi possível enviar o vídeo para o armazenamento.');
      }

      const { error: updateError } = await supabase
        .from('projects')
        .update({
          video_path: path,
          video_name: file.name,
          video_size: file.size,
          status: 'queued',
          progress: 10,
        })
        .eq('id', project.id);

      if (updateError) {
        await supabase.storage.from('cortes-videos').remove([path]);
        throw new Error('O vídeo foi enviado, mas não foi possível finalizar o projeto.');
      }

      onCreated({
        id: project.id,
        title: project.title,
        fileName: file.name,
        fileSize: file.size,
        status: 'queued',
        progress: 10,
        createdAt: project.created_at,
      });
      setFile(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o vídeo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo projeto</CardTitle>
        <CardDescription>Envie um vídeo para preparar seu primeiro projeto de cortes.</CardDescription>
      </CardHeader>
      <CardContent>
        <button
          type="button"
          className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${dragging ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); selectFile(e.dataTransfer.files[0]); }}
        >
          <Upload className="mb-3 text-primary" size={30} />
          <strong>Arraste seu vídeo aqui</strong>
          <span className="mt-1 text-sm text-muted-foreground">ou clique para escolher um arquivo de vídeo</span>
          <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={e => selectFile(e.target.files?.[0])} />
        </button>

        {file && (
          <div className="mt-4 flex items-center justify-between rounded-xl border p-4">
            <div className="flex min-w-0 items-center gap-3">
              <FileVideo className="shrink-0 text-primary" size={22} />
              <div className="min-w-0">
                <strong className="block truncate">{file.name}</strong>
                <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setFile(null)} aria-label="Remover vídeo"><X /></Button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <Button className="mt-4 w-full" disabled={!file || busy} onClick={createProject}>
          {busy ? <><Loader2 className="animate-spin" /> Enviando vídeo...</> : <><Sparkles /> Enviar e criar projeto</>}
        </Button>
      </CardContent>
    </Card>
  );
}
