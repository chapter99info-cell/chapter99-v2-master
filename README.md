# Chapter99 V4 — Complete System
## Thai Massage & Spa PWA + POS — Australia

---

## 📁 Project Structure

```
src/
├── App.tsx                        ← Main entry + PIN routing
├── types/
│   ├── pos.ts                     ← Phase 5 types
│   └── admin.ts                   ← Phase 7 types
├── lib/
│   ├── posCalc.ts                 ← GST + surcharge calc
│   ├── posDb.ts                   ← Offline IndexedDB
│   ├── syncService.ts             ← Offline → Supabase sync
│   ├── thermalPrinter.ts          ← 80mm receipt printer
│   ├── healthFundPDF.tsx          ← HICAPS PDF generator
│   ├── notifyService.ts           ← SMS + Email
│   ├── alertSystem.ts             ← Insurance/Visa/BAS alerts
│   ├── googleSheets.ts            ← Tax report sync
│   └── adminService.ts            ← Super admin data
├── components/
│   ├── booking/BookingSystem.tsx  ← Phase 3: Online booking
│   ├── queue/QueueBoard.tsx       ← Phase 4: iPad queue
│   ├── staff/StaffManager.tsx     ← Phase 2: Staff CRUD
│   ├── pos/POSPage.tsx            ← Phase 5: POS system
│   ├── alerts/AlertDashboard.tsx  ← Phase 6: Owner alerts
│   ├── dashboard/                 ← Phase 7: Super admin
│   ├── shops/AddShopModal.tsx
│   └── proposals/ProposalBuilder.tsx
supabase/
│   ├── 00-schema-phase1.sql       ← PIN auth
│   ├── 00-schema-phase2.sql       ← Multi-tenant + Staff
│   ├── 00-schema-phase3-4.sql     ← Booking + Queue
│   ├── 01-schema-phase5.sql       ← POS + Transactions
│   ├── 02-schema-phase6.sql       ← Health Fund + Google
│   └── 03-schema-phase7.sql       ← Proposals + MRR
api/
│   ├── posRoutes.ts               ← SMS, Email, Sheet sync
│   ├── phase6Routes.ts            ← Drive upload, Cron
│   └── cron/                      ← Daily alert jobs
scripts/
│   └── googleAppsScript.js        ← Google Apps Script
```

---

## 🚀 Setup Guide

### 1. Clone & Install
```bash
git clone https://github.com/your-repo/chapter99-v4
cd chapter99-v4
npm install
cp .env.example .env.local
```

### 2. Supabase Setup (Trip2Talk V4 — fresh project)

In Supabase Dashboard → **trip2talk-v4** → **SQL Editor**, run **one file at a time** in this order:

```
supabase/001_missing_tables.sql   ← Chapter99 spa schema (optional if using spa only)
supabase/002_rls_policies.sql
supabase/003_seed_data.sql
supabase/004_trip2talk_tables.sql ← Trip2Talk tours, CRM, client app tables
supabase/005_trip2talk_rls.sql
supabase/006_trip2talk_seed.sql   ← sample tour + guide content
```

**Trip2Talk client routes:** `/onboard`, `/app`, `/app/social`, `/app/packing`, `/app/trip`  
**Staff PIN:** `/` (PIN gate) → `1111` guide, `4444` cashier, `9999` owner  
**Chapter99 spa staff (legacy):** `/chapter99/staff/*`

**Legacy / incremental migrations:** numbered files in `supabase/` (e.g. `21`, `22`, `28`–`31`) are still used for upgrades on existing databases; the `001`–`003` bundle is for a new empty project only.

### 3. Environment Variables
```env
# Supabase
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Shop
VITE_SHOP_ID=shop-001

# Twilio SMS
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+61400000000

# Resend Email
RESEND_API_KEY=re_...

# Stripe
VITE_STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...

# Google
GOOGLE_SERVICE_ACCOUNT={"type":"service_account"...}
GOOGLE_SHEET_ID=1Bxi...
GOOGLE_DRIVE_FOLDER_ID=1abc...

# Cron
CRON_SECRET=your_secret_here
```

### 4. Google Apps Script
1. Go to [script.google.com](https://script.google.com)
2. New Project → paste `scripts/googleAppsScript.js`
3. Update `SUPABASE_URL`, `SHOP_ID`, `DRIVE_FOLDER_ID`
4. Run `setupTriggers()` once

### 5. vercel.json (Cron Jobs)
```json
{
  "crons": [
    { "path": "/api/cron/alerts", "schedule": "0 22 * * *" },
    { "path": "/api/cron/monthly-report", "schedule": "0 22 1 * *" }
  ]
}
```

### 6. Deploy
```bash
# Push to GitHub → Vercel auto-deploys
git add .
git commit -m "Chapter99 V4 initial deploy"
git push origin main
```

---

## 🔐 PIN System

| PIN | Level | Access |
|-----|-------|--------|
| `1111` | Staff | Own queue + briefing only |
| `4444` | Cashier | POS + Booking + Add/Edit staff |
| `9999` | Owner | Everything + Delete staff |
| `3501` | Super Admin | All shops + Proposals + MRR |

---

## 💰 Pricing (Locked — do not modify)

| Tier | Setup | /month |
|------|-------|--------|
| Starter | $199 | $29 |
| Professional | $499 | $69 |
| Business Plus | $899 | $110 |

---

## 🇦🇺 Australia Compliance

- ✅ GST 10% (1/11 formula)
- ✅ Remedial Massage GST-free
- ✅ HICAPS Health Fund receipts
- ✅ ABN + Provider Number on all receipts
- ✅ Card surcharge 1.5% (ACCC compliant)
- ✅ PayID (zero cost)
- ✅ BAS quarterly reminders
- ✅ Superannuation 11.5%
- ✅ Visa/Work Rights tracking
- ✅ Insurance expiry alerts

---

## 📱 Devices

| Device | Use |
|--------|-----|
| iPad (landscape) | POS + Queue Board |
| iPhone | Staff queue view |
| Desktop | Super Admin dashboard |
| Any browser | Customer booking page |

---

Built with ❤️ by Chapter99 · chapter99solutions.com.au
