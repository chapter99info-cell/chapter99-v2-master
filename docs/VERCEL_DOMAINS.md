# Vercel domain split (Mira Thai vs Trip2Talk)

Two Vercel projects must **never** share a custom domain.

| Vercel project | Product | Custom domains | Production URL |
|----------------|---------|----------------|----------------|
| **chapter99-v4-complete** | Mira Thai Massage (Chapter99 spa) | `chapter99info.tech`, `www.chapter99info.tech` | https://www.chapter99info.tech |
| **trip2talk-v4** | Trip2Talk V4 | `trip2talk.com.au`, `www.trip2talk.com.au`, `trip2talk-v4.vercel.app` | https://trip2talk.com.au |

## Verify (CLI)

```bash
npx vercel api "/v9/projects/trip2talk-v4/domains" --raw
npx vercel api "/v9/projects/chapter99-v4-complete/domains" --raw
```

Expected: `trip2talk-v4` has **no** `chapter99info.tech`. `chapter99-v4-complete` has **no** `trip2talk.app` / `trip2talk-v4.vercel.app` as a user-facing primary (`.vercel.app` preview URL is OK).

## Remove a domain from the wrong project

Dashboard: **Project → Settings → Domains → ⋯ → Delete**

Or API:

```bash
npx vercel api DELETE "/v9/projects/trip2talk-v4/domains/chapter99info.tech"
npx vercel api DELETE "/v9/projects/trip2talk-v4/domains/www.chapter99info.tech"
```

## Add `trip2talk.com.au`

See **`docs/TRIP2TALK_DOMAIN_SETUP.md`** for registrar DNS, env vars, and QR base URL.

Quick env on **trip2talk-v4**:

- `VITE_APP_URL=https://trip2talk.com.au`
- `VITE_PUBLIC_APP_URL=https://trip2talk.com.au`
- `VITE_TRIP2TALK_URL=https://trip2talk.com.au`

## App routing (chapter99-v4-complete codebase)

Hostname detection lives in `src/lib/productDomain.ts`:

- `chapter99info.tech` → spa routes at `/`
- `trip2talk.com.au` / `www.trip2talk.com.au` → Trip2Talk PIN at `/`

**Deploy from this repo:** always link to `trip2talk-v4` only:

```bash
npx vercel link --yes --project trip2talk-v4
npx vercel --prod --yes
```

Never run `vercel --prod` here while linked to `chapter99-v4-complete` (Mira Thai).
