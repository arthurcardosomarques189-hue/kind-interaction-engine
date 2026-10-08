import { useEffect, useRef, useState } from 'react';
import { CortesUpload } from '@/components/cortes-upload';
import { getCortesExportStatus, renderCortesClip } from '@/lib/cortes-export.functions';
import type { CortesClip, CortesProject } from '@/lib/cortes-project';
import { Link } from '@tanstack/react-router';
import { Upload, Scissors, Sparkles, FolderOpen, Clock3, Play, ArrowRight, Zap, Loader2, AlertCircle, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

const features = [
  { icon: Sparkles, title: 'Encontre os melhores momentos', description: 'A IA transcreve o vídeo e identifica trechos com maior potencial.' },
  { icon: Scissors, title: 'Gere vários cortes', description: 'Receba sugestões de cortes com início, fim e pontuação.' },
  { icon: Play, title: 'Pronto para vertical', description: 'A estrutura já fica preparada para a próxima etapa de edição 9:16.' },
];

function formatTime(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function CortesDashboard() {
  const [project, setProject] = useState<CortesProject | null>(null);
  const [clips, setClips] = useState<CortesClip[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedClip, setSelectedClip] = useState<CortesClip | null>(null);
  const [exportingClipId, setExportingClipId] = useState<string | null>(null);
  const [exportResults, setExportResults] = useState<Record<string, { status: string; outputUrl?: string | null; error?: string | null }>>({});
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [captionStyle, setCaptionStyle] = useState<'highlight' | 'karaoke' | 'pop' | 'fade' | 'slide' | 'bounce' | 'typewriter'>('highlight');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!project) return;

    let cancelled = false;
    const poll = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id,title,status,progress,error_message,video_path,video_name,video_size,created_at')
        .eq('id', project.id)
        .single();

      if (cancelled || error || !data) return;

      const next: CortesProject = {
        id: data.id,
        title: data.title,
        fileName: data.video_name ?? project.fileName,
        fileSize: data.video_size ?? project.fileSize,
        status: data.status as CortesProject['status'],
        progress: data.progress ?? 0,
        createdAt: data.created_at,
        videoPath: data.video_path,
        errorMessage: data.error_message,
      };
      setProject(next);

      if (next.status === 'completed') {
        const { data: clipRows } = await supabase
          .from('clips')
          .select('id,title,start_seconds,end_seconds,score,video_path')
          .eq('project_id', project.id)
          .order('score', { ascending: false });

        if (!cancelled) {
          setClips((clipRows ?? []) as CortesClip[]);
          setLoadingResults(false);
        }

        if (next.videoPath && !videoUrl) {
          const { data: signed } = await supabase.storage
            .from('cortes-videos')
            .createSignedUrl(next.videoPath, 60 * 60);
          if (!cancelled) setVideoUrl(signed?.signedUrl ?? null);
        }
      } else if (next.status === 'failed') {
        setLoadingResults(false);
      }
    };

    setLoadingResults(true);
    void poll();
    const timer = window.setInterval(poll, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [project?.id]);

  useEffect(() => {
    if (!selectedClip || !videoRef.current) return;
    videoRef.current.currentTime = selectedClip.startSeconds;
    void videoRef.current.play();
  }, [selectedClip]);

  const exportClip = async (clip: CortesClip) => {
    if (!project || exportingClipId) return;
    setExportingClipId(clip.id);
    try {
      const created = await renderCortesClip({ data: { projectId: project.id, clipId: clip.id, captions: captionsEnabled, captionStyle } });
      let latest = await getCortesExportStatus({ data: { exportId: created.exportId } });
      for (let attempt = 0; attempt < 45 && latest.status !== 'completed' && latest.status !== 'failed'; attempt++) {
        setExportResults((current) => ({ ...current, [clip.id]: { status: latest.status } }));
        await new Promise((resolve) => window.setTimeout(resolve, 4000));
        latest = await getCortesExportStatus({ data: { exportId: created.exportId } });
      }
      setExportResults((current) => ({
        ...current,
        [clip.id]: {
          status: latest.status,
          outputUrl: latest.output_url,
          error: latest.error_message,
        },
      }));
    } catch (error) {
      setExportResults((current) => ({
        ...current,
        [clip.id]: { status: 'failed', error: error instanceof Error ? error.message : 'Erro ao exportar.' },
      }));
    } finally {
      setExportingClipId(null);
    }
  };

  const startClip = (clip: CortesClip) => {
    setSelectedClip(clip);
    window.setTimeout(() => {
      if (videoRef.current) videoRef.current.currentTime = clip.startSeconds;
    }, 50);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Scissors size={19} /></span>
            <span>CORTES<span className="text-primary"> AI</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">Admin</Link>
            <Button asChild variant="outline" size="sm"><Link to="/auth">Entrar</Link></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="grid gap-8 overflow-hidden rounded-3xl border bg-card p-6 shadow-sm md:grid-cols-[1.35fr_.65fr] md:p-10">
          <div className="flex flex-col justify-center">
            <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Zap size={13} className="text-primary" /> CORTES AI
            </span>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Transforme vídeos longos em cortes que prendem atenção.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Envie seu vídeo, deixe a IA encontrar os melhores momentos e visualize os cortes sugeridos.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => document.getElementById('novo-projeto')?.scrollIntoView({ behavior: 'smooth' })}>
                <Upload /> Novo projeto
              </Button>
              <Button asChild size="lg" variant="outline"><Link to="/auth">Entrar na conta <ArrowRight /></Link></Button>
            </div>
          </div>
          <div className="flex min-h-64 items-center justify-center rounded-2xl bg-muted/50 p-8">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border bg-background shadow-sm"><Scissors size={34} className="text-primary" /></div>
              <p className="font-semibold">Seu próximo corte começa aqui</p>
              <p className="mt-1 text-sm text-muted-foreground">Upload → Transcrição → IA → cortes</p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardHeader><Icon className="text-primary" size={22} /><CardTitle className="mt-3 text-lg">{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
            </Card>
          ))}
        </section>

        <section id="novo-projeto" className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <CortesUpload onCreated={(created) => { setProject(created); setClips([]); setVideoUrl(null); setSelectedClip(null); }} />
          {project ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {project.status === 'processing' || project.status === 'queued' ? <Loader2 className="animate-spin text-primary" /> : project.status === 'failed' ? <AlertCircle className="text-destructive" /> : <Sparkles className="text-primary" />}
                  {project.status === 'completed' ? 'Cortes encontrados' : project.status === 'failed' ? 'Processamento interrompido' : 'IA processando'}
                </CardTitle>
                <CardDescription className="truncate">{project.fileName}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, project.progress))}%` }} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {project.status === 'completed' ? 'Análise concluída.' : project.status === 'failed' ? (project.errorMessage ?? 'Ocorreu um erro.') : `Processando... ${project.progress}%`}
                </p>
                {project.status === 'completed' && clips.length === 0 && (
                  <p className="mt-4 rounded-xl bg-muted/40 p-4 text-sm">A transcrição terminou, mas a IA não encontrou cortes com tempo suficiente.</p>
                )}
                {loadingResults && project.status !== 'completed' && project.status !== 'failed' && (
                  <p className="mt-4 text-sm text-muted-foreground">Atualizando o status automaticamente...</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <FolderOpen className="mx-auto text-muted-foreground" size={28} />
              <h2 className="mt-3 text-xl font-semibold">Comece seu primeiro projeto</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Escolha um vídeo e clique em “Criar cortes com IA”.</p>
            </div>
          )}
        </section>

        {project?.status === 'completed' && clips.length > 0 && (
          <section className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Scissors className="text-primary" /> Editor vertical</CardTitle>
                <CardDescription>Configure o formato do corte e as legendas antes de gerar o MP4.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-semibold">Formato</p>
                    <p className="mt-1 text-xs text-muted-foreground">O vídeo será exportado em 1080 × 1920.</p>
                    <div className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm font-medium">9:16 · Vertical</div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-semibold">Legendas automáticas</p>
                    <p className="mt-1 text-xs text-muted-foreground">A fala é transcrita automaticamente na renderização.</p>
                    <label className="mt-3 flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={captionsEnabled} onChange={(event) => setCaptionsEnabled(event.target.checked)} />
                      Ativar legendas
                    </label>
                  </div>
                  <div className="rounded-xl border p-4">
                    <label className="text-sm font-semibold" htmlFor="caption-style">Estilo das legendas</label>
                    <select id="caption-style" value={captionStyle} onChange={(event) => setCaptionStyle(event.target.value as typeof captionStyle)} className="mt-3 w-full rounded-lg border bg-background px-3 py-2 text-sm">
                      <option value="highlight">Highlight</option>
                      <option value="karaoke">Karaokê</option>
                      <option value="pop">Pop</option>
                      <option value="bounce">Bounce</option>
                      <option value="slide">Slide</option>
                      <option value="fade">Fade</option>
                      <option value="typewriter">Máquina de escrever</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {project?.status === 'completed' && clips.length > 0 && (
          <section className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Pré-visualização</CardTitle>
                <CardDescription>
                  {selectedClip ? `${selectedClip.title} · ${formatTime(selectedClip.startSeconds)}–${formatTime(selectedClip.endSeconds)}` : 'Selecione um corte para começar.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {videoUrl ? (
                  <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-black shadow-lg"><video ref={videoRef} src={videoUrl} controls className="aspect-[9/16] w-full object-cover" /></div>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-xl bg-muted"><Loader2 className="animate-spin" /></div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  O corte selecionado é reenquadrado em 9:16 e pode ser exportado com legendas automáticas.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Melhores cortes</CardTitle>
                <CardDescription>{clips.length} sugestões encontradas pela IA.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {clips.map((clip, index) => (
                  <div key={clip.id} className="rounded-xl border p-4 transition hover:bg-muted/40">
                    <button
                      type="button"
                      onClick={() => startClip(clip)}
                      className="w-full rounded-lg text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground">CORTE {index + 1}</span>
                          <strong className="mt-1 block">{clip.title}</strong>
                        </div>
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{clip.score}/100</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock3 size={14} /> {formatTime(clip.startSeconds)} – {formatTime(clip.endSeconds)}
                      </div>
                    </button>
                    <div className="mt-3 flex items-center gap-2">
                      <Button type="button" size="sm" onClick={() => void exportClip(clip)} disabled={exportingClipId !== null}>
                        {exportingClipId === clip.id ? <Loader2 className="animate-spin" /> : <Play />}
                        {exportingClipId === clip.id ? 'Renderizando…' : 'Gerar vídeo 9:16'}
                      </Button>
                      {exportResults[clip.id]?.status === 'completed' && exportResults[clip.id]?.outputUrl && (
                        <Button asChild size="sm" variant="outline">
                          <a href={exportResults[clip.id].outputUrl!} target="_blank" rel="noreferrer">Abrir MP4</a>
                        </Button>
                      )}
                    </div>
                    {exportResults[clip.id]?.status === 'rendering' && (
                      <p className="mt-2 text-xs text-muted-foreground">O vídeo está sendo renderizado. Aguarde.</p>
                    )}
                    {exportResults[clip.id]?.status === 'failed' && (
                      <p className="mt-2 text-xs text-destructive">{exportResults[clip.id].error ?? 'Não foi possível gerar o vídeo.'}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        )}

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardDescription>Projetos</CardDescription><CardTitle className="text-3xl">{project ? 1 : 0}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Projetos desta sessão.</p></CardContent></Card>
          <Card><CardHeader><CardDescription>Cortes gerados</CardDescription><CardTitle className="text-3xl">{clips.length}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Sugestões encontradas pela IA.</p></CardContent></Card>
          <Card><CardHeader><CardDescription>Pipeline</CardDescription><CardTitle className="text-3xl">IA</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Upload → transcrição → seleção.</p></CardContent></Card>
        </section>
      </main>
    </div>
  );
}
