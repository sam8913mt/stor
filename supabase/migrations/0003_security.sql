-- ARAM store · 0003 · Row Level Security policies and privileges
-- Run after 0002. Atomic; refuses to run out of order or twice.
begin;
select public.aram_require('0002', '0003');

-- Row Level Security. Default deny; explicit policies only.
do $$ declare t text; begin
  foreach t in array array['profiles','admin_roles','admin_users','categories','collections','products','collection_products',
    'product_variants','product_images','wishlist_items','coupons','orders','order_items','reviews','cms_pages','settings','activity_logs']
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

-- Admin full-access policies, one permission per table
do $$ declare r record; begin
  for r in select * from (values
    ('products','products.manage'),('product_variants','products.manage'),('product_images','products.manage'),
    ('categories','catalog.manage'),('collections','catalog.manage'),('collection_products','catalog.manage'),
    ('coupons','marketing.manage'),('reviews','reviews.manage'),('cms_pages','cms.manage'),
    ('settings','settings.manage'),('admin_roles','admins.manage'),('admin_users','admins.manage')) as v(t, p)
  loop
    execute format('create policy "admin all" on public.%I for all to authenticated using (public.has_perm(%L)) with check (public.has_perm(%L))', r.t, r.p, r.p);
  end loop;
end $$;

-- Public catalogue (read-only)
create policy "public read" on public.categories for select to anon, authenticated using (is_active);
create policy "public read" on public.collections for select to anon, authenticated using (is_active);
create policy "public read" on public.collection_products for select to anon, authenticated using (true);
create policy "public read" on public.products for select to anon, authenticated using (status = 'active');
create policy "public read" on public.product_variants for select to anon, authenticated
  using (is_active and exists (select 1 from public.products p where p.id = product_variants.product_id and p.status = 'active'));
create policy "public read" on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_images.product_id and p.status = 'active'));
create policy "public read" on public.cms_pages for select to anon, authenticated using (is_published);
create policy "public read" on public.settings for select to anon, authenticated using (is_public);
create policy "public read approved" on public.reviews for select to anon, authenticated using (status = 'approved');

-- Profiles
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "staff profile read" on public.profiles for select to authenticated
  using (public.has_perm('customers.manage') or public.has_perm('admins.manage'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone) on public.profiles to authenticated;

-- Wishlist
create policy "own wishlist" on public.wishlist_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Orders: customers read their own; creation only via place_order(); staff manage
create policy "own orders read" on public.orders for select to authenticated using (user_id = auth.uid());
create policy "staff orders read" on public.orders for select to authenticated using (public.has_perm('orders.manage'));
create policy "staff orders update" on public.orders for update to authenticated using (public.has_perm('orders.manage')) with check (public.has_perm('orders.manage'));
create policy "own items read" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid()));
create policy "staff items read" on public.order_items for select to authenticated using (public.has_perm('orders.manage'));

-- Reviews: own reviews visible; only verified buyers may write; always created as pending
create policy "own reviews read" on public.reviews for select to authenticated using (user_id = auth.uid());
create policy "buyers review" on public.reviews for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and exists (
    select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
    where o.user_id = auth.uid() and oi.product_id = reviews.product_id and o.status <> 'cancelled'));

-- Logs: read-only for staff; no insert/update/delete policy exists (triggers write as definer)
create policy "staff logs read" on public.activity_logs for select to authenticated using (public.has_perm('logs.view'));
revoke insert, update, delete on public.activity_logs from authenticated, anon;

insert into public.aram_migrations (version) values ('0003');
commit;
