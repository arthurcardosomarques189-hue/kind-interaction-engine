import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const input = z.object({ youtubeUrl: z.string().url() });

export const createYouTubeCortesProject = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input)
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase.from('projects').insert({
      title: 'Vídeo do YouTube',
      user_id: context.userId,
      status: 'queued',
      cuts: 0,
      minutes: 0,
      source_type: 'youtube',
      source_url: data.youtubeUrl,
    }).select('*').single();

    if (error || !project) throw new Error('Não foi possível criar o projeto do YouTube.');

    const { error: invokeError } = await context.supabase.functions.invoke('import-youtube-cortes', {
      body: { projectId: project.id, youtubeUrl: data.youtubeUrl },
    });

    if (invokeError) {
      await context.supabase.from('projects').update({
        status: 'failed',
        error_message: invokeError.message,
      }).eq('id', project.id).eq('user_id', context.userId);
      throw new Error(invokeError.message || 'Não foi possível iniciar a importação do YouTube.');
    }

    return project;
  });
