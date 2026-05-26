# Payment notification flow

```
ลูกทริปจ่ายเงิน (Cashier POS / Onboarding)
        ↓
① Email ใบเสร็จ → ลูกทริป (Resend — free tier)
        ↓
② Web Push → Staff รู้ทันที (browser push — free)
        ↓
③ Staff โพสต์ FB Group เอง (~30 วินาที) — copy จาก Guide dashboard
```

## Code path

1. `tour_bookings.insert` in `CashierPOS.tsx` or `PreTripOnboarding.tsx`
2. `dispatchTransactionNotification()` → Edge Function `send-trip-receipt`
3. `send-trip-receipt`:
   - Resend email to `client_email` (from `crm_clients.client_email`)
   - Web Push to all rows in `push_notifications`
4. Staff on `/staff` (PIN 1111):
   - Enable push once → saves subscription
   - Realtime `INSERT` on `tour_bookings` refreshes manifest + shows FB copy box

## Setup

### 1. SQL (Supabase SQL Editor)

Run `supabase/012_crm_push_notifications.sql` (migrates `staff_push_subscriptions` → `push_notifications`).

### 2. VAPID keys (one-time)

```bash
npx web-push generate-vapid-keys
```

- **Supabase** → Edge Functions → Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- **Vercel / .env**: `VITE_VAPID_PUBLIC_KEY` = same public key

### 3. Resend (email)

Secrets: `RESEND_API_KEY`, `RESEND_FROM_EMAIL=receipts@trip2talk.app`

### 4. Redeploy edge function

```bash
npx supabase functions deploy send-trip-receipt --project-ref rvcwprxnqwscgjusmjvj
```

### 5. Staff device

- Open Guide dashboard (`/staff`, PIN `1111`)
- Tap **Enable push notifications**
- Allow browser permission
- Add to Home Screen (PWA) on phone for alerts when app is closed

## FB post template

Auto-generated Thai/English text — **Copy for Facebook** on Staff dashboard after each payment.
