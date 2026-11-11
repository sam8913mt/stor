-- ARAM store · 0002 · helpers, triggers, RPCs (has_perm, coupon preview, admin stats, activity log)
-- Run after 0001. Atomic; refuses to run out of order or twice.
begin;
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
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120));
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

-- Restore stock when an order is cancelled (replaced by the fuller version in 0005)
create or replace function public.restore_stock_on_cancel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.product_variants v set stock = v.stock + oi.qty
    from public.order_items oi where oi.order_id = new.id and oi.variant_id = v.id;
  end if;
  return null;
end $$;
create trigger orders_restore_stock after update of status on public.orders for each row execute function public.restore_stock_on_cancel();

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
commit;
