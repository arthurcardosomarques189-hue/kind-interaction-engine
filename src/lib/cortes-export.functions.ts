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
    const { data: result, error } = await context.supabase.functions.invoke('check-cortes-export', {
      body: { exportId: data.exportId },
    });

    if (error) throw new Error(error.message || 'Não foi possível consultar a exportação.');
    if (result?.error) throw new Error(result.error);
    return result;
  });
