import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Scissors, ShieldCheck, ArrowLeft, ArrowRight } from 'lucide-react';
import { lovable } from '@/integrations/lovable';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { pageHead } from '@/lib/metadata';
import studio from '@/assets/studio.jpg';

export const Route = createFileRoute('/auth')({ head: () => pageHead('Acesse sua conta', 'Entre com segurança na sua conta CORTES AI.'), component: Auth });
function Auth() {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const navigate = useNavigate();
  useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: '/admin', replace: true }); }); }, [navigate]);
  async function signIn() { setBusy(true); setError(''); try { const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: `${window.location.origin}/auth` }); if (result.error) { setError('Não foi possível entrar com Google. Tente novamente.'); return; } if (!result.redirected) await navigate({ to: '/admin' }); } catch { setError('Não foi possível entrar. Tente novamente.'); } finally { setBusy(false); } }
  return <main className="auth-page"><img src={studio} alt="Estúdio CORTES AI" width={1536} height={1024}/><div className="auth-inner"><Link to="/" className="auth-back"><ArrowLeft size={16}/> Voltar</Link><div className="brand"><span className="brand-symbol"><Scissors size={22}/></span>CORTES<span className="text-primary">AI</span></div><div className="eyebrow">BEM-VINDO AO SEU WORKSPACE</div><h1>Acesse sua conta.</h1><p>Seu espaço de criação e controle.</p><Button onClick={signIn} disabled={busy} className="auth-google" variant="outline"><span className="google-mark">G</span>{busy ? 'Conectando…' : 'Continuar com Google'}<ArrowRight/></Button>{error && <p role="alert" className="text-destructive">{error}</p>}<div className="auth-secure"><ShieldCheck size={17}/> Acesso seguro. Administração restrita ao proprietário.</div></div></main>;
}