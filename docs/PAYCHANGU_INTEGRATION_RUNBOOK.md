# PayChangu payment and JARVIS fulfilment runbook

## Scope and current limits

The implementation uses PayChangu Standard Checkout. PayChangu's current Standard Checkout documentation lists MWK and USD as supported currencies. The current Kelnix order function enables Malawi (MWK) only; no international market is enabled by this work. Do not assume PayChangu settles supplier payments to China or supports every target-country currency.

Official provider references:
- Standard Checkout: https://developer.paychangu.com/docs/standard-checkout
- Transaction verification: https://developer.paychangu.com/docs/transaction-verification
- Webhooks: https://developer.paychangu.com/docs/webhooks

## Flow implemented

1. The signed-in customer submits delivery details and chooses an approved shipping service for each supplier.
2. The database `place_marketplace_order` function validates the products, supplier approvals, destination, shipping services, and stock; it calculates totals and writes order and supplier snapshots in one transaction.
3. The browser calls `initiate-paychangu-payment`. The Edge Function verifies the customer owns the order, reads the authoritative amount/currency, creates a unique PayChangu reference, and requests a hosted checkout URL. The secret key never reaches the browser.
4. The customer completes checkout on PayChangu.
5. PayChangu sends the configured webhook. The webhook function validates the HMAC SHA-256 `Signature` header against the raw request body, then independently calls PayChangu's `/verify-payment/{tx_ref}` endpoint.
6. The verified result is passed to the service-role-only `finalize_paychangu_payment` database function. It requires matching transaction reference, successful status, exact amount and currency. Mismatches are held for manual review; successful payments mark the order paid and confirmed.
7. A payment-confirmed event is placed in `jarvis_event_outbox`; supplier fulfilment snapshots move to `queued_for_review`. This is the integration boundary for JARVIS. Supplier purchases are explicitly flagged as requiring human approval. No supplier is paid automatically.

The customer return page also calls `verify-paychangu-payment`, so the system does not rely only on a browser redirect or webhook delivery.

## Supabase deployment

Run these commands from the repository root after linking the intended Supabase project. Review the project ref before deploying; do not apply these migrations to a production database until they have passed in a disposable test project.

```bash
supabase link --project-ref YOUR_TEST_PROJECT_REF
supabase db push
supabase secrets set PAYCHANGU_SECRET_KEY="YOUR_PAYCHANGU_TEST_SECRET"
supabase secrets set PAYCHANGU_WEBHOOK_SECRET="YOUR_PAYCHANGU_WEBHOOK_SECRET"
supabase secrets set SITE_URL="https://YOUR_FRONTEND_HOST"
supabase secrets set JARVIS_WEBHOOK_SECRET="GENERATE_A_LONG_RANDOM_SECRET"
supabase functions deploy initiate-paychangu-payment
supabase functions deploy verify-paychangu-payment
supabase functions deploy paychangu-webhook --no-verify-jwt
supabase functions deploy jarvis-outbox --no-verify-jwt
```

Supabase supplies the project URL, anon key and service-role key to Edge Functions in its runtime environment. Never put the service-role key or PayChangu secret in Vite variables or frontend code.

The repository's `supabase/config.toml` disables Supabase JWT verification only for the provider webhook and JARVIS outbox endpoints. The webhook performs PayChangu HMAC validation; the outbox endpoint validates its dedicated shared secret. Customer-facing payment functions retain JWT verification and independently validate the signed-in user.

## PayChangu dashboard

In the PayChangu merchant dashboard, use test credentials first. Under Settings → API & Webhooks, configure the webhook URL:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/paychangu-webhook`

Enable payment event notifications and save. The webhook secret configured in Supabase must be the matching webhook secret from PayChangu. Confirm the exact signature header and payload format with a test event before live mode.

The Standard Checkout function sends:
- `callback_url`: `https://YOUR_FRONTEND_HOST/payment/return`
- `return_url`: `https://YOUR_FRONTEND_HOST/payment/cancelled`

The frontend host must serve the Vite app for these paths (configure SPA rewrites if required).

## Required environment / deployment checks

- Frontend has the correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Supabase migrations 001, 002 and 003 are applied in order to the test project.
- At least one supplier is approved and has an active product with stock.
- An administrator has configured an approved, enabled MWK shipping option for every supplier in the basket. Kelnix will not invent or assume delivery prices. The admin dashboard now contains a delivery-service form for this.
- PayChangu test secret and webhook secret are configured as Supabase secrets.
- Webhook URL is saved in the PayChangu test dashboard.
- Test a success, failure, duplicate webhook, invalid signature, wrong amount, wrong currency, delayed webhook, and customer return before enabling live mode.

## JARVIS event contract

The payment finalizer writes one idempotent outbox event per order:
- `event_type`: `order.payment_confirmed`
- `aggregate_type`: `order`
- `aggregate_id`: order UUID
- payload: order ID/number, customer ID, currency, total, supplier fulfilment count, and `requires_human_supplier_purchase_approval: true`

JARVIS can poll the service-to-service endpoint `https://YOUR_PROJECT_REF.supabase.co/functions/v1/jarvis-outbox` with `POST` JSON `{ "action": "claim", "limit": 10 }` and header `x-jarvis-secret: YOUR_SHARED_SECRET`. The endpoint claims events using row locks and a 15-minute processing lease. Acknowledge each event with `POST` JSON `{ "action": "ack", "event_id": "EVENT_UUID", "success": true }`; on failure send `success: false` and a short `error`. After eight failed attempts an event is held for review. JARVIS should create a supplier purchase proposal per fulfilment snapshot and wait for explicit administrator approval before placing supplier orders or initiating supplier payouts. JARVIS must process event IDs idempotently. JARVIS being offline must never prevent checkout or corrupt payment state.

## Not yet completed / not claimed

- The migrations and Edge Functions have been committed but have not been deployed or executed against a test Supabase project.
- PayChangu test credentials and dashboard webhook configuration have not been supplied or configured.
- A test-mode end-to-end transaction has not been run.
- The JARVIS outbox and authenticated claim/ack endpoint are implemented; a live JARVIS consumer/worker and supplier purchase adapters are not yet connected.
- Supplier payout, refunds, reconciliation scheduling and international settlement routes remain separate work.
- No live customer charge has been initiated.
