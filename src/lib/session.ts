import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Designer } from "@/db/repo";
import { createClient } from "./supabase/server";

// The current Designer, or null. While sign-in is on hold (2026-09-27) most Designers are anonymous
// Supabase users: created on their first save, tied to this browser by the session cookie.
export async function getDesigner(): Promise<Designer | null> {
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

export const DEMO_LIMIT = Number(process.env.DEMO_LIMIT ?? 3);
export const UNLIMITED_EMAILS = (process.env.UNLIMITED_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
// Without an account a browser gets one Demo.
export const ANONYMOUS_DEMO_LIMIT = 1;

export const limitFor = (designer: Designer | null) =>
  !designer || designer.isAnonymous
    ? { limit: ANONYMOUS_DEMO_LIMIT, unlimitedEmails: [] }
    : { limit: DEMO_LIMIT, unlimitedEmails: UNLIMITED_EMAILS };

// Where Demo Links live: the demo host in production, this server in local dev.
export async function demoBase() {
  if (process.env.DEMO_HOST) return `https://${process.env.DEMO_HOST}`;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}
