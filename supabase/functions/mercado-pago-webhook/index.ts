import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const mpToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
const webhookSecret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
const db = createClient(url, serviceKey);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!mpToken) return new Response("Payment provider not configured", { status: 503 });

  const raw = await req.text();
  if (webhookSecret) {
    const signature = req.headers.get("x-signature") || "";
    if (!await validSignature(signature, webhookSecret, raw)) return new Response("Invalid signature", { status: 401 });
  }

  let body: Record<string, any> = {};
  try { body = JSON.parse(raw); } catch {}
  const type = body.type || body.topic;
  const dataId = String(body.data?.id || body.id || "");
  if (!dataId) return new Response("ok", { status: 200 });

  const eventId = String(body.id || `${type}:${dataId}`);
  const { data: inserted } = await db.from("billing_webhook_events").insert({
    provider: "mercado_pago", event_id: eventId, event_type: type, payload: body
  }).select("id").maybeSingle();
  if (!inserted) return new Response("ok", { status: 200 });

  if (type === "subscription_preapproval") {
    await syncSubscription(dataId);
  } else if (type === "subscription_authorized_payment" || type === "payment") {
    await syncPayment(dataId);
  }
  return new Response("ok", { status: 200 });
});

async function syncSubscription(id: string) {
  const r = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${mpToken}` } });
  if (!r.ok) return;
  const s = await r.json();
  const { data: row } = await db.from("billing_subscriptions").select("id,user_id,plan_id").eq("provider_subscription_id", String(s.id)).maybeSingle();
  if (!row) return;
  const status = mapSubscriptionStatus(s.status);
  await db.from("billing_subscriptions").update({ status, current_period_start: s.date_created || null, current_period_end: s.next_payment_date || null, updated_at: new Date().toISOString() }).eq("id", row.id);
}

async function syncPayment(id: string) {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${mpToken}` } });
  if (!r.ok) return;
  const p = await r.json();
  const reference = String(p.external_reference || "");
  const { data: sub } = await db.from("billing_subscriptions").select("id,user_id,plan_id").eq("provider_subscription_id", String(p.preapproval_id || "")).maybeSingle();
  const userId = sub?.user_id;
  const planId = sub?.plan_id;
  if (!userId || !planId) return;
  const status = String(p.status || "pending");
  const { data: payment } = await db.from("billing_payments").upsert({
    user_id: userId, plan_id: planId, subscription_id: sub.id, provider: "mercado_pago",
    provider_payment_id: String(p.id), status: mapPaymentStatus(status),
    amount_brl: Number(p.transaction_amount || 0), raw_status: status,
    approved_at: status === "approved" ? new Date().toISOString() : null
  }, { onConflict: "provider,provider_payment_id" }).select().single();

  if (status === "approved" && payment) {
    const grantRef = `mp-payment:${p.id}`;
    await db.rpc("grant_plan_credits", { target: userId, plan: planId, reference: grantRef });
    await db.from("billing_payments").update({ credits_granted: (await db.from("billing_plans").select("credits").eq("id", planId).single()).data?.credits || 0 }).eq("id", payment.id);
    await db.from("billing_subscriptions").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", sub.id);
  }
}

function mapSubscriptionStatus(s: string) {
  if (s === "authorized") return "active";
  if (s === "paused") return "paused";
  if (s === "cancelled") return "cancelled";
  if (s === "expired") return "expired";
  return "pending";
}
function mapPaymentStatus(s: string) {
  if (s === "approved") return "approved";
  if (s === "authorized") return "authorized";
  if (s === "rejected") return "rejected";
  if (s === "cancelled") return "cancelled";
  if (s === "refunded") return "refunded";
  return "pending";
}
async function validSignature(header: string, secret: string, body: string) {
  const parsed = Object.fromEntries(header.split(",").map(p => p.split("=")).filter(p => p.length === 2));
  if (!parsed.v1) return false;
  const ts = parsed.ts || "";
  const dataId = "";
  const message = `id:${dataId};request-id:${""};ts:${ts};`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
  return hex === parsed.v1 || !webhookSecret;
}
