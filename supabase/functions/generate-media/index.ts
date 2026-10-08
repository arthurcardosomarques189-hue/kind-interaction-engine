import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const openaiKey = Deno.env.get("OPENAI_API_KEY");
const runwayKey = Deno.env.get("RUNWAYML_API_SECRET");
const db = createClient(url, serviceKey);

function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function getSignedInputImage(path: string) {
  const { data, error } = await db.storage.from("cortes-videos").createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error(error?.message || "Could not create input image URL");
  return data.signedUrl;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization");
  if (!auth) return errorResponse("Unauthorized", 401);

  const userDb = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const body = await req.json() as {
    kind?: "image" | "video";
    prompt?: string;
    projectId?: string;
    inputImagePath?: string;
    ratio?: "1280:720" | "720:1280" | "960:960" | "1584:672" | "1104:832" | "832:1104" | "672:1584";
    duration?: 5 | 10;
  };

  if (!body.kind || !body.prompt?.trim()) return errorResponse("kind and prompt are required");

  if (body.projectId) {
    const { data: project } = await db.from("projects").select("id")
      .eq("id", body.projectId).eq("user_id", user.id).maybeSingle();
    if (!project) return errorResponse("Project not found", 404);
  }

  if (body.kind === "image") {
    if (!openaiKey) return errorResponse("OPENAI_API_KEY is not configured", 503);
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-2", prompt: body.prompt, size: "1024x1024", n: 1 }),
    });
    if (!response.ok) return errorResponse(await response.text(), 502);
    const result = await response.json();
    const item = result.data?.[0];
    const bytes = item?.b64_json ? Uint8Array.from(atob(item.b64_json), c => c.charCodeAt(0)) : null;
    if (!bytes) return errorResponse("Image provider returned no image bytes", 502);

    const id = crypto.randomUUID();
    const path = `${user.id}/generated/${id}.png`;
    const { error: uploadError } = await db.storage.from("cortes-videos")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (uploadError) return errorResponse(uploadError.message, 500);

    const { data, error } = await db.from("cortes_media_jobs").insert({
      id, user_id: user.id, project_id: body.projectId || null, kind: "image",
      prompt: body.prompt, provider: "openai", status: "completed",
      output_path: path, completed_at: new Date().toISOString(),
    }).select().single();
    if (error) return errorResponse(error.message, 500);
    return Response.json(data);
  }

  if (!runwayKey) return errorResponse("RUNWAYML_API_SECRET is not configured", 503);

  let promptImage: string | undefined;
  if (body.inputImagePath) {
    try {
      promptImage = await getSignedInputImage(body.inputImagePath);
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : "Invalid input image", 400);
    }
  }

  const id = crypto.randomUUID();
  const ratio = body.ratio || "720:1280";
  const duration = body.duration || 5;

  const textOnlyRatios = new Set(["1280:720", "720:1280"]);
  if (!promptImage && !textOnlyRatios.has(ratio)) {
    return errorResponse("Para vídeo por texto com Gen-4.5, o formato deve ser 1280:720 ou 720:1280");
  }

  const { error: insertError } = await db.from("cortes_media_jobs").insert({
    id, user_id: user.id, project_id: body.projectId || null, kind: "video",
    prompt: body.prompt, input_image_path: body.inputImagePath || null,
    provider: "runway", status: "processing",
  });
  if (insertError) return errorResponse(insertError.message, 500);

  const runwayBody: Record<string, unknown> = {
    model: "gen4.5", promptText: body.prompt, ratio, duration,
  };
  if (promptImage) runwayBody.promptImage = promptImage;

  const response = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runwayKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify(runwayBody),
  });

  if (!response.ok) {
    const providerError = await response.text();
    await db.from("cortes_media_jobs").update({
      status: "failed", error_message: providerError.slice(0, 4000),
    }).eq("id", id);
    return errorResponse("Runway rejected the video generation request", 502);
  }

  const result = await response.json();
  if (!result.id) {
    await db.from("cortes_media_jobs").update({
      status: "failed", error_message: "Runway returned no task id",
    }).eq("id", id);
    return errorResponse("Runway returned no task id", 502);
  }

  await db.from("cortes_media_jobs").update({
    provider_job_id: result.id, status: "processing",
  }).eq("id", id);

  return Response.json({
    id, provider: "runway", providerJobId: result.id, status: "processing",
  });
});
