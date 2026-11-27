create table if not exists public.digital_asset_listings (
 id uuid primary key default gen_random_uuid(),
 seller_id uuid not null references auth.users(id) on delete restrict,
 title text not null check (char_length(trim(title)) between 5 and 180),
 summary text not null check (char_length(trim(summary)) between 30 and 5000),
 asset_type text not null check (asset_type in ('private_repository','unity_project','unreal_project','game_assets','technical_dataset','developer_tool','other')),
 technologies text[] not null default '{}',
 engine_or_framework text,
 commit_count integer check (commit_count is null or commit_count >= 0),
 merged_pr_count integer check (merged_pr_count is null or merged_pr_count >= 0),
 first_party_loc integer check (first_party_loc is null or first_party_loc >= 0),
 development_months integer check (development_months is null or development_months >= 0),
 has_documentation boolean not null default false,
 has_tests boolean not null default false,
 provenance_summary text,
 licence_type text not null check (licence_type in ('non_exclusive','exclusive','commercial','custom')),
 asking_price numeric(14,2) not null check (asking_price > 0),
 currency_code text not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
 rights_attested boolean not null default false,
 status text not null default 'draft' check (status in ('draft','submitted','under_review','approved','rejected','archived')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint digital_asset_rights_required check (status not in ('submitted','under_review','approved') or rights_attested = true)
);
create index if not exists digital_asset_listings_seller_idx on public.digital_asset_listings(seller_id);
create index if not exists digital_asset_listings_status_idx on public.digital_asset_listings(status);
alter table public.digital_asset_listings enable row level security;
drop policy if exists "Public can view approved digital assets" on public.digital_asset_listings;
create policy "Public can view approved digital assets" on public.digital_asset_listings for select to anon, authenticated using (status='approved');
drop policy if exists "Sellers can view own digital assets" on public.digital_asset_listings;
create policy "Sellers can view own digital assets" on public.digital_asset_listings for select to authenticated using (seller_id=auth.uid());
drop policy if exists "Admins can view all digital assets" on public.digital_asset_listings;
create policy "Admins can view all digital assets" on public.digital_asset_listings for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "Authenticated users can submit own digital assets" on public.digital_asset_listings;
create policy "Authenticated users can submit own digital assets" on public.digital_asset_listings for insert to authenticated with check (seller_id=auth.uid() and status in ('draft','submitted') and (status='draft' or rights_attested=true));
drop policy if exists "Sellers can edit own unapproved digital assets" on public.digital_asset_listings;
create policy "Sellers can edit own unapproved digital assets" on public.digital_asset_listings for update to authenticated using (seller_id=auth.uid() and status in ('draft','submitted')) with check (seller_id=auth.uid() and status in ('draft','submitted') and (status='draft' or rights_attested=true));
drop policy if exists "Admins can manage digital asset listings" on public.digital_asset_listings;
create policy "Admins can manage digital asset listings" on public.digital_asset_listings for all to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
grant select on public.digital_asset_listings to anon, authenticated;
grant insert, update on public.digital_asset_listings to authenticated;

create table if not exists public.digital_asset_reviews (
 id uuid primary key default gen_random_uuid(), asset_id uuid not null references public.digital_asset_listings(id) on delete cascade,
 reviewer_id uuid not null references auth.users(id) on delete restrict,
 decision text not null check (decision in ('submitted','under_review','approved','rejected','needs_information')),
 review_notes text, evidence_checked text, created_at timestamptz not null default now()
);
alter table public.digital_asset_reviews enable row level security;
drop policy if exists "Admins can manage digital asset reviews" on public.digital_asset_reviews;
create policy "Admins can manage digital asset reviews" on public.digital_asset_reviews for all to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
grant select, insert, update on public.digital_asset_reviews to authenticated;

create table if not exists public.digital_asset_orders (
 id uuid primary key default gen_random_uuid(), order_number text not null unique,
 buyer_id uuid not null references auth.users(id) on delete restrict, seller_id uuid not null references auth.users(id) on delete restrict,
 asset_id uuid not null references public.digital_asset_listings(id) on delete restrict, asset_title_snapshot text not null,
 licence_type text not null, licence_terms text not null, amount numeric(14,2) not null check (amount > 0),
 currency_code text not null check (currency_code ~ '^[A-Z]{3}$'), platform_fee numeric(14,2) not null default 0 check (platform_fee >= 0),
 seller_net_amount numeric(14,2) not null check (seller_net_amount >= 0),
 payment_status text not null default 'pending' check (payment_status in ('pending','processing','paid','failed','cancelled','refunded','disputed','review_required')),
 fulfilment_status text not null default 'awaiting_payment' check (fulfilment_status in ('awaiting_payment','awaiting_licence','ready_for_delivery','delivered','blocked','cancelled')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.digital_asset_orders enable row level security;
drop policy if exists "Order parties can view their digital asset orders" on public.digital_asset_orders;
create policy "Order parties can view their digital asset orders" on public.digital_asset_orders for select to authenticated using (buyer_id=auth.uid() or seller_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
grant select on public.digital_asset_orders to authenticated;

create table if not exists public.digital_asset_licence_acceptances (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.digital_asset_orders(id) on delete restrict,
 buyer_id uuid not null references auth.users(id) on delete restrict, licence_version text not null,
 terms_sha256 text not null check (terms_sha256 ~ '^[a-f0-9]{64}$'), accepted_at timestamptz not null default now(),
 ip_hash text, user_agent text
);
alter table public.digital_asset_licence_acceptances enable row level security;
drop policy if exists "Buyers and admins can read licence acceptances" on public.digital_asset_licence_acceptances;
create policy "Buyers and admins can read licence acceptances" on public.digital_asset_licence_acceptances for select to authenticated using (buyer_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
grant select on public.digital_asset_licence_acceptances to authenticated;

create table if not exists public.digital_asset_entitlements (
 id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.digital_asset_orders(id) on delete restrict,
 buyer_id uuid not null references auth.users(id) on delete restrict, asset_id uuid not null references public.digital_asset_listings(id) on delete restrict,
 access_method text not null check (access_method in ('private_storage','controlled_repository_invite','manual_handover')),
 delivery_reference text, status text not null default 'pending' check (status in ('pending','active','revoked','expired')),
 activated_at timestamptz, expires_at timestamptz, created_at timestamptz not null default now()
);
alter table public.digital_asset_entitlements enable row level security;
drop policy if exists "Buyers and admins can read entitlements" on public.digital_asset_entitlements;
create policy "Buyers and admins can read entitlements" on public.digital_asset_entitlements for select to authenticated using (buyer_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
grant select on public.digital_asset_entitlements to authenticated;

create table if not exists public.digital_asset_payouts (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.digital_asset_orders(id) on delete restrict,
 seller_id uuid not null references auth.users(id) on delete restrict, amount numeric(14,2) not null check (amount >= 0),
 currency_code text not null check (currency_code ~ '^[A-Z]{3}$'), payout_method text, payout_reference text,
 status text not null default 'held' check (status in ('held','approved','processing','paid','failed','cancelled')),
 paid_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.digital_asset_payouts enable row level security;
drop policy if exists "Sellers and admins can read payout status" on public.digital_asset_payouts;
create policy "Sellers and admins can read payout status" on public.digital_asset_payouts for select to authenticated using (seller_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
grant select on public.digital_asset_payouts to authenticated;