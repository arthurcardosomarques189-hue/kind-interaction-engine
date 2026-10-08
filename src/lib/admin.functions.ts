import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

export const getAccount = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: profile, error } = await context.supabase.from('profiles').select('*').eq('id', context.userId).single();
  if (error) throw new Error('Não foi possível carregar sua conta.');
  const { data: owner, error: roleError } = await context.supabase.rpc('is_owner');
  if (roleError) throw new Error('Não foi possível verificar suas permissões.');
  return { profile, owner: owner === true };
});

export const getAdminData = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: owner, error } = await context.supabase.rpc('is_owner');
  if (error || owner !== true) throw new Error('Você não tem permissão para acessar esta área.');
  const [profiles, projects, usage, payments] = await Promise.all([
    context.supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    context.supabase.from('projects').select('*').order('created_at', { ascending: false }),
    context.supabase.from('usage_events').select('*').order('created_at', { ascending: false }),
    context.supabase.from('payments').select('*').eq('status', 'paid'),
  ]);
  if (profiles.error || projects.error || usage.error || payments.error) throw new Error('Não foi possível carregar os dados.');
  return { profiles: profiles.data ?? [], projects: projects.data ?? [], usage: usage.data ?? [], payments: payments.data ?? [] };
});

export const updateAdminUser = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ target: z.string().uuid(), credit_delta: z.number().int().default(0), new_plan: z.enum(['Free', 'Starter', 'Pro', 'Business']).optional(), new_suspended: z.boolean().optional() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('admin_update_user', {
      target: data.target,
      credit_delta: data.credit_delta,
      ...(data.new_plan !== undefined ? { new_plan: data.new_plan } : {}),
      ...(data.new_suspended !== undefined ? { new_suspended: data.new_suspended } : {}),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });