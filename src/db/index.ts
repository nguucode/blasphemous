import "server-only";
import { cache } from "react";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { assertLocalDatabase, fakeAuthEnabled } from "@/lib/e2e-guard";
import type { Db } from "./repo";
import * as schema from "./schema";

// prepare: false because Supabase's transaction pooler (port 6543), the one to use from serverless,
// does not support prepared statements.
function connect(max: number): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL in .env.local (Supabase → Connect → Transaction pooler)");
  if (fakeAuthEnabled()) assertLocalDatabase(url);
  return drizzle(postgres(url, { prepare: false, max }), { schema });
}

// Cloudflare Workers can't reuse a socket across requests, so there each request opens its own connection.
const onWorkers = globalThis.navigator?.userAgent === "Cloudflare-Workers";
const perRequestDb = cache(() => connect(1));

// Elsewhere: one pool per server process (kept across dev hot reloads).
const g = globalThis as unknown as { db?: Db };

export function getDb(): Db {
  if (onWorkers) return perRequestDb();
  // E2E's in-memory Postgres (PGlite) is single-threaded: one connection keeps transactions from interleaving.
  g.db ??= connect(fakeAuthEnabled() ? 1 : 5);
  return g.db;
}
