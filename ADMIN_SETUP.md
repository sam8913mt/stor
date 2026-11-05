# ADMIN_SETUP — first super administrator and roles

The website cannot make anyone an admin by itself (row-level security forbids it). The first admin is created from the Supabase SQL editor, which only the project owner can open.

## Create the first super admin
1. Finish `SUPABASE_SETUP.md` (run `sql/00_INSTALL_ALL.sql`, which also creates the roles).
2. **Create the account:** open your site → `#/login` → *Sign up* with the email and a strong, unique password. (Alternative: Supabase → Authentication → Users → *Add user*, tick *Auto Confirm User*.)
3. Open `sql/08_first_admin.sql` in the SQL editor and change **only** this line to that exact email:
   `v_email text := 'CHANGE_ME@example.com';`
4. **Run.** Success message: `Done: … is now a super administrator.` Errors are explicit: placeholder not edited / account not found (sign up first) / roles missing (run the seed) / already an admin (nothing changed).
5. Remove your email from the editor history, **sign out and in again** on the site, open `https://USER.github.io/REPO/#/admin`.
6. Run `99_verify.sql` → *super admins* should be `1`.

No password, key or token is stored in any script. Do not paste the script with your email into chats or commits.

## Roles (seeded) and permissions
| Role | Permissions |
|---|---|
| `super_admin` | everything (`*`); cannot be edited or removed if it is the last one |
| `manager` | products, catalogue, orders, customers, coupons, reviews, CMS, analytics, logs |
| `content_editor` | products, catalogue, CMS, reviews |
| `support` | orders, customers, reviews |

Permission keys: `products.manage`, `catalog.manage`, `orders.manage`, `customers.manage`, `marketing.manage`, `reviews.manage`, `cms.manage`, `settings.manage`, `analytics.view`, `logs.view`, `admins.manage`. Payment/email/store settings need `settings.manage`; adding admins needs `admins.manage` (treat it as equivalent to super admin).

## Adding or changing admins later
Admin panel → **Admins & roles**: the person must already have signed up; enter their email, pick a role. Edit a non-super role's permissions in the same page. Every change is recorded in the Activity log.

## Security recommendations
- Turn on MFA for your **Supabase** and **GitHub** accounts.
- Use a unique password for the admin account; give staff the narrowest role.
- Never share the `service_role` key, the database password or Edge Function secrets with staff.
- If you lose access: sign in to the Supabase dashboard, sign up/choose another account, and run `08_first_admin.sql` with that email (an existing admin is never overwritten).
