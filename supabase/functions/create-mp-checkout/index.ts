import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const mpToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
const siteUrl = Deno.env.get("PUBLIC_SITE_URL") || "http://localhost:5173";
const db = createClient(supabaseUrl, serviceKey);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization");
  if (!auth) return new Response("Unauthorized", { status: 401 });
  const userDb = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!mpToken) return json({ error: "MERCADO_PAGO_ACCESS_TOKEN is not configured" }, 503);

  const { planId } = await req.json() as { planId?: string };
  if (!planId || !["creator", "pro", "studio"].includes(planId)) return json({ error: "Invalid paid plan" }, 400);

  const { data: plan } = await db.from("billing_plans").select("id,name,price_brl,billing_interval").eq("id", planId).eq("active", true).maybeSingle();
  if (!plan || Number(plan.price_brl) <= 0) return json({ error: "Plan unavailable" }, 404);

  const reference = crypto.randomUUID();
  const response = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: { Authorization: `Bearer ${mpToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      reason: `CORTES AI — plano ${plan.name}`,
      external_reference: reference,
      payer_email: user.email,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: Number(plan.price_brl), currency_id: "BRL" },
      back_url: `${siteUrl}/billing?plan=${planId}`,
      status: "pending"
    })
  });
  if (!response.ok) return json({ error: "Mercado Pago rejected the subscription", details: await response.text() }, 502);
  const mp = await response.json();

  const { data: subscription, error } = await db.from("billing_subscriptions").insert({
    user_id: user.id,
    plan_id: plan.id,
    provider: "mercado_pago",
    provider_subscription_id: mp.id,
    status: "pending"
  }).select().single();
  if (error) return json({ error: error.message }, 500);

  return json({ checkout_url: mp.init_point, subscription_id: subscription.id });
});

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}
