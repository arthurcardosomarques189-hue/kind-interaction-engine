import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autorizado.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY_OLD');
    const shotstackKey = Deno.env.get('SHOTSTACK_API_KEY');
    if (!supabaseUrl || !serviceRoleKey || !shotstackKey) throw new Error('Motor de vídeo não configurado.');

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: claimsData, error: claimsError } = await admin.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return json({ error: 'Sessão inválida.' }, 401);

    const userId = claimsData.claims.sub as string;
    const body = await req.json();
    const exportId = String(body.exportId ?? '');

    const { data: exportRow, error: exportError } = await admin
      .from('exports')
      .select('*')
      .eq('id', exportId)
      .eq('user_id', userId)
      .single();

    if (exportError || !exportRow) return json({ error: 'Exportação não encontrada.' }, 404);
    if (!exportRow.render_id || exportRow.status === 'completed' || exportRow.status === 'failed') return json(exportRow);

    const response = await fetch(`https://api.shotstack.io/edit/v1/render/${exportRow.render_id}`, {
      headers: { Accept: 'application/json', 'x-api-key': shotstackKey },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.message ?? 'Não foi possível consultar a renderização.');

    const renderStatus = payload?.response?.status;
    const outputUrl = payload?.response?.url;

    if (renderStatus === 'done' && outputUrl) {
      const outputPath = exportRow.output_path ?? `${userId}/${exportRow.project_id}/exports/${exportId}.mp4`;
      const download = await fetch(outputUrl);
      if (!download.ok) throw new Error('Não foi possível baixar o MP4 renderizado.');
      const outputBlob = await download.blob();

      const { error: uploadError } = await admin.storage
        .from('cortes-videos')
        .upload(outputPath, outputBlob, {
          contentType: 'video/mp4',
          upsert: true,
        });
      if (uploadError) throw new Error('Não foi possível salvar o MP4 renderizado.');

      const { data: signedOutput, error: signedError } = await admin.storage
        .from('cortes-videos')
        .createSignedUrl(outputPath, 60 * 60 * 24);
      if (signedError || !signedOutput?.signedUrl) throw new Error('Não foi possível criar o link seguro do MP4.');

      const { data: updated } = await admin.from('exports').update({
        status: 'completed',
        output_url: signedOutput.signedUrl,
        output_path: outputPath,
        updated_at: new Date().toISOString(),
      }).eq('id', exportId).eq('user_id', userId).select('*').single();
      return json(updated ?? { ...exportRow, status: 'completed', output_url: signedOutput.signedUrl, output_path: outputPath });
    }

    if (renderStatus === 'failed') {
      const message = payload?.response?.error ?? 'A renderização falhou.';
      const { data: updated } = await admin.from('exports').update({
        status: 'failed',
        error_message: message,
        updated_at: new Date().toISOString(),
      }).eq('id', exportId).eq('user_id', userId).select('*').single();
      return json(updated ?? { ...exportRow, status: 'failed', error_message: message });
    }

    return json({ ...exportRow, status: renderStatus ?? 'rendering' });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro ao consultar exportação.' }, 500);
  }
});
