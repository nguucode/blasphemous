import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Db } from "./repo";
import * as schema from "./schema";

// One pool per server process (kept across dev hot reloads). prepare: false because Supabase's
// transaction pooler (port 6543), the one to use from serverless, does not support prepared statements.
const g = globalThis as unknown as { db?: Db };

export function getDb(): Db {
  if (g.db) return g.db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL in .env.local (Supabase → Connect → Transaction pooler)");
  g.db = drizzle(postgres(url, { prepare: false, max: 5 }), { schema });
  return g.db;
}
