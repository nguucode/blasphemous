import { NextResponse, type NextRequest } from "next/server";
import { routeRequest } from "@/lib/host-routing";

export function proxy(request: NextRequest) {
  const route = routeRequest({
    host: request.headers.get("host") ?? "",
    pathname: request.nextUrl.pathname,
    appHost: process.env.APP_HOST,
    demoHost: process.env.DEMO_HOST,
  });
  return route.type === "redirect" ? NextResponse.redirect(route.url, 301) : NextResponse.next();
}

// Skip Next internals and static files (models, favicon).
export const config = { matcher: "/((?!_next/|.*\\..*).*)" };
