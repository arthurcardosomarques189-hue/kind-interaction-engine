import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const auth = [requireSupabaseAuth];

export const createCortesCheckout = createServerFn({ method: 'POST' })
  .middleware(auth)
  .inputValidator(z.object({ planId: z.enum(['creator','pro','studio']) }))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.functions.invoke('create-mp-checkout', { body: data });
    if (error) throw new Error(error.message || 'Não foi possível iniciar o pagamento.');
    if (result?.error) throw new Error(result.error);
    return result as { checkout_url: string; subscription_id: string };
  });

export const generateCortesMedia = createServerFn({ method: 'POST' })
  .middleware(auth)
  .inputValidator(z.object({ kind: z.enum(['image','video']), prompt: z.string().min(3), projectId: z.string().uuid().optional(), inputImagePath: z.string().optional() }))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.functions.invoke('generate-media', { body: data });
    if (error) throw new Error(error.message || 'Não foi possível gerar a mídia.');
    if (result?.error) throw new Error(result.error);
    return result;
  });

export const checkCortesMedia = createServerFn({ method: 'POST' })
  .middleware(auth)
  .inputValidator(z.object({ mediaJobId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.functions.invoke('check-media-generation', { body: data });
    if (error) throw new Error(error.message || 'Não foi possível verificar a geração da mídia.');
    if (result?.error) throw new Error(result.error);
    return result;
  });

export const startCortesDubbing = createServerFn({ method: 'POST' })
  .middleware(auth)
  .inputValidator(z.object({ projectId: z.string().uuid(), sourceLanguage: z.string().min(2), targetLanguage: z.string().min(2) }))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.functions.invoke('dubbing-cortes', { body: data });
    if (error) throw new Error(error.message || 'Não foi possível iniciar a dublagem.');
    if (result?.error) throw new Error(result.error);
    return result;
  });

export const publishCortes = createServerFn({ method: 'POST' })
  .middleware(auth)
  .inputValidator(z.object({ publicationId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.functions.invoke('publish-cortes', { body: data });
    if (error) throw new Error(error.message || 'Não foi possível publicar.');
    if (result?.error) throw new Error(result.error);
    return result;
  });
