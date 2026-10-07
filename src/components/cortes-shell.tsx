import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Scissors, LayoutDashboard, Users, Film, Activity, ShieldCheck, LogOut, ArrowUpRight, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getAccount } from '@/lib/admin.functions';

export function CortesShell({ children, section = 'Visão geral', onSection }: { children: ReactNode; section?: string; onSection?: (section: string) => void }) {
  const [account, setAccount] = useState<Awaited<ReturnType<typeof getAccount>> | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const fetchAccount = useServerFn(getAccount);
  const navigate = useNavigate(); const query = useQueryClient(); const router = useRouter();
  useEffect(() => { let live = true; supabase.auth.getUser().then(async ({ data }) => { if (!live) return; setSignedIn(!!data.user); if (data.user) { try { const a = await fetchAccount(); if (live) setAccount(a); } catch { /* Account error stays nonprivileged. */ } } }); return () => { live = false; }; }, [fetchAccount, router.state.location.pathname]);
  async function signOut() { await query.cancelQueries(); query.clear(); await supabase.auth.signOut(); setAccount(null); setSignedIn(false); await navigate({ to: '/auth', replace: true }); }
  const items = [{ name: 'Visão geral', icon: LayoutDashboard }, { name: 'Usuários', icon: Users }, { name: 'Projetos', icon: Film }, { name: 'Uso e custos', icon: Activity }];
  return <div className={`app-layout ${collapsed ? 'nav-collapsed' : ''}`}>
    <aside className="app-sidebar">
      <Link to="/" className="brand"><span className="brand-symbol"><Scissors size={22}/></span><span>CORTES<span className="text-primary"> AI</span></span></Link>
      <div className="workspace-label">WORKSPACE <span>ADMIN</span></div>
      <nav>{items.map(({ name, icon: Icon }) => <Button key={name} variant="ghost" className={`nav-item ${section === name ? 'active' : ''}`} onClick={() => onSection ? onSection(name) : navigate({ to: '/admin' })}><Icon size={18}/><span>{name}</span>{name === 'Visão geral' && <span className="nav-dot"/>}</Button>)}</nav>
      <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={20}/><div>Acesso protegido<small>Exclusivo do proprietário</small></div></div><Button asChild variant="outline" className="w-full"><Link to="/">Ir para o CORTES AI <ArrowUpRight/></Link></Button><div className="sidebar-account"><span className="avatar">{account?.profile.display_name?.slice(0, 1) || 'C'}</span><div><strong>{account?.profile.display_name || (signedIn ? 'Minha conta' : 'Visitante')}</strong><small>{account?.owner ? 'OWNER' : 'CORTES AI'}</small></div>{signedIn && <Button title="Sair" aria-label="Sair" variant="ghost" size="icon" onClick={signOut}><LogOut/></Button>}</div></div>
    </aside>
    <div className="app-body"><header className="app-topbar"><div className="flex items-center gap-3"><Button size="icon" variant="ghost" title="Alternar menu" aria-label="Alternar menu" onClick={() => setCollapsed(!collapsed)}><PanelLeftClose/></Button><span className="text-muted-foreground">Workspace</span><span className="text-muted-foreground">/</span><strong>Administração</strong></div><div className="flex items-center gap-3"><span className="live-label"><i/> Sistema online</span>{account?.owner ? <span className="owner-badge"><ShieldCheck size={13}/> OWNER</span> : <Button asChild variant="outline" size="sm"><Link to="/auth">{signedIn ? 'Minha conta' : 'Entrar'}</Link></Button>}</div></header><main>{children}</main><footer>CORTES AI <span>Controle, clareza e segurança.</span><span>© {new Date().getFullYear()} CORTES AI</span></footer></div>
  </div>;
}