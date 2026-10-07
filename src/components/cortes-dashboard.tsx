import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Upload, Scissors, Sparkles, FolderOpen, Clock3, Play, ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
  { icon: Sparkles, title: 'Encontre os melhores momentos', description: 'A IA identifica trechos com maior potencial de retenção.' },
  { icon: Scissors, title: 'Gere vários cortes', description: 'Transforme um vídeo longo em vários clipes prontos para editar.' },
  { icon: Play, title: 'Formato vertical', description: 'Prepare seus cortes para Shorts, Reels e TikTok em 9:16.' },
];

export function CortesDashboard() {
  const [showInfo, setShowInfo] = useState(false);

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
              Envie seu vídeo, deixe a IA encontrar os melhores momentos e organize seus cortes em um único lugar.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => setShowInfo(true)}><Upload /> Novo projeto</Button>
              <Button asChild size="lg" variant="outline"><Link to="/auth">Entrar na conta <ArrowRight /></Link></Button>
            </div>
            {showInfo && (
              <div role="status" className="mt-4 rounded-xl border bg-muted/40 p-4 text-sm">
                <strong>Próxima etapa:</strong> conectaremos o upload e o processamento real do vídeo ao backend do CORTES AI.
              </div>
            )}
          </div>
          <div className="flex min-h-64 items-center justify-center rounded-2xl bg-muted/50 p-8">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border bg-background shadow-sm"><Scissors size={34} className="text-primary" /></div>
              <p className="font-semibold">Seu próximo corte começa aqui</p>
              <p className="mt-1 text-sm text-muted-foreground">Upload → IA → cortes → exportação</p>
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

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardDescription>Projetos</CardDescription><CardTitle className="text-3xl">0</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Seus projetos aparecerão aqui.</p></CardContent></Card>
          <Card><CardHeader><CardDescription>Cortes gerados</CardDescription><CardTitle className="text-3xl">0</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Ainda não há cortes processados.</p></CardContent></Card>
          <Card><CardHeader><CardDescription>Tempo economizado</CardDescription><CardTitle className="flex items-center gap-2 text-3xl">0 <Clock3 size={22} /></CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Calcularemos após os primeiros processamentos.</p></CardContent></Card>
        </section>

        <section className="mt-8 rounded-2xl border border-dashed p-8 text-center">
          <FolderOpen className="mx-auto text-muted-foreground" size={28} />
          <h2 className="mt-3 text-xl font-semibold">Ainda não há projetos</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Quando o pipeline de processamento estiver conectado, seus vídeos e cortes ficarão organizados nesta área.</p>
        </section>
      </main>
    </div>
  );
}
