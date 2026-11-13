# Kelnix Dropshipping

Kelnix is evolving from a Malawi multi-supplier marketplace into a dropshipping commerce platform. The current implementation reuses the React/Vite storefront and existing Supabase project.

## Current deployment status

- Existing Supabase project upgraded on 13 November 2026.
- Original marketplace data tables were retained and extended; no customer/order/product records were present. Three profile records were retained to preserve existing sign-in identities.
- Database migrations applied: original marketplace migrations plus international commerce foundation, secure order engine, PayChangu/JARVIS outbox, and security/query-index hardening.
- Four Supabase Edge Functions are deployed and ACTIVE:
  - `initiate-paychangu-payment` (JWT required)
  - `verify-paychangu-payment` (JWT required)
  - `paychangu-webhook` (provider HMAC validation; JWT disabled)
  - `jarvis-outbox` (shared-secret authentication; JWT disabled)
- No PayChangu or JARVIS secrets have been configured yet.
- No PayChangu dashboard webhook has been registered and no payment test has been run.
- JARVIS has not yet been connected as an event consumer.
- Malawi/MWK is the only enabled market. International destinations are not enabled.
- `main` remains unchanged. Work is on `feat/international-dropshipping-foundation`.

## Commerce and payment flow

1. A signed-in customer chooses products and an approved shipping service for each supplier.
2. The database RPC `place_marketplace_order` validates stock, supplier status, destination and shipping options, calculates totals, and writes order/fulfilment snapshots atomically.
3. The customer is redirected to PayChangu Standard Checkout by a server-side Edge Function.
4. The return flow and webhook independently verify the transaction with PayChangu. Payment is only marked successful after server-side verification of reference, status, amount and currency.
5. A verified payment creates an idempotent JARVIS outbox event. Supplier purchasing remains subject to human approval.

The storefront must not be used for live orders until secrets, frontend environment variables, shipping options, PayChangu webhook configuration and end-to-end tests are complete.

## Supabase migrations

- `supabase/migrations/202611080001_marketplace_core.sql` — original marketplace schema.
- `supabase/migrations/202611130001_international_commerce_foundation.sql` — market, supplier, shipping and order snapshots.
- `supabase/migrations/202611130002_secure_order_engine.sql` — trusted transactional order-placement RPC.
- `supabase/migrations/202611130003_paychangu_payment_and_jarvis_outbox.sql` — payment state, verified finalisation and JARVIS outbox.
- `supabase/migrations/202611130004_security_and_query_indexes.sql` — trigger-function permissions and supporting indexes.

## Required configuration before payment testing

Set these as Supabase Edge Function secrets (never in frontend code):

- `PAYCHANGU_SECRET_KEY`
- `PAYCHANGU_WEBHOOK_SECRET`
- `SITE_URL` — the deployed storefront origin
- `JARVIS_WEBHOOK_SECRET` — a long random secret shared with the JARVIS worker

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions automatically. Do not expose the service-role key.

Set the frontend environment variables in the hosting project:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Use the publishable/anon key only in the browser. Never use the service-role key as a Vite variable.

Then configure the PayChangu merchant webhook URL:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/paychangu-webhook`

See [the PayChangu and JARVIS runbook](docs/PAYCHANGU_INTEGRATION_RUNBOOK.md) for setup and test cases.

## Security notes

- Payment state and order totals are server-authoritative.
- Webhook signature verification is performed over the raw request body and the provider transaction is independently re-verified.
- The JARVIS outbox and webhook event tables intentionally have no client-facing RLS policies; service-role-only backend functions access them.
- Security-definer functions used for admin checks and transactional order placement are intentional; the order RPC validates the authenticated caller and inputs.
- Enable leaked-password protection in Supabase Auth before launch.
- Never automatically purchase from suppliers or send supplier payouts without explicit human approval.

## Remaining work

1. Add the four Supabase secrets securely and configure the PayChangu test webhook.
2. Set the correct Supabase URL/publishable key and storefront URL in the frontend hosting environment.
3. Configure an approved supplier, active product, and actual MWK shipping service.
4. Run end-to-end tests: successful payment, failure, duplicate webhook, invalid signature, amount/currency mismatch, delayed webhook, and customer return.
5. Connect the JARVIS worker to claim and acknowledge outbox events idempotently.
6. Implement supplier stock confirmation/synchronisation, purchase orders, tracking, refunds and reconciliation.
7. Select one international launch country only after confirming payment settlement, duties/taxes, consumer rights, returns and shipping feasibility.

## Development

```bash
npm install
npm run dev
npm run build
```

GitHub Actions validates the frontend production build and type-checks all four Edge Functions. SQL migrations still require database-level tests and the full payment flow requires a test transaction.
