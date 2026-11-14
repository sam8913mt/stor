-- =====================================================================================================================
-- ARAM STORE · 00_INSTALL_ALL.sql · COMPLETE DATABASE INSTALLER (canonical one-file installation)
-- =====================================================================================================================
-- USE: Supabase dashboard → SQL Editor → New query → paste this whole file → Run. FRESH Supabase project only.
--
-- WHAT IT DOES: installs, in dependency order and as ONE transaction: tables, keys, indexes, constraints, functions, triggers,
--   Row Level Security + policies, storage bucket + policies, roles/permissions, order/inventory/coupon/cancellation logic,
--   payment objects, email outbox, saved addresses, server-side search/pagination, bilingual (fa/en) fields, store settings,
--   activity logging, hardening, and non-destructive seed data. Equivalent to running 01…07 one by one.
--
-- SAFETY
--   * One transaction (begin … commit): if ANY statement fails, NOTHING is installed and nothing is changed. Every object here
--     is transactional in PostgreSQL, so there is no part that must run outside the transaction.
--   * Install tracker `public.aram_migrations` + guards: refuses to run on a project that already has ARAM tables
--     (it never overwrites or drops anything). Re-running after success stops at step 0001 with a clear message.
--   * Seed data only INSERTS MISSING rows and fills EMPTY English fields; values edited by an administrator are never overwritten.
--   * No extensions are required (gen_random_uuid() is built in) and no enums are used (state columns use CHECK constraints).
--   * Contains NO passwords, API keys, service-role keys, payment/email/webhook secrets. First admin is NOT created here:
--     sign up on the site, then run 08_first_admin.sql. Then run 99_verify.sql.
--   * Storage policies are created on storage.objects: run in the dashboard SQL editor (postgres role). If the editor reports a
--     permission error there, the whole install rolls back; nothing is left half-installed.
--
-- DE-DUPLICATION vs. the step-by-step files: the first version of restore_stock_on_cancel() (step 0002) is omitted because step
--   0005 replaces it; the trigger orders_restore_stock is created once, after the final function. The no-op
--   `drop function if exists place_order(old signature)` is omitted (fresh project). Final database state is identical.
-- =====================================================================================================================

begin;

-- ───────────────────────────────────────── STEP 0001 core schema ─────────────────────────────────────────
-- ARAM store · 0001 · core schema (tables, keys, indexes).
-- Run FIRST on a fresh Supabase project. Atomic (single transaction). Refuses to run twice or on top of an existing `profiles` table.

do $$ begin
  if to_regprocedure('auth.uid()') is null or to_regclass('auth.users') is null then
    raise exception 'ARAM install: this does not look like a Supabase project (auth schema missing). Nothing was changed.';
  end if;
  if to_regclass('public.aram_migrations') is not null or to_regclass('public.profiles') is not null then
    raise exception 'ARAM install: 0001 already applied, or public.profiles already exists. Nothing was changed.';
  end if;
end $$;

-- Installation tracker: enforces the run order and blocks accidental re-runs. Invisible to API clients (RLS on, no policies).
create table public.aram_migrations (version text primary key, applied_at timestamptz not null default now());
alter table public.aram_migrations enable row level security;
revoke all on public.aram_migrations from anon, authenticated;

create or replace function public.aram_require(p_prev text, p_this text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_prev is not null and not exists (select 1 from public.aram_migrations where version = p_prev) then
    raise exception 'ARAM install: run step % first (it has not been applied). Nothing was changed.', p_prev;
  end if;
  if p_this is not null and exists (select 1 from public.aram_migrations where version = p_this) then
    raise exception 'ARAM install: step % was already applied. Nothing was changed.', p_this;
  end if;
end $$;
revoke all on function public.aram_require(text, text) from public, anon, authenticated;


create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  label_fa text not null,
  permissions text[] not null default '{}'
);

create table public.admin_users (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role_id uuid not null references public.admin_roles(id),
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_fa text not null,
  name_en text,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_fa text not null,
  subtitle_fa text,
  description_fa text,
  tone text not null default 'sand',
  sort_order int not null default 0,
  is_active boolean not null default true,
  is_featured boolean not null default false
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_fa text not null,
  title_en text not null default '',
  description_fa text,
  material_fa text,
  care_fa text,
  category_id uuid references public.categories(id) on delete set null,
  base_price numeric(12,0) not null check (base_price >= 0),
  compare_at_price numeric(12,0) check (compare_at_price is null or compare_at_price >= 0),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  is_featured boolean not null default false,
  is_new boolean not null default false,
  tone text not null default 'sand' check (tone in ('ivory','sand','taupe','stone','mocha','charcoal')),
  silhouette text not null default 'top' check (silhouette in ('coat','top','trousers','skirt','dress','bag','scarf','knit')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_status_idx on public.products(status);
create index products_category_idx on public.products(category_id);

create table public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (collection_id, product_id)
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text unique not null,
  color_name text not null,
  color_hex text not null default '#CCCCCC' check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  size text not null,
  price_override numeric(12,0) check (price_override is null or price_override >= 0),
  stock int not null default 0 check (stock >= 0),
  is_active boolean not null default true
);
create index variants_product_idx on public.product_variants(product_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  path text not null,
  alt text,
  sort_order int not null default 0
);

create table public.wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code = upper(code)),
  kind text not null check (kind in ('percent','fixed')),
  value numeric(12,0) not null check (value > 0),
  min_subtotal numeric(12,0) not null default 0,
  max_uses int,
  used_count int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true
);

create sequence public.order_seq start 10001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default ('ARM-' || nextval('public.order_seq')),
  user_id uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending','confirmed','processing','shipped','delivered','cancelled')),
  payment_method text not null check (payment_method in ('cod','bank_transfer')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  subtotal numeric(12,0) not null default 0,
  discount numeric(12,0) not null default 0,
  shipping_fee numeric(12,0) not null default 0,
  total numeric(12,0) not null default 0,
  coupon_code text,
  shipping jsonb not null,
  note text,
  created_at timestamptz not null default now()
);
create index orders_user_idx on public.orders(user_id);
create index orders_created_idx on public.orders(created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  title text not null,
  sku text not null,
  color text,
  size text,
  unit_price numeric(12,0) not null,
  qty int not null check (qty > 0)
);
create index order_items_order_idx on public.order_items(order_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '',
  rating int not null check (rating between 1 and 5),
  title text,
  body text check (body is null or char_length(body) <= 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create table public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_fa text not null,
  body_fa text not null default '',
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default true
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_email text,
  action text not null,
  entity text not null,
  entity_id text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index logs_created_idx on public.activity_logs(created_at desc);

insert into public.aram_migrations (version) values ('0001');

-- ───────────────────────────────────────── STEP 0002 helpers, triggers, RPCs ─────────────────────────────────────────
-- ARAM store · 0002 · helpers, triggers, RPCs (has_perm, coupon preview, admin stats, activity log)
-- Run after 0001. Atomic; refuses to run out of order or twice.

select public.aram_require('0001', '0002');


create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users au join public.admin_roles r on r.id = au.role_id
    where au.user_id = auth.uid() and ('*' = any(r.permissions) or p = any(r.permissions))
  )
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid())
$$;

create or replace function public.my_permissions() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce((select r.permissions from public.admin_users au join public.admin_roles r on r.id = au.role_id where au.user_id = auth.uid()), '{}'::text[])
$$;

-- Profile row on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, nullif(new.email, ''), left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120),
          case when coalesce(new.phone, '') <> '' then '+' || ltrim(new.phone, '+') end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger cms_touch before update on public.cms_pages for each row execute function public.touch_updated_at();

-- Activity log: written only by triggers, only for admin actors
create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid text; rec jsonb;
begin
  if auth.uid() is null or not public.is_admin() then return null; end if;
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  rid := coalesce(rec ->> tg_argv[0], rec ->> 'id');
  insert into public.activity_logs (actor_id, actor_email, action, entity, entity_id, meta)
  values (auth.uid(), (select email from public.profiles where id = auth.uid()), lower(tg_op), tg_table_name, rid,
          case when tg_table_name = 'orders' and tg_op = 'UPDATE' then jsonb_build_object('status', rec ->> 'status', 'payment_status', rec ->> 'payment_status')
               when rec ? 'title_fa' then jsonb_build_object('title', rec ->> 'title_fa')
               when rec ? 'name_fa' then jsonb_build_object('title', rec ->> 'name_fa')
               when rec ? 'code' then jsonb_build_object('title', rec ->> 'code')
               else '{}'::jsonb end);
  return null;
end $$;

create trigger log_products after insert or update or delete on public.products for each row execute function public.log_change();
create trigger log_variants after insert or update or delete on public.product_variants for each row execute function public.log_change();
create trigger log_categories after insert or update or delete on public.categories for each row execute function public.log_change();
create trigger log_collections after insert or update or delete on public.collections for each row execute function public.log_change();
create trigger log_coupons after insert or update or delete on public.coupons for each row execute function public.log_change();
create trigger log_reviews after update or delete on public.reviews for each row execute function public.log_change();
create trigger log_cms after insert or update or delete on public.cms_pages for each row execute function public.log_change();
create trigger log_orders after update or delete on public.orders for each row execute function public.log_change();
create trigger log_settings after insert or update or delete on public.settings for each row execute function public.log_change('key');
create trigger log_admin_roles after insert or update or delete on public.admin_roles for each row execute function public.log_change();
create trigger log_admin_users after insert or update or delete on public.admin_users for each row execute function public.log_change('user_id');

-- Coupon preview (the authoritative check happens again inside place_order)
create or replace function public.validate_coupon(p_code text, p_subtotal numeric) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.coupons; d numeric;
begin
  select * into c from public.coupons where code = upper(trim(p_code)) and is_active;
  if not found
     or (c.starts_at is not null and c.starts_at > now())
     or (c.ends_at is not null and c.ends_at < now())
     or (c.max_uses is not null and c.used_count >= c.max_uses)
     or p_subtotal < c.min_subtotal then
    return jsonb_build_object('valid', false);
  end if;
  d := case when c.kind = 'percent' then round(p_subtotal * least(c.value, 100) / 100) else least(c.value, p_subtotal) end;
  return jsonb_build_object('valid', true, 'discount', d, 'code', c.code);
end $$;

-- Analytics for the dashboard
create or replace function public.admin_stats(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := date_trunc('day', now()) - make_interval(days => greatest(p_days, 1) - 1); res jsonb;
begin
  if not public.has_perm('analytics.view') then raise exception 'FORBIDDEN'; end if;
  select jsonb_build_object(
    'revenue', coalesce((select sum(total) from public.orders where created_at >= since and status <> 'cancelled'), 0),
    'orders', (select count(*) from public.orders where created_at >= since),
    'pending', (select count(*) from public.orders where status = 'pending'),
    'new_customers', (select count(*) from public.profiles where created_at >= since),
    'total_customers', (select count(*) from public.profiles),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', d::date, 'revenue', coalesce(r.rev, 0), 'orders', coalesce(r.n, 0)) order by d)
      from generate_series(since, date_trunc('day', now()), interval '1 day') d
      left join (select date_trunc('day', created_at) dd, sum(total) rev, count(*) n from public.orders
                 where created_at >= since and status <> 'cancelled' group by 1) r on r.dd = d), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(t) from (
        select oi.title, sum(oi.qty) as qty, sum(oi.qty * oi.unit_price) as revenue
        from public.order_items oi join public.orders o on o.id = oi.order_id
        where o.created_at >= since and o.status <> 'cancelled'
        group by oi.title order by sum(oi.qty * oi.unit_price) desc limit 5) t), '[]'::jsonb),
    'status_counts', coalesce((select jsonb_object_agg(status, c) from (select status, count(*) c from public.orders where created_at >= since group by 1) s), '{}'::jsonb),
    'low_stock', coalesce((
      select jsonb_agg(x) from (
        select pv.sku, p.title_fa as title, pv.stock from public.product_variants pv join public.products p on p.id = pv.product_id
        where pv.is_active and p.status = 'active' and pv.stock <= 3 order by pv.stock, pv.sku limit 8) x), '[]'::jsonb)
  ) into res;
  return res;
end $$;

insert into public.aram_migrations (version) values ('0002');

-- ───────────────────────────────────────── STEP 0003 RLS policies ─────────────────────────────────────────
-- ARAM store · 0003 · Row Level Security policies and privileges
-- Run after 0002. Atomic; refuses to run out of order or twice.

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

-- ───────────────────────────────────────── STEP 0004 storage ─────────────────────────────────────────
-- ARAM store · 0004 · Storage bucket for product photos
-- Run after 0003. Atomic; refuses to run out of order or twice.

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

-- ───────────────────────────────────────── STEP 0005 payments, email, addresses, orders, search ─────────────────────────────────────────
-- ARAM store · 0005 · payments, email outbox, addresses, order placement, cancellation, search & pagination
-- Run after 0004. Atomic; refuses to run out of order or twice.

select public.aram_require('0004', '0005');

-- Features: i18n columns, payments, email outbox, addresses, order placement v2, cancellation, server-side search/pagination.
-- Replaces restore_stock_on_cancel() from 0002 and defines place_order().

-- ── i18n content columns (English alongside Persian) ──
alter table public.collections add column if not exists title_en text, add column if not exists subtitle_en text, add column if not exists description_en text;
alter table public.products add column if not exists description_en text, add column if not exists material_en text, add column if not exists care_en text;
alter table public.cms_pages add column if not exists title_en text, add column if not exists body_en text;
alter table public.orders add column if not exists locale text not null default 'fa' check (locale in ('fa','en'));

-- ── Payment providers (non-secret config only; API keys live in Edge Function secrets) ──
create table public.payment_providers (
  key text primary key check (key in ('cod','bank_transfer','zarinpal','stripe')),
  kind text not null check (kind in ('offline','online')),
  label_fa text not null, label_en text not null,
  instructions_fa text, instructions_en text,
  is_enabled boolean not null default false,
  sort_order int not null default 0
);
insert into public.payment_providers (key, kind, label_fa, label_en, is_enabled, sort_order) values
  ('cod', 'offline', 'پرداخت در محل', 'Cash on delivery', true, 1),
  ('bank_transfer', 'offline', 'کارت‌به‌کارت / واریز بانکی', 'Bank transfer', true, 2),
  ('zarinpal', 'online', 'پرداخت آنلاین (زرین‌پال)', 'Online payment (Zarinpal)', false, 3),
  ('stripe', 'online', 'پرداخت با کارت بانکی (Stripe)', 'Card payment (Stripe)', false, 4);

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_fk foreign key (payment_method) references public.payment_providers(key);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null references public.payment_providers(key),
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  amount numeric(12,0) not null,
  authority text,
  ref_id text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments(order_id);
create unique index payments_provider_authority_idx on public.payments(provider, authority) where authority is not null;

-- ── Email outbox ──
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  template text not null check (template in ('order_placed','order_status','payment_received','admin_new_order')),
  locale text not null default 'fa' check (locale in ('fa','en')),
  data jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  attempts int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_status_idx on public.email_outbox(status, created_at);

-- ── Saved addresses ──
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text check (label is null or char_length(label) <= 60),
  full_name text not null check (char_length(full_name) between 1 and 120),
  phone text not null check (char_length(phone) between 3 and 30),
  city text not null check (char_length(city) between 1 and 80),
  address text not null check (char_length(address) between 1 and 500),
  postal_code text check (postal_code is null or char_length(postal_code) <= 20),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index addresses_one_default on public.addresses(user_id) where is_default;

create or replace function public.addresses_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.addresses where user_id = new.user_id) >= 10 then raise exception 'ADDRESS_LIMIT'; end if;
    if not exists (select 1 from public.addresses where user_id = new.user_id) then new.is_default := true; end if;
  end if;
  if new.is_default then
    update public.addresses set is_default = false where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end $$;
create trigger addresses_guard_trg before insert or update on public.addresses for each row execute function public.addresses_guard();

-- ── RLS for new tables ──
alter table public.payment_providers enable row level security;
alter table public.payments enable row level security;
alter table public.email_outbox enable row level security;
alter table public.addresses enable row level security;

create policy "public read enabled" on public.payment_providers for select to anon, authenticated using (is_enabled);
create policy "admin all" on public.payment_providers for all to authenticated using (public.has_perm('settings.manage')) with check (public.has_perm('settings.manage'));
create policy "own payments read" on public.payments for select to authenticated using (exists (select 1 from public.orders o where o.id = payments.order_id and o.user_id = auth.uid()));
create policy "staff payments read" on public.payments for select to authenticated using (public.has_perm('orders.manage'));
create policy "staff email read" on public.email_outbox for select to authenticated using (public.has_perm('settings.manage'));
create policy "own addresses" on public.addresses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.payments, public.email_outbox from authenticated, anon;

-- bank details are only for signed-in shoppers, not the public
update public.settings set is_public = false where key = 'bank_card_info';
create policy "auth read bank info" on public.settings for select to authenticated using (key = 'bank_card_info');
insert into public.settings (key, value, is_public) values
  ('email_enabled', 'false', false), ('email_provider', '"resend"', false), ('email_from', '""', false),
  ('email_from_name', '""', false), ('email_admin_notify', '""', false),
  ('tagline_en', '""', true), ('announcement_en', '""', true), ('hero_title_en', '""', true), ('hero_subtitle_en', '""', true),
  ('hero_cta_label_en', '""', true), ('statement_en', '""', true)
on conflict (key) do nothing;

create trigger log_payment_providers after insert or update or delete on public.payment_providers for each row execute function public.log_change('key');

-- ── Shipment tracking (carrier + tracking code, shown to the customer and sent in the "shipped" SMS) ──
alter table public.orders add column if not exists tracking_code text check (tracking_code is null or char_length(tracking_code) <= 60),
  add column if not exists tracking_carrier text check (tracking_carrier is null or char_length(tracking_carrier) <= 40);

-- ── SMS (customers are notified by SMS, never by email) ──
create or replace function public.norm_phone(p text) returns text
language sql immutable set search_path = public as $$
  select case
    when b.d ~ '^09[0-9]{9}$' then '+98' || substr(b.d, 2)
    when b.d ~ '^989[0-9]{9}$' then '+' || b.d
    when b.d ~ '^9[0-9]{9}$' then '+98' || b.d
    when regexp_replace(a.t, '[[:space:]-]', '', 'g') ~ '^\+[0-9]{8,15}$' then regexp_replace(a.t, '[[:space:]-]', '', 'g')
    else null end
  from (select translate(coalesce(p, ''), '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789') as t) a,
       lateral (select regexp_replace(a.t, '[^0-9]', '', 'g') as d) b
$$;

create table if not exists public.sms_outbox (
  id uuid primary key default gen_random_uuid(),
  to_phone text not null,
  template text not null check (template in ('order_placed','order_status','payment_received','admin_new_order','campaign')),
  locale text not null default 'fa' check (locale in ('fa','en')),
  data jsonb not null default '{}',
  body text,
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  attempts int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists sms_outbox_status_idx on public.sms_outbox(status, created_at);
alter table public.sms_outbox enable row level security;
drop policy if exists "staff sms read" on public.sms_outbox;
create policy "staff sms read" on public.sms_outbox for select to authenticated using (public.has_perm('settings.manage'));
revoke insert, update, delete on public.sms_outbox from authenticated, anon;

insert into public.settings (key, value, is_public) values
  ('sms_enabled', 'false', false), ('sms_provider', '"none"', false), ('sms_sender', '""', false), ('sms_admin_notify', '""', false),
  ('sms_otp_enabled', 'false', true)
on conflict (key) do nothing;

-- ── Email enqueueing ──
create or replace function public.enqueue_order_email(p_order uuid, p_template text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders; ph text; adm text; admp text; d jsonb;
begin
  select * into o from public.orders where id = p_order;
  if not found then return; end if;
  d := jsonb_build_object('order_number', o.order_number, 'total', o.total, 'status', o.status, 'payment_status', o.payment_status,
                          'payment_method', o.payment_method, 'name', o.shipping ->> 'full_name',
                          'tracking_code', o.tracking_code, 'carrier', o.tracking_carrier);
  -- the customer is notified by SMS: phone of the account, else the phone typed at checkout
  select coalesce(public.norm_phone(p.phone), public.norm_phone(o.shipping ->> 'phone')) into ph from public.profiles p where p.id = o.user_id;
  if ph is null then ph := public.norm_phone(o.shipping ->> 'phone'); end if;
  if ph is not null then
    insert into public.sms_outbox (to_phone, template, locale, data) values (ph, p_template, o.locale, d);
  end if;
  -- store staff: new-order alert (email and/or SMS, whichever is filled in Admin settings)
  if p_template = 'order_placed' then
    select value #>> '{}' into adm from public.settings where key = 'email_admin_notify';
    if adm is not null and adm <> '' then
      insert into public.email_outbox (to_email, template, locale, data) values (adm, 'admin_new_order', 'fa', d);
    end if;
    select public.norm_phone(value #>> '{}') into admp from public.settings where key = 'sms_admin_notify';
    if admp is not null then
      insert into public.sms_outbox (to_phone, template, locale, data) values (admp, 'admin_new_order', 'fa', d);
    end if;
  end if;
end $$;
revoke all on function public.enqueue_order_email(uuid, text) from public, anon, authenticated;

create or replace function public.orders_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.payment_status = 'paid' and old.payment_status <> 'paid' then perform public.enqueue_order_email(new.id, 'payment_received');
  elsif new.status <> old.status and new.status <> 'pending' then perform public.enqueue_order_email(new.id, 'order_status');
  end if;
  return null;
end $$;
create trigger orders_notify_trg after update of status, payment_status on public.orders for each row execute function public.orders_notify();

-- ── Stock sync: cancel restores stock + coupon use; reactivation re-deducts stock (or fails) ──
create or replace function public.restore_stock_on_cancel() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.product_variants v set stock = v.stock + oi.qty from public.order_items oi where oi.order_id = new.id and oi.variant_id = v.id;
    if new.coupon_code is not null then update public.coupons set used_count = greatest(used_count - 1, 0) where code = new.coupon_code; end if;
  elsif old.status = 'cancelled' and new.status <> 'cancelled' then
    for r in select variant_id, qty, sku from public.order_items where order_id = new.id and variant_id is not null loop
      update public.product_variants set stock = stock - r.qty where id = r.variant_id and stock >= r.qty;
      if not found then raise exception 'OUT_OF_STOCK:%', r.sku; end if;
    end loop;
    if new.coupon_code is not null then update public.coupons set used_count = used_count + 1 where code = new.coupon_code; end if;
  end if;
  return null;
end $$;

create trigger orders_restore_stock after update of status on public.orders for each row execute function public.restore_stock_on_cancel();

-- ── Order placement v2 (adds locale, enabled-provider check, rate limit, email enqueue) ──
create or replace function public.place_order(p_items jsonb, p_shipping jsonb, p_coupon text default null, p_payment text default 'cod', p_note text default null, p_locale text default 'fa')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  it jsonb; v record; q int; price numeric;
  v_sub numeric := 0; disc numeric := 0; ship numeric := 0; fee numeric; free_from numeric;
  oid uuid; onum text; c public.coupons; loc text := case when p_locale = 'en' then 'en' else 'fa' end;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.payment_providers where key = p_payment and is_enabled) then raise exception 'BAD_PAYMENT'; end if;
  if (select count(*) from public.orders where user_id = uid and created_at > now() - interval '10 minutes') >= 5 then raise exception 'RATE_LIMIT'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then raise exception 'EMPTY_CART'; end if;
  if coalesce(trim(p_shipping ->> 'full_name'), '') = '' or coalesce(trim(p_shipping ->> 'phone'), '') = ''
     or coalesce(trim(p_shipping ->> 'city'), '') = '' or coalesce(trim(p_shipping ->> 'address'), '') = '' then
    raise exception 'BAD_SHIPPING';
  end if;

  insert into public.orders (user_id, payment_method, shipping, note, locale)
  values (uid, p_payment, jsonb_build_object(
      'full_name', left(p_shipping ->> 'full_name', 120), 'phone', left(p_shipping ->> 'phone', 30),
      'city', left(p_shipping ->> 'city', 80), 'address', left(p_shipping ->> 'address', 500),
      'postal_code', left(coalesce(p_shipping ->> 'postal_code', ''), 20)), left(p_note, 500), loc)
  returning id, order_number into oid, onum;

  for it in select * from jsonb_array_elements(p_items) loop
    q := (it ->> 'qty')::int;
    if q is null or q < 1 or q > 10 then raise exception 'BAD_QTY'; end if;
    select pv.id, pv.sku, pv.color_name, pv.size, pv.stock, pv.is_active, pv.price_override, pv.product_id, p.title_fa, p.base_price, p.status
      into v from public.product_variants pv join public.products p on p.id = pv.product_id
      where pv.id = (it ->> 'variant_id')::uuid for update of pv;
    if not found or not v.is_active or v.status <> 'active' then raise exception 'UNAVAILABLE'; end if;
    if v.stock < q then raise exception 'OUT_OF_STOCK:%', v.sku; end if;
    price := coalesce(v.price_override, v.base_price);
    insert into public.order_items (order_id, product_id, variant_id, title, sku, color, size, unit_price, qty)
    values (oid, v.product_id, v.id, v.title_fa, v.sku, v.color_name, v.size, price, q);
    update public.product_variants set stock = stock - q where id = v.id;
    v_sub := v_sub + price * q;
  end loop;

  if p_coupon is not null and trim(p_coupon) <> '' then
    select * into c from public.coupons where code = upper(trim(p_coupon)) and is_active for update;
    if not found or (c.starts_at is not null and c.starts_at > now()) or (c.ends_at is not null and c.ends_at < now())
       or (c.max_uses is not null and c.used_count >= c.max_uses) or v_sub < c.min_subtotal then
      raise exception 'BAD_COUPON';
    end if;
    disc := case when c.kind = 'percent' then round(v_sub * least(c.value, 100) / 100) else least(c.value, v_sub) end;
    update public.coupons set used_count = used_count + 1 where id = c.id;
  end if;

  select (value #>> '{}')::numeric into fee from public.settings where key = 'shipping_fee';
  select (value #>> '{}')::numeric into free_from from public.settings where key = 'free_shipping_threshold';
  ship := case when coalesce(free_from, 0) > 0 and v_sub - disc >= free_from then 0 else coalesce(fee, 0) end;

  update public.orders set subtotal = v_sub, discount = disc, shipping_fee = ship, total = v_sub - disc + ship,
         coupon_code = case when disc > 0 then c.code else null end where id = oid;
  perform public.enqueue_order_email(oid, 'order_placed');
  return jsonb_build_object('id', oid, 'order_number', onum, 'total', v_sub - disc + ship);
end $$;
revoke all on function public.place_order(jsonb, jsonb, text, text, text, text) from public, anon;
grant execute on function public.place_order(jsonb, jsonb, text, text, text, text) to authenticated;

-- ── Customer cancellation (own, unpaid, not yet shipped). Stock is restored by the trigger above. ──
create or replace function public.cancel_my_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status not in ('pending','confirmed') or o.payment_status <> 'unpaid' then raise exception 'CANNOT_CANCEL'; end if;
  update public.orders set status = 'cancelled' where id = o.id;
  update public.payments set status = 'failed', updated_at = now() where order_id = o.id and status = 'pending';
end $$;
revoke all on function public.cancel_my_order(uuid) from public, anon;
grant execute on function public.cancel_my_order(uuid) to authenticated;

-- ── Payment confirmation: callable only by Edge Functions (service_role) after provider verification ──
create or replace function public.mark_order_paid(p_payment_id uuid, p_ref text, p_raw jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare pay public.payments;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if pay.status = 'paid' then return; end if;
  update public.payments set status = 'paid', ref_id = p_ref, raw = p_raw, updated_at = now() where id = pay.id;
  update public.orders set payment_status = 'paid', status = case when status = 'pending' then 'confirmed' else status end where id = pay.order_id;
end $$;
revoke all on function public.mark_order_paid(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.mark_order_paid(uuid, text, jsonb) to service_role;

-- ── Server-side catalogue search + pagination ──
create or replace function public.norm_fa(t text) returns text language sql immutable set search_path = public as $$
  select lower(translate(coalesce(t, ''), 'يك' || chr(8204) || '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', 'یک ' || '01234567890123456789'))
$$;

create or replace function public.search_products(
  p_q text default null, p_cat text default null, p_col text default null,
  p_colors text[] default null, p_sizes text[] default null,
  p_min numeric default null, p_max numeric default null,
  p_in_stock boolean default false, p_new boolean default false, p_sale boolean default false, p_featured boolean default false,
  p_sort text default 'new', p_limit int default 24, p_offset int default 0
) returns jsonb language sql stable set search_path = public as $$
  with pr as (
    select p.id, p.created_at, p.compare_at_price, p.is_new, p.is_featured,
           concat_ws(' ', p.title_fa, p.title_en, p.material_fa, c.name_fa, c.name_en) as hay,
           c.slug as cslug,
           coalesce((select min(coalesce(v.price_override, p.base_price)) from public.product_variants v where v.product_id = p.id and v.is_active), p.base_price) as price
    from public.products p left join public.categories c on c.id = p.category_id
    where p.status = 'active'
  ), base as (
    select * from pr
    where (coalesce(p_cat, '') = '' or cslug = p_cat)
      and (coalesce(p_col, '') = '' or exists (select 1 from public.collection_products cp join public.collections co on co.id = cp.collection_id
                                               where cp.product_id = pr.id and co.slug = p_col and co.is_active))
      and (coalesce(trim(p_q), '') = '' or position(public.norm_fa(trim(p_q)) in public.norm_fa(hay)) > 0
           or exists (select 1 from public.product_variants v where v.product_id = pr.id and v.is_active and position(public.norm_fa(trim(p_q)) in public.norm_fa(v.color_name)) > 0))
      and (p_min is null or price >= p_min) and (p_max is null or price <= p_max)
      and (not p_new or is_new) and (not p_featured or is_featured)
      and (not p_sale or (compare_at_price is not null and compare_at_price > price))
      and (not p_in_stock or exists (select 1 from public.product_variants v where v.product_id = pr.id and v.is_active and v.stock > 0))
      and ((p_colors is null and p_sizes is null) or exists (
            select 1 from public.product_variants v where v.product_id = pr.id and v.is_active and v.stock > 0
              and (p_colors is null or v.color_name = any (p_colors)) and (p_sizes is null or v.size = any (p_sizes))))
  ), page as (
    select id, row_number() over (order by
      case when p_sort = 'price-asc' then price end asc, case when p_sort = 'price-desc' then price end desc, created_at desc, id) as rn
    from base
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'ids', coalesce((select jsonb_agg(id order by rn) from page where rn > greatest(p_offset, 0) and rn <= greatest(p_offset, 0) + least(greatest(p_limit, 1), 60)), '[]'::jsonb))
$$;

create or replace function public.catalog_facets() returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'colors', coalesce((select jsonb_agg(jsonb_build_object('name', color_name, 'hex', color_hex) order by color_name)
                        from (select distinct v.color_name, v.color_hex from public.product_variants v join public.products p on p.id = v.product_id
                              where v.is_active and p.status = 'active') x), '[]'::jsonb),
    'sizes', coalesce((select jsonb_agg(size order by size) from (select distinct v.size from public.product_variants v join public.products p on p.id = v.product_id
                              where v.is_active and p.status = 'active') y), '[]'::jsonb))
$$;

insert into public.aram_migrations (version) values ('0005');

-- ───────────────────────────────────────── STEP 0006 hardening ─────────────────────────────────────────
-- ARAM store · 0006 · security hardening (limits, immutability, super-admin protection)
-- Run after 0005. Atomic; refuses to run out of order or twice.

select public.aram_require('0005', '0006');


-- Coupon preview only for signed-in users (blocks anonymous code enumeration)
revoke execute on function public.validate_coupon(text, numeric) from public, anon;
grant execute on function public.validate_coupon(text, numeric) to authenticated;

-- Field limits
alter table public.profiles add constraint profiles_len check (char_length(coalesce(full_name, '')) <= 120 and char_length(coalesce(phone, '')) <= 30);
alter table public.reviews add constraint reviews_len check (char_length(author_name) <= 120 and char_length(coalesce(title, '')) <= 120);
alter table public.product_images add constraint product_images_path check (path like product_id::text || '/%');

-- Orders: owner and totals are immutable once finalised (admins may only change status/payment/note)
create or replace function public.orders_immutable() returns trigger language plpgsql as $$
begin
  if new.user_id <> old.user_id or new.order_number <> old.order_number or new.id <> old.id then raise exception 'IMMUTABLE'; end if;
  if old.total <> 0 and (new.total <> old.total or new.subtotal <> old.subtotal or new.discount <> old.discount or new.shipping_fee <> old.shipping_fee) then
    raise exception 'IMMUTABLE';
  end if;
  return new;
end $$;
create trigger orders_immutable_trg before update on public.orders for each row execute function public.orders_immutable();

-- Never leave the store without a super admin
create or replace function public.protect_super_admin() returns trigger language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  select id into sid from public.admin_roles where name = 'super_admin';
  if tg_table_name = 'admin_users' then
    if old.role_id = sid and (tg_op = 'DELETE' or new.role_id <> sid)
       and (select count(*) from public.admin_users where role_id = sid) <= 1 then
      raise exception 'LAST_SUPER_ADMIN';
    end if;
  elsif tg_table_name = 'admin_roles' then
    if old.id = sid and (tg_op = 'DELETE' or new.permissions <> old.permissions or new.name <> old.name) then raise exception 'PROTECTED_ROLE'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger protect_admin_users before update or delete on public.admin_users for each row execute function public.protect_super_admin();
create trigger protect_admin_roles before update or delete on public.admin_roles for each row execute function public.protect_super_admin();

insert into public.aram_migrations (version) values ('0006');

-- ───────────────────────────────────────── STEP SEED (non-destructive) ─────────────────────────────────────────
-- ARAM store · seed · starter data (roles, settings, categories, pages, sample catalogue).
-- Run AFTER 0001–0006. Idempotent and non-destructive: only inserts missing rows; never overwrites values you edited.

select public.aram_require('0006', null);

insert into public.admin_roles (name, label_fa, permissions) values
  ('super_admin', 'مدیر کل', array['*']),
  ('manager', 'مدیر فروشگاه', array['products.manage','catalog.manage','orders.manage','customers.manage','marketing.manage','reviews.manage','cms.manage','analytics.view','logs.view']),
  ('content_editor', 'ویرایشگر محتوا', array['products.manage','catalog.manage','cms.manage','reviews.manage']),
  ('support', 'پشتیبانی', array['orders.manage','customers.manage','reviews.manage'])
on conflict (name) do nothing;

insert into public.settings (key, value, is_public) values
  ('store_name', '"آرام"', true),
  ('tagline', '"پوشاک ساده و ماندگار"', true),
  ('announcement', '"ارسال رایگان برای سفارش‌های بالای ۵٬۰۰۰٬۰۰۰ تومان"', true),
  ('shipping_fee', '250000', true),
  ('free_shipping_threshold', '5000000', true),
  ('contact_email', '""', true),
  ('contact_phone', '""', true),
  ('instagram', '""', true),
  ('bank_card_info', '""', false),
  ('hero_title', '"سکوت، زیباترین لباس است"', true),
  ('hero_subtitle', '"مجموعه پاییز؛ برش‌های ساده، پارچه‌های اصیل و رنگ‌های خاموش."', true),
  ('hero_cta_label', '"مشاهده مجموعه"', true),
  ('hero_cta_link', '"/shop?new=1"', true),
  ('statement', '"لباسی که هر سال بیشتر دوستش داشته باشید."', true)
on conflict (key) do nothing;

insert into public.categories (slug, name_fa, name_en, sort_order) values
  ('outerwear','بالاپوش','Outerwear',1), ('tops','بلوز و پیراهن','Tops',2), ('knitwear','بافت','Knitwear',3),
  ('bottoms','شلوار و دامن','Bottoms',4), ('dresses','پیراهن زنانه','Dresses',5), ('accessories','اکسسوری','Accessories',6)
on conflict (slug) do nothing;

insert into public.cms_pages (slug, title_fa, body_fa, is_published) values
  ('about','درباره آرام','آرام با این باور ساخته شد که لباس خوب نیازی به فریاد ندارد.

## رویکرد ما
برش‌های ساده، پارچه‌های طبیعی و رنگ‌های خاموش؛ لباس‌هایی که از فصلی به فصل دیگر می‌مانند.', true),
  ('shipping-returns','ارسال و بازگشت','## ارسال
سفارش‌ها پس از تأیید آماده‌سازی و ارسال می‌شوند. هزینه ارسال هنگام ثبت سفارش نمایش داده می‌شود.

## بازگشت
برای شرایط بازگشت کالا با پشتیبانی تماس بگیرید. (متن را از بخش مدیریت محتوا ویرایش کنید.)', true)
on conflict (slug) do nothing;

do $$
declare rec jsonb; pid uuid; cid uuid; col jsonb; sz text; i int := 0; n int;
begin
  if exists (select 1 from public.products) then return; end if;
  for rec in select * from jsonb_array_elements($j$[
   {"slug":"long-wool-coat","fa":"پالتوی پشمی بلند","en":"Long Wool Coat","cat":"outerwear","price":18900000,"tone":"taupe","sil":"coat","new":true,"feat":true,"mat":"۹۰٪ پشم، ۱۰٪ کشمیر","desc":"پالتوی راسته با یقه‌ی باز و آستر ابریشمی.","colors":[{"n":"قهوه‌ای روشن","h":"#A59A88"},{"n":"زغالی","h":"#35322E"}],"sizes":["S","M","L"]},
   {"slug":"silk-blend-blazer","fa":"کت ابریشمی ساده","en":"Silk Blend Blazer","cat":"outerwear","price":14500000,"tone":"stone","sil":"coat","feat":true,"mat":"ابریشم و پشم","desc":"کت تک‌دکمه با شانه‌ی نرم.","colors":[{"n":"سنگی","h":"#7B7469"}],"sizes":["S","M","L"]},
   {"slug":"linen-shirt","fa":"پیراهن کتانی یقه‌دار","en":"Linen Shirt","cat":"tops","price":4200000,"tone":"ivory","sil":"top","new":true,"mat":"کتان خالص","desc":"پیراهن گشاد با دکمه‌های صدفی.","colors":[{"n":"عاجی","h":"#F1ECE1"},{"n":"شنی","h":"#DDD4C3"}],"sizes":["S","M","L","XL"]},
   {"slug":"satin-blouse","fa":"بلوز ساتن آستین‌بلند","en":"Satin Blouse","cat":"tops","price":5800000,"tone":"sand","sil":"top","feat":true,"mat":"ساتن ویسکوز","desc":"بلوز روان با یقه‌ی ساده.","colors":[{"n":"شنی","h":"#DDD4C3"}],"sizes":["S","M","L"]},
   {"slug":"organic-cotton-tee","fa":"تی‌شرت پنبه ارگانیک","en":"Organic Cotton Tee","cat":"tops","price":1900000,"tone":"ivory","sil":"top","mat":"پنبه ارگانیک","desc":"تی‌شرت ضخیم با یقه‌ی گرد.","colors":[{"n":"عاجی","h":"#F1ECE1"},{"n":"زغالی","h":"#35322E"}],"sizes":["S","M","L","XL"]},
   {"slug":"tailored-trousers","fa":"شلوار فاستونی راسته","en":"Tailored Trousers","cat":"bottoms","price":6400000,"tone":"charcoal","sil":"trousers","feat":true,"mat":"فاستونی پشمی","desc":"شلوار کمر بلند با خط اتو.","colors":[{"n":"زغالی","h":"#35322E"}],"sizes":["S","M","L"]},
   {"slug":"pleated-midi-skirt","fa":"دامن میدی پلیسه","en":"Pleated Midi Skirt","cat":"bottoms","price":5200000,"tone":"mocha","sil":"skirt","new":true,"mat":"پلی‌استر بازیافتی","desc":"دامن پلیسه با کمر کشی.","colors":[{"n":"موکا","h":"#6E5F52"}],"sizes":["S","M","L"]},
   {"slug":"crepe-maxi-dress","fa":"پیراهن بلند کرپ","en":"Crepe Maxi Dress","cat":"dresses","price":9800000,"tone":"sand","sil":"dress","feat":true,"mat":"کرپ ویسکوز","desc":"پیراهن بلند با فرم A و یقه‌ی قایقی.","colors":[{"n":"شنی","h":"#DDD4C3"},{"n":"موکا","h":"#6E5F52"}],"sizes":["S","M","L"]},
   {"slug":"shirt-dress","fa":"پیراهن شمیز ساده","en":"Shirt Dress","cat":"dresses","price":7300000,"compare":8600000,"tone":"stone","sil":"dress","mat":"پنبه پوپلین","desc":"شمیز کمربند‌دار تا زیر زانو.","colors":[{"n":"سنگی","h":"#7B7469"}],"sizes":["S","M","L"]},
   {"slug":"leather-shoulder-bag","fa":"کیف دوشی چرم","en":"Leather Shoulder Bag","cat":"accessories","price":12400000,"tone":"mocha","sil":"bag","feat":true,"mat":"چرم طبیعی","desc":"کیف ساختاریافته با بند قابل‌تنظیم.","colors":[{"n":"موکا","h":"#6E5F52"},{"n":"مشکی","h":"#191715"}],"sizes":["یک‌سایز"]},
   {"slug":"cashmere-scarf","fa":"شال کشمیر","en":"Cashmere Scarf","cat":"accessories","price":6900000,"tone":"taupe","sil":"scarf","new":true,"mat":"کشمیر خالص","desc":"شال نرم و سبک با حاشیه‌ی ساده.","colors":[{"n":"قهوه‌ای روشن","h":"#A59A88"}],"sizes":["یک‌سایز"]},
   {"slug":"merino-crewneck","fa":"بافت پشمی یقه‌گرد","en":"Merino Crewneck","cat":"knitwear","price":4800000,"tone":"sand","sil":"knit","mat":"پشم مرینو","desc":"بافت نازک و گرم برای لایه‌بندی.","colors":[{"n":"شنی","h":"#DDD4C3"},{"n":"زغالی","h":"#35322E"}],"sizes":["S","M","L"]}
  ]$j$::jsonb) loop
    i := i + 1;
    select id into cid from public.categories where slug = rec ->> 'cat';
    insert into public.products (slug, title_fa, title_en, description_fa, material_fa, care_fa, category_id, base_price, compare_at_price, status, is_featured, is_new, tone, silhouette)
    values (rec ->> 'slug', rec ->> 'fa', rec ->> 'en', rec ->> 'desc', rec ->> 'mat', 'شست‌وشوی ملایم یا خشک‌شویی؛ اتو در دمای پایین.', cid,
            (rec ->> 'price')::numeric, nullif(rec ->> 'compare', '')::numeric, 'active',
            coalesce((rec ->> 'feat')::boolean, false), coalesce((rec ->> 'new')::boolean, false), rec ->> 'tone', rec ->> 'sil')
    returning id into pid;
    n := 0;
    for col in select * from jsonb_array_elements(rec -> 'colors') loop
      for sz in select jsonb_array_elements_text(rec -> 'sizes') loop
        n := n + 1;
        insert into public.product_variants (product_id, sku, color_name, color_hex, size, stock)
        values (pid, upper(substr(rec ->> 'slug', 1, 4)) || '-' || i || '-' || n, col ->> 'n', col ->> 'h', sz, 2 + ((i + n) % 7));
      end loop;
    end loop;
  end loop;

  insert into public.collections (slug, title_fa, subtitle_fa, description_fa, tone, sort_order, is_featured) values
    ('autumn-calm', 'پاییز آرام', 'رنگ‌های خاموش، لایه‌های نرم', 'مجموعه‌ای برای روزهای خنک؛ بالاپوش، بافت و اکسسوری در پالت خاکی.', 'taupe', 1, true),
    ('essentials', 'ضروریات', 'پایه‌های همیشگی کمد', 'تکه‌هایی که با هر چیزی ست می‌شوند و هر سال می‌مانند.', 'ivory', 2, false);
  insert into public.collection_products (collection_id, product_id)
    select c.id, p.id from public.collections c join public.products p on
      (c.slug = 'autumn-calm' and p.slug in ('long-wool-coat','silk-blend-blazer','pleated-midi-skirt','cashmere-scarf','merino-crewneck','leather-shoulder-bag'))
   or (c.slug = 'essentials' and p.slug in ('organic-cotton-tee','linen-shirt','tailored-trousers','satin-blouse','shirt-dress'));
end $$;

-- English content for the sample data (so the English storefront isn't empty)
update public.settings set value = to_jsonb(v.val) from (values
  ('tagline_en', 'Simple, lasting clothing'), ('announcement_en', 'Free shipping on orders over 5,000,000 Toman'),
  ('hero_title_en', 'Silence is the most beautiful garment'), ('hero_subtitle_en', 'The autumn collection: simple cuts, honest fabrics, muted colours.'),
  ('hero_cta_label_en', 'View the collection'), ('statement_en', 'Clothes you will love a little more each year.')) as v(k, val)
where public.settings.key = v.k and public.settings.value = '""'::jsonb;
update public.collections set title_en = 'Autumn Calm', subtitle_en = 'Muted colours, soft layers', description_en = 'A collection for cooler days: outerwear, knitwear and accessories in an earthy palette.' where slug = 'autumn-calm' and title_en is null;
update public.collections set title_en = 'Essentials', subtitle_en = 'The wardrobe foundations', description_en = 'Pieces that go with everything and stay for years.' where slug = 'essentials' and title_en is null;
update public.cms_pages set title_en = 'About ARAM', body_en = 'ARAM was founded on the belief that good clothes do not need to shout.

## Our approach
Simple cuts, natural fabrics and muted colours: clothes that last from one season to the next.' where slug = 'about' and title_en is null;
update public.cms_pages set title_en = 'Shipping & returns', body_en = '## Shipping
Orders are prepared and shipped after confirmation. The shipping cost is shown when you place the order.

## Returns
Contact support for return conditions. (Edit this text in Content management.)' where slug = 'shipping-returns' and title_en is null;
update public.products set material_en = case slug
  when 'long-wool-coat' then '90% wool, 10% cashmere' when 'silk-blend-blazer' then 'Silk and wool' when 'linen-shirt' then 'Pure linen'
  when 'satin-blouse' then 'Viscose satin' when 'organic-cotton-tee' then 'Organic cotton' when 'tailored-trousers' then 'Wool suiting'
  when 'pleated-midi-skirt' then 'Recycled polyester' when 'crepe-maxi-dress' then 'Viscose crepe' when 'shirt-dress' then 'Cotton poplin'
  when 'leather-shoulder-bag' then 'Natural leather' when 'cashmere-scarf' then 'Pure cashmere' when 'merino-crewneck' then 'Merino wool' end,
  care_en = 'Gentle wash or dry clean; iron on low heat.',
  description_en = case slug
  when 'long-wool-coat' then 'A straight coat with an open collar and silk lining.' when 'silk-blend-blazer' then 'A single-button blazer with a soft shoulder.'
  when 'linen-shirt' then 'A relaxed shirt with mother-of-pearl buttons.' when 'satin-blouse' then 'A fluid blouse with a plain collar.'
  when 'organic-cotton-tee' then 'A heavyweight tee with a round neck.' when 'tailored-trousers' then 'High-waisted trousers with a pressed crease.'
  when 'pleated-midi-skirt' then 'A pleated skirt with an elasticated waist.' when 'crepe-maxi-dress' then 'An A-line maxi dress with a boat neck.'
  when 'shirt-dress' then 'A belted shirt dress that falls below the knee.' when 'leather-shoulder-bag' then 'A structured bag with an adjustable strap.'
  when 'cashmere-scarf' then 'A soft, light scarf with a plain edge.' when 'merino-crewneck' then 'A fine, warm knit for layering.' end
where slug in ('long-wool-coat','silk-blend-blazer','linen-shirt','satin-blouse','organic-cotton-tee','tailored-trousers','pleated-midi-skirt','crepe-maxi-dress','shirt-dress','leather-shoulder-bag','cashmere-scarf','merino-crewneck') and material_en is null;

insert into public.aram_migrations (version) values ('seed') on conflict do nothing;

-- ── Customer registration data (name, national id, birth date, gender, province, consent) ──
alter table public.profiles
  add column if not exists first_name text, add column if not exists last_name text, add column if not exists national_id text,
  add column if not exists birth_date date, add column if not exists gender text,
  add column if not exists marketing_sms_optin boolean not null default false, add column if not exists accepted_terms_at timestamptz;
alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check check (gender is null or gender in ('female', 'male', 'other'));
alter table public.profiles drop constraint if exists profiles_national_id_check;
alter table public.profiles add constraint profiles_national_id_check check (national_id is null or national_id ~ '^[0-9]{10}$');
alter table public.addresses add column if not exists province text;

-- customers may edit their own details, but never their phone (it is their sign-in identity) or anything else
revoke update on public.profiles from authenticated, anon;
grant update (full_name, first_name, last_name, national_id, birth_date, gender, marketing_sms_optin) on public.profiles to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); bd date; fn text; ln text;
begin
  fn := left(nullif(trim(coalesce(m ->> 'first_name', '')), ''), 60); ln := left(nullif(trim(coalesce(m ->> 'last_name', '')), ''), 60);
  begin bd := nullif(m ->> 'birth_date', '')::date; exception when others then bd := null; end;
  insert into public.profiles (id, email, full_name, phone, first_name, last_name, national_id, birth_date, gender, marketing_sms_optin, accepted_terms_at)
  values (new.id, nullif(new.email, ''),
          left(coalesce(nullif(trim(coalesce(fn, '') || ' ' || coalesce(ln, '')), ''), m ->> 'full_name', ''), 120),
          case when coalesce(new.phone, '') <> '' then '+' || ltrim(new.phone, '+') end,
          fn, ln,
          case when (m ->> 'national_id') ~ '^[0-9]{10}$' then m ->> 'national_id' end,
          bd,
          case when (m ->> 'gender') in ('female', 'male', 'other') then m ->> 'gender' end,
          (m ->> 'marketing_sms_optin') = 'true',
          case when (m ->> 'accepted_terms') = 'true' then now() end)
  on conflict (id) do nothing;
  return new;
end $$;

-- Support tool: an admin sets a new password for a customer (until SMS password reset exists). Logged in activity_logs.
create or replace function public.admin_set_customer_password(p_user uuid, p_password text) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not public.has_perm('customers.manage') then raise exception 'FORBIDDEN'; end if;
  if char_length(coalesce(p_password, '')) < 8 then raise exception 'WEAK_PASSWORD'; end if;
  if exists (select 1 from public.admin_users where user_id = p_user) and not public.has_perm('admins.manage') then raise exception 'FORBIDDEN'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_user;
  if not found then raise exception 'NOT_FOUND'; end if;
  insert into public.activity_logs (actor_id, actor_email, action, entity, entity_id)
  values (auth.uid(), (select email from public.profiles where id = auth.uid()), 'set_password', 'customer', p_user::text);
end $$;
revoke all on function public.admin_set_customer_password(uuid, text) from public, anon;
grant execute on function public.admin_set_customer_password(uuid, text) to authenticated;

insert into public.cms_pages (slug, title_fa, body_fa, is_published) values
  ('terms', 'قوانین و مقررات', E'## شرایط استفاده\nبا ثبت‌نام و خرید از این فروشگاه، شرایط زیر را می‌پذیرید.\n\n## سفارش و پرداخت\nقیمت‌ها به تومان است و سفارش پس از تأیید و پرداخت قطعی می‌شود.\n\n## بازگشت کالا\nشرایط بازگشت در صفحه «ارسال و بازگشت» آمده است.\n\n(این متن نمونه است؛ از بخش مدیریت محتوا آن را ویرایش کنید.)', true),
  ('privacy', 'حریم خصوصی', E'## اطلاعاتی که نگه می‌داریم\nنام، شماره موبایل و نشانی شما فقط برای ثبت و ارسال سفارش و پشتیبانی استفاده می‌شود و به شخص ثالث فروخته نمی‌شود.\n\n## پیامک تبلیغاتی\nپیامک تبلیغاتی فقط در صورت موافقت شما ارسال می‌شود و هر زمان می‌توانید آن را در حساب کاربری خاموش کنید.\n\n(این متن نمونه است؛ از بخش مدیریت محتوا آن را ویرایش کنید.)', true)
on conflict (slug) do nothing;

-- ── Store features: try-on photo, back-in-stock alerts ──
-- (tracking_code / tracking_carrier already exist from the order-tracking step)
alter table public.products add column if not exists tryon_url text;

alter table public.sms_outbox drop constraint if exists sms_outbox_template_check;
alter table public.sms_outbox add constraint sms_outbox_template_check
  check (template in ('order_placed','order_status','payment_received','admin_new_order','campaign','back_in_stock'));

create table if not exists public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);
alter table public.stock_alerts enable row level security;
drop policy if exists "own alerts" on public.stock_alerts;
create policy "own alerts" on public.stock_alerts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "staff alerts read" on public.stock_alerts;
create policy "staff alerts read" on public.stock_alerts for select to authenticated using (public.has_perm('products.manage'));
revoke all on public.stock_alerts from anon;

-- when a sold-out product gets stock again, everyone who asked is told by SMS (once)
create or replace function public.notify_back_in_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if coalesce(old.stock, 0) > 0 or new.stock <= 0 then return new; end if;
  select title_fa into t from public.products where id = new.product_id;
  insert into public.sms_outbox (to_phone, template, locale, data)
    select public.norm_phone(p.phone), 'back_in_stock', 'fa', jsonb_build_object('title', t, 'slug', (select slug from public.products where id = new.product_id))
      from public.stock_alerts a join public.profiles p on p.id = a.user_id
     where a.product_id = new.product_id and a.notified_at is null and public.norm_phone(p.phone) is not null;
  update public.stock_alerts set notified_at = now() where product_id = new.product_id and notified_at is null;
  return new;
end $$;
drop trigger if exists variants_back_in_stock on public.product_variants;
create trigger variants_back_in_stock after update of stock on public.product_variants for each row execute function public.notify_back_in_stock();

create or replace function public.enqueue_order_email(p_order uuid, p_template text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders; ph text; adm text; admp text; d jsonb;
begin
  select * into o from public.orders where id = p_order;
  if not found then return; end if;
  d := jsonb_build_object('order_number', o.order_number, 'total', o.total, 'status', o.status, 'payment_status', o.payment_status,
                          'payment_method', o.payment_method, 'name', o.shipping ->> 'full_name',
                          'tracking_code', o.tracking_code, 'carrier', o.tracking_carrier);
  select coalesce(public.norm_phone(p.phone), public.norm_phone(o.shipping ->> 'phone')) into ph from public.profiles p where p.id = o.user_id;
  if ph is null then ph := public.norm_phone(o.shipping ->> 'phone'); end if;
  if ph is not null then
    insert into public.sms_outbox (to_phone, template, locale, data) values (ph, p_template, o.locale, d);
  end if;
  if p_template = 'order_placed' then
    select value #>> '{}' into adm from public.settings where key = 'email_admin_notify';
    if adm is not null and adm <> '' then
      insert into public.email_outbox (to_email, template, locale, data) values (adm, 'admin_new_order', 'fa', d);
    end if;
    select public.norm_phone(value #>> '{}') into admp from public.settings where key = 'sms_admin_notify';
    if admp is not null then
      insert into public.sms_outbox (to_phone, template, locale, data) values (admp, 'admin_new_order', 'fa', d);
    end if;
  end if;
end $$;
revoke all on function public.enqueue_order_email(uuid, text) from public, anon, authenticated;

commit;
