# SUPABASE_SETUP — master installation guide (one SQL file)

For a **fresh** Supabase project. Nothing here has been run against a real database by the author: run the verification script (step 5) and report any error text if something fails. All scripts contain **no** keys, passwords or personal data.

## 1. Create the project
1. supabase.com → **New project** → choose a region near your customers → set a strong **database password** and store it in a password manager (it is never needed by this app or by GitHub).
2. Wait until the project status is healthy.
3. Project Settings → API: note the **Project URL** and **anon public** key (used for GitHub secrets / `.env`). Keep the **service_role** key private; this project never uses it in the frontend (Edge Functions receive it automatically).

## 2. Install the database — ONE file
1. Open **SQL Editor → New query**.
2. Paste the entire contents of **`sql/00_INSTALL_ALL.sql`** → **Run** → wait for "Success".

That single file installs everything the app needs, in dependency order, as **one transaction** (tables, keys, indexes, constraints, functions, triggers, RLS + all policies, the `product-images` storage bucket, roles/permissions, order/inventory/coupon/cancellation logic, payments, email outbox, addresses, search/pagination, bilingual fields, settings, activity log, hardening, and non-destructive seed data: default admin roles, settings, categories, CMS pages, 12 sample products with English text). If any statement fails, **nothing** is installed — fix the cause and run it again.
To start with an empty catalogue, delete the sample-product `do $$ … $$` block near the end of the seed section before running.

**Built-in safety:** an install tracker (`aram_migrations`) makes the installer refuse to run on a project that already has ARAM tables (`ARAM install: … already applied. Nothing was changed.`). It never drops or overwrites anything; the seed part only inserts missing rows and never overwrites values you edited. The file contains no passwords, keys or secrets. Everything in it is transactional in PostgreSQL, so there is no part that must run outside the transaction. Use this route **or** the step files below — never both.

### Alternative: step-by-step files (same result)
Run `sql/01_schema.sql` → `02_functions.sql` → `03_security.sql` → `04_storage.sql` → `05_features.sql` → `06_hardening.sql` → `07_seed.sql`, each in its own query, waiting for success. Each step is transactional, checks that the previous step ran, and refuses to run twice or out of order. Use this only if you want to inspect or apply the steps separately. CLI users: `supabase/migrations/*` + `supabase/seed.sql` are the same step files (`supabase link --project-ref REF && supabase db push`, then run the seed); never put `08_first_admin.sql` into migrations.

## 3. Authentication settings
Authentication → Providers → Email: enabled, **Confirm email OFF**. URL Configuration: Site URL = your GitHub Pages URL (after you have it; `http://localhost:5173` while developing).

## 4. Storage
Nothing to click: `04_storage.sql` creates the bucket. Check Storage → `product-images` exists and is Public.

## 5. First administrator (sign up → edit one email in `sql/08_first_admin.sql` → run it)
Follow `ADMIN_SETUP.md`.

## 6. Verify (after the first admin)
Run `99_verify.sql` (read-only). Expected: migrations `0001, 0002, 0003, 0004, 0005, 0006, seed`; *public tables without RLS* = `none (good)`; *missing functions* = `none (good)`; signup trigger present; storage bucket `product-images`; payment providers `cod (on), bank_transfer (on), zarinpal (off), stripe (off)`; admin roles `content_editor, manager, super_admin, support`; super admins `1` once `08_first_admin.sql` has been run (`0` before).

## 7. Edge Functions (payments, email) — optional until you need them
Follow `EXTERNAL_SETUP.md`. Cash on delivery and bank transfer work without them.

## Troubleshooting
| Message | Meaning / action |
|---|---|
| `run step 000X first` | (step-by-step route only) you skipped a file — run the missing one, then continue |
| `step 000X was already applied` | already installed; nothing changed — do not re-run; continue with the next stage |
| `0001 already applied, or public.profiles already exists` | the project already has tables with these names; use a fresh project (this installer never overwrites) |
| `Supabase Storage is not available` | enable Storage for the project, then run `04_storage.sql` again |
| `permission denied … storage.objects` | run the script as the default `postgres` role in the dashboard SQL editor |
| Any other error | the whole file was rolled back; fix nothing by hand — copy the exact error and the file name and ask for help |

## Starting over
The installer never deletes anything. To restart from scratch, create a new Supabase project (or reset the database from Project Settings → Database, which **destroys all data**), then repeat from step 2.
