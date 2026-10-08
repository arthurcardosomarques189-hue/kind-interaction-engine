import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Archive, Clock3, Download, Loader2, Scissors, Video, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

type ProjectRow = {
  id: string;
  title: string;
  status: string;
  progress: number;
  cuts: number;
  created_at: string;
  video_name: string | null;
};

type ExportRow = {
  id: string;
  project_id: string;
  clip_id: string;
  status: string;
  output_path: string | null;
  created_at: string;
  error_message: string | null;
};

type ClipRow = { id: string; title: string; start_seconds: number; end_seconds: number; score: number };

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatTime(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function CortesHistory() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [exports, setExports] = useState<ExportRow[]>([]);
  const [clips, setClips] = useState<Record<string, ClipRow>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [{ data: projectRows }, { data: exportRows }, { data: clipRows }] = await Promise.all([
        supabase.from('projects').select('id,title,status,progress,cuts,created_at,video_name').order('created_at', { ascending: false }).limit(50),
        supabase.from('exports').select('id,project_id,clip_id,status,output_path,created_at,error_message').order('created_at', { ascending: false }).limit(100),
        supabase.from('clips').select('id,title,start_seconds,end_seconds,score').order('created_at', { ascending: false }).limit(200),
      ]);
      if (cancelled) return;
      setProjects((projectRows ?? []) as ProjectRow[]);
      setExports((exportRows ?? []) as ExportRow[]);
      setClips(Object.fromEntries(((clipRows ?? []) as ClipRow[]).map((clip) => [clip.id, clip])));
      setLoading(false);

      const completed = (exportRows ?? []).filter((item) => item.status === 'completed' && item.output_path) as ExportRow[];
      const signed = await Promise.all(completed.map(async (item) => {
        const { data } = await supabase.storage.from('cortes-videos').createSignedUrl(item.output_path!, 60 * 60);
        return [item.id, data?.signedUrl ?? ''] as const;
      }));
      if (!cancelled) setUrls(Object.fromEntries(signed.filter(([, url]) => url)));
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Scissors size={19} /></span>
            <span>CORTES<span className="text-primary"> AI</span></span>
          </Link>
          <Button asChild variant="outline" size="sm"><Link to="/"><ArrowLeft /> Novo projeto</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <p className="text-sm font-semibold text-primary">BIBLIOTECA</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Meus projetos</h1>
          <p className="mt-2 text-muted-foreground">Histórico dos projetos e dos vídeos MP4 exportados.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border p-12"><Loader2 className="animate-spin text-primary" /></div>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Archive className="mx-auto text-muted-foreground" size={36} />
              <h2 className="mt-4 text-xl font-semibold">Nenhum projeto ainda</h2>
              <p className="mt-2 text-sm text-muted-foreground">Crie seu primeiro projeto para ele aparecer aqui.</p>
              <Button asChild className="mt-6"><Link to="/">Criar projeto</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5">
            {projects.map((project) => {
              const projectExports = exports.filter((item) => item.project_id === project.id);
              return (
                <Card key={project.id} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <CardTitle>{project.title}</CardTitle>
                        <CardDescription className="mt-1 flex items-center gap-2"><Clock3 size={14} /> {formatDate(project.created_at)} {project.video_name ? `· ${project.video_name}` : ''}</CardDescription>
                      </div>
                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{project.status === 'completed' ? 'Concluído' : project.status === 'failed' ? 'Falhou' : `${project.progress}%`}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Cortes</p><p className="mt-1 text-2xl font-bold">{project.cuts}</p></div>
                      <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Exportações</p><p className="mt-1 text-2xl font-bold">{projectExports.length}</p></div>
                      <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Status</p><p className="mt-2 font-semibold">{project.status === 'completed' ? 'Pronto para usar' : 'Em processamento'}</p></div>
                    </div>

                    {projectExports.length > 0 && (
                      <div className="mt-5 space-y-3">
                        <p className="text-sm font-semibold">Vídeos exportados</p>
                        {projectExports.map((item) => {
                          const clip = clips[item.clip_id];
                          const url = urls[item.id];
                          return (
                            <div key={item.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="font-medium">{clip?.title ?? 'Corte exportado'}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {clip ? `${formatTime(clip.start_seconds)} – ${formatTime(clip.end_seconds)} · score ${clip.score}/100` : 'MP4 vertical'}
                                </p>
                              </div>
                              {item.status === 'completed' && url ? (
                                <Button asChild size="sm"><a href={url} target="_blank" rel="noreferrer"><Download /> Abrir MP4</a></Button>
                              ) : item.status === 'failed' ? (
                                <span className="text-xs text-destructive">{item.error_message ?? 'Exportação falhou'}</span>
                              ) : (
                                <span className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Renderizando…</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><Video size={16} /> Os links MP4 são assinados temporariamente para manter os vídeos privados.</div>
      </main>
    </div>
  );
}
