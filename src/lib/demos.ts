import type { Device, DeviceLink } from "@/components/device-view";

// A Demo as the Viewer page needs it (spec 7.1).
export type PublishedDemo = {
  name: string;
  slug: string;
  links: Partial<Record<Device, DeviceLink>>;
  responsiveDesktop: boolean;
  backgroundColor: string;
};

const LIVE_CHAT = { fileKey: "k0piuu0Zxvnmz3rpCaGLfa", nodeId: "3:10" };

// ponytail: in-memory sample Demos until Supabase exists. Replace the body of getPublishedDemo with the
// Drizzle query from spec 7.3/7.5 (demos.slug, then slug_redirects; is_published and not deleted).
const SAMPLE_DEMOS: PublishedDemo[] = [
  { name: "Live Chat", slug: "live-chat", links: { desktop: LIVE_CHAT, phone: LIVE_CHAT }, responsiveDesktop: false, backgroundColor: "#000000" },
  { name: "Live Chat (responsive)", slug: "live-chat-responsive", links: { desktop: LIVE_CHAT }, responsiveDesktop: true, backgroundColor: "#1e1b4b" },
];

export async function getPublishedDemo(slug: string): Promise<PublishedDemo | undefined> {
  return SAMPLE_DEMOS.find((d) => d.slug === slug);
}
