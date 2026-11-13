-- ARAM store · 13 · full customer registration data + admin password tool, for a database that is ALREADY installed. Safe to run more than once.
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

