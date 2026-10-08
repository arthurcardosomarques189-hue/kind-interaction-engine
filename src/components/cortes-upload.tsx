import { useRef, useState } from 'react';
import { Upload, FileVideo, X, Sparkles, Loader2, CheckCircle2, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createCortesProject } from '@/lib/cortes-project.functions';
import { queueCortesProcessing } from '@/lib/cortes-processing.functions';
import { createYouTubeCortesProject } from '@/lib/cortes-youtube.functions';
import { supabase } from '@/integrations/supabase/client';
import { uploadCortesVideoResumable } from '@/lib/cortes-large-upload';
import type { CortesProject } from '@/lib/cortes-project';

function isYouTubeUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be';
  } catch {
    return false;
  }
}

export function CortesUpload({ onCreated }: { onCreated: (project: CortesProject) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'upload' | 'youtube'>('upload');
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

  function selectFile(next: File | undefined) {
    if (!next) return;
    setError(null);
    setUploaded(false);
    if (!next.type.startsWith('video/')) {
      setError('Escolha um arquivo de vídeo.');
      return;
    }
    if (next.size > MAX_VIDEO_SIZE) {
      setError('O vídeo precisa ter no máximo 500 MB. Vídeos maiores usam upload em partes e processamento assíncrono.');
      return;
    }
    setFile(next);
  }

  async function createProjectFromFile() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setUploaded(false);

    try {
      const project = await createCortesProject({ data: { title: file.name.replace(/\.[^/.]+$/, '') } });
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = project.user_id + '/' + project.id + '/original-' + crypto.randomUUID() + '-' + safeName;

      setUploadProgress(1);
      await uploadCortesVideoResumable(path, file, setUploadProgress);

      const { error: updateError } = await supabase.from('projects').update({
        video_path: path, video_name: file.name, video_size: file.size, source_type: 'upload',
        status: 'queued', progress: 10,
      }).eq('id', project.id);
      if (updateError) {
        await supabase.storage.from('cortes-videos').remove([path]);
        throw new Error('O vídeo foi enviado, mas não foi possível finalizar o projeto.');
      }

      const created: CortesProject = {
        id: project.id, title: project.title, fileName: file.name, fileSize: file.size,
        status: 'queued', progress: 15, createdAt: project.created_at, videoPath: path,
        errorMessage: null, sourceType: 'upload',
      };
      setUploaded(true);
      onCreated(created);
      setFile(null);

      try {
        await queueCortesProcessing({ data: { projectId: project.id } });
      } catch (processingError) {
        const message = processingError instanceof Error ? processingError.message : 'Não foi possível iniciar o processamento.';
        await supabase.from('projects').update({ status: 'failed', error_message: message }).eq('id', project.id);
        throw new Error(message);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o vídeo.');
    } finally {
      setBusy(false);
    }
  }

  async function createProjectFromYouTube() {
    const value = youtubeUrl.trim();
    if (!isYouTubeUrl(value)) {
      setError('Cole um link válido do YouTube.');
      return;
    }
    setBusy(true);
    setError(null);
    setUploaded(false);
    try {
      const project = await createYouTubeCortesProject({ data: { youtubeUrl: value } });
      onCreated({
        id: project.id,
        title: project.title,
        fileName: 'YouTube',
        fileSize: 0,
        status: 'queued',
        progress: 10,
        createdAt: project.created_at,
        videoPath: null,
        errorMessage: null,
        sourceType: 'youtube',
        sourceUrl: value,
      });
      setUploaded(true);
      setYoutubeUrl('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível importar o vídeo do YouTube.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo projeto</CardTitle>
        <CardDescription>Envie um vídeo ou cole um link do YouTube para criar cortes com IA.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-5 grid grid-cols-2 rounded-xl border p-1">
          <button type="button" onClick={() => { setMode('upload'); setError(null); }} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === 'upload' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
            <Upload className="mr-2 inline" size={16} /> Arquivo
          </button>
          <button type="button" onClick={() => { setMode('youtube'); setError(null); }} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === 'youtube' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
            <Youtube className="mr-2 inline" size={16} /> YouTube
          </button>
        </div>

        {mode === 'youtube' ? (
          <div>
            <label htmlFor="youtube-url" className="text-sm font-semibold">Link do vídeo</label>
            <input
              id="youtube-url"
              value={youtubeUrl}
              onChange={e => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="mt-2 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
              inputMode="url"
            />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Use somente vídeos que você tenha permissão para processar. O CORTES AI não deve burlar DRM, paywalls ou restrições de acesso.
            </p>
            <Button className="mt-4 w-full" disabled={!youtubeUrl.trim() || busy} onClick={() => void createProjectFromYouTube()}>
              {busy ? <><Loader2 className="animate-spin" /> Importando vídeo...</> : <><Youtube /> Importar e criar cortes</>}
            </Button>
          </div>
        ) : (
          <>
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
              <span className="mt-1 text-sm text-muted-foreground">ou clique para escolher um arquivo de vídeo (até 500 MB)</span>
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

            {busy && file && uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-4 rounded-xl border p-3">
                <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                  <span>Enviando vídeo em partes...</span><span>{uploadProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: uploadProgress + '%' }} />
                </div>
              </div>
            )}

            <Button className="mt-4 w-full" disabled={!file || busy} onClick={() => void createProjectFromFile()}>
              {busy ? <><Loader2 className="animate-spin" /> Enviando e iniciando IA...</> : <><Sparkles /> Criar cortes com IA</>}
            </Button>
          </>
        )}

        {uploaded && (
          <p className="mt-3 flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 size={16} /> Projeto criado. A IA vai analisar os melhores momentos.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
