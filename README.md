# PetBindr Marketing Site

Waitlist landing page for [petbindr.com](https://petbindr.com). Built with Next.js 15 (App Router), Tailwind CSS, Framer Motion, Firebase Admin SDK, and Resend.

---

## Running locally

```bash
cd petbindr-site
npm install

# Copy env file and fill in your values (see Environment Variables below)
cp .env.local.example .env.local

npm run dev
# → http://localhost:3000
```

---

## Deploying to Vercel

1. Push `petbindr-site/` to GitHub (or a monorepo — Vercel handles subdirectory roots)
2. In Vercel, create a new project and set **Root Directory** to `petbindr-site`
3. Add all environment variables from `.env.local.example` in the Vercel dashboard
4. Deploy — Vercel auto-detects Next.js

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `RESEND_API_KEY` | Yes | From [resend.com/api-keys](https://resend.com/api-keys) |
| `RESEND_FROM_EMAIL` | No | Defaults to `onboarding@resend.dev`. Set to `waitlist@petbindr.com` after domain verification. |
| `FIREBASE_PROJECT_ID` | No | Defaults to `petbindr-2d4bd` (the PetBindr Firebase project) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes | Base64-encoded or raw JSON service account key (see below) |

---

## Firebase service account setup

The marketing site uses **Firebase Admin SDK** to write waitlist signups to Firestore.
It reuses the same Firebase project as the iOS app (`petbindr-2d4bd`) but requires a
separate server-side service account.

**Steps:**

1. Go to [Firebase Console](https://console.firebase.google.com) → `petbindr-2d4bd`
2. Click the gear icon → **Project Settings** → **Service Accounts** tab
3. Click **Generate new private key** → **Generate key**
4. A `.json` file downloads — keep it secret, never commit it
5. Encode it for the environment variable:

```bash
base64 -i serviceAccount.json | tr -d '\n'
```

6. Paste the output as `FIREBASE_SERVICE_ACCOUNT_JSON` in `.env.local` and Vercel

**Firestore collection:** `waitlist`
Each document ID is the email address (prevents duplicates). Fields:
- `email` — string
- `createdAt` — server timestamp
- `foundingMember` — boolean (true for first 1,000 signups)
- `source` — string (optional, from UTM params)

---

## Resend email setup

1. Sign up at [resend.com](https://resend.com)
2. Get your API key and add it as `RESEND_API_KEY`
3. To send from `waitlist@petbindr.com`:
   - Go to Resend → Domains → Add domain → `petbindr.com`
   - Add the DNS records they provide to your domain registrar
   - Once verified, set `RESEND_FROM_EMAIL=waitlist@petbindr.com`
4. Until domain is verified, the API route falls back to `onboarding@resend.dev`

---

## Swapping in real screenshots

Replace the placeholder divs in `components/sections/SolutionSection.tsx`.

1. Drop your screenshots in `public/screenshots/`:
   - `sharing-permissions.png`
   - `task-tracking.png`
   - `quick-reference.png`

2. In `SolutionSection.tsx`, replace each `<div className="screenshot-placeholder">` with:

```tsx
import Image from "next/image";

<Image
  src="/screenshots/sharing-permissions.png"
  alt="Sharing & permissions screen"
  width={260}
  height={463}
  className="rounded-2xl shadow-xl"
/>
```

Recommended screenshot specs: 390×844px (iPhone 15 Pro), exported at 2x (780×1688px actual file).

---

## OG image

`public/og-image.png` is currently a placeholder. Before launch:
- Create a 1200×630px image in Figma or Canva
- Background: `#FBF8F3` (Warm Cream)
- Headline: "Our pet binder was 13 pages. So we built this instead." in Fraunces navy
- Logo in upper-left corner
- Export as PNG and replace `public/og-image.png`

---

## Updating social links

Social URLs appear in two places:
- `components/sections/BuildInPublicSection.tsx`
- `components/sections/FooterSection.tsx`

Search for `TODO` comments to find them. Replace the `href` values with live URLs.

---

## Logo

Drop your real logo SVG at `public/logo.svg`. The current file is a placeholder.
The `<Image>` component in `components/sections/Hero.tsx` renders it at:
- 160px wide on desktop
- 120px wide on mobile
