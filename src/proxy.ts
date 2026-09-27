import { NextResponse, type NextRequest } from "next/server";
import { routeRequest } from "@/lib/host-routing";
import { refreshSession } from "@/lib/supabase/proxy";

// Only pages that read the Designer's session need it refreshed; Viewer pages stay session-free.
const NEEDS_SESSION = /^\/(app|login|auth)(\/|$)/;

export async function proxy(request: NextRequest) {
  const route = routeRequest({
    host: request.headers.get("host") ?? "",
    pathname: request.nextUrl.pathname,
    appHost: process.env.APP_HOST,
    demoHost: process.env.DEMO_HOST,
  });
  if (route.type === "redirect") return NextResponse.redirect(route.url, 301);
  return NEEDS_SESSION.test(request.nextUrl.pathname) ? refreshSession(request) : NextResponse.next();
}

// Skip Next internals and static files (models, favicon).
export const config = { matcher: "/((?!_next/|.*\\..*).*)" };
