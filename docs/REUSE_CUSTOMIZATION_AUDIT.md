# Kelnix Marketplace — Reuse and Customization Audit

**Repository:** `Jonathan97k/K-Makert`  
**Audited branch:** `work/reuse-customization-audit`  
**Audit date:** 2026-11-13  
**Method:** Read-only source inspection of the README, package manifest, application entrypoint, main React application, Supabase client and initial database migration. No live Supabase project, deployment, environment secrets or runtime test environment was available during this review.

## 1. Executive decision

**Reuse the existing React/Vite/Supabase application. Do not rewrite it.**

The repository already contains a useful customer-facing marketplace foundation and early supplier/admin workflows. The existing visual design, React components, authentication screens, catalogue browsing, cart interactions, supplier onboarding UI and much of the database model are worth retaining.

The existing business model is currently a Malawi-focused, multi-supplier marketplace. The target business also includes international dropshipping, where Kelnix acts as the retailer and an external supplier fulfils each customer order. These are related but not identical operating models. The recommended approach is to preserve a shared commerce foundation and add explicit fulfilment/sourcing capabilities, while launching one operating model first.

## 2. Stack and repository baseline

- React 19 application using Vite.
- Supabase JavaScript client for browser-side authentication and data access.
- React Router is not present in the inspected package manifest; the current app is primarily a single React application.
- lucide-react icons.
- CSS is maintained in `src/styles.css`.
- Supabase migration: `supabase/migrations/202611080001_marketplace_core.sql`.
- Current package scripts include `dev`, `build`, and `preview`; no test or lint script is currently declared in the inspected `package.json`.

Keep this stack for the current stage. A framework migration or microservices split would add cost without solving the immediate business gaps.

## 3. Reuse classification

| Existing feature | Decision | Work required |
| --- | --- | --- |
| Storefront visual layout and responsive CSS | **Reuse** | Update messaging, market/currency presentation and brand content when the launch market is confirmed. |
| Search, category filters and sorting | **Reuse + extend** | Make category and filters data-driven; support market, availability and shipping filters. |
| Product cards and supplier attribution | **Reuse + extend** | Add accurate price, currency, shipping estimate, availability and product detail links. |
| Cart and quantity controls | **Reuse + extend** | Revalidate product prices and stock on the server; persist cart where useful; handle multi-supplier shipping. |
| Customer email/password authentication | **Reuse** | Verify against a live Supabase project; add account recovery and production auth settings. |
| Google OAuth flow | **Reuse** | Verify provider and redirect configuration in Supabase. |
| Supplier registration UI | **Customize** | Retain form and account flow; add international supplier/company fields and a distinct internal sourcing workflow. |
| Supplier dashboard UI | **Customize** | Keep existing layout; add product feed/import, stock updates, fulfilment status and supplier performance. |
| Admin dashboard UI | **Customize substantially** | Retain layout and lists; separate operational permissions and add order, fulfilment, payment, returns and audit workflows. |
| Existing Supabase client wrapper | **Reuse with cleanup** | Keep public-key-only browser access; improve missing-configuration behavior and typed query/error handling. |
| Existing SQL entities | **Reuse selectively** | Keep profiles, suppliers, products, orders, order_items, payments and profit_ledger as a starting point; add fulfilment, supplier order, shipping, refunds, currencies and event/audit entities. |
| Demo product catalogue | **Do not use in production** | Keep only for an explicit preview/demo mode. Never allow sample listings to appear as live inventory. |
| WhatsApp-only checkout | **Replace as primary checkout** | May remain as customer support/contact, but introduce server-created orders and a verified payment process. |
| PWA entrypoint | **Verify before relying on it** | Check manifest, icons and service worker assets and test install/offline behavior. |

## 4. Important implementation findings

### 4.1 Demo catalogue and production safety

The README explicitly states that the eight products in `src/App.jsx` are sample listings, not verified inventory or prices. The application initializes state with these demo products. A failed, empty or unavailable Supabase catalogue query can therefore leave sample products displayed.

**Required change:** distinguish demo/preview mode from production. In production, a missing database connection or empty catalogue must display a clear empty/error state, not purchasable-looking sample products.

### 4.2 Administrator identity fallback

The main application checks a hard-coded user UUID as an alternative to the database role in both the role-loading effect and dashboard-opening function.

**Required change:** remove the hard-coded UUID fallback. Administrator access must be based on verified server/database authorization. UI role checks are for presentation only; RLS or trusted server-side checks must enforce permissions.

### 4.3 Supplier visibility

The migration allows suppliers to read their own records and administrators to read all supplier records. It does not provide an obvious public read policy for approved supplier business profiles. The storefront query attempts to join products to supplier business names.

**Required change:** decide which supplier fields are public and expose only those fields through a safe public view or carefully scoped policy. Do not make phone numbers, email addresses or private supplier details public just to display a supplier name.

### 4.4 Orders are not a complete checkout workflow

The current storefront sends cart contents to WhatsApp. The migration has order and order-item tables, but no verified server-side transactional checkout function was found in the inspected migration. The order table insert policy permits a customer-owned order (or a null customer ID), while no customer insert policy for order items was present in the inspected migration. There is no verified price/stock revalidation and atomic stock reservation workflow.

**Required change:** create a trusted server-side checkout function/RPC. It must validate product status, stock, current prices, currency and shipping; calculate totals itself; create the order and immutable order-item snapshots atomically; and reserve or deduct stock safely. Never trust totals supplied by the browser.

### 4.5 Payment records are only a schema foundation

The `payments` table is provider-neutral, but no PayChangu integration or trusted webhook handler was found in the inspected files.

**Required change:** implement payment initiation and server-side verification only after confirming PayChangu merchant capabilities, accepted currencies, settlement currencies and payout rails. Add idempotency and reconciliation. A browser redirect must never mark an order paid.

### 4.6 Supplier and dropshipping fulfilment are different workflows

The current supplier model expects suppliers to register and list their own products. International dropshipping may instead require Kelnix to source products from suppliers that never log into Kelnix and to purchase from them only after a customer order is paid.

**Required change:** keep the existing supplier model, but introduce a separate internal sourcing/fulfilment model. Each order item must preserve its supplier, supplier SKU, cost, currency, shipping option and relevant product details as a historical snapshot. Changing a product's supplier later must not rewrite past orders.

### 4.7 Financial integrity

The profit ledger is a useful starting point, but the schema alone does not calculate true net profit. The business will need to account for supplier cost, shipping, payment fees, currency conversion, taxes/duties where applicable, creator commissions, refunds and chargebacks.

**Required change:** record money movements and costs explicitly, store currency and exchange-rate snapshots, and derive reporting from reconciled records. Do not use an LLM to calculate or authorize financial transactions.

### 4.8 Security review still required

The migration enables RLS and includes guards against certain role/status changes. This is a good foundation, but it is not a complete security audit. In particular, policies and triggers need adversarial tests around profile updates, supplier/product updates, order ownership, status transitions and any future RPCs.

No service-role key should ever be placed in a `VITE_*` variable or shipped to the browser.

## 5. Recommended target modules

1. **Commerce:** storefront, product pages, cart, customer account, checkout and order history.
2. **Catalogue:** product data, variants, media, market availability, currency and pricing.
3. **Supplier intelligence:** supplier records, supplier SKUs, sourcing cost, reliability, shipping and evidence.
4. **Orders:** order lifecycle, immutable item snapshots, cancellations and returns.
5. **Fulfilment:** supplier purchase orders, supplier acknowledgements, tracking and delivery milestones.
6. **Payments and finance:** payment initiation/verification, refunds, reconciliation, supplier costs, fees and profit.
7. **Marketing and creators:** campaigns, creator records, affiliate links/codes, attribution and commissions.
8. **Administration and governance:** permissions, approvals, audit log, support tools and operational reporting.
9. **JARVIS integration:** controlled API access to read/analyse data and propose actions; sensitive actions require human approval.

Kelnix must continue to accept and track orders if JARVIS or an AI provider is offline.

## 6. Implementation sequence

### Stage 0 — Protect and document
- Keep all development on a feature branch.
- Preserve `main` as the stable baseline.
- Record architecture decisions and configuration requirements.
- Confirm the launch operating model and first target market before adding market-specific payment/shipping behavior.

### Stage 1 — Stabilize the current application
- Remove the hard-coded administrator UUID.
- Make demo catalogue mode explicit and prevent sample products from appearing as live inventory.
- Improve Supabase unconfigured/error states.
- Verify public supplier attribution without exposing private fields.
- Add automated build/lint/test checks.

### Stage 2 — Database and authorization
- Provision/confirm Supabase project and safely apply migrations.
- Review and test RLS policies.
- Add safe public catalogue/supplier views.
- Add secure role assignment and administrator bootstrap procedure.
- Add audit records for privileged changes.

### Stage 3 — Product and order foundation
- Add product detail/variant support as needed.
- Implement server-side transactional checkout.
- Add immutable order item and supplier snapshots.
- Add stock reservation and cancellation handling.
- Add customer order history and admin order workflow.

### Stage 4 — Payments and fulfilment
- Verify payment provider and settlement constraints.
- Add payment initiation, webhook verification, idempotency and reconciliation.
- Add supplier purchase orders, shipment/tracking and delivery state.
- Add refunds and returns workflow.

### Stage 5 — International dropshipping
- Add multiple markets, currencies, localized prices and shipping estimates.
- Add internal supplier/SKU sourcing and supplier reliability records.
- Add landed-cost and margin calculations.
- Confirm tax, duties, consumer protection and delivery obligations for the selected launch market.

### Stage 6 — Growth and JARVIS
- Add creator/affiliate management and attribution.
- Expose controlled operational APIs to JARVIS.
- Add AI research/analysis and human-approved action proposals.
- Add operational dashboards, monitoring and alerts.

### Stage 7 — Pilot and launch
- Test end-to-end with test payments and controlled fulfilment.
- Run security, privacy, backup/restore and failure-recovery checks.
- Pilot with a small product set and controlled order volume.
- Expand only after payment, delivery, support and unit economics are validated.

## 7. External decisions and access still required

These are business/configuration dependencies, not reasons to rewrite the code:

- Confirm whether the first launch is international dropshipping or Malawi multi-supplier marketplace.
- Select the first customer market and currency.
- Confirm the actual Supabase project and whether the migration has been applied.
- Confirm PayChangu's permitted customer payment currencies, settlement currencies, payout methods and international merchant rules.
- Choose supplier sourcing and shipping partners based on verified shipping times, tracking, returns and landed cost.
- Confirm production hosting and domain.
- Provide credentials only through secure provider dashboards/environment settings, never in chat or committed source files.

## 8. Scope boundaries for this audit

This is a source-level reuse/customization audit, not a penetration test, production readiness certification or proof that the current app builds. No code behavior has been runtime-tested, no database was modified, no payment provider was contacted, and no production deployment was changed.

## 9. Immediate next engineering tasks

1. Add CI build validation and a small test/lint foundation.
2. Refactor catalogue loading so demo products cannot masquerade as live inventory.
3. Remove the hard-coded admin UUID and rely on the verified profile role plus RLS.
4. Add a secure public supplier display mechanism.
5. Design and test transactional checkout before adding a payment gateway.

**Recommended first code change:** Stage 1 stabilization. It is small, reusable, low-risk, and protects the existing work before larger commerce features are added.
