import { NextResponse, type NextRequest } from "next/server";
import { fakeAuthEnabled } from "@/lib/e2e-guard";
import { refreshSession } from "@/lib/supabase/proxy";

// Only pages that read the Designer's session need it refreshed; Viewer pages stay session-free.
const NEEDS_SESSION = /^\/(app|login|auth)(\/|$)/;

export async function proxy(request: NextRequest) {
  // E2E runs without Supabase (fake sign-in cookie), so there is no session to refresh.
  return NEEDS_SESSION.test(request.nextUrl.pathname) && !fakeAuthEnabled() ? refreshSession(request) : NextResponse.next();
}

// Skip Next internals and static files (models, favicon).
export const config = { matcher: "/((?!_next/|.*\\..*).*)" };
