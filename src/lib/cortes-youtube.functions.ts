import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { normalizeYouTubeUrl } from '@/lib/cortes-video-input';

const input = z.object({ youtubeUrl: z.string().url() });

export const createYouTubeCortesProject = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input)
  .handler(async ({ data, context }) => {
    const sourceUrl = normalizeYouTubeUrl(data.youtubeUrl);
    if (!sourceUrl) throw new Error('Cole um link válido de um vídeo do YouTube.');
    if (!process.env['YOUTUBE_INGEST_URL']) {
      throw new Error('A importação do YouTube aguarda a conexão do serviço de importação. Você já pode enviar um arquivo de vídeo.');
    }
    const { data: project, error } = await context.supabase.from('projects').insert({
      title: 'Vídeo do YouTube',
      user_id: context.userId,
      status: 'queued',
      cuts: 0,
      minutes: 0,
      source_type: 'youtube',
      source_url: sourceUrl,
    }).select('*').single();

    if (error || !project) throw new Error('Não foi possível criar o projeto do YouTube.');

    const { error: invokeError } = await context.supabase.functions.invoke('import-youtube-cortes', {
      body: { projectId: project.id, youtubeUrl: sourceUrl },
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
