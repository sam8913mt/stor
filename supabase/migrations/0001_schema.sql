-- ARAM store · 0001 · core schema (tables, keys, indexes).
-- Run FIRST on a fresh Supabase project. Atomic (single transaction). Refuses to run twice or on top of an existing `profiles` table.
begin;

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
commit;
