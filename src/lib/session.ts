import "server-only";
import { sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { transferDemos, type Designer } from "@/db/repo";
import { fakeAuthEnabled } from "./e2e-guard";
import { createClient } from "./supabase/server";

// E2E only (see e2e-guard.ts): the Designer is a uuid in this cookie instead of a Supabase session.
const FAKE_COOKIE = "e2e_designer";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The current Designer, or null. Designers sign in with Google (spec 12, 2026-10-07). Anonymous Designers
// from before that still reach the Demo they made, until they sign in and it moves to their account.
export async function getDesigner(): Promise<Designer | null> {
  if (fakeAuthEnabled()) {
    const id = (await cookies()).get(FAKE_COOKIE)?.value;
    return id && UUID.test(id) ? { id, email: "e2e@blasphemous.test", isAnonymous: false } : null;
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "", isAnonymous: claims.is_anonymous === true };
}

const loginUrl = (next: string) => `/login?next=${encodeURIComponent(next)}`;

// For /app pages that show someone's own Demos. Pages render in parallel with their layout, so each checks.
export async function requireDesigner(next: string): Promise<Designer> {
  const designer = await getDesigner();
  if (!designer) redirect(loginUrl(next));
  return designer;
}

// Creating a Demo needs a signed-in account; an anonymous Designer is sent to sign in first.
export async function requireAccount(next: string): Promise<Designer> {
  const designer = await getDesigner();
  if (!designer || designer.isAnonymous) redirect(loginUrl(next));
  return designer;
}

export const DEMO_LIMIT = 3;

// Starts Google sign-in from a Server Action and returns the URL to send the browser to.
export async function googleSignInUrl(next: string): Promise<string | null> {
  if (fakeAuthEnabled()) {
    const id = crypto.randomUUID();
    await getDb().execute(sql`insert into auth.users (id) values (${id})`); // the test database's stand-in for Supabase Auth
    (await cookies()).set(FAKE_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" });
    return next;
  }
  const supabase = await createClient();
  await rememberAnonymous(supabase);
  // Server Actions always carry Origin; Supabase only redirects to URLs on its allow list anyway.
  const origin = (await headers()).get("origin");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  return error ? null : data.url;
}

// Signing in replaces the anonymous session, so its access token waits in this cookie for the callback,
// which verifies it and moves that Designer's Demos to the account.
// ponytail: the token lives an hour, so a sign-in left open longer keeps the Demos on the anonymous user;
// moving them by hand (transferDemos) is the fix if it ever happens.
const ANON_COOKIE = "anon_handoff";
type Supabase = Awaited<ReturnType<typeof createClient>>;

async function rememberAnonymous(supabase: Supabase) {
  const designer = await getDesigner();
  if (!designer?.isAnonymous) return;
  const { data } = await supabase.auth.getSession(); // already verified by getDesigner's getClaims
  if (!data.session) return;
  (await cookies()).set(ANON_COOKIE, data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // Google's redirect back is a top-level GET, which lax cookies follow
    path: "/auth",
    maxAge: 600,
  });
}

export async function adoptAnonymousDemos(supabase: Supabase, accountId: string) {
  const store = await cookies();
  const token = store.get(ANON_COOKIE)?.value;
  if (!token) return;
  store.delete({ name: ANON_COOKIE, path: "/auth" });
  const { data } = await supabase.auth.getClaims(token);
  const from = data?.claims;
  if (from?.is_anonymous === true && from.sub && from.sub !== accountId) await transferDemos(getDb(), from.sub, accountId);
}

// Where Demo Links live: the demo host in production, this server in local dev.
export async function demoBase() {
  if (process.env.DEMO_HOST) return `https://${process.env.DEMO_HOST}`;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}
