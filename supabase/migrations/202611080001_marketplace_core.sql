-- Kelnix Marketplace core schema
-- Apply with Supabase SQL Editor or Supabase CLI after provisioning the project.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  role text not null default 'customer' check (role in ('customer','supplier','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete restrict,
  business_name text not null,
  contact_name text not null,
  phone text not null,
  email text,
  address text,
  district text,
  description text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  commission_rate numeric(5,2) not null default 10 check (commission_rate >= 0 and commission_rate <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  name text not null,
  description text,
  category text not null,
  sku text,
  unit text not null default 'piece',
  image_url text,
  cost_price numeric(14,2) not null default 0 check (cost_price >= 0),
  selling_price numeric(14,2) not null check (selling_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  status text not null default 'pending' check (status in ('draft','pending','active','rejected','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, sku)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('KM-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  customer_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  delivery_address text,
  district text,
  notes text,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(14,2) not null default 0 check (delivery_fee >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  status text not null default 'pending' check (status in ('pending','confirmed','processing','ready','dispatched','delivered','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','failed','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0),
  line_total numeric(14,2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  provider_reference text unique,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'MWK',
  status text not null default 'initiated' check (status in ('initiated','pending','succeeded','failed','refunded')),
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profit_ledger (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  gross_amount numeric(14,2) not null,
  supplier_cost numeric(14,2) not null,
  platform_fee numeric(14,2) not null default 0,
  net_profit numeric(14,2) not null,
  currency text not null default 'MWK',
  created_at timestamptz not null default now()
);

create index if not exists products_supplier_status_idx on public.products(supplier_id, status);
create index if not exists products_category_status_idx on public.products(category, status);
create index if not exists orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index if not exists order_items_supplier_idx on public.order_items(supplier_id);
create index if not exists payments_order_idx on public.payments(order_id);

do $$
declare t text;
begin
  foreach t in array array['profiles','suppliers','products','orders','payments'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

create or replace function public.is_marketplace_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.profit_ledger enable row level security;

drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles for select
using (id = auth.uid() or public.is_marketplace_admin());

drop policy if exists "profiles update own basic details" on public.profiles;
create policy "profiles update own basic details" on public.profiles for update
using (id = auth.uid() or public.is_marketplace_admin())
with check (id = auth.uid() or public.is_marketplace_admin());

drop policy if exists "supplier reads own or admin" on public.suppliers;
create policy "supplier reads own or admin" on public.suppliers for select
using (owner_id = auth.uid() or public.is_marketplace_admin());

drop policy if exists "supplier submits application" on public.suppliers;
create policy "supplier submits application" on public.suppliers for insert
with check (owner_id = auth.uid() and status = 'pending');

drop policy if exists "supplier updates own application or admin" on public.suppliers;
create policy "supplier updates own application or admin" on public.suppliers for update
using (owner_id = auth.uid() or public.is_marketplace_admin())
with check (owner_id = auth.uid() or public.is_marketplace_admin());

drop policy if exists "public reads active products" on public.products;
create policy "public reads active products" on public.products for select
using (status = 'active' or public.is_marketplace_admin() or exists (
  select 1 from public.suppliers s where s.id = supplier_id and s.owner_id = auth.uid()
));

drop policy if exists "approved supplier creates products" on public.products;
create policy "approved supplier creates products" on public.products for insert
with check (exists (
  select 1 from public.suppliers s
  where s.id = supplier_id and s.owner_id = auth.uid() and s.status = 'approved'
) and status in ('draft','pending'));

drop policy if exists "supplier manages own products" on public.products;
create policy "supplier manages own products" on public.products for update
using (exists (select 1 from public.suppliers s where s.id = supplier_id and s.owner_id = auth.uid()) or public.is_marketplace_admin())
with check (exists (select 1 from public.suppliers s where s.id = supplier_id and s.owner_id = auth.uid()) or public.is_marketplace_admin());

drop policy if exists "admin deletes products" on public.products;
create policy "admin deletes products" on public.products for delete
using (public.is_marketplace_admin());

drop policy if exists "customer reads own orders or admin" on public.orders;
create policy "customer reads own orders or admin" on public.orders for select
using (customer_id = auth.uid() or public.is_marketplace_admin());

drop policy if exists "customer creates own orders" on public.orders;
create policy "customer creates own orders" on public.orders for insert
with check (customer_id = auth.uid() or customer_id is null);

drop policy if exists "supplier sees orders containing own products" on public.order_items;
create policy "supplier sees orders containing own products" on public.order_items for select
using (exists (select 1 from public.suppliers s where s.id = supplier_id and s.owner_id = auth.uid()) or public.is_marketplace_admin());

drop policy if exists "customer sees own order items" on public.order_items;
create policy "customer sees own order items" on public.order_items for select
using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));

drop policy if exists "admin manages order items" on public.order_items;
create policy "admin manages order items" on public.order_items for all
using (public.is_marketplace_admin()) with check (public.is_marketplace_admin());

drop policy if exists "customer reads own payments or admin" on public.payments;
create policy "customer reads own payments or admin" on public.payments for select
using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()) or public.is_marketplace_admin());

drop policy if exists "admin manages payments" on public.payments;
create policy "admin manages payments" on public.payments for all
using (public.is_marketplace_admin()) with check (public.is_marketplace_admin());

drop policy if exists "admin reads profit ledger" on public.profit_ledger;
create policy "admin reads profit ledger" on public.profit_ledger for select
using (public.is_marketplace_admin());

drop policy if exists "admin manages profit ledger" on public.profit_ledger;
create policy "admin manages profit ledger" on public.profit_ledger for all
using (public.is_marketplace_admin()) with check (public.is_marketplace_admin());

-- IMPORTANT:
-- Do not expose the service-role key in browser code.
-- Set the first administrator's role manually from the Supabase SQL editor after
-- creating that user's account:
-- update public.profiles set role = 'admin' where id = '<auth-user-uuid>';
-- Supplier status/role approval must be performed by an administrator.


-- Guard fields that suppliers/customers must never self-approve or escalate.
create or replace function public.guard_marketplace_privileged_fields()
returns trigger language plpgsql security definer
set search_path = public
as $$
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
        raise exception 'Supplier product changes must be submitted for review';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_privileged_fields on public.profiles;
create trigger guard_profile_privileged_fields before update on public.profiles
for each row execute function public.guard_marketplace_privileged_fields();

drop trigger if exists guard_supplier_privileged_fields on public.suppliers;
create trigger guard_supplier_privileged_fields before update on public.suppliers
for each row execute function public.guard_marketplace_privileged_fields();

drop trigger if exists guard_product_privileged_fields on public.products;
create trigger guard_product_privileged_fields before update on public.products
for each row execute function public.guard_marketplace_privileged_fields();
