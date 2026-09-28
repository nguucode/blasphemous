// In-memory Postgres for end-to-end tests: PGlite with the real migration, served over the
// Postgres wire protocol on 127.0.0.1:5433 so the app connects exactly as it does to Supabase.
// Everything is gone when the process stops.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const PORT = 5433;
const db = new PGlite();
// Supabase owns auth.users; the fake sign-in (src/lib/session.ts) inserts into this stand-in.
await db.exec("create schema auth; create table auth.users (id uuid primary key);");
await migrate(drizzle(db), { migrationsFolder: "drizzle" });

const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1", maxConnections: 5 });
await server.start();
console.log(`E2E database ready on 127.0.0.1:${PORT}`);

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
