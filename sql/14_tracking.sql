-- ARAM store · 14 · shipment tracking code, for a database that is ALREADY installed. Run 14 AFTER 12_sms.sql. Safe to run more than once.
-- ── Shipment tracking (carrier + tracking code, shown to the customer and sent in the "shipped" SMS) ──
alter table public.orders add column if not exists tracking_code text check (tracking_code is null or char_length(tracking_code) <= 60),
  add column if not exists tracking_carrier text check (tracking_carrier is null or char_length(tracking_carrier) <= 40);

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
