// End-to-end tests run the app with a fake sign-in and an in-memory Postgres (e2e/test-db.mjs).
// These two checks keep that mode from ever touching production.

type Env = Record<string, string | undefined>;

// Only an explicit E2E_FAKE_AUTH=1, and never in a production build (next build sets NODE_ENV=production).
export const fakeAuthEnabled = (env: Env = process.env) => env.E2E_FAKE_AUTH === "1" && env.NODE_ENV !== "production";

// With fake sign-in on, the database must be on this machine, so a test can never write to the real one.
export function assertLocalDatabase(url: string | undefined) {
  let host = "";
  try {
    host = new URL(url ?? "").hostname;
  } catch {}
  if (host !== "localhost" && host !== "127.0.0.1") throw new Error("E2E_FAKE_AUTH needs a local DATABASE_URL (localhost or 127.0.0.1)");
}
