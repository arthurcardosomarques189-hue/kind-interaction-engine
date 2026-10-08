import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const providerUrl = Deno.env.get("SOCIAL_PUBLISH_URL");
const providerKey = Deno.env.get("SOCIAL_PUBLISH_API_KEY");
const db = createClient(url, serviceKey);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userDb = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!providerUrl || !providerKey) return Response.json({ error: "SOCIAL_PUBLISH_URL and SOCIAL_PUBLISH_API_KEY are required" }, { status: 503 });

  const body = await req.json() as { publicationId?: string };
  if (!body.publicationId) return Response.json({ error: "publicationId is required" }, { status: 400 });
  const { data: publication } = await db.from("cortes_publications").select("*").eq("id", body.publicationId).eq("user_id", user.id).maybeSingle();
  if (!publication) return Response.json({ error: "Publication not found" }, { status: 404 });

  const { data: account } = await db.from("cortes_social_accounts").select("id,platform,display_name,status").eq("id", publication.social_account_id).eq("user_id", user.id).maybeSingle();
  if (!account || account.status !== "connected") return Response.json({ error: "Social account is not connected" }, { status: 400 });

  await db.from("cortes_publications").update({ status: "publishing", error_message: null }).eq("id", publication.id);
  const response = await fetch(providerUrl, { method: "POST", headers: { Authorization: `Bearer ${providerKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ publication, account: { id: account.id, platform: account.platform } }) });
  if (!response.ok) {
    const error = await response.text();
    await db.from("cortes_publications").update({ status: "failed", error_message: error }).eq("id", publication.id);
    return Response.json({ error: "Social provider rejected the publication" }, { status: 502 });
  }
  const result = await response.json();
  await db.from("cortes_publications").update({ status: "published", external_post_id: result.post_id || result.id || null, external_url: result.url || null, published_at: new Date().toISOString() }).eq("id", publication.id);
  return Response.json(result);
});
