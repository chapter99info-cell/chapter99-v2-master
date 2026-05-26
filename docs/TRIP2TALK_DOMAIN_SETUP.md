# trip2talk.com.au — domain setup (trip2talk-v4)

## STEP 1 — Vercel Dashboard

1. Open [trip2talk-v4](https://vercel.com) → **Settings** → **Domains**
2. **Add domain:** `trip2talk.com.au`
3. **Add domain:** `www.trip2talk.com.au`
4. Wait until Vercel shows **Valid Configuration** (can take up to 48h after DNS).

CLI (optional):

```bash
npx vercel domains add trip2talk.com.au trip2talk-v4
npx vercel domains add www.trip2talk.com.au trip2talk-v4
```

## STEP 2 — DNS at your registrar

| Type  | Name | Value                 |
|-------|------|-----------------------|
| A     | `@`  | `76.76.21.21`         |
| CNAME | `www`| `cname.vercel-dns.com`|

Use the exact records Vercel shows if they differ from the table above.

## STEP 3 — Vercel environment (trip2talk-v4 project)

Set for **Production** (and Preview if you want QR previews on preview URLs):

| Variable | Value |
|----------|--------|
| `VITE_APP_URL` | `https://trip2talk.com.au` |
| `VITE_PUBLIC_APP_URL` | `https://trip2talk.com.au` |
| `VITE_TRIP2TALK_URL` | `https://trip2talk.com.au` |
| `VITE_APP_PRODUCT` | `trip2talk` |

CLI:

```bash
npx vercel env add VITE_APP_URL production
npx vercel env add VITE_PUBLIC_APP_URL production
npx vercel env add VITE_TRIP2TALK_URL production
npx vercel env add VITE_APP_PRODUCT production
```

Then redeploy:

```bash
npx vercel --prod --yes
```

## STEP 4 — QR / onboarding links (code)

Staff onboarding QR uses `getTrip2TalkAppOrigin()` / `buildTrip2TalkOnboardUrl()` in `src/lib/trip2talkAppUrl.ts`.

Example production URL:

`https://trip2talk.com.au/onboard?trip=NZ2026-01`

## STEP 5 — Do not attach this domain to chapter99-v4-complete

`chapter99info.tech` stays on **chapter99-v4-complete** only.  
`trip2talk.com.au` stays on **trip2talk-v4** only.

See also `docs/VERCEL_DOMAINS.md`.
