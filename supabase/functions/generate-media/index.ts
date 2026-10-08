import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const openaiKey = Deno.env.get("OPENAI_API_KEY");
const videoProviderUrl = Deno.env.get("VIDEO_GENERATION_URL");
const videoProviderKey = Deno.env.get("VIDEO_GENERATION_API_KEY");
const db = createClient(url, serviceKey);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization");
  if (!auth) return new Response("Unauthorized", { status: 401 });
  const userDb = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { kind?: "image"|"video"; prompt?: string; projectId?: string; inputImagePath?: string };
  if (!body.kind || !body.prompt?.trim()) return Response.json({ error: "kind and prompt are required" }, { status: 400 });

  if (body.projectId) {
    const { data: project } = await db.from("projects").select("id").eq("id", body.projectId).eq("user_id", user.id).maybeSingle();
    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  }

  if (body.kind === "image") {
    if (!openaiKey) return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-2", prompt: body.prompt, size: "1024x1024", n: 1 })
    });
    if (!response.ok) return Response.json({ error: await response.text() }, { status: 502 });
    const result = await response.json();
    const item = result.data?.[0];
    const bytes = item?.b64_json ? Uint8Array.from(atob(item.b64_json), c => c.charCodeAt(0)) : null;
    if (!bytes) return Response.json({ error: "Image provider returned no image bytes" }, { status: 502 });
    const id = crypto.randomUUID();
    const path = `${user.id}/generated/${id}.png`;
    const { error: uploadError } = await db.storage.from("cortes-videos").upload(path, bytes, { contentType: "image/png", upsert: false });
    if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 });
    const { data, error } = await db.from("cortes_media_jobs").insert({ id, user_id: user.id, project_id: body.projectId || null, kind: "image", prompt: body.prompt, provider: "openai", status: "completed", output_path: path, completed_at: new Date().toISOString() }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(data);
  }

  if (!videoProviderUrl || !videoProviderKey) return Response.json({ error: "VIDEO_GENERATION_URL and VIDEO_GENERATION_API_KEY are required for video generation" }, { status: 503 });
  const id = crypto.randomUUID();
  const { error: insertError } = await db.from("cortes_media_jobs").insert({ id, user_id: user.id, project_id: body.projectId || null, kind: "video", prompt: body.prompt, input_image_path: body.inputImagePath || null, provider: "external-video", status: "processing" });
  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });
  const response = await fetch(videoProviderUrl, { method: "POST", headers: { Authorization: `Bearer ${videoProviderKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ prompt: body.prompt, input_image_path: body.inputImagePath || null, job_id: id }) });
  if (!response.ok) {
    await db.from("cortes_media_jobs").update({ status: "failed", error_message: await response.text() }).eq("id", id);
    return Response.json({ error: "Video provider rejected the request" }, { status: 502 });
  }
  const result = await response.json();
  await db.from("cortes_media_jobs").update({ provider_job_id: result.job_id || result.id || null, status: result.status === "completed" ? "completed" : "processing", output_path: result.output_path || null }).eq("id", id);
  return Response.json({ id, ...result });
});
