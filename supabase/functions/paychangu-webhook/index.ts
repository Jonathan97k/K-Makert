import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const raw = await req.text();
    const signature = req.headers.get("Signature") ?? req.headers.get("signature") ?? "";
    const webhookSecret = Deno.env.get("PAYCHANGU_WEBHOOK_SECRET");
    const secretKey = Deno.env.get("PAYCHANGU_SECRET_KEY");
    if (!webhookSecret || !secretKey) return reply({ error: "Webhook is not configured" }, 503);

    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const expected = toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
    if (!signature || !constantTimeEqual(expected.toLowerCase(), signature.toLowerCase())) {
      return reply({ error: "Invalid webhook signature" }, 401);
    }

    const payload = JSON.parse(raw);
    const txRef = typeof payload.tx_ref === "string" ? payload.tx_ref : "";
    if (!/^KELNIX-[0-9a-f-]{36}$/i.test(txRef)) return reply({ error: "Unknown transaction reference" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: payment } = await admin.from("payments")
      .select("id,provider_reference").eq("provider", "paychangu")
      .eq("provider_reference", txRef).maybeSingle();
    if (!payment) return reply({ error: "Payment reference not found" }, 404);

    // Never trust webhook fields alone: re-query PayChangu's verification endpoint.
    const response = await fetch(`https://api.paychangu.com/verify-payment/${encodeURIComponent(txRef)}`, {
      headers: { "Accept": "application/json", "Authorization": `Bearer ${secretKey}` },
    });
    const verified = await response.json().catch(() => ({}));
    if (!response.ok || verified?.status !== "success" || !verified?.data || verified.data.tx_ref !== txRef) {
      return reply({ error: "Provider verification is not yet successful" }, 503);
    }

    const { data: result, error } = await admin.rpc("finalize_paychangu_payment", {
      p_tx_ref: txRef,
      p_verified_status: verified.data.status,
      p_verified_amount: Number(verified.data.amount),
      p_verified_currency: String(verified.data.currency ?? ""),
      p_provider_transaction_id: verified.data.reference ? String(verified.data.reference) : null,
      p_verified_payload: verified,
      p_event_key: `webhook:${txRef}:${String(verified.data.status)}`,
    });
    if (error) return reply({ error: "Payment state update failed" }, 500);
    return reply({ received: true, result });
  } catch (_error) {
    return reply({ error: "Webhook processing failed" }, 500);
  }
});
