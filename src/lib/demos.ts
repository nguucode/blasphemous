import "server-only";
import type { DeviceLink } from "@/components/device-view";
import { getDb } from "@/db";
import { deviceLinks, resolveSlug } from "@/db/repo";
import { DEVICES, type Device, type Flow } from "@/lib/devices";

// A Demo as the Viewer page needs it (spec 7.1, 12). Brand images go by URL, not inline.
export type PublishedDemo = {
  name: string;
  slug: string;
  enabled: Device[];
  links: Partial<Record<Device, DeviceLink>>;
  models: Partial<Record<Device, string>>;
  flows: Flow[];
  brandColor: string;
  backgroundColor: string;
  backgroundImage: string | null;
  logo: string | null;
};

// The version in the query lets /api/media cache for good: a new upload changes the URL.
export const mediaUrl = (id: string, kind: "logo" | "background", updatedAt: string) =>
  `/api/media/${id}/${kind}?v=${Date.parse(updatedAt).toString(36)}`;

export async function lookupDemo(slug: string): Promise<{ demo: PublishedDemo } | { redirectTo: string } | undefined> {
  const found = await resolveSlug(getDb(), slug);
  if (!found || "redirectTo" in found) return found;
  const d = found.demo;
  const links = deviceLinks(d);
  const enabled = DEVICES.map((x) => x.id).filter((x) => d.devices[x].enabled && links[x]);
  return {
    demo: {
      name: d.name,
      slug,
      enabled,
      links,
      models: Object.fromEntries(enabled.map((x) => [x, d.devices[x].model])),
      flows: d.flows.filter((f) => enabled.includes(f.device)),
      brandColor: d.brandColor,
      backgroundColor: d.backgroundColor,
      backgroundImage: d.backgroundImage && mediaUrl(d.id, "background", d.updatedAt),
      logo: d.logo && mediaUrl(d.id, "logo", d.updatedAt),
    },
  };
}
