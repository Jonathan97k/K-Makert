drop policy if exists "Admins can update marketplace enquiries" on public.marketplace_leads;
create policy "Admins can update marketplace enquiries"
on public.marketplace_leads for update to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (status in ('new','reviewing','contacted','qualified','closed','rejected'));
grant update on public.marketplace_leads to authenticated;