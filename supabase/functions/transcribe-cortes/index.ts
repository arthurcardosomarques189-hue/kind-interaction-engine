import { createClient } from "npm:@supabase/supabase-js@2";

type Job = { projectId: string };

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openAiKey = Deno.env.get("OPENAI_API_KEY")!;

const admin = createClient(supabaseUrl, serviceKey);

async function processProject(projectId: string) {
  const { data: project, error } = await admin
    .from("projects")
    .select("id,user_id,video_path")
    .eq("id", projectId)
    .single();

  if (error || !project?.video_path) {
    throw new Error("Projeto ou vídeo não encontrado.");
  }

  await admin.from("projects").update({
    status: "processing",
    progress: 30,
    error_message: null,
  }).eq("id", project.id);

  const { data: video, error: downloadError } = await admin.storage
    .from("cortes-videos")
    .download(project.video_path);

  if (downloadError || !video) {
    throw new Error("Não foi possível baixar o vídeo.");
  }

  const form = new FormData();
  form.append("file", new File([video], "audio-source.mp4", { type: video.type || "video/mp4" }));
  form.append("model", "gpt-4o-mini-transcribe");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAiKey}` },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Falha na transcrição: ${response.status}`);
  }

  const result = await response.json();
  const text = typeof result.text === "string" ? result.text : "";

  const { error: transcriptError } = await admin.from("transcripts").insert({
    project_id: project.id,
    user_id: project.user_id,
    text,
    language: result.language ?? null,
  });

  if (transcriptError) throw transcriptError;

  await admin.from("projects").update({
    status: "completed",
    progress: 100,
    error_message: null,
  }).eq("id", project.id);
}

Deno.serve(async (req) => {
  try {
    const body = await req.json() as Job;
    if (!body.projectId) return new Response("projectId is required", { status: 400 });

    EdgeRuntime.waitUntil(
      processProject(body.projectId).catch(async (error) => {
        await admin.from("projects").update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Erro de processamento",
        }).eq("id", body.projectId);
      })
    );

    return Response.json({ ok: true, projectId: body.projectId, status: "processing" });
  } catch {
    return new Response("Invalid request", { status: 400 });
  }
});
