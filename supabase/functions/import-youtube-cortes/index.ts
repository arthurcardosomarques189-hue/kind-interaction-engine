import { createClient } from "npm:@supabase/supabase-js@2";

type Body = { projectId: string; youtubeUrl: string };

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ingestionUrl = Deno.env.get("YOUTUBE_INGEST_URL");
const admin = createClient(supabaseUrl, serviceKey);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function isYouTubeUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Authentication required" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: "Authentication required" }, 401);

    const body = (await req.json()) as Body;
    if (!body.projectId || !body.youtubeUrl || !isYouTubeUrl(body.youtubeUrl)) {
      return jsonResponse({ error: "Cole um link válido do YouTube." }, 400);
    }

    const { data: project } = await admin.from("projects").select("id,user_id,title")
      .eq("id", body.projectId).eq("user_id", user.id).single();
    if (!project) return jsonResponse({ error: "Projeto não encontrado." }, 404);

    if (!ingestionUrl) {
      return jsonResponse({
        error: "O importador do YouTube ainda não está conectado. Configure YOUTUBE_INGEST_URL no Supabase.",
      }, 503);
    }

    await admin.from("projects").update({
      source_type: "youtube",
      source_url: body.youtubeUrl,
      status: "processing",
      progress: 10,
      error_message: null,
    }).eq("id", project.id);

    const providerResponse = await fetch(ingestionUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: body.youtubeUrl, maxFileSizeBytes: 24 * 1024 * 1024, requestedFormat: "mp4" }),
    });

    if (!providerResponse.ok) throw new Error("O provedor de importação não conseguiu preparar este vídeo.");

    const provider = await providerResponse.json() as {
      download_url?: string; file_name?: string; mime_type?: string; title?: string;
    };
    if (!provider.download_url) throw new Error("O provedor não retornou um arquivo de vídeo.");

    const downloadResponse = await fetch(provider.download_url);
    if (!downloadResponse.ok) throw new Error("Não foi possível baixar o vídeo preparado.");
    const video = await downloadResponse.blob();
    if (video.size > 24 * 1024 * 1024) throw new Error("Este MVP aceita vídeos de até 24 MB por processamento.");

    const fileName = (provider.file_name || "youtube-video.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = user.id + "/" + project.id + "/original-" + crypto.randomUUID() + "-" + fileName;

    const { error: uploadError } = await admin.storage.from("cortes-videos").upload(path, video, {
      contentType: provider.mime_type || video.type || "video/mp4", upsert: false,
    });
    if (uploadError) throw new Error("Não foi possível salvar o vídeo importado.");

    const { error: updateError } = await admin.from("projects").update({
      video_path: path, video_name: fileName, video_size: video.size,
      title: (provider.title || project.title).slice(0, 160),
      status: "queued", progress: 15, error_message: null,
    }).eq("id", project.id).eq("user_id", user.id);

    if (updateError) {
      await admin.storage.from("cortes-videos").remove([path]);
      throw new Error("O vídeo foi importado, mas o projeto não pôde ser finalizado.");
    }

    const { error: invokeError } = await admin.functions.invoke("transcribe-cortes", {
      body: { projectId: project.id }, headers: { Authorization: authHeader },
    });
    if (invokeError) throw new Error("O vídeo foi importado, mas a análise de IA não pôde ser iniciada.");

    return jsonResponse({ ok: true, projectId: project.id, status: "processing" });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Falha na importação." }, 500);
  }
});
