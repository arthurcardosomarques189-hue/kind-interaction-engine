import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const runwayKey = Deno.env.get("RUNWAYML_API_SECRET");
const db = createClient(url, serviceKey);

function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function saveOutput(userId: string, mediaJobId: string, outputUrl: string) {
  const response = await fetch(outputUrl);
  if (!response.ok) throw new Error(`Could not download Runway output: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const path = `${userId}/generated/${mediaJobId}.mp4`;
  const { error } = await db.storage.from("cortes-videos").upload(path, bytes, {
    contentType: "video/mp4", upsert: true,
  });
  if (error) throw new Error(error.message);
  return path;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!runwayKey) return errorResponse("RUNWAYML_API_SECRET is not configured", 503);

  const auth = req.headers.get("Authorization");
  if (!auth) return errorResponse("Unauthorized", 401);
  const userDb = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const body = await req.json() as { mediaJobId?: string };
  if (!body.mediaJobId) return errorResponse("mediaJobId is required");

  const { data: mediaJob } = await db.from("cortes_media_jobs")
    .select("id,user_id,kind,provider,provider_job_id,status")
    .eq("id", body.mediaJobId).eq("user_id", user.id).maybeSingle();

  if (!mediaJob) return errorResponse("Media job not found", 404);
  if (mediaJob.kind !== "video" || mediaJob.provider !== "runway") {
    return errorResponse("Media job is not a Runway video job");
  }
  if (!mediaJob.provider_job_id) return errorResponse("Runway task id is missing", 409);

  const response = await fetch(
    `https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(mediaJob.provider_job_id)}`,
    { headers: { Authorization: `Bearer ${runwayKey}`, "X-Runway-Version": "2024-11-06" } },
  );
  if (!response.ok) return errorResponse("Could not retrieve Runway task", 502);

  const task = await response.json();
  const status = task.status as string;

  if (status === "FAILED" || status === "CANCELED") {
    const message = String(task.failure || task.failureCode || `Runway task ${status.toLowerCase()}`);
    await db.from("cortes_media_jobs").update({
      status: "failed", error_message: message.slice(0, 4000),
    }).eq("id", mediaJob.id);
    return Response.json({ id: mediaJob.id, status: "failed", error: message });
  }

  if (status !== "SUCCEEDED") {
    return Response.json({ id: mediaJob.id, status: "processing", providerStatus: status });
  }

  const outputUrl = task.output?.[0];
  if (!outputUrl) return errorResponse("Runway task succeeded without an output URL", 502);

  try {
    const outputPath = await saveOutput(user.id, mediaJob.id, outputUrl);
    const { data: updated, error } = await db.from("cortes_media_jobs").update({
      status: "completed", output_path: outputPath, completed_at: new Date().toISOString(),
    }).eq("id", mediaJob.id).select().single();
    if (error) return errorResponse(error.message, 500);
    return Response.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not store generated video";
    await db.from("cortes_media_jobs").update({
      status: "failed", error_message: message.slice(0, 4000),
    }).eq("id", mediaJob.id);
    return errorResponse(message, 500);
  }
});
