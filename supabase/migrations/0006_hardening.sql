-- ARAM store · 0006 · security hardening (limits, immutability, super-admin protection)
-- Run after 0005. Atomic; refuses to run out of order or twice.
begin;
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
commit;
