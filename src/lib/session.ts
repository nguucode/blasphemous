import "server-only";
import { sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import type { Designer } from "@/db/repo";
import { fakeAuthEnabled } from "./e2e-guard";
import { createClient } from "./supabase/server";

// E2E only (see e2e-guard.ts): the Designer is a uuid in this cookie instead of a Supabase session.
const FAKE_COOKIE = "e2e_designer";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The current Designer, or null. While sign-in is on hold (2026-09-27) most Designers are anonymous
// Supabase users: created on their first save, tied to this browser by the session cookie.
export async function getDesigner(): Promise<Designer | null> {
  if (fakeAuthEnabled()) {
    const id = (await cookies()).get(FAKE_COOKIE)?.value;
    return id && UUID.test(id) ? { id, email: "", isAnonymous: true } : null;
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "", isAnonymous: claims.is_anonymous === true };
}

// The current Designer, or a new anonymous one. Only call from a Server Action or Route Handler
// (it sets the session cookie), and only when the visitor is about to save something.
export async function getOrCreateDesigner(): Promise<Designer> {
  const existing = await getDesigner();
  if (existing) return existing;
  if (fakeAuthEnabled()) {
    const id = crypto.randomUUID();
    await getDb().execute(sql`insert into auth.users (id) values (${id})`); // the test database's stand-in for Supabase Auth
    (await cookies()).set(FAKE_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" });
    return { id, email: "", isAnonymous: true };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw new Error(`Anonymous sign-in failed: ${error?.message ?? "no user"}`);
  return { id: data.user.id, email: "", isAnonymous: true };
}

// For /app pages that show someone's own Demos. Pages render in parallel with their layout, so each checks.
// Without a Designer there is nothing to show yet: start by creating a Demo.
export async function requireDesigner(): Promise<Designer> {
  const designer = await getDesigner();
  if (!designer) redirect("/app/new");
  return designer;
}

// Sign-in is on hold, so every Designer is a browser, and a browser gets one Demo.
// Per-account limits (spec 7.4) come back with sign-in.
export const DEMO_LIMIT = 1;

// Where Demo Links live: the demo host in production, this server in local dev.
export async function demoBase() {
  if (process.env.DEMO_HOST) return `https://${process.env.DEMO_HOST}`;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}
