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

    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase não configurado.');
    if (!shotstackKey) throw new Error('Motor de vídeo não configurado. Adicione SHOTSTACK_API_KEY aos secrets.');

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: claimsData, error: claimsError } = await admin.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return json({ error: 'Sessão inválida.' }, 401);

    const userId = claimsData.claims.sub as string;
    const body = await req.json();
    const projectId = String(body.projectId ?? '');
    const clipId = String(body.clipId ?? '');
    const captions = body.captions !== false;
    const captionStyle = ['highlight', 'karaoke', 'pop', 'fade', 'slide', 'bounce', 'typewriter', 'none'].includes(body.captionStyle) ? body.captionStyle : 'highlight';

    if (!projectId || !clipId) return json({ error: 'Projeto e corte são obrigatórios.' }, 400);

    const { data: clip, error: clipError } = await admin
      .from('clips')
      .select('id,project_id,user_id,title,start_seconds,end_seconds')
      .eq('id', clipId)
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (clipError || !clip) return json({ error: 'Corte não encontrado.' }, 404);

    const { data: project, error: projectError } = await admin
      .from('projects')
      .select('id,video_path')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project?.video_path) return json({ error: 'Vídeo original não encontrado.' }, 404);

    const start = Math.max(0, Number(clip.start_seconds));
    const length = Math.max(1, Number(clip.end_seconds) - start);

    const { data: signed, error: signedError } = await admin.storage
      .from('cortes-videos')
      .createSignedUrl(project.video_path, 60 * 60);

    if (signedError || !signed?.signedUrl) throw new Error('Não foi possível preparar o vídeo para renderização.');

    const { data: exportRow, error: exportError } = await admin
      .from('exports')
      .insert({
        project_id: projectId,
        clip_id: clipId,
        user_id: userId,
        provider: 'shotstack',
        status: 'queued',
      })
      .select('*')
      .single();

    if (exportError || !exportRow) throw new Error('Não foi possível criar a exportação.');

    const renderResponse = await fetch('https://api.shotstack.io/edit/v1/render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': shotstackKey,
      },
      body: JSON.stringify({
        timeline: {
          tracks: [
            ...(captions ? [{
              clips: [{
                asset: {
                  type: 'rich-caption',
                  src: 'alias://source-video',
                  font: { family: 'Arial', size: 68, color: '#ffffff', weight: 700 },
                  align: { vertical: 'bottom' },
                  stroke: { width: 4, color: '#000000', opacity: 1 },
                  animation: { style: captionStyle },
                  active: { font: { color: '#ffe600' } },
                },
                start: 0,
                length: 'end',
                width: 900,
                height: 400,
                offset: { x: 0, y: 0.28 },
              }],
            }] : []),
            {
              clips: [{
                alias: 'source-video',
                asset: { type: 'video', src: signed.signedUrl, trim: start },
                start: 0,
                length,
                fit: 'crop',
              }],
            },
          ],
        },
        output: {
          format: 'mp4',
          size: { width: 1080, height: 1920 },
          fps: 30,
          quality: 70,
        },
      }),
    });

    const renderJson = await renderResponse.json();
    if (!renderResponse.ok || !renderJson?.response?.id) {
      await admin.from('exports').update({
        status: 'failed',
        error_message: renderJson?.message ?? renderJson?.response?.message ?? 'Falha ao enviar renderização.',
        updated_at: new Date().toISOString(),
      }).eq('id', exportRow.id);
      throw new Error(renderJson?.message ?? 'Falha ao enviar renderização.');
    }

    await admin.from('exports').update({
      render_id: renderJson.response.id,
      status: 'rendering',
      updated_at: new Date().toISOString(),
    }).eq('id', exportRow.id);

    return json({ ok: true, exportId: exportRow.id, renderId: renderJson.response.id });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro ao renderizar vídeo.' }, 500);
  }
});
