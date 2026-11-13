-- Product media: allow multiple product photos and secure supplier-owned uploads.
alter table public.products
  add column if not exists image_urls text[] not null default '{}';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
on storage.objects for select
to public
using (bucket_id = 'product-images');

drop policy if exists "Suppliers upload own product images" on storage.objects;
create policy "Suppliers upload own product images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Suppliers update own product images or admin" on storage.objects;
create policy "Suppliers update own product images or admin"
on storage.objects for update
to authenticated
using (
  bucket_id = 'product-images'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_marketplace_admin())
)
with check (
  bucket_id = 'product-images'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_marketplace_admin())
);

drop policy if exists "Suppliers delete own product images or admin" on storage.objects;
create policy "Suppliers delete own product images or admin"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'product-images'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_marketplace_admin())
);
