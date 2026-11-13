-- Secure order placement foundation.
-- All customer order writes go through place_marketplace_order(); browser-supplied
-- prices, supplier IDs, totals, shipping fees and payment states are never trusted.

begin;


-- Checkout must be allowed to decrement stock on active products. Suppliers still
-- cannot edit active product details or alter supplier ownership/approval state.
create or replace function public.guard_marketplace_privileged_fields()
returns trigger language plpgsql security definer
set search_path = public
as $
begin
  if tg_table_name = 'profiles' then
    if not public.is_marketplace_admin() and new.role is distinct from old.role then
      raise exception 'Only an administrator can change account roles';
    end if;
  elsif tg_table_name = 'suppliers' then
    if not public.is_marketplace_admin() then
      if new.owner_id is distinct from old.owner_id
        or new.status is distinct from old.status
        or new.commission_rate is distinct from old.commission_rate then
        raise exception 'Only an administrator can change supplier ownership, approval or commission';
      end if;
    end if;
  elsif tg_table_name = 'products' then
    if not public.is_marketplace_admin() then
      if new.supplier_id is distinct from old.supplier_id then
        raise exception 'A product cannot be transferred to another supplier';
      end if;
      if new.status not in ('draft','pending') then
        if (to_jsonb(new) - 'stock_quantity' - 'updated_at')
          is distinct from (to_jsonb(old) - 'stock_quantity' - 'updated_at') then
          raise exception 'Only inventory quantity can change on an active product';
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$;


-- Keep the existing Malawi market available; no foreign market is enabled.
insert into public.market_configs(country_code, market_name, currency_code, is_enabled, is_default)
values ('MW', 'Malawi', 'MWK', true, true)
on conflict (country_code) do update
set market_name = excluded.market_name,
    currency_code = excluded.currency_code,
    is_enabled = true,
    is_default = true,
    updated_at = now();

-- One immutable supplier fulfilment/shipping snapshot per supplier per order.
create table if not exists public.order_supplier_fulfilments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  shipping_option_id uuid references public.supplier_shipping_options(id) on delete set null,
  supplier_name_snapshot text not null,
  supplier_country_code_snapshot text not null check (supplier_country_code_snapshot ~ '^[A-Z]{2}$'),
  service_name_snapshot text not null,
  shipping_currency_snapshot text not null check (shipping_currency_snapshot ~ '^[A-Z]{3}$'),
  shipping_cost_snapshot numeric(14,2) not null check (shipping_cost_snapshot >= 0),
  processing_days_min_snapshot integer,
  processing_days_max_snapshot integer,
  transit_days_min_snapshot integer,
  transit_days_max_snapshot integer,
  tracking_available_snapshot boolean not null default false,
  return_supported_snapshot boolean not null default false,
  created_at timestamptz not null default now(),
  unique(order_id, supplier_id)
);

create index if not exists order_supplier_fulfilments_supplier_idx
  on public.order_supplier_fulfilments(supplier_id, created_at desc);

alter table public.order_supplier_fulfilments enable row level security;
drop policy if exists "customer supplier admin read fulfilment snapshots" on public.order_supplier_fulfilments;
create policy "customer supplier admin read fulfilment snapshots"
on public.order_supplier_fulfilments for select
using (
  public.is_marketplace_admin()
  or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
  or exists (select 1 from public.suppliers s where s.id = supplier_id and s.owner_id = auth.uid())
);

-- Remove direct customer inserts. Only the database function below may create
-- customer orders and line items. Admin maintenance remains governed by existing policies.
drop policy if exists "customer creates own orders" on public.orders;
revoke insert on public.orders from anon, authenticated;
revoke insert on public.order_items from anon, authenticated;
revoke insert, update, delete on public.order_supplier_fulfilments from anon, authenticated;

create or replace function public.place_marketplace_order(
  p_items jsonb,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_district text,
  p_client_request_id uuid,
  p_market_country_code text default 'MW',
  p_shipping_option_ids jsonb default '{}'::jsonb,
  p_notes text default null
)
returns table(order_id uuid, order_number text, currency_code text, subtotal numeric, shipping_amount numeric, total numeric)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid := auth.uid();
  v_market public.market_configs%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_existing_order public.orders%rowtype;
  v_subtotal numeric(14,2) := 0;
  v_shipping numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_supplier public.suppliers%rowtype;
  v_option public.supplier_shipping_options%rowtype;
  v_qty integer;
  v_product_id uuid;
  v_supplier_id uuid;
  v_option_id uuid;
  v_supplier_ids uuid[] := array[]::uuid[];
  v_seen_products uuid[] := array[]::uuid[];
  v_line_total numeric(14,2);
begin
  if v_customer_id is null then
    raise exception 'Sign in before placing an order' using errcode = '28000';
  end if;

  if p_client_request_id is null then
    raise exception 'A unique checkout request ID is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_customer_id::text || ':' || p_client_request_id::text, 0));

  select * into v_existing_order from public.orders
  where customer_id = v_customer_id and client_request_id = p_client_request_id;
  if found then
    return query select v_existing_order.id, v_existing_order.order_number,
      v_existing_order.currency_code, v_existing_order.subtotal,
      v_existing_order.shipping_amount, v_existing_order.total;
    return;
  end if;

  if p_customer_name is null or length(trim(p_customer_name)) < 2 or length(p_customer_name) > 160 then
    raise exception 'Enter a valid customer name';
  end if;
  if p_customer_phone is null or length(trim(p_customer_phone)) < 5 or length(p_customer_phone) > 40 then
    raise exception 'Enter a valid customer phone number';
  end if;
  if p_delivery_address is null or length(trim(p_delivery_address)) < 5 or length(p_delivery_address) > 500 then
    raise exception 'Enter a complete delivery address';
  end if;
  if p_district is not null and length(p_district) > 120 then
    raise exception 'District is too long';
  end if;
  if p_notes is not null and length(p_notes) > 1000 then
    raise exception 'Order notes are too long';
  end if;
  if p_market_country_code is null or p_market_country_code !~ '^[A-Z]{2}$' then
    raise exception 'Invalid destination market';
  end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Your basket must be a JSON array';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'Your basket must contain between 1 and 30 product lines';
  end if;
  if p_shipping_option_ids is null or jsonb_typeof(p_shipping_option_ids) <> 'object' then
    raise exception 'Shipping selections are invalid';
  end if;

  select * into v_market
  from public.market_configs
  where country_code = p_market_country_code and is_enabled = true;
  if not found then
    raise exception 'This destination market is not currently accepting orders';
  end if;

  -- Validate and lock each product, calculate prices from the database, and
  -- reserve available stock in the same transaction.
  for v_item in select value from jsonb_array_elements(p_items) order by value->>'product_id'
  loop
    if jsonb_typeof(v_item) <> 'object'
      or coalesce(v_item->>'product_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(v_item->>'quantity','') !~ '^[0-9]{1,4}$' then
      raise exception 'A basket line has an invalid product or quantity';
    end if;
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 100 then
      raise exception 'Each product quantity must be between 1 and 100';
    end if;
    if v_product_id = any(v_seen_products) then
      raise exception 'Duplicate product lines are not allowed';
    end if;
    v_seen_products := array_append(v_seen_products, v_product_id);

    select * into v_product
    from public.products
    where id = v_product_id
    for update;
    if not found or v_product.status <> 'active' then
      raise exception 'A product in your basket is no longer available';
    end if;
    if v_product.stock_quantity < v_qty then
      raise exception 'Insufficient stock for product: %', v_product.name;
    end if;

    select * into v_supplier from public.suppliers where id = v_product.supplier_id;
    if not found or v_supplier.status <> 'approved' then
      raise exception 'A product supplier is not currently approved';
    end if;

    if v_product.destination_mode = 'allowlist'
      and not (p_market_country_code = any(v_product.destination_country_codes)) then
      raise exception 'A product cannot be shipped to the selected destination';
    elsif v_product.destination_mode = 'blocklist'
      and p_market_country_code = any(v_product.destination_country_codes) then
      raise exception 'A product cannot be shipped to the selected destination';
    end if;

    v_subtotal := v_subtotal + (v_product.selling_price * v_qty);
    if not (v_supplier.id = any(v_supplier_ids)) then
      v_supplier_ids := array_append(v_supplier_ids, v_supplier.id);
    end if;
    update public.products set stock_quantity = stock_quantity - v_qty where id = v_product.id;
  end loop;

  -- Require one administrator-approved shipping service per supplier.
  -- Currency conversion is intentionally not guessed: shipping must be priced
  -- in the selected market currency until a verified FX/pricing service exists.
  foreach v_supplier_id in array v_supplier_ids
  loop
    if coalesce(p_shipping_option_ids->>v_supplier_id::text,'') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Choose an available shipping service for every supplier';
    end if;
    v_option_id := (p_shipping_option_ids->>v_supplier_id::text)::uuid;
    select * into v_option
    from public.supplier_shipping_options
    where id = v_option_id
      and supplier_id = v_supplier_id
      and destination_country_code = p_market_country_code
      and status = 'approved'
      and is_enabled = true;
    if not found then
      raise exception 'A selected shipping service is unavailable';
    end if;
    if v_option.shipping_currency <> v_market.currency_code then
      raise exception 'Shipping currency does not match the destination market; administrator configuration is required';
    end if;
    v_shipping := v_shipping + v_option.shipping_cost;
  end loop;

  v_total := v_subtotal + v_shipping;
  insert into public.orders(
    customer_id, customer_name, customer_phone, delivery_address, district, notes,
    subtotal, delivery_fee, total, status, payment_status,
    market_country_code, currency_code, shipping_amount, tax_amount, discount_amount,
    base_currency_code, client_request_id
  ) values (
    v_customer_id, trim(p_customer_name), trim(p_customer_phone), trim(p_delivery_address),
    nullif(trim(coalesce(p_district,'')),''), nullif(trim(coalesce(p_notes,'')), ''),
    v_subtotal, v_shipping, v_total, 'pending', 'unpaid',
    p_market_country_code, v_market.currency_code, v_shipping, 0, 0, v_market.currency_code,
    p_client_request_id
  ) returning id, orders.order_number into v_order_id, v_order_number;

  -- Re-read products to write authoritative immutable line snapshots.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id = v_product_id;
    select * into v_supplier from public.suppliers where id = v_product.supplier_id;
    v_line_total := v_product.selling_price * v_qty;
    insert into public.order_items(
      order_id, product_id, supplier_id, product_name, quantity, unit_price, unit_cost,
      supplier_sku_snapshot, supplier_name_snapshot, supplier_country_code_snapshot,
      supplier_cost_currency, supplier_shipping_cost_snapshot, customer_currency_code
    ) values (
      v_order_id, v_product.id, v_supplier.id, v_product.name, v_qty,
      v_product.selling_price, v_product.cost_price,
      coalesce(v_product.supplier_sku, v_product.sku),
      v_supplier.business_name, v_supplier.country_code,
      v_product.supplier_cost_currency, 0, v_market.currency_code
    );
  end loop;

  foreach v_supplier_id in array v_supplier_ids
  loop
    v_option_id := (p_shipping_option_ids->>v_supplier_id::text)::uuid;
    select * into v_option from public.supplier_shipping_options where id = v_option_id;
    select * into v_supplier from public.suppliers where id = v_supplier_id;
    insert into public.order_supplier_fulfilments(
      order_id, supplier_id, shipping_option_id, supplier_name_snapshot,
      supplier_country_code_snapshot, service_name_snapshot, shipping_currency_snapshot,
      shipping_cost_snapshot, processing_days_min_snapshot, processing_days_max_snapshot,
      transit_days_min_snapshot, transit_days_max_snapshot,
      tracking_available_snapshot, return_supported_snapshot
    ) values (
      v_order_id, v_supplier_id, v_option.id, v_supplier.business_name,
      v_supplier.country_code, v_option.service_name, v_option.shipping_currency,
      v_option.shipping_cost, v_option.processing_days_min, v_option.processing_days_max,
      v_option.transit_days_min, v_option.transit_days_max,
      v_option.tracking_available, v_option.return_supported
    );
  end loop;

  return query select v_order_id, v_order_number, v_market.currency_code, v_subtotal, v_shipping, v_total;
end;
$;

revoke all on function public.place_marketplace_order(jsonb,text,text,text,text,uuid,text,jsonb,text) from public, anon;
grant execute on function public.place_marketplace_order(jsonb,text,text,text,text,uuid,text,jsonb,text) to authenticated;

commit;
