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

    const { data: creditsReserved, error: creditsError } = await context.supabase.rpc('reserve_processing_credits', {
      target: context.userId,
      amount: 5,
    });

    if (creditsError) throw new Error('Não foi possível validar seus créditos.');
    if (!creditsReserved) throw new Error('Você não possui créditos suficientes para processar este vídeo.');

    const { error: updateError } = await context.supabase
      .from('projects')
      .update({ status: 'queued', progress: 15, error_message: null })
      .eq('id', project.id)
      .eq('user_id', context.userId);

    if (updateError) {
      await context.supabase.rpc('refund_processing_for_project', {
        target: context.userId,
        project_id: project.id,
        amount: 5,
        reason: 'processing_queue_failed',
      });
      throw new Error('Não foi possível colocar o projeto na fila.');
    }

    const { data: functionResult, error: functionError } =
      await context.supabase.functions.invoke('transcribe-cortes', {
        body: { projectId: project.id },
      });

    if (functionError) {
      await context.supabase
        .from('projects')
        .update({ status: 'failed', error_message: functionError.message })
        .eq('id', project.id)
        .eq('user_id', context.userId);

      await context.supabase.rpc('refund_processing_for_project', {
        target: context.userId,
        project_id: project.id,
        amount: 5,
        reason: 'processing_start_failed',
      });

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
