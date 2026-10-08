import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const input = z.object({ projectId: z.string().uuid(), clipId: z.string().uuid() });

export const renderCortesClip = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input)
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.functions.invoke('render-cortes', {
      body: data,
    });

    if (error) throw new Error(error.message || 'Não foi possível iniciar a exportação.');
    if (!result?.ok) throw new Error(result?.error || 'Não foi possível iniciar a exportação.');

    return result;
  });

export const getCortesExportStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ exportId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: exportRow, error } = await context.supabase
      .from('exports')
      .select('id,status,render_id,output_url,error_message,updated_at')
      .eq('id', data.exportId)
      .eq('user_id', context.userId)
      .single();

    if (error || !exportRow) throw new Error('Exportação não encontrada.');

    if (exportRow.status === 'rendering' && exportRow.render_id) {
      const shotstackKey = process.env['SHOTSTACK_API_KEY'];
      if (shotstackKey) {
        const response = await fetch(`https://api.shotstack.io/edit/v1/render/${exportRow.render_id}`, {
          headers: { Accept: 'application/json', 'x-api-key': shotstackKey },
        });
        const payload = await response.json();
        const renderStatus = payload?.response?.status;
        const outputUrl = payload?.response?.url;

        if (renderStatus === 'done' && outputUrl) {
          await context.supabase
            .from('exports')
            .update({ status: 'completed', output_url: outputUrl, updated_at: new Date().toISOString() })
            .eq('id', exportRow.id)
            .eq('user_id', context.userId);
          return { ...exportRow, status: 'completed', output_url: outputUrl };
        }

        if (renderStatus === 'failed') {
          const message = payload?.response?.error ?? 'A renderização falhou.';
          await context.supabase
            .from('exports')
            .update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() })
            .eq('id', exportRow.id)
            .eq('user_id', context.userId);
          return { ...exportRow, status: 'failed', error_message: message };
        }

        return { ...exportRow, status: renderStatus ?? 'rendering' };
      }
    }

    return exportRow;
  });
