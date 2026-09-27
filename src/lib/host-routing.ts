import { isReservedSlug, isSlugFormat } from "./slug";

// Spec 6: the app lives on appHost, Demo Links on demoHost; one deployment serves both.
// Without both hosts configured (local dev) every request passes through.
export type Route = { type: "next" } | { type: "redirect"; url: string };

export function routeRequest({
  host, pathname, appHost, demoHost,
}: { host: string; pathname: string; appHost?: string; demoHost?: string }): Route {
  if (!appHost || !demoHost) return { type: "next" };
  const hostname = host.split(":")[0];
  const segments = pathname.split("/").filter(Boolean);
  const isDemoPath = segments.length === 1 && isSlugFormat(segments[0]) && !isReservedSlug(segments[0]);

  if (hostname === demoHost) return isDemoPath ? { type: "next" } : { type: "redirect", url: `https://${appHost}${pathname}` };
  if (hostname === appHost && isDemoPath) return { type: "redirect", url: `https://${demoHost}${pathname}` };
  return { type: "next" };
}
