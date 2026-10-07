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

    const openAiKey = process.env.OPENAI_API_KEY;
    if (!openAiKey) {
      throw new Error('O motor de IA ainda não está configurado. Adicione OPENAI_API_KEY no ambiente seguro do servidor.');
    }

    const { error: updateError } = await context.supabase
      .from('projects')
      .update({ status: 'processing', progress: 20, error_message: null })
      .eq('id', project.id)
      .eq('user_id', context.userId);

    if (updateError) throw new Error('Não foi possível iniciar o processamento.');

    return {
      ok: true,
      projectId: project.id,
      status: 'processing',
      provider: 'openai',
      transcriptionModel: 'gpt-4o-mini-transcribe',
    };
  });
