import "server-only";
import { headers } from "next/headers";
import type { Designer } from "@/db/repo";
import { createClient } from "./supabase/server";

// The signed-in Designer (Supabase Auth, spec 5 and 8.2), or null.
export async function getDesigner(): Promise<Designer | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  return claims?.sub && typeof claims.email === "string" ? { id: claims.sub, email: claims.email } : null;
}

export const DEMO_LIMIT = Number(process.env.DEMO_LIMIT ?? 3);
export const UNLIMITED_EMAILS = (process.env.UNLIMITED_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);

// Where Demo Links live: the demo host in production, this server in local dev.
export async function demoBase() {
  if (process.env.DEMO_HOST) return `https://${process.env.DEMO_HOST}`;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}
