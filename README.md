# Blasphemous

[![CI](https://github.com/nguucode/blasphemous/actions/workflows/ci.yml/badge.svg)](https://github.com/nguucode/blasphemous/actions/workflows/ci.yml)

Present Figma prototypes to clients with one link. Clients don't need a Figma account, switch between phone, tablet and desktop on the page, and see the phone flow inside a 3D iPhone they can rotate and still tap through.

**[Live demo](https://ontheshore.biz/products/blasphemous/demo/)** · [Product page](https://ontheshore.biz/products/blasphemous/)

Beta, and a personal project by [ontheshore](https://ontheshore.biz). The interface is in Vietnamese.

## Features

- **One link for every device.** Turn on Desktop, Tablet and/or Mobile and paste a Figma prototype link for each. Every Device turned on is a tab; viewers switch without reloading and land on the tab that fits their screen.
- **3D devices.** Mobile is a 3D iPhone 17 Pro Max, Tablet a 3D iPad Pro 12.9″ or iPad Air 11″; the real Figma embed sits inside and stays interactive at any angle. Desktop is a monitor at 1280, 1440 or 1920 wide.
- **Flow list.** Read the file's flows once with a Figma personal access token (used for that one request, never stored), or add a flow by link. Flows are grouped by Device, whether each Device has its own Figma page or they share one.
- **Keyboard.** W/S: previous/next flow. D/A: next/previous screen, through the Figma Embed API (needs `NEXT_PUBLIC_FIGMA_CLIENT_ID`).
- **Brand.** Logo (PNG/SVG), brand colour for the selected tab and flow, and a background colour or image.
- **Live Figma.** Nothing is imported: edit the prototype in Figma and the Demo follows.
- **Clean links that last.** Each Demo gets its own slug. Renaming keeps the old link working, and a slug is never given to anyone else, even after deletion.
- **No sign-up.** Creating a Demo starts an anonymous session tied to the browser (one Demo per browser during the Beta). Google and magic-link sign-in exist in the code but are switched off.

## How it works

The Figma prototype is an ordinary `<iframe>` rendered by three.js's `CSS3DRenderer`, underneath a transparent WebGL canvas that draws the device. The model's screen writes transparent pixels, punching a hole through which the iframe shows, and the device body hides it when you turn it around. See [`src/components/device-3d.tsx`](src/components/device-3d.tsx).

## Stack

Next.js 16 (App Router, TypeScript), React 19, Tailwind CSS v4, Supabase (Postgres and Auth), Drizzle ORM, three.js. Tests: Vitest, Playwright, and PGlite as an in-memory Postgres.

## Getting started

Requirements: Node.js 20.9 or newer, a free [Supabase](https://supabase.com) project, and pnpm (`corepack enable`, or prefix commands with `npx pnpm@12.6.0`).

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. In Supabase:
   - **Authentication → Sign In / Providers:** turn on **Allow anonymous sign-ins**.
   - **Authentication → URL Configuration:** set Site URL to `http://localhost:3000` and add `http://localhost:3000/**` to Redirect URLs.
3. Copy `.env.example` to `.env.local` and fill in the project URL, the publishable key and the database connection string (Supabase → Connect → Transaction pooler, port 6543).
4. Create the tables:
   ```bash
   pnpm db:migrate
   ```
5. Optional: for the D/A shortcuts, create an OAuth app at [figma.com/developers/apps](https://www.figma.com/developers/apps), add your site's origin (and `http://localhost:3000`) as an embed origin, and set `NEXT_PUBLIC_FIGMA_CLIENT_ID`.
6. Start the app at http://localhost:3000:
   ```bash
   pnpm dev
   ```

The tables have Row Level Security on and no policies, so Supabase's public Data API can't read or write them. Only the server, connecting with `DATABASE_URL`, can.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm test` | Unit and integration tests (the database tests run the real migration on PGlite, no Supabase needed) |
| `pnpm e2e` | End-to-end tests in Chromium (see below) |
| `pnpm typecheck` | TypeScript |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations to the database in `DATABASE_URL` |

## End-to-end tests

`pnpm e2e` runs Playwright against a separate dev server on port 3100 and needs no Supabase project or `.env.local`:

- The database is PGlite (Postgres in memory) with the real migrations, served on `127.0.0.1:5433` ([`e2e/test-db.mjs`](e2e/test-db.mjs)). It is empty on every run.
- Sign-in is replaced by a test cookie, switched on by `E2E_FAKE_AUTH=1`. [`src/lib/e2e-guard.ts`](src/lib/e2e-guard.ts) ignores that switch in production builds and refuses any database that is not on localhost.

The first run downloads Chromium (`npx playwright install chromium`).

## Routes

| Route | Page |
|---|---|
| `/` | Homepage with a live sample Demo |
| `/try` | Playground: paste a link and preview it, nothing saved |
| `/app/new` | Create a Demo, in the same layout clients see |
| `/app` | Your Demos (this browser) |
| `/app/demos/[id]` | Edit, hide or delete a Demo |
| `/[slug]` | The page clients see |
| `/api/media/[id]/[kind]` | A published Demo's logo or background image (`kind`: `logo`, `background`) |
| `/privacy`, `/terms` | Privacy and terms |

## Project layout

```
src/
  app/                 routes (see above), server actions in app/app/actions.ts
  components/          device-3d.tsx (3D iPhone/iPad), device-view.tsx (switcher and stage), demo-shell.tsx (Demo layout, Flow list, shortcuts)
  db/                  schema.ts, repo.ts (data rules) and their tests
  lib/                 figma-link.ts, figma-flows.ts, devices.ts, device-models.ts, demo-rules.ts, slug.ts, session.ts, supabase/
  proxy.ts             Supabase session refresh
drizzle/               SQL migrations
public/models/         the iPhone model
```

## Deploying

The live app runs on Cloudflare Workers through [OpenNext](https://opennext.js.org/cloudflare). The worker name, domain and `DEMO_HOST` are in [`wrangler.jsonc`](wrangler.jsonc); change them for your own deployment.

1. `pnpm wrangler login`
2. `pnpm wrangler secret put DATABASE_URL` (the Transaction pooler string)
3. Put `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (and, for D/A, `NEXT_PUBLIC_FIGMA_CLIENT_ID`) in `.env.local`: they are built into the browser bundle.
4. `pnpm run deploy` builds and uploads. `pnpm preview` runs the same build locally in workerd, reading secrets from `.dev.vars`.

In Supabase, add `https://<your domain>/**` to Redirect URLs.

Build from an APFS or HFS+ disk. On exFAT and other non-Apple drives macOS writes `._*` files next to every build file, and OpenNext fails on them.

Any other Node host that runs Next.js also works: set the same variables as `.env.local`, plus `DEMO_HOST`.

## License

Code: [MIT](LICENSE).

The 3D phone model is [“iPhone 17 Pro Max”](https://sketchfab.com/3d-models/iphone-17-pro-max-e7c5674931ae4b0ea1b4eaaabb159fdb) by [Taufiq K](https://sketchfab.com/fqrhmn), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and modified (see [`public/models/LICENSE.txt`](public/models/LICENSE.txt)). Keep the credit on any page that shows it.

Blasphemous is not affiliated with Figma or Apple. Figma is a trademark of Figma, Inc.
