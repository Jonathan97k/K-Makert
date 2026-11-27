-- KELNIX digital marketplace account roles.
-- Buyer access is enabled by default. Seller requests are pending until admin approval.
create table if not exists public.marketplace_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  buyer_enabled boolean not null default true,
  seller_status text not null default 'not_requested'
    check (seller_status in ('not_requested','pending','approved','rejected','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.marketplace_memberships enable row level security;
revoke all on public.marketplace_memberships from anon, authenticated;
grant select, insert, update on public.marketplace_memberships to authenticated;

drop policy if exists "Users can view own marketplace membership" on public.marketplace_memberships;
create policy "Users can view own marketplace membership"
on public.marketplace_memberships for select to authenticated
using (user_id = (select auth.uid()) or public.is_marketplace_admin());

drop policy if exists "Users can create own initial marketplace membership" on public.marketplace_memberships;
create policy "Users can create own initial marketplace membership"
on public.marketplace_memberships for insert to authenticated
with check (user_id = (select auth.uid()) and buyer_enabled = true and seller_status in ('not_requested','pending'));

drop policy if exists "Admins manage marketplace memberships" on public.marketplace_memberships;
create policy "Admins manage marketplace memberships"
on public.marketplace_memberships for all to authenticated
using (public.is_marketplace_admin())
with check (public.is_marketplace_admin());

create or replace function public.handle_new_marketplace_membership()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare requested_intent text;
begin
  requested_intent := coalesce(new.raw_user_meta_data ->> 'marketplace_intent', 'buyer');
  insert into public.marketplace_memberships (user_id,buyer_enabled,seller_status)
  values (new.id,true,case when requested_intent in ('seller','both') then 'pending' else 'not_requested' end)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_marketplace_membership() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_marketplace_membership on auth.users;
create trigger on_auth_user_created_marketplace_membership after insert on auth.users
for each row execute function public.handle_new_marketplace_membership();

revoke update on public.marketplace_memberships from authenticated;
grant update (buyer_enabled,updated_at) on public.marketplace_memberships to authenticated;
drop policy if exists "Users can update own buyer preference" on public.marketplace_memberships;
create policy "Users can update own buyer preference"
on public.marketplace_memberships for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function public.admin_set_marketplace_seller_status(target_user_id uuid,new_status text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_marketplace_admin() then raise exception 'Administrator access required'; end if;
  if new_status not in ('pending','approved','rejected','suspended','not_requested') then raise exception 'Invalid seller status'; end if;
  update public.marketplace_memberships set seller_status=new_status,updated_at=now() where user_id=target_user_id;
  if not found then raise exception 'Marketplace membership not found'; end if;
end;
$$;
revoke all on function public.admin_set_marketplace_seller_status(uuid,text) from public,anon;
grant execute on function public.admin_set_marketplace_seller_status(uuid,text) to authenticated;

-- Users cannot promote themselves to legacy admin/supplier roles.
revoke update on public.profiles from authenticated;
grant update (full_name,phone,updated_at) on public.profiles to authenticated;

drop policy if exists "Authenticated users can submit own digital assets" on public.digital_asset_listings;
drop policy if exists "Authenticated users can submit own digital assets" on public.digital_asset_listings;
drop policy if exists "Marketplace sellers can create own digital assets" on public.digital_asset_listings;
create policy "Marketplace sellers can create own digital assets"
on public.digital_asset_listings for insert to authenticated
with check (
 seller_id=(select auth.uid()) and (
  (status='draft' and exists(select 1 from public.marketplace_memberships m where m.user_id=(select auth.uid()) and m.seller_status in ('pending','approved')))
  or (status='submitted' and rights_attested=true and exists(select 1 from public.marketplace_memberships m where m.user_id=(select auth.uid()) and m.seller_status='approved'))
 )
);
drop policy if exists "Sellers can edit own unapproved digital assets" on public.digital_asset_listings;
drop policy if exists "Sellers can edit own unapproved digital assets" on public.digital_asset_listings;
drop policy if exists "Marketplace sellers can edit own eligible digital assets" on public.digital_asset_listings;
create policy "Marketplace sellers can edit own eligible digital assets"
on public.digital_asset_listings for update to authenticated
using (seller_id=(select auth.uid()) and status in ('draft','submitted') and exists(select 1 from public.marketplace_memberships m where m.user_id=(select auth.uid()) and m.seller_status in ('pending','approved')))
with check (
 seller_id=(select auth.uid()) and status in ('draft','submitted') and (
  (status='draft' and exists(select 1 from public.marketplace_memberships m where m.user_id=(select auth.uid()) and m.seller_status in ('pending','approved')))
  or (status='submitted' and rights_attested=true and exists(select 1 from public.marketplace_memberships m where m.user_id=(select auth.uid()) and m.seller_status='approved'))
 )
);
