create table if not exists public.marketplace_leads (
 id uuid primary key default gen_random_uuid(),
 lead_type text not null check (lead_type in ('buyer_interest','seller_application','general_enquiry')),
 full_name text not null check (char_length(trim(full_name)) between 2 and 120),
 email text not null check (char_length(trim(email)) between 5 and 254),
 organisation text,
 country text not null default 'Malawi',
 asset_type text,
 technologies text,
 repository_url text,
 repository_size text,
 message text not null check (char_length(trim(message)) between 10 and 5000),
 rights_confirmed boolean not null default false,
 status text not null default 'new' check (status in ('new','reviewing','contacted','qualified','closed','rejected')),
 user_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.marketplace_leads enable row level security;
drop policy if exists "Public can submit marketplace enquiries" on public.marketplace_leads;
create policy "Public can submit marketplace enquiries" on public.marketplace_leads for insert to anon, authenticated
with check (status='new' and (user_id is null or user_id=auth.uid()) and (lead_type <> 'seller_application' or rights_confirmed=true));
drop policy if exists "Users can read their own marketplace enquiries" on public.marketplace_leads;
create policy "Users can read their own marketplace enquiries" on public.marketplace_leads for select to authenticated
using (user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
grant insert on public.marketplace_leads to anon, authenticated;
grant select on public.marketplace_leads to authenticated;