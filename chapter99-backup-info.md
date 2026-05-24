# Chapter99 Project Backup

Last updated: Saturday 23 May 2026

---

## GitHub Repository

- **Repo URL:** https://github.com/chapter99info-cell/chapter99-v4-complete
- **Branch:** `main`
- **Latest commit:** `48b56bf` — Add built-in privacy and terms pages with booking agreement.

---

## Vercel

- **Project:** chapter99-v4-complete
- **URL:** https://chapter99-v4-complete.vercel.app
- **Custom domain:** https://chapter99info.tech
- **Login:** via GitHub (same account linked to `chapter99info-cell`)

---

## Supabase

- **Project URL:** Set in Vercel → Project → Settings → Environment Variables as `VITE_SUPABASE_URL` / `SUPABASE_URL` (format: `https://<project-ref>.supabase.co`)
- **Do not store the URL or keys in this document** — copy names/values from Vercel or your local `.env` after clone.
- **Login:** via Google
- **SQL migrations:** Run files in repo `supabase/` in order (especially recent: `21`, `22`, `24`, `28`, `29`, `30`, `31`) via Supabase SQL Editor.

---

## Environment Variables (names only — no values)

### Client (Vite — prefix `VITE_`)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SHOP_ID`
- `VITE_SHOP_DOMAIN_MAP`
- `VITE_PUBLIC_APP_URL` (optional — public site base URL for menu/QR links)

### Server / Vercel API routes

- `SUPABASE_URL` (optional if `VITE_SUPABASE_URL` is set — APIs fall back to it)
- `SUPABASE_ANON_KEY` (listed for completeness; primary client key is `VITE_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `CRON_SECRET`
- `SHOP_DOMAIN_MAP` (JSON: hostname → shop slug for custom domains)
- `SHOP_ID` (optional server fallback for Stripe checkout)
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` (Google Sheets sync)
- `GOOGLE_PRIVATE_KEY` (Google Sheets sync)
- `REVIEW_REQUEST_PREVIEW_EMAIL` (optional — review-request API preview)
- `GOOGLE_AI_API_KEY` (if used for AI features — confirm in Vercel dashboard)

### Auto / platform (usually set by Vercel — do not add manually)

- `VERCEL_URL`
- `NODE_ENV`

**Template file in repo:** `.env.example` (placeholders only).

---

## Custom domain map (example shape)

`SHOP_DOMAIN_MAP` and `VITE_SHOP_DOMAIN_MAP` use JSON, e.g.:

```json
{"mira-thai-massage.com.au":"mira","sdcws.com.au":"sdcws"}
```

Add each shop hostname in Vercel when attaching domains in Hostinger.

---

## Hostinger Domains

- chapter99info.tech
- mirathaimassage.com.au
- chapter99info.com
- chapter99solutions.com.au

Point DNS A/CNAME records to Vercel per Vercel project → Domains instructions.

---

## How to restore on a new computer

1. Install **Chrome** → sign in with Google.
2. Install **Node.js** LTS — https://nodejs.org
3. Install **Git** — https://git-scm.com
4. Install **Cursor** — https://cursor.com
5. Clone the repo:
   ```bash
   git clone https://github.com/chapter99info-cell/chapter99-v4-complete.git
   cd chapter99-v4-complete
   ```
6. Install dependencies:
   ```bash
   npm install
   ```
7. Create `.env` in project root — copy **variable names and values** from Vercel (Settings → Environment Variables). Use `.env.example` as a checklist. **Never commit `.env`.**
8. Run locally:
   ```bash
   npm run dev
   ```
9. Open the URL shown in the terminal (usually http://localhost:5173).
10. Staff app: `/staff` (optional `?shop=<slug>` on default Vercel host).
11. Public site: `/?shop=<slug>` or custom domain after DNS + `SHOP_DOMAIN_MAP` are configured.

**Production deploy:** Push to `main` → Vercel auto-deploys from GitHub.

---

## Important logins

| Service | How to sign in |
|--------|----------------|
| **Vercel** | GitHub |
| **Supabase** | Google |
| **GitHub** | `chapter99info-cell` |
| **Hostinger** | [email] |
| **Google AI Studio** | [email] (if using `GOOGLE_AI_API_KEY`) |
| **Resend** | (account tied to `receipts@chapter99solutions.com.au` domain) |
| **Stripe** | Chapter99 Stripe dashboard |
| **Twilio** | SMS account for booking/review SMS |

---

## Project structure (quick reference)

| Area | Location |
|------|----------|
| Public site routes | `src/Root.tsx`, `src/pages/`, `src/layouts/PublicLayout.tsx` |
| Staff / POS app | `src/App.tsx`, `/staff` route |
| Super Admin (PIN 3501) | `src/components/dashboard/SuperAdminDashboard.tsx` |
| Booking wizard | `src/components/booking/BookingWizard.tsx` |
| API routes (Vercel) | `api/*.ts` |
| Shared server logic | `server/*.ts` |
| Edge middleware (custom domains) | `middleware.ts`, `lib/shopDomainMap.ts` |
| DB migrations | `supabase/*.sql` |

---

## Security reminders

- **Never** put API keys, service role keys, or Stripe secrets in git or this backup file.
- Rotate keys if `.env` was ever shared or committed by mistake.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only (Vercel), never expose as `VITE_`.

---

*This document is a recovery checklist only. Live secrets live in Vercel and Supabase dashboards.*
