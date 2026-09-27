import "server-only";
import type { Device, DeviceLink } from "@/components/device-view";
import { deviceLinks, resolveSlug } from "./demo-store";
import { readState } from "./dev-db";

// A Demo as the Viewer page needs it (spec 7.1).
export type PublishedDemo = {
  name: string;
  slug: string;
  links: Partial<Record<Device, DeviceLink>>;
  responsiveDesktop: boolean;
  backgroundColor: string;
};

export async function lookupDemo(slug: string): Promise<{ demo: PublishedDemo } | { redirectTo: string } | undefined> {
  const found = resolveSlug(readState(), slug);
  if (!found || "redirectTo" in found) return found;
  const { name, responsiveDesktop, backgroundColor } = found.demo;
  return { demo: { name, slug, links: deviceLinks(found.demo), responsiveDesktop, backgroundColor } };
}
