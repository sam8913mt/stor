-- ARAM store · 0005 · payments, email outbox, addresses, order placement, cancellation, search & pagination
-- Run after 0004. Atomic; refuses to run out of order or twice.
begin;
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

-- ── Email enqueueing ──
create or replace function public.enqueue_order_email(p_order uuid, p_template text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders; em text; adm text; d jsonb;
begin
  select * into o from public.orders where id = p_order;
  if not found then return; end if;
  select email into em from public.profiles where id = o.user_id;
  d := jsonb_build_object('order_number', o.order_number, 'total', o.total, 'status', o.status, 'payment_status', o.payment_status,
                          'payment_method', o.payment_method, 'name', o.shipping ->> 'full_name');
  if em is not null and em <> '' then
    insert into public.email_outbox (to_email, template, locale, data) values (em, p_template, o.locale, d);
  end if;
  if p_template = 'order_placed' then
    select value #>> '{}' into adm from public.settings where key = 'email_admin_notify';
    if adm is not null and adm <> '' then
      insert into public.email_outbox (to_email, template, locale, data) values (adm, 'admin_new_order', 'fa', d);
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

-- ── Order placement v2 (adds locale, enabled-provider check, rate limit, email enqueue) ──
drop function if exists public.place_order(jsonb, jsonb, text, text, text);
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
commit;
