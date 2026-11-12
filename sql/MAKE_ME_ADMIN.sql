-- ARAM · make an existing account a super administrator.
-- 1) Put YOUR phone number (09121234567) or email on the line marked <<< below.  2) Run in Supabase → SQL Editor.
-- 3) On the site: sign out, sign in again, then open /admin.
do $$
declare
  v_contact text := 'mhmdsammtyy466@gmail.com';   -- <<< EDIT: the phone or email you sign in with
  v_user uuid; v_role uuid; v_digits text;
begin
  v_digits := regexp_replace(regexp_replace(v_contact, '\D', '', 'g'), '^0', '98');
  -- look in auth.users itself, so it works even if the profile row is missing
  select id into v_user from auth.users
   where (position('@' in v_contact) > 0 and lower(email) = lower(trim(v_contact)))
      or (position('@' in v_contact) = 0 and regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_digits)
   limit 1;
  if v_user is null then
    raise exception 'No account found for "%". Sign up on the site first (or check the number: % ). Existing accounts: %', v_contact, v_digits,
      (select coalesce(string_agg(coalesce(nullif(phone, ''), email), ', '), 'none') from (select phone, email from auth.users order by created_at desc limit 10) t);
  end if;
  insert into public.profiles (id, email, full_name, phone)
    select id, nullif(email, ''), '', case when coalesce(phone, '') <> '' then '+' || ltrim(phone, '+') end from auth.users where id = v_user
    on conflict (id) do nothing;
  select id into v_role from public.admin_roles where name = 'super_admin';
  if v_role is null then raise exception 'Role super_admin is missing: the database seed did not run (install ARAM_ALL.sql first).'; end if;
  insert into public.admin_users (user_id, role_id) values (v_user, v_role) on conflict (user_id) do update set role_id = excluded.role_id;
  raise notice 'Done: % is now a super administrator.', v_contact;
end $$;
