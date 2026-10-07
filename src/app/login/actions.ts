"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { googleSignInUrl } from "@/lib/session";

export async function signInWithGoogle(next: string) {
  const url = await googleSignInUrl(safeNext(typeof next === "string" ? next : undefined));
  redirect(url ?? "/login?error=google");
}
