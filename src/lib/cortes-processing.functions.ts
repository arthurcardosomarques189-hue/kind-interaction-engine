import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const input = z.object({ projectId: z.string().uuid() });

export const queueCortesProcessing = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input)
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase
      .from('projects')
      .select('*')
      .eq('id', data.projectId)
      .eq('user_id', context.userId)
      .single();

    if (error || !project) throw new Error('Projeto não encontrado.');
    if (!project.video_path) throw new Error('Este projeto ainda não possui um vídeo.');

    const { error: updateError } = await context.supabase
      .from('projects')
      .update({ status: 'queued', progress: 15, error_message: null })
      .eq('id', project.id)
      .eq('user_id', context.userId);

    if (updateError) throw new Error('Não foi possível colocar o projeto na fila.');

    return { ok: true, projectId: project.id, status: 'queued' };
  });
