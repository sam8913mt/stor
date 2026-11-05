# KEEP_ALIVE_SETUP — keep the Supabase project active

A scheduled job inside your own Supabase project calls a tiny Edge Function every 2 days; the function runs one read-only query. No computer of yours needs to be on, and nothing is stored in GitHub except code.

## Files added / changed
| File | Purpose |
|---|---|
| `supabase/functions/keep-alive/index.ts` | the function: checks the secret, runs `select key from settings limit 1`, returns `{"ok":true,"timestamp":"…"}` (writes nothing, returns no data) |
| `sql/10_keep_alive.sql` | enables `pg_cron` + `pg_net` and schedules the job `aram-keep-alive` (03:00 UTC every 2nd day-of-month, max gap 2 days) |
| `supabase/config.toml` | + `[functions.keep-alive] verify_jwt = false` (the function authenticates itself with the secret) |
| `KEEP_ALIVE_SETUP.md`, `PROJECT_STATUS.md` | docs |
Nothing else (schema, RLS, storefront, admin, payments, email) was touched. Supabase's own supported scheduler (`pg_cron` + `pg_net`) is used; the secret and URL live in Supabase Vault, never in a file.

## One-time setup (≈5 minutes)
1. **Link and set the secret** (skip `CRON_SECRET` if you already set it for email; reuse the same value):
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase secrets set CRON_SECRET="$(openssl rand -hex 24)"   # note the value: you need it in step 3 and for the test
   ```
2. **Deploy the function:**
   ```bash
   supabase functions deploy keep-alive --no-verify-jwt
   ```
3. **Store two Vault secrets** (Supabase dashboard → *Integrations → Vault* → *Add new secret*; this keeps the values out of SQL history):
   - name `aram_project_url` → value `https://YOUR_PROJECT_REF.supabase.co`
   - name `aram_cron_secret` → value = the exact `CRON_SECRET` from step 1
   (If you prefer SQL: `select vault.create_secret('<value>', '<name>');` — then clear the editor history.)
4. **Manual test first** (see below) — it must return `{"ok":true,…}`.
5. **Enable the schedule:** SQL Editor → paste all of `sql/10_keep_alive.sql` → Run. It stops with a clear message if the Vault secrets are missing or the main install isn't complete. If `pg_cron`/`pg_net` can't be created from SQL, enable them in *Database → Extensions* and run it again.

## Manual test (immediately)
```bash
curl -i -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/keep-alive" -H "x-cron-secret: YOUR_CRON_SECRET"
```
Expected: `HTTP 200` and `{"ok":true,"timestamp":"2026-…"}`. Without the header (or with a wrong value) you must get `401 {"ok":false,"error":"UNAUTHORIZED"}`.
Test the scheduler path without waiting: in the SQL editor run the job body once —
```sql
select net.http_post(
  url := rtrim((select decrypted_secret from vault.decrypted_secrets where name = 'aram_project_url'), '/') || '/functions/v1/keep-alive',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'aram_cron_secret')),
  body := '{}'::jsonb);
select created, status_code, left(content::text, 120) as body from net._http_response order by created desc limit 3;  -- wait ~5 s; expect 200
```

## Verify the schedule and last execution
```sql
select jobid, jobname, schedule, active from cron.job where jobname = 'aram-keep-alive';          -- one active row
select status, return_message, start_time from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname = 'aram-keep-alive') order by start_time desc limit 5;
```
`status = succeeded` means pg_cron sent the request. The function's own result is in **Dashboard → Edge Functions → keep-alive → Logs** (HTTP 200 = success). `net._http_response` only keeps recent responses (hours), so use the Edge Function logs for the history of successful calls.

## If it fails
| Symptom | Fix |
|---|---|
| curl `401` | wrong/missing `x-cron-secret`, or `CRON_SECRET` not set (`supabase secrets set …`, redeploy not needed) |
| curl `404` | function not deployed → step 2 |
| curl `503 DB_ERROR` | project paused/unhealthy or the `settings` table missing → resume the project; run `sql/99_verify.sql` |
| `10_keep_alive.sql` says Vault secrets missing | step 3; names must be exactly `aram_project_url` and `aram_cron_secret` |
| job runs but Edge log shows 401 | the Vault secret differs from `CRON_SECRET` → update the Vault value |
| `cron.job_run_details` shows `failed` | read `return_message`; usually `pg_net` not enabled (Database → Extensions) |
| Remove the schedule | `select cron.unschedule('aram-keep-alive');` |

## Limitations
- If Supabase has **already paused** the project, the in-database schedule cannot run; restore the project from the dashboard once, then it keeps going.
- Supabase does not publish exactly what counts as "activity"; a regular API call that runs a database query is the intended signal but is not guaranteed by this repository.
- Rotating `CRON_SECRET` requires updating the Vault value `aram_cron_secret` too (and the email scheduler if you use one).

## Optional second trigger: GitHub Actions (`.github/workflows/supabase-keep-alive.yml`)
Calls the **same** `keep-alive` function every ~3 days from GitHub's servers (independent of the in-database schedule above; you can use either or both). Complete steps 1–2 of the one-time setup first (secret + deploy).
1. Repo → **Settings → Secrets and variables → Actions → New repository secret**, create two secrets:
   | Name | Value |
   |---|---|
   | `KEEP_ALIVE_URL` | the full function URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/keep-alive` |
   | `KEEP_ALIVE_SECRET` | the exact value of the Supabase secret `CRON_SECRET` (sent as header `x-cron-secret`) |
2. **Test now:** repo → **Actions → Supabase keep-alive → Run workflow**. A green run prints `SUCCESS: keep-alive answered HTTP 200 …`. A red run prints `FAILED: … HTTP 401` (wrong secret), `HTTP 404` (not deployed), `HTTP 503` (database problem) or a curl exit code (network/timeout).
3. After that it runs by itself: minute 17 past 03:00 UTC on every 3rd day of the month (1, 4, 7 … 31).

Notes: the URL and secret are never printed (GitHub masks `secrets.*`; curl's error text is suppressed). GitHub cron is best-effort — runs can be late or occasionally skipped and are **not** exactly 72 hours apart; scheduled workflows run only from the default branch and GitHub pauses them after 60 days without repository activity (re-enable in the Actions tab or push a commit). This stores a copy of `CRON_SECRET` as a GitHub Actions secret — acceptable for this low-impact secret (it can only ping the keep-alive function and drain the email queue), but never store the service-role key, database password or provider keys there. If you rotate `CRON_SECRET`, update `KEEP_ALIVE_SECRET` too.
