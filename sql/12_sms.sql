-- ARAM store · 12 · SMS notifications + SMS one-time-code login support, for a database that is ALREADY installed.
-- (Fresh installs through ARAM_ALL.sql already include this.) Safe to run more than once.
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

create or replace function public.enqueue_order_email(p_order uuid, p_template text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders; ph text; adm text; admp text; d jsonb;
begin
  select * into o from public.orders where id = p_order;
  if not found then return; end if;
  d := jsonb_build_object('order_number', o.order_number, 'total', o.total, 'status', o.status, 'payment_status', o.payment_status,
                          'payment_method', o.payment_method, 'name', o.shipping ->> 'full_name');
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
