# SQL installation — `sql/`

**Canonical install: ONE file, `00_INSTALL_ALL.sql`.** It installs the entire Aram Store database on a **fresh** Supabase project (tables, keys, indexes, constraints, functions, triggers, RLS + policies, storage bucket, roles/permissions, inventory/order/cancellation/coupon logic, payments, email outbox, addresses, search/pagination, bilingual fields, settings, activity log, hardening, non-destructive seed data). It runs as a single transaction: if anything fails, nothing is installed. It contains no passwords, API keys or secrets.

## Install (exact steps)
1. **Create a fresh Supabase project** (supabase.com → New project; keep the database password in a password manager).
2. Open **SQL Editor → New query**.
3. Paste the whole of **`00_INSTALL_ALL.sql`** and **Run**. Wait for "Success". (If it errors, read the message — the install rolled back completely; fix the cause and run it again.)
4. **Create the first user account:** open your site (`#/login`, or locally `npm run dev`) and *Sign up* — or Supabase → Authentication → Users → *Add user* (tick *Auto Confirm User*). Also set Authentication → Providers → Email → *Confirm email* **off**.
5. Open **`08_first_admin.sql`** and change the one line `v_email text := 'CHANGE_ME@example.com';` to that account's exact email. Do not put a password or key in the file.
6. **Run `08_first_admin.sql`.** Expected notice: `Done: … is now a super administrator.`
7. **Run `99_verify.sql`** (read-only).
8. **Confirm the results:**

| check_name | expected |
|---|---|
| migrations applied | `0001, 0002, 0003, 0004, 0005, 0006, seed` |
| public tables without RLS | `none (good)` |
| RLS policies in public | a number > 0 (about 60) |
| missing functions | `none (good)` |
| triggers in public | a number > 0 |
| signup trigger on auth.users | `on_auth_user_created` |
| storage bucket | `product-images` |
| payment providers | `cod (on), bank_transfer (on), zarinpal (off), stripe (off)` |
| admin roles | `content_editor, manager, super_admin, support` |
| super admins | `1` (after step 6) |
| sample products | `12` (or `0` if you removed the sample block) |

Then sign out and in on the site and open `#/admin`.

## Safety behaviour
- Refuses to run on a project that already contains ARAM tables (`ARAM install: … already applied … Nothing was changed.`); it never drops, truncates or overwrites.
- Seed only inserts missing rows and fills *empty* English fields; edited values are never overwritten.
- `08_first_admin.sql` never creates passwords, fails if the account doesn't exist, and never overwrites an existing admin.
- Everything in the installer is transactional in PostgreSQL; there is no step that must run outside the transaction.
- Storage policies live on `storage.objects`: run from the dashboard SQL editor (postgres role). A permission error there rolls back the whole install.

## Files
| File | Purpose |
|---|---|
| `00_INSTALL_ALL.sql` | **the one-file installer (use this)** |
| `08_first_admin.sql` | make an existing account the super admin (edit one email) |
| `99_verify.sql` | read-only installation report |
| `10_keep_alive.sql` | optional, run after the install + function deploy + Vault secrets: schedules the keep-alive job (see `../KEEP_ALIVE_SETUP.md`) |
| `01_schema.sql` … `06_hardening.sql`, `07_seed.sql` | the same install split into steps (alternative; each step is transactional, ordered and refuses to run twice or out of order) |

`00_INSTALL_ALL.sql` = steps 01–07 in one transaction, with two documented de-duplications (the superseded first `restore_stock_on_cancel()` and a no-op `drop function` are omitted; the `orders_restore_stock` trigger is created once after the final function). Final database state is identical to the step-by-step route. `../supabase/migrations/` + `../supabase/seed.sql` are the CLI copies of the step files. **Use one route only — do not run `00_INSTALL_ALL.sql` and then the step files.**
