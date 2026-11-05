# ARAM — quiet-luxury fashion store

React 18 + TypeScript + Vite storefront and admin dashboard on Supabase (Postgres, Auth, Storage, RLS, Edge Functions). Persian RTL by default, English LTR optional. Hosted as a static site on GitHub Pages.

**Status first:** read `PROJECT_STATUS.md` — it separates what is implemented, what was executed here, what is untested, and what still needs your manual configuration.

## Guides (follow in this order)
| # | Document | Covers |
|---|---|---|
| 1 | `SUPABASE_SETUP.md` | create the project, run `sql/00_INSTALL_ALL.sql`, verify |
| 2 | `ADMIN_SETUP.md` | create the first super administrator, roles |
| 3 | `DEPLOYMENT.md` | GitHub repo, upload, secrets, Pages, deploy, verify |
| 4 | `EXTERNAL_SETUP.md` | optional: Zarinpal/Stripe, email, Edge Functions + secrets |
| 5 | `KEEP_ALIVE_SETUP.md` | optional: scheduled keep-alive ping so the Supabase project stays active |

## Folder map
- `sql/` — **`00_INSTALL_ALL.sql` = the complete one-file database installer**, plus `08_first_admin.sql`, `99_verify.sql` and the same install split into steps `01…07` (see `sql/README.md`)
- `supabase/migrations/` + `supabase/seed.sql` — same SQL for the Supabase CLI · `supabase/functions/` — Edge Functions (`create-payment`, `payment-callback`, `stripe-webhook`, `process-email-queue`) · `supabase/config.toml`
- `src/pages` storefront · `src/admin` dashboard · `src/components` · `src/context.tsx` · `src/lib` · `src/i18n.ts` + `src/locales/en.ts` · `src/styles`
- `.github/workflows/deploy.yml` (build → deploy, blocks on type/build errors) · `ci.yml` (PR checks) · `supabase-keep-alive.yml` (optional scheduled ping, needs secrets `KEEP_ALIVE_URL` + `KEEP_ALIVE_SECRET`)
- `.env.example` — the only two public variables the frontend needs

## Local development
```bash
cp .env.example .env     # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (public values)
npm install              # then commit the generated package-lock.json
npm run typecheck        # tsc --noEmit
npm run dev              # http://localhost:5173
npm run build            # tsc --noEmit && vite build → dist/
```
Requires Node ≥ 18.18. Cash on delivery and bank transfer work out of the box; online payments and email need `EXTERNAL_SETUP.md`.

## Security basics
Only the Supabase URL and anon key reach the browser (both public by design). Data access is enforced by Row Level Security; orders are created and priced by database functions; payment confirmation happens only server-side. Never put service-role keys, database passwords, or provider keys in the repo, `.env`, or GitHub secrets.
