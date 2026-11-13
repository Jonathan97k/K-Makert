# Kelnix International Dropshipping Implementation Plan

## Purpose

Evolve the existing Kelnix Marketplace application into an international dropshipping operation by reusing the existing React/Vite storefront, Supabase authentication, supplier onboarding, product catalogue, cart, and administration UI wherever practical.

The existing Malawi multi-supplier marketplace remains a reusable foundation. International dropshipping is the first commercial launch priority; the data model should not prevent local suppliers from being supported later.

## Engineering principles

1. Preserve working functionality; extend before replacing.
2. Keep `main` stable. Implement on feature branches and merge through reviewed pull requests.
3. Keep checkout, payment state, order totals, inventory reservations, supplier purchasing, and accounting deterministic on the server/database. AI may assist staff but must not decide financial truth.
4. Do not expose Supabase service-role credentials or payment secrets in browser code.
5. Verify payment notifications server-side, authenticate provider callbacks, and make payment processing idempotent.
6. Require human approval for supplier payout changes, refunds, unusual orders, and external marketing outreach.
7. Store supplier/product/price/shipping snapshots on order items so later catalogue changes do not rewrite order history.
8. Do not treat a payment success redirect as proof of payment or spend unsettled funds.
9. Keep the storefront and order processing operational if JARVIS or an AI provider is unavailable.
10. Avoid introducing new frameworks or paid services until the existing stack has been fully evaluated.

## Existing foundation identified

- React + Vite storefront and responsive UI.
- Supabase JS client and email/password + Google OAuth flows.
- Product catalogue query, search, category filtering, and cart.
- Supplier application and supplier workspace.
- Admin UI for supplier/product approvals, orders, payment records, and profit summaries.
- Initial Supabase migration at `supabase/migrations/202611080001_marketplace_core.sql`.
- PWA manifest and service worker.

## Work completed on this branch

- Added a trusted transactional `place_marketplace_order` database function. It requires an authenticated customer, validates the destination market and basket, serializes customer idempotency keys, locks products in deterministic order, calculates product prices from the database, checks approved suppliers and destination eligibility, reserves stock, requires one approved shipping service per supplier, and writes order, line-item and supplier-fulfilment snapshots in one transaction.
- Removed direct customer insert policies/privileges for orders and order items; duplicate checkout submissions using the same customer request ID return the existing order; the browser cannot set its own order totals, supplier IDs, prices or payment status through direct table inserts.
- Added supplier fulfilment snapshots and a narrowly scoped product trigger exception allowing inventory quantity changes on active products while protecting active product details.
- Created a dedicated feature branch and kept `main` unchanged.
- Added an additive international commerce migration covering supplier country/type, supplier SKU and cost currency, product destination eligibility, processing/shipping estimates, market configuration, supplier shipping proposals with admin approval, order currency/market/FX snapshots, and supplier commercial snapshots on order items. Markets remain disabled and no shipping option is approved by default.
- Removed the hard-coded administrator UUID fallback from frontend role checks. Administrator access now depends on the authenticated user's database profile role.
- Prevented the configured/live catalogue from silently showing demo listings when the database returns zero products or a query error. The demo catalogue remains available only in unconfigured preview mode.
- No production database was changed. Neither new migration has been applied or executed against PostgreSQL yet. No payment integration or deployment was performed.

## Important findings and risks to resolve

- The current migration describes a local multi-supplier marketplace and MWK defaults, not a complete international dropshipping data model.
- The current browser checkout sends a WhatsApp message; it does not create a transactional order or collect payment.
- The current schema has orders and order_items, but the visible RLS policies do not provide a customer-facing transactional order-creation path for order items. A trusted database function or server endpoint is needed.
- Client-submitted order totals must never be trusted. The server must re-read active product prices and calculate amounts.
- Supplier ownership and privileged status fields have database guardrails in the migration, but all RLS policies, grants, trigger behaviour, and security-definer functions still require a complete review.
- A profile role check in the UI is not a security boundary. Every privileged database operation must be enforced by RLS or trusted server-side code.
- The migration's live application status is unverified. Do not assume it has been applied.
- PayChangu's supported international currencies, cross-border payment methods, settlement currencies, payout timing, and refund capabilities must be confirmed before designing checkout around it.
- No JARVIS integration is currently established in this repository.

## Target business capabilities

### Customer commerce
- Market/country-aware storefront, product availability, pricing, shipping estimates, tax/duty disclosures, customer accounts, cart, checkout, order history, and notifications.
- Currency and locale are explicit order properties; conversion rates and timestamps are recorded when relevant.

### Product and supplier operations
- Supplier records include country, legal/business identity, approved contact, fulfilment origin, shipping methods, typical dispatch time, tracking capability, return address, and verification status.
- Product records include supplier SKU, supplier cost and currency, destination eligibility, shipping cost/estimate, stock/availability evidence, product compliance notes, and approved sales price.
- Supplier/product mapping and commercial terms are snapshotted on each order item.

### Orders and fulfilment
- Server-calculated order totals and immutable line-item snapshots.
- Payment intent and verified payment events, idempotency keys, refunds, and reconciliation.
- Supplier purchase orders, supplier confirmation, dispatch, carrier/tracking updates, delivery exceptions, cancellation and returns.
- Separate customer payment, supplier cost, platform margin, fees, refunds, and creator commission ledger entries.

### Marketing and creators
- Public business/creator discovery using permitted sources and platform APIs.
- Evidence-backed creator profiles, audience/market fit, approved outreach, unique referral links/codes, attribution, and commission reconciliation.
- No spam, fake accounts, private-data scraping, or automated unsolicited bulk messaging.

### JARVIS integration
- Scoped internal APIs and event-driven workflows for research, supplier/product intelligence, campaign monitoring, customer-support assistance, and exception alerts.
- Human approval for consequential external actions.
- AI-provider abstraction, structured outputs, task logs, budget limits, retries, and a kill switch.

## Delivery sequence

### Phase 0 — Repository and environment verification
- Complete file inventory and identify routes, components, Supabase usage, migrations, PWA setup, deployment config, and tests.
- Confirm current Supabase project/migration state with the owner; never apply migrations without explicit approval.
- Run dependency install/build/tests in a controlled environment and record baseline results.
- Confirm current hosting and environment variable names without exposing secret values.

### Phase 1 — Security and data integrity
- Finish review of RLS, grants, triggers, auth profile creation, security-definer functions, and browser role handling.
- Remove any remaining hard-coded privileges or demo data from configured production paths.
- Add server-authoritative order creation, price calculation, inventory checks, and idempotency.
- Add audit events for privileged changes.

### Phase 2 — International commerce data model
- [x] Draft additive schema migration for country/market, currency, supplier country, shipping methods, delivery estimates, product destination eligibility, supplier SKU, exchange-rate snapshots, and order snapshots.
- [x] Preserve current tables and local marketplace data through additive columns/tables; existing records retain MW/MWK defaults.
- [ ] Validate migration against a disposable Supabase/PostgreSQL database before production approval.
- Define data retention and privacy requirements for launch markets.

### Phase 3 — Supplier sourcing and catalogue operations
- Supplier verification and approval.
- Supplier catalogue ingestion/import, mapping, duplicate detection, product review, cost and shipping updates.
- Landed-cost and margin calculation with clear fee assumptions.

### Phase 4 — Checkout and payments
- Confirm PayChangu capabilities and settlement arrangements from official merchant documentation/account support.
- Implement a payment provider abstraction; integrate PayChangu only for verified supported flows.
- Verify webhooks/signatures server-side, reconcile provider references, handle retries and duplicate events.
- If PayChangu cannot support a target market/currency, evaluate a legitimate alternative before launch.

### Phase 5 — Supplier purchasing and fulfilment
- Purchase orders, supplier acknowledgements, tracking, carrier events, customer notifications, delivery exceptions, cancellations, returns and refunds.
- Define working-capital and settlement rules before automatic supplier purchasing.

### Phase 6 — JARVIS and creator operations
- Integrate through restricted internal APIs and auditable events.
- Add market research, creator discovery/CRM, campaign attribution, operational alerts, and staff approval queues.

### Phase 7 — Pilot and launch
- Automated unit/integration/end-to-end tests, security review, backup/restore test, monitoring, incident procedures, legal pages, and support process.
- Pilot one launch market and a small approved product set before opening broader markets.

## Decisions that must be confirmed before launch

- First customer destination market and permitted product categories.
- Legal seller/importer-of-record arrangement and responsibility for duties/taxes/returns.
- PayChangu support for the target market, customer payment methods, currency, and settlement route.
- Supplier locations, shipping service levels, return handling, and product compliance evidence.
- Customer-facing brand/contact details and operational support capacity.

## Current status

This is an implementation roadmap, not a claim that the listed capabilities already exist. Work should be delivered in small, reviewable commits with build/test evidence. Do not merge to `main`, apply a production migration, connect live payments, or send customer/creator messages without explicit approval.
