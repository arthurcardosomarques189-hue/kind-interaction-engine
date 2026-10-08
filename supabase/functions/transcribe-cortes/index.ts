import { createClient } from "npm:@supabase/supabase-js@2";

type Job = { projectId: string };

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY_OLD")!;
const assemblyKey = Deno.env.get("ASSEMBLYAI_API_KEY");
const webhookSecret = Deno.env.get("ASSEMBLYAI_WEBHOOK_SECRET");
const admin = createClient(supabaseUrl, serviceKey);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
    if (!assemblyKey) {
      return jsonResponse({
        error: "A transcrição de vídeos grandes ainda não está configurada. Configure ASSEMBLYAI_API_KEY no Supabase.",
      }, 503);
    }

    const body = (await req.json()) as Job;
    if (!body.projectId) return jsonResponse({ error: "projectId is required" }, 400);

    const { data: project, error } = await admin
      .from("projects")
      .select("id,user_id,video_path")
      .eq("id", body.projectId)
      .single();

    if (error || !project?.video_path) {
      throw new Error("Projeto ou vídeo não encontrado.");
    }

    const { data: signed, error: signedError } = await admin.storage
      .from("cortes-videos")
      .createSignedUrl(project.video_path, 24 * 60 * 60);

    if (signedError || !signed?.signedUrl) {
      throw new Error("Não foi possível preparar o vídeo para a transcrição.");
    }

    const webhookUrl = new URL(
      "/functions/v1/assemblyai-transcription-webhook",
      supabaseUrl,
    ).toString();

    const response = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        authorization: assemblyKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        audio_url: signed.signedUrl,
        speech_models: ["universal-3-pro", "universal-2"],
        webhook_url: webhookUrl,
        webhook_auth_header_name: "X-AssemblyAI-Webhook-Secret",
        webhook_auth_header_value: webhookSecret ?? "",
        language_detection: true,
        punctuate: true,
        format_text: true,
      }),
    });

    const provider = await response.json().catch(() => null);
    if (!response.ok || !provider?.id) {
      throw new Error(
        "Falha ao enviar o vídeo para a transcrição: " +
          (provider?.error ?? response.status),
      );
    }

    await admin
      .from("projects")
      .update({
        status: "processing",
        progress: 30,
        transcription_provider: "assemblyai",
        transcription_job_id: provider.id,
        transcription_status: provider.status ?? "queued",
        error_message: null,
      })
      .eq("id", project.id);

    return jsonResponse({
      ok: true,
      projectId: project.id,
      status: "processing",
      provider: "assemblyai",
      transcriptionJobId: provider.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na transcrição";
    return jsonResponse({ error: message }, 500);
  }
});
