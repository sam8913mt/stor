-- ARAM · set a new password for an existing account (use it when you forgot the admin password).
-- Edit ONLY the two lines marked <<<, then run the whole file in Supabase → SQL Editor.
do $$
declare
  v_email text := 'mhmdsammtyy466@gmail.com';   -- <<< 1) the account email
  v_new_password text := 'sam.8913';                     -- <<< 2) write your NEW password between the quotes (at least 8 characters)
  n int;
begin
  if length(v_new_password) < 8 then
    raise exception 'Write the new password (at least 8 characters) between the quotes on the v_new_password line.';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(v_new_password, extensions.gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where lower(email) = lower(trim(v_email));
  get diagnostics n = row_count;
  if n = 0 then raise exception 'No account with email %.', v_email; end if;
  raise notice 'Password changed for %. Sign in with the new password.', v_email;
end $$;
