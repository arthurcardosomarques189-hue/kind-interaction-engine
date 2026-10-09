import { useRef, useState } from 'react';
import { CheckCircle2, File, FileVideo, Loader2, Settings, Sparkles, Upload, X, Youtube } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { createCortesProject } from '@/lib/cortes-project.functions';
import { queueCortesProcessing } from '@/lib/cortes-processing.functions';
import { createYouTubeCortesProject } from '@/lib/cortes-youtube.functions';
import { supabase } from '@/integrations/supabase/client';
import { uploadCortesVideoResumable } from '@/lib/cortes-large-upload';
import type { CortesProject } from '@/lib/cortes-project';
import { normalizeYouTubeUrl, videoFileError } from '@/lib/cortes-video-input';

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

  // Opções Profissionais
  const [removeWatermark, setRemoveWatermark] = useState(true);
  const [autoCaption, setAutoCaption] = useState(true);

  function selectFile(next: File | undefined) {
    if (!next) return;
    setError(null);
    setUploaded(false);
    const validationError = videoFileError(next);
    if (validationError) {
      setFile(null);
      setError(validationError);
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
        status: 'pending', progress: 10,
      }).eq('id', project.id);
      
      if (updateError) {
        await supabase.storage.from('cortes-videos').remove([path]);
        throw new Error('O vídeo foi enviado, mas não foi possível finalizar o projeto.');
      }

      const created: CortesProject = {
        id: project.id, title: project.title, fileName: file.name, fileSize: file.size,
        status: 'pending', progress: 10, createdAt: project.created_at, videoPath: path,
        errorMessage: null, sourceType: 'upload',
      };
      
      setUploaded(true);
      onCreated(created);
      setFile(null);

      try {
        await queueCortesProcessing({ data: { projectId: project.id } });
      } catch (processingError) {
        const message = processingError instanceof Error ? processingError.message : 'Não foi possível iniciar o processamento.';
        throw new Error(message);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o vídeo.');
    } finally {
      setBusy(false);
    }
  }

  async function createProjectFromYouTube() {
    const value = normalizeYouTubeUrl(youtubeUrl);
    if (!value) {
      setError('Cole um link válido do YouTube.');
      return;
    }
    setBusy(true);
    setError(null);
    setUploaded(false);
    
    try {
      const project = await createYouTubeCortesProject({ 
        data: { 
          youtubeUrl: value,
          removeWatermark,
          autoCaption
        } 
      });
      
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

  const optionsPanel = (
    <div className="mt-6 space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-5 transition-all">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
        <Settings size={16} /> Configurações de Processamento
      </h4>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label htmlFor="watermark-toggle" className="text-sm font-medium cursor-pointer">
            Remover marca d'água (Pro)
          </Label>
          <p className="text-xs text-muted-foreground">Exportar cortes limpos sem logo do sistema</p>
        </div>
        <Switch id="watermark-toggle" checked={removeWatermark} onCheckedChange={setRemoveWatermark} disabled={busy} />
      </div>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label htmlFor="caption-toggle" className="text-sm font-medium cursor-pointer">
            Legendas dinâmicas automáticas
          </Label>
          <p className="text-xs text-muted-foreground">Adicionar legendas estilo Reels/TikTok</p>
        </div>
        <Switch id="caption-toggle" checked={autoCaption} onCheckedChange={setAutoCaption} disabled={busy} />
      </div>
    </div>
  );

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader>
        <CardTitle>Novo projeto de cortes</CardTitle>
        <CardDescription>Envie um vídeo ou cole um link do YouTube para a IA encontrar os melhores momentos.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-5 grid grid-cols-2 rounded-xl border p-1 bg-muted/30">
          <Button type="button" disabled={busy} aria-pressed={mode === 'upload'} variant={mode === 'upload' ? 'default' : 'ghost'} className={mode === 'upload' ? 'shadow-sm' : ''} onClick={() => { setMode('upload'); setError(null); setUploaded(false); }}>
            <Upload className="mr-2 inline" size={16} /> Arquivo Local
          </Button>
          <Button type="button" disabled={busy} aria-pressed={mode === 'youtube'} variant={mode === 'youtube' ? 'default' : 'ghost'} className={mode === 'youtube' ? 'shadow-sm' : ''} onClick={() => { setMode('youtube'); setError(null); setUploaded(false); }}>
            <Youtube className="mr-2 inline" size={16} /> Link YouTube
          </Button>
        </div>

        {mode === 'youtube' ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <label htmlFor="youtube-url" className="text-sm font-semibold">Link do vídeo</label>
            <input
              id="youtube-url"
              value={youtubeUrl}
              onChange={e => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="mt-2 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none ring-primary focus:ring-2 transition-all"
              inputMode="url"
              disabled={busy}
            />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Use somente vídeos públicos. O CORTES AI não processa vídeos privados, restritos ou protegidos por paywall.
            </p>

            {optionsPanel}

            <Button className="mt-6 w-full led-glow h-12 text-base font-semibold" disabled={!youtubeUrl.trim() || busy} onClick={() => void createProjectFromYouTube()}>
              {busy ? <><Loader2 className="animate-spin mr-2" /> Importando vídeo...</> : <><Sparkles className="mr-2" /> Importar e Gerar Cortes Virais</>}
            </Button>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              className={`h-auto w-full flex-col whitespace-normal rounded-xl border-2 border-dashed p-8 text-center transition-all sm:p-12 ${dragging ? 'border-primary bg-primary/10 scale-[1.02]' : 'hover:bg-muted/40 hover:border-primary/50'}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); selectFile(e.dataTransfer.files[0]); }}
            >
              <div className={`rounded-full p-4 mb-4 transition-colors ${dragging ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                <Upload size={32} />
              </div>
              <strong className="text-lg">Arraste seu vídeo aqui</strong>
              <span className="mt-2 text-sm text-muted-foreground">ou clique para escolher um arquivo .mp4, .mov (até 500 MB)</span>
            </Button>
            <input ref={inputRef} type="file" accept="video/*,.mp4,.mov,.webm,.m4v,.avi,.mkv" disabled={busy} className="hidden" onChange={e => { selectFile(e.target.files?.[0]); e.target.value = ''; }} />

            {file && (
              <div className="mt-4 flex items-center justify-between rounded-xl border bg-background p-4 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <FileVideo className="shrink-0 text-primary" size={24} />
                  </div>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm">{file.name}</strong>
                    <span className="text-xs text-muted-foreground font-medium">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" disabled={busy} onClick={() => setFile(null)} aria-label="Remover vídeo" className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"><X size={18} /></Button>
              </div>
            )}

            {busy && file && uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-4 rounded-xl border p-4 bg-muted/20 animate-in fade-in">
                <div className="mb-3 flex justify-between text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Enviando vídeo em partes...</span>
                  <span className="text-primary">{uploadProgress}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted/50 border">
                  <div className="h-full bg-primary transition-all duration-300 ease-out led-glow" style={{ width: uploadProgress + '%' }} />
                </div>
              </div>
            )}

            {optionsPanel}

            <Button className="mt-6 w-full led-glow h-12 text-base font-semibold" disabled={!file || busy} onClick={() => void createProjectFromFile()}>
              {busy ? <><Loader2 className="animate-spin mr-2" /> Processando Inteligência Artificial...</> : <><Sparkles className="mr-2" /> Gerar Cortes Virais</>}
            </Button>
          </div>
        )}

        {uploaded && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 size={18} /> Processo iniciado! O vídeo está na sua biblioteca e começará a ser analisado.
          </div>
        )}
        {error && (
          <div role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive animate-in fade-in slide-in-from-bottom-2 border border-destructive/20">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}