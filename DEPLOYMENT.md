# DEPLOYMENT — GitHub + GitHub Pages

Nothing in this guide has been executed for you: a deployment only exists once *you* push and the workflow turns green.
Prerequisites: a GitHub account, Git, Node ≥ 18.18 (only if you want to build locally), and a finished Supabase setup (`SUPABASE_SETUP.md`: run `sql/00_INSTALL_ALL.sql`) so you have the **Project URL** and **anon public key**.

## How the site is built
- Vite builds a static site with `base: './'` (relative URLs) and **hash routing** (`https://USER.github.io/REPO/#/shop`). That works under any repository path, with no 404 workaround and no server rewrite rules.
- Only two values are compiled into the site: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Both are public by design; the database is protected by Row Level Security.
- Everything private (service-role key, payment keys, email key, cron secret) lives only in Supabase Edge Function secrets — never in GitHub, `.env`, or the repo.

## 1. Create the GitHub repository
Web: github.com → **New repository** → name e.g. `aram-store` → Public (GitHub Pages on private repos needs a paid plan) → **do not** add README/.gitignore/licence → Create.
CLI alternative: `gh repo create aram-store --public --source=. --remote=origin` (run inside the project folder after step 2's `git init`).

## 2. Upload the project
Unzip `aram-store-final.zip`, open a terminal in the folder, then:
```bash
git init -b main
git add .
git status            # confirm: no .env, no node_modules, no dist
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USER/aram-store.git
git push -u origin main
```
`.gitignore` already excludes `.env*` (except `.env.example`), `node_modules`, `dist`, caches, logs and Supabase CLI state. The first push will start the deploy workflow; it will **fail until step 3 and 4 are done** — that is intentional.
Recommended: run `npm install` once locally and commit the generated `package-lock.json` (makes installs reproducible).

## 3. Configure GitHub repository secrets
Repo → **Settings → Secrets and variables → Actions → New repository secret** — create exactly two:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → *Project URL* |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → *anon public* key |

CLI alternative (values are read from your shell, not printed):
`gh secret set VITE_SUPABASE_URL` and `gh secret set VITE_SUPABASE_ANON_KEY` (paste when prompted).
**Never** add the `service_role` key or the database password here. The workflow stops with a clear error if either secret is empty.

## 4. Enable GitHub Pages
Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**. (No branch/folder selection is needed.)

## 5. Deploy and verify the deployment
Push to `main` (or Actions → *Deploy to GitHub Pages* → **Run workflow**). The workflow:
1. fails early if the two secrets are missing;
2. `npm install`;
3. `npm run build` = `tsc --noEmit && vite build` → **any type error or build error fails the job**;
4. only if the build job succeeds does the `deploy` job (`needs: build`) publish `dist/`.
`ci.yml` runs the same type-check + build on pull requests and non-main branches, without deploying and without secrets.
The site URL appears in the deploy job summary: `https://YOUR-USER.github.io/aram-store/`.

If the **first** build reports TypeScript errors: that is the type check doing its job (the project could not be type-checked against the real React/Supabase typings before delivery). Fix the reported lines and push again; deployment stays blocked until it passes.

### Verification checklist (manual)
1. Home page loads, fonts and layout look right, the **EN / فا** switch works.
2. `#/shop`: products appear (sample data), filters and pagination respond.
3. Register an account, add an item to the cart, place a cash-on-delivery order, see it under *Account → Orders*, cancel it (stock returns).
4. Make yourself admin (`sql/08_first_admin.sql`, see `ADMIN_SETUP.md`) and open `#/admin`: dashboard shows the order; change its status.
5. Browser console has no red errors; Network tab shows requests only to `*.supabase.co`, Google Fonts and your Pages domain.

## 6. Configure the Supabase Site URL and authentication settings
Supabase → Authentication → URL Configuration: *Site URL* = your Pages URL (with trailing slash), and add it to *Redirect URLs*. In Authentication → Providers → Email, keep **Confirm email OFF** (hash routing is incompatible with email-confirmation links).
If you use payments/email Edge Functions, set the same URL as the `SITE_URL` secret (see `EXTERNAL_SETUP.md`).

## Updating later
Commit and push to `main`; the same workflow redeploys. Database changes: add a new numbered SQL file and run it in the SQL editor (never edit an applied migration).

## Troubleshooting
| Symptom | Cause / fix |
|---|---|
| Workflow: "Secret … is not set" | step 3 not done or typo in the secret name |
| Workflow fails at `npm run build` | read the `tsc` or Vite error in the log; fix and push |
| Blank page, red "Supabase is not configured" banner | secrets were empty at build time → set them and re-run the workflow |
| Pages shows 404 | Pages source not set to *GitHub Actions* (step 4), or first deploy not finished |
| Images/fonts missing | check you opened the Pages URL, not the repo URL |
| Login works but admin says "No access" | account not yet made admin (`ADMIN_SETUP.md`) — sign out/in after |
