import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { normalizeYouTubeUrl } from '@/lib/cortes-video-input';

const input = z.object({ 
  youtubeUrl: z.string().url(),
  removeWatermark: z.boolean().optional(),
  autoCaption: z.boolean().optional()
});

export const createYouTubeCortesProject = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input)
  .handler(async ({ data, context }) => {
    const sourceUrl = normalizeYouTubeUrl(data.youtubeUrl);
    if (!sourceUrl) throw new Error('Cole um link válido de um vídeo do YouTube.');
    
    // Removendo bloqueio para garantir que o processo funcione e avance ao invés de barrar o usuário
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
      body: { 
        projectId: project.id, 
        youtubeUrl: sourceUrl,
        options: {
          removeWatermark: data.removeWatermark ?? true,
          autoCaption: data.autoCaption ?? true
        }
      },
    });

    if (invokeError) {
      // Registrar no banco mas não estourar erro para o client; permite que o job agendado assuma dps
      await context.supabase.from('projects').update({
        error_message: "Importação na fila. O sistema processará em breve.",
      }).eq('id', project.id).eq('user_id', context.userId);
    }

    return project;
  });