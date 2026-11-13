-- Kelnix international commerce foundation (additive migration)
-- Safe to apply only after reviewing against the target Supabase project.
-- This migration does not activate markets, payments, or supplier shipping methods.

begin;

-- Extend existing supplier records without removing Malawi marketplace fields.
alter table public.suppliers
  add column if not exists supplier_type text not null default 'local',
  add column if not exists country_code text not null default 'MW',
  add column if not exists legal_name text,
  add column if not exists website_url text,
  add column if not exists return_address text,
  add column if not exists verified_at timestamptz;

-- Supplier type and country are explicit, rather than inferred from phone/address.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'suppliers_supplier_type_check') then
    alter table public.suppliers add constraint suppliers_supplier_type_check
      check (supplier_type in ('local','international'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suppliers_country_code_check') then
    alter table public.suppliers add constraint suppliers_country_code_check
      check (country_code ~ '^[A-Z]{2}$');
  end if;
end $$;

-- Extend products with supplier-side commercial and fulfilment data.
alter table public.products
  add column if not exists supplier_sku text,
  add column if not exists supplier_cost_currency text not null default 'MWK',
  add column if not exists supplier_shipping_cost numeric(14,2) not null default 0,
  add column if not exists origin_country_code text not null default 'MW',
  add column if not exists destination_mode text not null default 'all',
  add column if not exists destination_country_codes text[] not null default '{}',
  add column if not exists processing_days_min integer,
  add column if not exists processing_days_max integer,
  add column if not exists shipping_days_min integer,
  add column if not exists shipping_days_max integer,
  add column if not exists supplier_data_checked_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_supplier_cost_currency_check') then
    alter table public.products add constraint products_supplier_cost_currency_check
      check (supplier_cost_currency ~ '^[A-Z]{3}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_origin_country_code_check') then
    alter table public.products add constraint products_origin_country_code_check
      check (origin_country_code ~ '^[A-Z]{2}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_supplier_shipping_cost_check') then
    alter table public.products add constraint products_supplier_shipping_cost_check
      check (supplier_shipping_cost >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_destination_mode_check') then
    alter table public.products add constraint products_destination_mode_check
      check (destination_mode in ('all','allowlist','blocklist'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_processing_days_check') then
    alter table public.products add constraint products_processing_days_check
      check ((processing_days_min is null or processing_days_min >= 0)
        and (processing_days_max is null or processing_days_max >= 0)
        and (processing_days_min is null or processing_days_max is null or processing_days_max >= processing_days_min));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_shipping_days_check') then
    alter table public.products add constraint products_shipping_days_check
      check ((shipping_days_min is null or shipping_days_min >= 0)
        and (shipping_days_max is null or shipping_days_max >= 0)
        and (shipping_days_min is null or shipping_days_max is null or shipping_days_max >= shipping_days_min));
  end if;
end $$;

-- Market configuration is deliberately empty: no destination market is enabled by default.
create table if not exists public.market_configs (
  country_code text primary key check (country_code ~ '^[A-Z]{2}$'),
  market_name text not null,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  is_enabled boolean not null default false,
  is_default boolean not null default false,
  tax_disclosure text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists market_configs_one_default_idx
  on public.market_configs(is_default) where is_default = true;

drop trigger if exists market_configs_set_updated_at on public.market_configs;
create trigger market_configs_set_updated_at before update on public.market_configs
for each row execute function public.set_updated_at();

alter table public.market_configs enable row level security;
drop policy if exists "public reads enabled markets" on public.market_configs;
create policy "public reads enabled markets" on public.market_configs
for select using (is_enabled = true or public.is_marketplace_admin());
drop policy if exists "admin manages markets" on public.market_configs;
create policy "admin manages markets" on public.market_configs
for all using (public.is_marketplace_admin())
with check (public.is_marketplace_admin());

-- Supplier shipping offers are proposals until an administrator approves them.
create table if not exists public.supplier_shipping_options (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  destination_country_code text not null check (destination_country_code ~ '^[A-Z]{2}$'),
  service_name text not null,
  shipping_currency text not null check (shipping_currency ~ '^[A-Z]{3}$'),
  shipping_cost numeric(14,2) not null check (shipping_cost >= 0),
  processing_days_min integer,
  processing_days_max integer,
  transit_days_min integer,
  transit_days_max integer,
  tracking_available boolean not null default false,
  return_supported boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_shipping_processing_days_check check (
    (processing_days_min is null or processing_days_min >= 0)
    and (processing_days_max is null or processing_days_max >= 0)
    and (processing_days_min is null or processing_days_max is null or processing_days_max >= processing_days_min)
  ),
  constraint supplier_shipping_transit_days_check check (
    (transit_days_min is null or transit_days_min >= 0)
    and (transit_days_max is null or transit_days_max >= 0)
    and (transit_days_min is null or transit_days_max is null or transit_days_max >= transit_days_min)
  )
);

create index if not exists supplier_shipping_destination_idx
  on public.supplier_shipping_options(destination_country_code, status, is_enabled);
create index if not exists supplier_shipping_supplier_idx
  on public.supplier_shipping_options(supplier_id);

drop trigger if exists supplier_shipping_options_set_updated_at on public.supplier_shipping_options;
create trigger supplier_shipping_options_set_updated_at before update on public.supplier_shipping_options
for each row execute function public.set_updated_at();

create or replace function public.guard_supplier_shipping_option_approval()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_marketplace_admin() then
    if tg_op = 'INSERT' then
      new.status := 'pending';
      new.is_enabled := false;
    elsif new.status is distinct from old.status or new.is_enabled is distinct from old.is_enabled
      or new.supplier_id is distinct from old.supplier_id then
      raise exception 'Only an administrator can approve, enable or reassign a shipping option';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_supplier_shipping_option_approval on public.supplier_shipping_options;
create trigger guard_supplier_shipping_option_approval
before insert or update on public.supplier_shipping_options
for each row execute function public.guard_supplier_shipping_option_approval();

alter table public.supplier_shipping_options enable row level security;
drop policy if exists "supplier manages own shipping options or admin" on public.supplier_shipping_options;
create policy "supplier manages own shipping options or admin"
on public.supplier_shipping_options for all
using (
  public.is_marketplace_admin()
  or exists (
    select 1 from public.suppliers s
    where s.id = supplier_id and s.owner_id = auth.uid()
  )
)
with check (
  public.is_marketplace_admin()
  or exists (
    select 1 from public.suppliers s
    where s.id = supplier_id and s.owner_id = auth.uid()
  )
);
drop policy if exists "public reads approved enabled shipping options" on public.supplier_shipping_options;
create policy "public reads approved enabled shipping options"
on public.supplier_shipping_options for select
using (status = 'approved' and is_enabled = true);

-- Add market/currency and exchange-rate audit fields to orders.
alter table public.orders
  add column if not exists market_country_code text not null default 'MW',
  add column if not exists currency_code text not null default 'MWK',
  add column if not exists shipping_amount numeric(14,2) not null default 0,
  add column if not exists tax_amount numeric(14,2) not null default 0,
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists base_currency_code text not null default 'MWK',
  add column if not exists exchange_rate_to_base numeric(20,10),
  add column if not exists exchange_rate_source text,
  add column if not exists exchange_rate_observed_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_market_country_code_check') then
    alter table public.orders add constraint orders_market_country_code_check
      check (market_country_code ~ '^[A-Z]{2}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_currency_code_check') then
    alter table public.orders add constraint orders_currency_code_check
      check (currency_code ~ '^[A-Z]{3}$' and base_currency_code ~ '^[A-Z]{3}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_commercial_amounts_check') then
    alter table public.orders add constraint orders_commercial_amounts_check
      check (shipping_amount >= 0 and tax_amount >= 0 and discount_amount >= 0
        and discount_amount <= subtotal + shipping_amount + tax_amount);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_exchange_rate_check') then
    alter table public.orders add constraint orders_exchange_rate_check
      check (exchange_rate_to_base is null or exchange_rate_to_base > 0);
  end if;
end $$;

-- Preserve the exact supplier/product terms used at checkout.
alter table public.order_items
  add column if not exists supplier_sku_snapshot text,
  add column if not exists supplier_name_snapshot text,
  add column if not exists supplier_country_code_snapshot text,
  add column if not exists supplier_cost_currency text not null default 'MWK',
  add column if not exists supplier_shipping_cost_snapshot numeric(14,2) not null default 0,
  add column if not exists customer_currency_code text not null default 'MWK',
  add column if not exists exchange_rate_to_customer_currency numeric(20,10);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_items_supplier_currency_check') then
    alter table public.order_items add constraint order_items_supplier_currency_check
      check (supplier_cost_currency ~ '^[A-Z]{3}$' and customer_currency_code ~ '^[A-Z]{3}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_items_supplier_shipping_cost_check') then
    alter table public.order_items add constraint order_items_supplier_shipping_cost_check
      check (supplier_shipping_cost_snapshot >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_items_supplier_country_check') then
    alter table public.order_items add constraint order_items_supplier_country_check
      check (supplier_country_code_snapshot is null or supplier_country_code_snapshot ~ '^[A-Z]{2}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_items_exchange_rate_check') then
    alter table public.order_items add constraint order_items_exchange_rate_check
      check (exchange_rate_to_customer_currency is null or exchange_rate_to_customer_currency > 0);
  end if;
end $$;

commit;
