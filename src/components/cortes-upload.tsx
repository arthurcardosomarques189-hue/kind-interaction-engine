import { useRef, useState } from 'react';
import { Upload, FileVideo, X, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createLocalProject, type CortesProject } from '@/lib/cortes-project';

export function CortesUpload({ onCreated }: { onCreated: (project: CortesProject) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  function selectFile(next: File | undefined) {
    if (!next) return;
    if (!next.type.startsWith('video/')) return;
    setFile(next);
  }

  async function createProject() {
    if (!file) return;
    setBusy(true);
    await new Promise(resolve => setTimeout(resolve, 450));
    onCreated(createLocalProject(file));
    setBusy(false);
    setFile(null);
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
              <div className="min-w-0"><strong className="block truncate">{file.name}</strong><span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span></div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setFile(null)} aria-label="Remover vídeo"><X /></Button>
          </div>
        )}

        <Button className="mt-4 w-full" disabled={!file || busy} onClick={createProject}>
          {busy ? <><Loader2 className="animate-spin" /> Preparando projeto...</> : <><Sparkles /> Criar projeto</>}
        </Button>
      </CardContent>
    </Card>
  );
}
