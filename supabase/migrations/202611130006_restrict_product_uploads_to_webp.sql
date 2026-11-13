-- Restrict the product-media bucket to sanitized WebP images only.
-- The storefront converts validated JPEG/PNG/WebP source photos into clean WebP before upload.
update storage.buckets
set allowed_mime_types = array['image/webp']::text[],
    file_size_limit = 8388608,
    public = true
where id = 'product-images';
