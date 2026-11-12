-- ARAM store · 08 · create the FIRST super administrator.
-- Run AFTER 0001–0007 (seed). Run it ONCE, in the Supabase SQL editor (it needs the postgres role, so the website can never run it).
--
-- BEFORE running:
--   1. Open your deployed site (or `npm run dev`), go to  #/login  and SIGN UP with the email/password you want to use as admin
--      (or create the user in Supabase → Authentication → Users → Add user, with "Auto Confirm User" ticked).
--   2. Replace the email below with that exact email address. Do NOT put a password or any key in this file.
--   3. Run the script. It makes that existing account a super admin; it does not create passwords.
--
-- Safe by design: fails loudly if the email is still the placeholder, the account does not exist yet, the seed roles are missing,
-- or the user is already an admin (it never silently overwrites an existing role).
-- AFTER running: delete your email from this file/editor history; sign out and back in on the site, then open  #/admin .

do $$
declare
  v_email   text := 'CHANGE_ME@example.com';   -- <<< EDIT THIS: the phone (09121234567) or email of the account that already signed up
  v_user    uuid;
  v_role    uuid;
begin
  if lower(trim(v_email)) = 'change_me@example.com' or length(trim(v_email)) < 6 then
    raise exception 'Edit v_email first: put the phone number or email of the account that already signed up.';
  end if;
  if to_regprocedure('public.aram_require(text,text)') is null then
    raise exception 'ARAM: the database is not installed yet. Run sql/00_INSTALL_ALL.sql FIRST (it includes the seed data), then run this file.';
  end if;
  perform public.aram_require('0006', null);

  select id into v_user from public.profiles
   where (position('@' in v_email) > 0 and lower(email) = lower(trim(v_email)))
      or (position('@' in v_email) = 0 and regexp_replace(coalesce(phone, ''), '\D', '', 'g') = regexp_replace(regexp_replace(v_email, '\D', '', 'g'), '^0', '98'));
  if v_user is null then
    raise exception 'No account with phone/email % exists yet. Sign up on the site (or add the user in Supabase Auth) first, then re-run.', v_email;
  end if;

  select id into v_role from public.admin_roles where name = 'super_admin';
  if v_role is null then
    raise exception 'Role super_admin not found. Run 07_seed.sql first (it creates the default roles).';
  end if;

  if exists (select 1 from public.admin_users where user_id = v_user) then
    raise notice 'That account is already an admin; nothing changed.';
  else
    insert into public.admin_users (user_id, role_id) values (v_user, v_role);
    raise notice 'Done: % is now a super administrator.', v_email;
  end if;
end $$;
