import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const input = z.object({ title: z.string().trim().min(1).max(160) });

export const createCortesProject = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input)
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase.from('projects').insert({
      title: data.title,
      user_id: context.userId,
      status: 'queued',
      cuts: 0,
      minutes: 0,
    }).select('*').single();
    if (error || !project) throw new Error('Não foi possível criar o projeto.');
    return project;
  });
