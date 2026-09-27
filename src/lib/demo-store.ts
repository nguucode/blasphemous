import type { Device } from "@/components/device-view";
import type { DemoValue } from "./demo-rules";
import { isReservedSlug } from "./slug";

// The data rules of spec 7.1–7.5 as pure functions over the whole state: the Beta limit, slugs
// never reissued, old slugs redirecting, soft delete, ownership. Storage is someone else's job
// (lib/dev-db.ts now; Drizzle later), so these stay the same when the database arrives.

export type Designer = { id: string; email: string };
export type DemoInput = DemoValue;
export type DemoRecord = DemoValue & {
  id: string;
  ownerId: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
export type DemoState = { demos: DemoRecord[]; redirects: { slug: string; demoId: string }[] };
type Result<E extends string> = { ok: true; state: DemoState } | { ok: false; error: E };

export const emptyState = (): DemoState => ({ demos: [], redirects: [] });

export function isSlugTaken(state: DemoState, slug: string, exceptDemoId?: string) {
  return (
    isReservedSlug(slug) ||
    state.demos.some((d) => d.slug === slug && d.id !== exceptDemoId) ||
    state.redirects.some((r) => r.slug === slug && r.demoId !== exceptDemoId)
  );
}

export const listDemos = (state: DemoState, owner: Designer) => state.demos.filter((d) => d.ownerId === owner.id && !d.deletedAt);

export function demoLimit(owner: Designer, limit: number, unlimitedEmails: string[]) {
  return unlimitedEmails.some((e) => e.toLowerCase() === owner.email.toLowerCase()) ? Infinity : limit;
}

export function createDemo(
  state: DemoState,
  owner: Designer,
  input: DemoInput,
  { limit, unlimitedEmails, now }: { limit: number; unlimitedEmails: string[]; now: string },
): { ok: true; state: DemoState; demo: DemoRecord } | { ok: false; error: "limit" | "slug-taken" } {
  if (listDemos(state, owner).length >= demoLimit(owner, limit, unlimitedEmails)) return { ok: false, error: "limit" };
  if (isSlugTaken(state, input.slug)) return { ok: false, error: "slug-taken" };
  const demo: DemoRecord = { ...input, id: crypto.randomUUID(), ownerId: owner.id, isPublished: true, createdAt: now, updatedAt: now, deletedAt: null };
  return { ok: true, state: { ...state, demos: [...state.demos, demo] }, demo };
}

const findOwned = (state: DemoState, owner: Designer, id: string) => state.demos.find((d) => d.id === id && d.ownerId === owner.id && !d.deletedAt);
const replace = (state: DemoState, demo: DemoRecord): DemoState => ({ ...state, demos: state.demos.map((d) => (d.id === demo.id ? demo : d)) });

export function updateDemo(state: DemoState, owner: Designer, id: string, input: DemoInput, now: string): Result<"not-found" | "slug-taken"> {
  const demo = findOwned(state, owner, id);
  if (!demo) return { ok: false, error: "not-found" };
  if (input.slug !== demo.slug && isSlugTaken(state, input.slug, demo.id)) return { ok: false, error: "slug-taken" };
  let redirects = state.redirects;
  if (input.slug !== demo.slug) {
    // The old slug now redirects; a slug this Demo takes back stops being a redirect.
    redirects = [...redirects.filter((r) => r.slug !== input.slug), { slug: demo.slug, demoId: demo.id }];
  }
  return { ok: true, state: { ...replace(state, { ...demo, ...input, updatedAt: now }), redirects } };
}

export function setPublished(state: DemoState, owner: Designer, id: string, isPublished: boolean): Result<"not-found"> {
  const demo = findOwned(state, owner, id);
  return demo ? { ok: true, state: replace(state, { ...demo, isPublished }) } : { ok: false, error: "not-found" };
}

export function deleteDemo(state: DemoState, owner: Designer, id: string, now: string): Result<"not-found"> {
  const demo = findOwned(state, owner, id);
  return demo ? { ok: true, state: replace(state, { ...demo, deletedAt: now }) } : { ok: false, error: "not-found" };
}

// Viewer lookup: current slug first, then old slugs (spec 7.3). Hidden and deleted Demos are invisible.
export function resolveSlug(state: DemoState, slug: string): { demo: DemoRecord } | { redirectTo: string } | undefined {
  const demo = state.demos.find((d) => d.slug === slug);
  if (demo) return demo.isPublished && !demo.deletedAt ? { demo } : undefined;
  const redirect = state.redirects.find((r) => r.slug === slug);
  const target = redirect && state.demos.find((d) => d.id === redirect.demoId);
  return target ? { redirectTo: target.slug } : undefined;
}

export const deviceLinks = (demo: DemoValue) =>
  Object.fromEntries(Object.entries(demo.nodeIds).map(([d, nodeId]) => [d, { fileKey: demo.fileKey, nodeId }])) as Partial<
    Record<Device, { fileKey: string; nodeId: string }>
  >;
