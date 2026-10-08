import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = { projectId: string; clipId?: string; language?: string };
const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const openaiKey = Deno.env.get("OPENAI_API_KEY");
const db = createClient(url, serviceKey);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization");
  if (!auth) return new Response("Unauthorized", { status: 401 });
  const userDb = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const body = (await req.json()) as Body;
  if (!body.projectId) return new Response("projectId is required", { status: 400 });
  if (!openaiKey) return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not configured" }), { status: 503, headers: { "Content-Type": "application/json" } });
  const { data: project } = await db.from("projects").select("id,title").eq("id", body.projectId).eq("user_id", user.id).maybeSingle();
  if (!project) return new Response("Project not found", { status: 404 });
  const clip = body.clipId ? (await db.from("clips").select("id,title,start_seconds,end_seconds").eq("id", body.clipId).eq("project_id", body.projectId).maybeSingle()).data : null;
  const language = body.language || "pt-BR";
  const prompt = "Create short-form social metadata. Return JSON only with titles (3), hooks (3), hashtags (8), chapters, description and cta. Be accurate to the supplied project and clip; never promise virality. Language: " + language + ". DATA: " + JSON.stringify({ project, clip });
  const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + openaiKey, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-4o-mini", response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }) });
  if (!response.ok) return new Response(JSON.stringify({ error: await response.text() }), { status: 502, headers: { "Content-Type": "application/json" } });
  const result = await response.json();
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(result.choices?.[0]?.message?.content || "{}"); } catch { return new Response(JSON.stringify({ error: "AI returned invalid JSON" }), { status: 502, headers: { "Content-Type": "application/json" } }); }
  const { data, error } = await db.from("clip_ai_content").insert({ user_id: user.id, project_id: body.projectId, clip_id: body.clipId || null, language, titles: parsed.titles || [], hooks: parsed.hooks || [], description: parsed.description || "", hashtags: parsed.hashtags || [], cta: parsed.cta || "", chapters: parsed.chapters || [], provider: "openai", model: "gpt-4o-mini" }).select().single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
});