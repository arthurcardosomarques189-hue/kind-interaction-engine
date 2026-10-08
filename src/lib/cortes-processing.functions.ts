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

    const { data: creditsReserved, error: creditsError } = await context.supabase.rpc('reserve_project_processing', {
      project_id: project.id,
    });

    if (creditsError) throw new Error('Não foi possível validar seus créditos.');
    if (!creditsReserved) throw new Error('Este projeto já foi enviado para processamento.');

    const { data: functionResult, error: functionError } =
      await context.supabase.functions.invoke('transcribe-cortes', {
        body: { projectId: project.id },
      });

    if (functionError) {
      // Ownership was verified above; privileged writes handle failure and refund
      // together without giving browser callers permission to mint credits.
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { error: failureError } = await supabaseAdmin
        .from('projects')
        .update({ status: 'failed', error_message: functionError.message })
        .eq('id', project.id)
        .eq('user_id', context.userId);

      if (failureError) throw new Error('Não foi possível registrar a falha do processamento.');
      const { error: refundError } = await supabaseAdmin.rpc('refund_processing_for_project', {
        target: context.userId,
        project_id: project.id,
        amount: 5,
        reason: 'processing_start_failed',
      });

      if (refundError) throw new Error('O processamento falhou e o estorno não pôde ser confirmado.');

      throw new Error('Não foi possível iniciar o motor de transcrição.');
    }

    return {
      ok: true,
      projectId: project.id,
      status: functionResult?.status ?? 'processing',
      provider: 'openai',
      transcriptionModel: 'gpt-4o-mini-transcribe',
    };
  });
