# EXTERNAL_SETUP — payments, email and Edge Functions

Secrets summary (all set with `supabase secrets set NAME=value`; none goes into the repo; the only exception is the optional keep-alive workflow, which keeps a copy of `CRON_SECRET` as the GitHub Actions secret `KEEP_ALIVE_SECRET` (see `KEEP_ALIVE_SETUP.md`)): `SITE_URL`, `ZARINPAL_MERCHANT_ID`, `ZARINPAL_SANDBOX`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY`, `STRIPE_RATE`, `EMAIL_API_KEY`, `CRON_SECRET`. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected into functions by Supabase automatically.

# Setup for features that need external accounts

Nothing here is connected until you do it. The app ships the integration code; you supply credentials. **Secrets never go in the repo, `.env`, GitHub Pages or the `settings` table** — only in Supabase Edge Function secrets.

## 0. Prerequisites
```bash
npm i -g supabase            # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```
Complete `SUPABASE_SETUP.md` first (run `sql/00_INSTALL_ALL.sql`). Optional: cash on delivery / bank transfer need none of this.

## 1. Common secret
```bash
supabase secrets set SITE_URL=https://YOUR-USER.github.io/YOUR-REPO/    # trailing slash; used for redirects + CORS
```

## 2. Deploy the functions
```bash
supabase functions deploy create-payment
supabase functions deploy payment-callback --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy process-email-queue --no-verify-jwt
```
`create-payment` keeps JWT verification on and additionally validates the caller's access token and order ownership. The other three are called by gateways/cron without a user JWT, so each authenticates itself: `payment-callback` re-verifies the payment with Zarinpal server-to-server, `stripe-webhook` checks Stripe's HMAC signature, `process-email-queue` needs `x-cron-secret` or a signed-in user's token (`supabase/config.toml` records the `verify_jwt = false` setting).

CORS: the functions answer browsers from `SITE_URL`'s origin and from `http://localhost:*` (for `npm run dev`).

## 3. Payments
Admin → **Payment methods**. Cash-on-delivery and bank transfer work with no setup. Keep online providers **disabled** until their secrets are set.

### Zarinpal (Iran)
1. Create a merchant in the Zarinpal panel; copy the **Merchant ID** (UUID). For testing use their sandbox merchant.
2. `supabase secrets set ZARINPAL_MERCHANT_ID=… ZARINPAL_SANDBOX=true` (set `false`/omit in production).
3. In the Zarinpal panel, register your domain (the callback is `https://<ref>.supabase.co/functions/v1/payment-callback`).
4. Enable *Online payment (Zarinpal)* in the admin. Flow: checkout → `create-payment` → Zarinpal page → `payment-callback` verifies server-to-server (amount from DB, ×10 Toman→Rial) → order marked paid → redirect to the order page.

### Stripe (international cards)
Stripe does not settle in Toman, so you choose a currency and a conversion rate:
1. `supabase secrets set STRIPE_SECRET_KEY=sk_live_… STRIPE_CURRENCY=usd STRIPE_RATE=600000` (`STRIPE_RATE` = Toman per 1 USD, e.g.).
2. Stripe Dashboard → Developers → Webhooks → add `https://<ref>.supabase.co/functions/v1/stripe-webhook`, event `checkout.session.completed` (+ `checkout.session.async_payment_succeeded`). Copy the signing secret:
   `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_…`
3. Test with `sk_test_…` and the Stripe CLI (`stripe listen --forward-to …`) before going live.
4. Enable *Card payment (Stripe)* in the admin.

Customers whose payment fails or is abandoned keep an unpaid order and can **Pay online** again or **Cancel** from *Account → Orders*.

## 4. Email notifications
Templates (order placed, status change, payment received, new-order alert to admin) are bilingual and rendered in the Edge Function; rows are queued in `email_outbox` by database triggers.
1. Create an account with **Resend** (verify your sending domain) or **Brevo** (verify sender).
2. `supabase secrets set EMAIL_API_KEY=…`
3. Admin → **Email notifications**: choose provider, set sender address/name, optional admin alert address, tick *enabled*, save, then **Send test**.
4. Delivery trigger: the storefront/admin nudge the queue after orders and status changes, but for reliability schedule it. Generate a random secret, then:
```bash
supabase secrets set CRON_SECRET=$(openssl rand -hex 24)
```
```sql
-- Supabase SQL editor (enable pg_cron and pg_net under Database → Extensions first)
select cron.schedule('send-emails', '* * * * *', $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-email-queue',
    headers := '{"Content-Type":"application/json","x-cron-secret":"PASTE_CRON_SECRET"}'::jsonb,
    body := '{}'::jsonb) $$);
```
(Prefer Supabase Vault for the secret if you don't want it visible in `cron.job`.) Failed sends retry up to 5 times; see the queue table in the admin.

## 5. English / LTR
Header **EN / فا** switches language (stored in the browser, page reloads). UI text: Persian lives in code as `tr('id', 'فارسی')`, English in `src/locales/en.ts` keyed by id (missing ids fall back to Persian). Content (products, collections, categories, pages, hero text, settings) has `_en` fields editable in the admin; empty `_en` falls back to Persian. Add a new UI string: write `tr('x.1', 'متن')` and add `'x.1': 'Text'` to `en.ts`.

## 6. Troubleshooting
| Symptom | Cause |
|---|---|
| Checkout says gateway not set up | provider enabled but secret missing / function not deployed |
| Paid but order stays unpaid | callback/webhook URL not registered, wrong `SITE_URL`, or Stripe `STRIPE_WEBHOOK_SECRET` mismatch — check function logs (`supabase functions logs payment-callback`) |
| Emails stay `queued` | provider disabled in admin, `EMAIL_API_KEY`/sender missing, or cron not scheduled (use *Send queued now*) |
| `OUT_OF_STOCK` when reactivating a cancelled order | stock was sold meanwhile; restock first |
