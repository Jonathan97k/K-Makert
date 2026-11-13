import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign in is required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const secretKey = Deno.env.get("PAYCHANGU_SECRET_KEY");
    const siteUrl = Deno.env.get("SITE_URL");
    if (!supabaseUrl || !anonKey || !serviceKey || !secretKey || !siteUrl) {
      return json({ error: "Payment service is not configured" }, 503);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !userData.user) return json({ error: "Invalid session" }, 401);
    const user = userData.user;

    const body = await req.json();
    const orderId = typeof body.order_id === "string" ? body.order_id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
      return json({ error: "A valid order ID is required" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id,order_number,customer_id,total,currency_code,payment_status,customer_name")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order || order.customer_id !== user.id) {
      return json({ error: "Order not found" }, 404);
    }
    if (order.payment_status === "paid") return json({ error: "This order is already paid" }, 409);
    if (!["unpaid", "pending", "failed"].includes(order.payment_status)) {
      return json({ error: "This order is not currently payable" }, 409);
    }

    const amount = Number(order.total);
    const currency = String(order.currency_code).toUpperCase();
    if (!Number.isSafeInteger(amount) || amount <= 0 || !["MWK", "USD"].includes(currency)) {
      return json({ error: "Order amount or currency is not supported by the payment gateway" }, 422);
    }

    // Reuse a still-pending hosted checkout instead of creating duplicate charges.
    const { data: existing } = await admin
      .from("payments")
      .select("id,provider_reference,checkout_url,status,amount,currency")
      .eq("order_id", order.id)
      .eq("provider", "paychangu")
      .in("status", ["initiated", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      if (existing.checkout_url && Number(existing.amount) === amount && existing.currency === currency) {
        return json({ checkout_url: existing.checkout_url, tx_ref: existing.provider_reference, reused: true });
      }
      return json({ error: "A payment session is already being prepared. Wait briefly and retry." }, 409);
    }

    const txRef = `KELNIX-${crypto.randomUUID()}`;
    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .insert({
        order_id: order.id,
        provider: "paychangu",
        provider_reference: txRef,
        amount,
        currency,
        status: "initiated",
        metadata: { checkout: "standard", order_number: order.order_number },
      })
      .select("id")
      .single();

    if (paymentError || !payment) {
      // Another tab may have won the partial unique-index race. Reuse its
      // checkout session if ready; otherwise ask the customer to retry shortly.
      const { data: concurrent } = await admin.from("payments")
        .select("provider_reference,checkout_url,amount,currency,status")
        .eq("order_id", order.id).eq("provider", "paychangu")
        .in("status", ["initiated", "pending"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (concurrent?.checkout_url && Number(concurrent.amount) === amount && concurrent.currency === currency) {
        return json({ checkout_url: concurrent.checkout_url, tx_ref: concurrent.provider_reference, reused: true });
      }
      return json({ error: "A payment session is already being prepared. Wait briefly and retry." }, 409);
    }

    const names = String(order.customer_name ?? "").trim().split(/\s+/);
    const firstName = names.shift() || "Kelnix";
    const lastName = names.join(" ") || "Customer";
    const checkoutResponse = await fetch("https://api.paychangu.com/payment", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        amount: String(amount),
        currency,
        tx_ref: txRef,
        first_name: firstName,
        last_name: lastName,
        email: user.email,
        callback_url: `${siteUrl.replace(/\/$/, "")}/payment/return`,
        return_url: `${siteUrl.replace(/\/$/, "")}/payment/cancelled`,
        customization: {
          title: "Kelnix Marketplace",
          description: `Payment for order ${order.order_number}`,
        },
        meta: { order_id: order.id, order_number: order.order_number },
      }),
    });

    const providerBody = await checkoutResponse.json().catch(() => ({}));
    const checkoutUrl = providerBody?.data?.checkout_url;
    if (!checkoutResponse.ok || providerBody?.status !== "success" ||
      typeof checkoutUrl !== "string" || !checkoutUrl.startsWith("https://")) {
      await admin.from("payments").update({
        status: "failed",
        failure_reason: "PayChangu did not return a valid hosted checkout URL",
        metadata: { checkout: "standard", provider_response: providerBody },
        updated_at: new Date().toISOString(),
      }).eq("id", payment.id);
      return json({ error: "PayChangu could not initialise checkout. Please try again." }, 502);
    }

    await admin.from("payments").update({
      status: "pending",
      checkout_url: checkoutUrl,
      metadata: { checkout: "standard", provider_response: providerBody },
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id);

    await admin.from("orders").update({
      payment_status: "pending",
      updated_at: new Date().toISOString(),
    }).eq("id", order.id).neq("payment_status", "paid");

    return json({ checkout_url: checkoutUrl, tx_ref: txRef, reused: false });
  } catch (_error) {
    return json({ error: "Payment initialisation failed" }, 500);
  }
});
