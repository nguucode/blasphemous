# Blasphemous

[![CI](https://github.com/nguucode/blasphemous/actions/workflows/ci.yml/badge.svg)](https://github.com/nguucode/blasphemous/actions/workflows/ci.yml)

Present Figma prototypes to clients with one link. Clients don't need a Figma account, switch between phone, tablet and desktop on the page, and see the phone flow inside a 3D iPhone they can rotate and still tap through.

**[Live demo](https://ontheshore.biz/products/blasphemous/demo/)** · [Product page](https://ontheshore.biz/products/blasphemous/)

Beta, and a personal project by [ontheshore](https://ontheshore.biz). The interface is in Vietnamese.

## Features

- **One link for every device.** Paste a Figma prototype link for phone, tablet and/or desktop. Viewers switch devices without reloading; desktop can scale to 1280, 1440 or 1920 wide.
- **3D iPhone.** The real Figma embed sits inside a rotatable iPhone model and stays interactive at any angle.
- **Live Figma.** Nothing is imported: edit the prototype in Figma and the Demo follows.
- **Clean links that last.** Each Demo gets its own slug. Renaming keeps the old link working, and a slug is never given to anyone else, even after deletion.
- **No sign-up.** Creating a Demo starts an anonymous session tied to the browser (one Demo per browser during the Beta). Google and magic-link sign-in exist in the code but are switched off.

## How it works

The Figma prototype is an ordinary `<iframe>` rendered by three.js's `CSS3DRenderer`, underneath a transparent WebGL canvas that draws the phone. The model's own screen mesh writes transparent pixels, punching a hole through which the iframe shows, and the phone body hides it when you turn the phone around. See [`src/components/phone-3d.tsx`](src/components/phone-3d.tsx).

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
5. Start the app at http://localhost:3000:
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
| `/app/new` | Create a Demo, with a live preview |
| `/app` | Your Demos (this browser) |
| `/app/demos/[id]` | Edit, hide or delete a Demo |
| `/[slug]` | The page clients see |
| `/privacy`, `/terms` | Privacy and terms |

## Project layout

```
src/
  app/                 routes (see above), server actions in app/app/actions.ts
  components/          phone-3d.tsx (3D iPhone), device-view.tsx (device switcher and stage)
  db/                  schema.ts, repo.ts (data rules) and their tests
  lib/                 figma-link.ts, demo-rules.ts, slug.ts, host-routing.ts, session.ts, supabase/
  proxy.ts             host routing and Supabase session refresh
drizzle/               SQL migrations
public/models/         the iPhone model
```

## Deploying

Any Node host that runs Next.js works; Vercel is the simplest. Set the same variables as `.env.local`, plus `DEMO_HOST` to the domain that serves Demo Links (for example `blasphemous.ontheshore.biz`), and add `https://<that domain>/**` to Supabase's Redirect URLs.

## License

Code: [MIT](LICENSE).

The 3D phone model is [“iPhone 17 Pro Max”](https://sketchfab.com/3d-models/iphone-17-pro-max-e7c5674931ae4b0ea1b4eaaabb159fdb) by [Taufiq K](https://sketchfab.com/fqrhmn), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and modified (see [`public/models/LICENSE.txt`](public/models/LICENSE.txt)). Keep the credit on any page that shows it.

Blasphemous is not affiliated with Figma or Apple. Figma is a trademark of Figma, Inc.
