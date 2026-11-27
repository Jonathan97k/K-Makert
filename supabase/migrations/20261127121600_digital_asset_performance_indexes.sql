-- Performance remediation for the digital asset marketplace.
-- These indexes cover foreign-key lookups reported by Supabase's advisor.
-- Kept as a migration on the isolated feature branch; do not apply to production
-- until the preview database is provisioned and validated.

create index if not exists idx_digital_asset_entitlements_asset_id
  on public.digital_asset_entitlements (asset_id);
create index if not exists idx_digital_asset_entitlements_buyer_id
  on public.digital_asset_entitlements (buyer_id);

create index if not exists idx_digital_asset_licence_acceptances_buyer_id
  on public.digital_asset_licence_acceptances (buyer_id);
create index if not exists idx_digital_asset_licence_acceptances_order_id
  on public.digital_asset_licence_acceptances (order_id);

create index if not exists idx_digital_asset_orders_asset_id
  on public.digital_asset_orders (asset_id);
create index if not exists idx_digital_asset_orders_buyer_id
  on public.digital_asset_orders (buyer_id);
create index if not exists idx_digital_asset_orders_seller_id
  on public.digital_asset_orders (seller_id);

create index if not exists idx_digital_asset_payouts_order_id
  on public.digital_asset_payouts (order_id);
create index if not exists idx_digital_asset_payouts_seller_id
  on public.digital_asset_payouts (seller_id);

create index if not exists idx_digital_asset_reviews_asset_id
  on public.digital_asset_reviews (asset_id);
create index if not exists idx_digital_asset_reviews_reviewer_id
  on public.digital_asset_reviews (reviewer_id);

create index if not exists idx_marketplace_leads_user_id
  on public.marketplace_leads (user_id);

-- jarvis_event_outbox and payment_webhook_events intentionally have RLS enabled
-- with no client policies. Only postgres/service_role has table privileges;
-- this is a deny-by-default, service-only design, not a missing public policy.
