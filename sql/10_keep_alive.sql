-- ARAM store · 10 · keep-alive schedule (pg_cron → Edge Function `keep-alive`, every 2 days at 03:00 UTC).
-- Run AFTER 00_INSTALL_ALL.sql, the keep-alive Edge Function is deployed, and the two Vault secrets exist (see KEEP_ALIVE_SETUP.md).
-- Safe to run: changes no application data, is idempotent (replaces its own job `aram-keep-alive`), contains NO keys or URLs —
-- the project URL and the secret are read at run time from Supabase Vault (secrets named aram_project_url and aram_cron_secret).
-- Schedule `0 3 */2 * *` = 03:00 on every 2nd day of the month (1st, 3rd, 5th … 31st): the gap is never longer than 2 days.
begin;
do $$ begin
  if to_regprocedure('public.aram_require(text,text)') is null then
    raise exception 'ARAM: the database is not installed yet (the installer tables/functions do not exist). Run sql/00_INSTALL_ALL.sql FIRST, as ONE query, and wait for "Success". It already includes the seed data, so do not run 01-07 separately afterwards.';
  end if;
end $$;
select public.aram_require('0006', null);   -- the main installation must already be complete

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if to_regclass('vault.decrypted_secrets') is null then
    raise exception 'Supabase Vault is not available in this project (see KEEP_ALIVE_SETUP.md). Nothing was changed.';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'aram_project_url')
     or not exists (select 1 from vault.decrypted_secrets where name = 'aram_cron_secret') then
    raise exception 'Create the Vault secrets aram_project_url and aram_cron_secret first (KEEP_ALIVE_SETUP.md step 3). Nothing was changed.';
  end if;
  if exists (select 1 from cron.job where jobname = 'aram-keep-alive') then
    perform cron.unschedule('aram-keep-alive');   -- replace an earlier schedule of the same name
  end if;
end $$;

select cron.schedule('aram-keep-alive', '0 3 */2 * *', $job$
  select net.http_post(
    url := rtrim((select decrypted_secret from vault.decrypted_secrets where name = 'aram_project_url'), '/') || '/functions/v1/keep-alive',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'aram_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
$job$);

commit;
