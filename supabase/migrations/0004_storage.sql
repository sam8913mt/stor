-- ARAM store · 0004 · Storage bucket for product photos
-- Run after 0003. Atomic; refuses to run out of order or twice.
begin;
select public.aram_require('0003', '0004');
do $$ begin
  if to_regclass('storage.objects') is null then raise exception 'ARAM install: Supabase Storage is not available in this project. Nothing was changed.'; end if;
end $$;
-- Public bucket for product photos; only staff with products.manage may write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 3145728, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = excluded.allowed_mime_types;

create policy "product images public read" on storage.objects for select to anon, authenticated using (bucket_id = 'product-images');
create policy "product images staff insert" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.has_perm('products.manage'));
create policy "product images staff update" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.has_perm('products.manage'));
create policy "product images staff delete" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.has_perm('products.manage'));

insert into public.aram_migrations (version) values ('0004');
commit;
