import "server-only";
import { headers } from "next/headers";
import type { Designer } from "./demo-store";

// ponytail: TEMPORARY until Supabase Auth (spec 5, 8.2). In development every request is one fixed
// Designer; in production there is no Designer at all, so /app and its actions stay closed.
export async function getDesigner(): Promise<Designer | null> {
  if (process.env.NODE_ENV === "production") return null;
  return { id: "dev-designer", email: process.env.DEV_DESIGNER_EMAIL ?? "dev@localhost" };
}

export const DEMO_LIMIT = Number(process.env.DEMO_LIMIT ?? 3);
export const UNLIMITED_EMAILS = (process.env.UNLIMITED_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);

// Where Demo Links live: the demo host in production, this server in local dev.
export async function demoBase() {
  if (process.env.DEMO_HOST) return `https://${process.env.DEMO_HOST}`;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}
