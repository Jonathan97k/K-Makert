create table if not exists public.digital_asset_payments (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.digital_asset_orders(id) on delete restrict,
 provider text not null default 'paychangu' check (provider='paychangu'),
 provider_reference text not null unique, provider_transaction_id text,
 amount numeric(14,2) not null check (amount > 0),
 currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
 status text not null default 'initiated' check (status in ('initiated','pending','succeeded','failed','cancelled','review_required')),
 checkout_url text, failure_reason text, provider_metadata jsonb not null default '{}'::jsonb,
 verified_at timestamptz, paid_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists digital_asset_payments_order_idx on public.digital_asset_payments(order_id,created_at desc);
alter table public.digital_asset_payments enable row level security;
drop policy if exists "Order parties can view digital asset payments" on public.digital_asset_payments;
create policy "Order parties can view digital asset payments" on public.digital_asset_payments for select to authenticated using (
 exists(select 1 from public.digital_asset_orders o where o.id=order_id and (o.buyer_id=auth.uid() or o.seller_id=auth.uid()))
 or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
);
grant select on public.digital_asset_payments to authenticated;