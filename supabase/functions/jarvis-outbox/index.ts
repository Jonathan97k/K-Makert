import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const expectedSecret = Deno.env.get("JARVIS_WEBHOOK_SECRET");
    const suppliedSecret = req.headers.get("x-jarvis-secret") ?? "";
    if (!expectedSecret || !suppliedSecret || !safeEqual(expectedSecret, suppliedSecret)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "Outbox service is not configured" }, 503);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json();

    if (body.action === "claim") {
      const limit = Number.isInteger(body.limit) ? Math.min(50, Math.max(1, body.limit)) : 10;
      const { data, error } = await admin.rpc("claim_jarvis_events", { p_limit: limit });
      if (error) return json({ error: "Could not claim outbox events" }, 500);
      return json({ events: data ?? [] });
    }

    if (body.action === "ack") {
      const eventId = typeof body.event_id === "string" ? body.event_id : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) {
        return json({ error: "A valid event ID is required" }, 400);
      }
      const { data, error } = await admin.rpc("ack_jarvis_event", {
        p_event_id: eventId,
        p_success: body.success === true,
        p_error: typeof body.error === "string" ? body.error.slice(0, 1000) : null,
      });
      if (error) return json({ error: "Could not acknowledge outbox event" }, 409);
      return json(data);
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (_error) {
    return json({ error: "Outbox request failed" }, 500);
  }
});
