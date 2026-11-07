# PROJECT_STATUS — final pre-deployment audit

Legend: **Executed** = actually run here · **Untested** = never run · **Manual** = needs your accounts/actions.
No deployment and no database installation has been performed or verified by the author (no network, Postgres, Deno or browser were available).

## Verdict: NOT READY until the three untested items below pass on your side
1. `npm install` → `npm run typecheck` → `npm run build` — **untested** (no network; real React/Supabase typings never available). Deployment is blocked by CI until these pass.
2. `sql/00_INSTALL_ALL.sql` on a real Supabase project — **untested on PostgreSQL** (statically reviewed and mechanically validated only).
3. First deploy to GitHub Pages — **not performed**.

## Executed in this pass
| Check | Result |
|---|---|
| Network availability (registry) | unreachable → npm install/typecheck/build **not run** |
| `deploy.yml`, `ci.yml` parsed as YAML; deploy job `needs: build`; `config.toml` parsed | valid |
| package.json scripts/deps reviewed (`typecheck`, `build` = `tsc --noEmit && vite build`); Vite `base: './'`, HashRouter only (no BrowserRouter), relative favicon, `index.html` entry | consistent |
| `.gitignore`/`.env.example` reviewed; secret-pattern scan of the whole ZIP (JWTs, `sk_`, `whsec_`, DB URLs) | none found; no `.env`, no `node_modules` |
| `00_INSTALL_ALL.sql` generated from the migrations + seed, then compared **statement-by-statement** against every source file | every source statement present verbatim except 2 documented omissions (superseded first `restore_stock_on_cancel()`, no-op `drop function place_order(old)`) |
| Installer integrity: duplicate tables/functions/triggers/indexes/policies | none |
| Installer dependency order: FKs to later tables, objects on not-yet-created tables, triggers before their function, `has_perm`/`norm_fa`/`log_change` before use, sequence before `orders` | all correct |
| RLS coverage in installer | 22/22 public tables have RLS enabled |
| Installer transaction: exactly one `begin;` / `commit;`; tracker order `0001…0006, seed`; no secret-like strings | confirmed |
| `esbuild` bundle of the app; `tsc` with stubbed packages; SSR render of 28 pages (stubbed router/Supabase); Edge Function syntax transpile | pass (details: previous pass; code unchanged in this pass) |

**Not covered by any executed check:** real type-check/build, SQL semantics on PostgreSQL, RLS behaviour, Edge Function runtime, payments, email, GitHub Actions, GitHub Pages, browser behaviour.

## Changes in this pass
- **No application code change was needed** (audit found no genuine code/config defect).
- New canonical `sql/00_INSTALL_ALL.sql` (single transaction, tracker + guards preserved, seed non-destructive, no secrets). Old lowercase `00_install_all.sql` removed (name collision on case-insensitive systems).
- Step files `01…07` and `supabase/migrations` unchanged; `08_first_admin.sql` and `99_verify.sql` unchanged and separate.
- Docs updated: `sql/README.md` (exact 8-step install + expected verification table), `SUPABASE_SETUP.md`, `DEPLOYMENT.md` (repo → push → secrets → Pages → verify → Supabase Site URL), `README.md`, this file; `ADMIN_SETUP.md`/`EXTERNAL_SETUP.md` references corrected.

## Remaining manual configuration
1. Fresh Supabase project → run `sql/00_INSTALL_ALL.sql` → sign up → edit email in `sql/08_first_admin.sql` → run → run `99_verify.sql` and compare with `sql/README.md`.
2. Auth: Confirm email OFF; Site URL = Pages URL.
3. GitHub: create repo, push, secrets `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, Pages source = GitHub Actions.
4. Fix any real TypeScript error the first CI run reports.
5. Optional: Edge Functions + secrets for payments/email (`EXTERNAL_SETUP.md`).

## Security notes (static review only)
Default-deny RLS on all tables; staff via permissions; orders created/priced in the database; payment confirmation only via service-role RPC after gateway verification; no secrets in repo/frontend; first admin only via SQL editor. Residual: `admins.manage` ≈ super admin; no CAPTCHA/2FA/enforced email verification; refunds manual; RLS never penetration-tested.

## Known limitations
Manual refunds; no image reordering/CSV import; Gregorian admin date inputs; Stripe needs manual currency/rate secret; sample content illustrative.

## Keep-alive (optional add-on)
Scheduled ping so the Supabase project keeps seeing regular activity. Files: `supabase/functions/keep-alive/index.ts`, `sql/10_keep_alive.sql`, `supabase/config.toml` (+1 entry), `KEEP_ALIVE_SETUP.md`. Uses Supabase `pg_cron` + `pg_net`; the function runs one read-only `select` on `settings`, needs the `CRON_SECRET` secret (fail-closed), URL + secret read from Vault at run time (nothing in the repo). Existing schema, RLS, app code and migrations untouched; `10_keep_alive.sql` is not recorded in the install tracker, so `99_verify.sql` expectations are unchanged.
| Item | Status |
|---|---|
| Function handler logic (auth fail-closed, wrong/missing secret → 401, valid → 200 `{ok,timestamp}`, only `select key from settings limit 1`, DB error → 503 without detail, OPTIONS) | **Executed** (9/9 cases) with Deno/Supabase **stubbed** in Node |
| `config.toml` parse; `10_keep_alive.sql` quoting/transaction structure; secret scan | **Executed**, pass |
| Function on real Supabase (deploy, real DB query) | **Untested** |
| `pg_cron`/`pg_net`/Vault scheduling SQL on PostgreSQL | **Untested** (not executable here) |
| Deploy function, create 2 Vault secrets, run `10_keep_alive.sql` | **Manual, one-time** (`KEEP_ALIVE_SETUP.md`) |
Limits: cannot unpause an already-paused project; Supabase's exact inactivity rule isn't published; pg_net keeps responses only briefly (history = Edge Function logs).

### Keep-alive via GitHub Actions (`.github/workflows/supabase-keep-alive.yml`)
Cron `17 3 */3 * *` (UTC, every 3rd day of month; best-effort, not exact 72 h) + `workflow_dispatch`; POSTs to the existing function with header `x-cron-secret`; secrets `KEEP_ALIVE_URL` + `KEEP_ALIVE_SECRET`; fails on non-2xx or a response other than `{"ok":true}`; 30 s timeout, 2 retries, job limit 5 min; never prints URL/secret; no permissions granted.
| Item | Status |
|---|---|
| YAML valid; triggers/cron fields/permissions/timeout inspected | **Executed** |
| The workflow's shell step run unchanged against the real keep-alive handler (Supabase stubbed) over local HTTPS: valid → success; wrong secret (401), DB error (503), http:// URL, missing secret, missing URL, unreachable host, hanging server (curl 28 after ~50 s) → all fail; secret/host never in output | **Executed** (8/8) |
| Actual GitHub-hosted run, GitHub cron firing, real Supabase function | **Untested** — needs your repo secrets (`KEEP_ALIVE_SETUP.md`) |

## Real-browser test (Chromium via Playwright) — white-page investigation
The built-style site (esbuild bundle + the project's real `index.html`, served under a sub-path like GitHub Pages: `/REPO/`) was run in headless Chromium. **Stand-ins used:** a hand-written hash router (not react-router-dom), an in-memory Supabase fake, React 19 (project pins 18). So this proves the app's own code and `index.html` behave in a real browser; it does **not** prove react-router-dom, supabase-js, Vite output or GitHub Pages themselves.
| Scenario | Result |
|---|---|
| New `index.html`, Google Fonts requests hanging (blocked/slow network): first paint, hero, 4 product cards, ivory theme, no console/page errors | **pass** (first paint in ~0.1 s) |
| Routes `#/shop`, `#/product/…`, `#/cart`, `#/login`, `#/collections`, `#/checkout`, `#/p/about`, unknown route; add-to-cart → cart line | **pass** |
| **Previous** `index.html` (render-blocking Google Fonts stylesheet), same hanging network | **no first paint within 9 s → white page reproduced** (this was a real cause) |
| Empty Supabase config | app renders + setup banner (no crash) |
| Unbuilt `index.html` served raw (Pages "Deploy from a branch") | explanatory bilingual message appears instead of a white page |
| English mode | `dir=ltr`, `lang=en`, English navigation |
Still **untested:** real `npm install`/`tsc`/`vite build`, react-router-dom/supabase-js at runtime, a real GitHub Pages deployment, a real Supabase backend.
