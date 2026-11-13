import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign in is required" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const secretKey = Deno.env.get("PAYCHANGU_SECRET_KEY")!;
    const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await auth.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid session" }, 401);

    const body = await req.json();
    const txRef = typeof body.tx_ref === "string" ? body.tx_ref : "";
    if (!/^KELNIX-[0-9a-f-]{36}$/i.test(txRef)) return json({ error: "Invalid payment reference" }, 400);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: payment } = await admin.from("payments")
      .select("id,order_id,provider_reference,status")
      .eq("provider", "paychangu").eq("provider_reference", txRef).maybeSingle();
    if (!payment) return json({ error: "Payment reference not found" }, 404);
    const { data: order } = await admin.from("orders")
      .select("id,customer_id").eq("id", payment.order_id).maybeSingle();
    if (!order || order.customer_id !== authData.user.id) return json({ error: "Payment not found" }, 404);

    const response = await fetch(`https://api.paychangu.com/verify-payment/${encodeURIComponent(txRef)}`, {
      headers: { "Accept": "application/json", "Authorization": `Bearer ${secretKey}` },
    });
    const verified = await response.json().catch(() => ({}));
    if (!response.ok || verified?.status !== "success" || !verified?.data) {
      return json({ payment_status: "pending", message: "Payment has not yet been confirmed." }, 202);
    }

    const d = verified.data;
    if (d.tx_ref !== txRef) return json({ error: "Provider reference mismatch" }, 409);
    const { data: result, error: finalizeError } = await admin.rpc("finalize_paychangu_payment", {
      p_tx_ref: txRef,
      p_verified_status: d.status,
      p_verified_amount: Number(d.amount),
      p_verified_currency: String(d.currency ?? ""),
      p_provider_transaction_id: d.reference ? String(d.reference) : null,
      p_verified_payload: verified,
      p_event_key: `return:${txRef}:${String(d.status)}`,
    });
    if (finalizeError) return json({ error: "Could not finalise verified payment" }, 500);
    if (result?.review_required) return json({ payment_status: "review_required" }, 409);
    return json({ payment_status: result?.payment_status ?? "pending", order_id: order.id });
  } catch (_error) {
    return json({ error: "Payment verification failed" }, 500);
  }
});
