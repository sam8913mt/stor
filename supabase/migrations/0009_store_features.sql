-- ARAM store · 14 · tracking code, try-on photo, back-in-stock alerts, for a database that is ALREADY installed. Safe to run more than once.
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

