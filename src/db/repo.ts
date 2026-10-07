import { and, eq, isNull, ne, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { DEFAULT_DEVICES, type Device } from "@/lib/devices";
import type { DemoValue } from "@/lib/demo-rules";
import { isReservedSlug } from "@/lib/slug";
import { demos, slugRedirects } from "./schema";
import type * as schema from "./schema";

// Data rules of spec 7.1–7.5 on Postgres: the Beta limit, slugs never reissued, old slugs
// redirecting, soft delete, ownership. The server is the only client (RLS blocks the Data API).

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Q = Db | Tx;

export type Designer = { id: string; email: string; isAnonymous?: boolean };
export type DemoInput = DemoValue;
export type DemoRecord = DemoValue & {
  id: string;
  ownerId: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type Row = typeof demos.$inferSelect;
const toRecord = (r: Row): DemoRecord => ({
  id: r.id,
  ownerId: r.ownerId,
  name: r.name,
  slug: r.slug,
  fileKey: r.figmaFileKey,
  nodeIds: Object.fromEntries(
    ([["phone", r.phoneNodeId], ["tablet", r.tabletNodeId], ["desktop", r.desktopNodeId]] as const).filter(([, v]) => v),
  ) as Partial<Record<Device, string>>,
  devices: { ...DEFAULT_DEVICES, ...r.devices },
  flows: r.flows,
  brandColor: r.brandColor,
  backgroundColor: r.backgroundColor,
  backgroundImage: r.backgroundImage,
  logo: r.logo,
  isPublished: r.isPublished,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
  deletedAt: r.deletedAt?.toISOString() ?? null,
});
const toColumns = (input: DemoInput) => ({
  name: input.name,
  slug: input.slug,
  figmaFileKey: input.fileKey,
  phoneNodeId: input.nodeIds.phone ?? null,
  tabletNodeId: input.nodeIds.tablet ?? null,
  desktopNodeId: input.nodeIds.desktop ?? null,
  devices: input.devices,
  flows: input.flows,
  brandColor: input.brandColor,
  backgroundColor: input.backgroundColor,
  backgroundImage: input.backgroundImage,
  logo: input.logo,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Drizzle wraps driver errors; the Postgres code sits on the cause.
const isUniqueViolation = (e: unknown) => {
  const err = e as { code?: string; cause?: { code?: string } };
  return (err.cause?.code ?? err.code) === "23505";
};
const owned = (owner: Designer, id: string) => and(eq(demos.id, id), eq(demos.ownerId, owner.id), isNull(demos.deletedAt));

export const deviceLinks = (demo: DemoValue) =>
  Object.fromEntries(Object.entries(demo.nodeIds).map(([d, nodeId]) => [d, { fileKey: demo.fileKey, nodeId }])) as Partial<
    Record<Device, { fileKey: string; nodeId: string }>
  >;

export async function isSlugTaken(q: Q, slug: string, exceptDemoId?: string) {
  if (isReservedSlug(slug)) return true;
  const [demo] = await q
    .select({ id: demos.id })
    .from(demos)
    .where(and(eq(demos.slug, slug), exceptDemoId ? ne(demos.id, exceptDemoId) : undefined))
    .limit(1);
  if (demo) return true;
  const [redirect] = await q
    .select({ slug: slugRedirects.slug })
    .from(slugRedirects)
    .where(and(eq(slugRedirects.slug, slug), exceptDemoId ? ne(slugRedirects.demoId, exceptDemoId) : undefined))
    .limit(1);
  return !!redirect;
}

export async function listDemos(q: Q, owner: Designer) {
  const rows = await q.select().from(demos).where(and(eq(demos.ownerId, owner.id), isNull(demos.deletedAt))).orderBy(demos.createdAt);
  return rows.map(toRecord);
}

export async function findOwnedDemo(q: Q, owner: Designer, id: string) {
  if (!UUID.test(id)) return undefined;
  const [row] = await q.select().from(demos).where(owned(owner, id));
  return row && toRecord(row);
}

export async function createDemo(
  db: Db,
  owner: Designer,
  input: DemoInput,
  limit: number,
): Promise<{ ok: true; demo: DemoRecord } | { ok: false; error: "limit" | "slug-taken" }> {
  try {
    return await db.transaction(async (tx) => {
      // One create at a time per Designer, so two tabs cannot both take the last free slot.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${owner.id}))`);
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(demos)
        .where(and(eq(demos.ownerId, owner.id), isNull(demos.deletedAt)));
      if (count >= limit) return { ok: false, error: "limit" } as const;
      if (await isSlugTaken(tx, input.slug)) return { ok: false, error: "slug-taken" } as const;
      const [row] = await tx.insert(demos).values({ ...toColumns(input), ownerId: owner.id }).returning();
      return { ok: true, demo: toRecord(row) } as const;
    });
  } catch (e) {
    // demos.slug is unique: a race with another Designer on the same slug lands here.
    // ponytail: a slug that is only an old redirect has no cross-table constraint; a same-instant race there is not caught.
    if (isUniqueViolation(e)) return { ok: false, error: "slug-taken" };
    throw e;
  }
}

export async function updateDemo(db: Db, owner: Designer, id: string, input: DemoInput): Promise<{ ok: true } | { ok: false; error: "not-found" | "slug-taken" }> {
  if (!UUID.test(id)) return { ok: false, error: "not-found" };
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx.select().from(demos).where(owned(owner, id)).for("update");
      if (!current) return { ok: false, error: "not-found" } as const;
      if (input.slug !== current.slug) {
        if (await isSlugTaken(tx, input.slug, id)) return { ok: false, error: "slug-taken" } as const;
        // The old slug now redirects; a slug this Demo takes back stops being a redirect.
        await tx.delete(slugRedirects).where(and(eq(slugRedirects.slug, input.slug), eq(slugRedirects.demoId, id)));
        await tx.insert(slugRedirects).values({ slug: current.slug, demoId: id });
      }
      await tx.update(demos).set({ ...toColumns(input), updatedAt: new Date() }).where(eq(demos.id, id));
      return { ok: true } as const;
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "slug-taken" };
    throw e;
  }
}

export async function setPublished(db: Db, owner: Designer, id: string, isPublished: boolean): Promise<{ ok: true } | { ok: false; error: "not-found" }> {
  if (!UUID.test(id)) return { ok: false, error: "not-found" };
  const rows = await db.update(demos).set({ isPublished, updatedAt: new Date() }).where(owned(owner, id)).returning({ id: demos.id });
  return rows.length ? { ok: true } : { ok: false, error: "not-found" };
}

export async function deleteDemo(db: Db, owner: Designer, id: string): Promise<{ ok: true } | { ok: false; error: "not-found" }> {
  if (!UUID.test(id)) return { ok: false, error: "not-found" };
  const rows = await db.update(demos).set({ deletedAt: new Date() }).where(owned(owner, id)).returning({ id: demos.id });
  return rows.length ? { ok: true } : { ok: false, error: "not-found" };
}

// An anonymous Designer signs in: their Demos, deleted ones included (slugs stay reserved), go to the account.
// The limit only gates creating, so an account may end up over it.
export async function transferDemos(db: Db, fromId: string, toId: string) {
  await db.update(demos).set({ ownerId: toId, updatedAt: new Date() }).where(eq(demos.ownerId, fromId));
}

// Viewer lookup: current slug first, then old slugs (spec 7.3). Hidden and deleted Demos are invisible.
export async function resolveSlug(q: Q, slug: string): Promise<{ demo: DemoRecord } | { redirectTo: string } | undefined> {
  const [row] = await q.select().from(demos).where(eq(demos.slug, slug));
  if (row) return row.isPublished && !row.deletedAt ? { demo: toRecord(row) } : undefined;
  const [redirect] = await q
    .select({ slug: demos.slug })
    .from(slugRedirects)
    .innerJoin(demos, eq(demos.id, slugRedirects.demoId))
    .where(eq(slugRedirects.slug, slug));
  return redirect ? { redirectTo: redirect.slug } : undefined;
}

// A brand image of a published, not-deleted Demo, for /api/media.
export async function findPublishedMedia(q: Q, id: string, kind: "logo" | "background") {
  if (!UUID.test(id)) return undefined;
  const column = kind === "logo" ? demos.logo : demos.backgroundImage;
  const [row] = await q
    .select({ url: column })
    .from(demos)
    .where(and(eq(demos.id, id), eq(demos.isPublished, true), isNull(demos.deletedAt)));
  return row?.url ?? undefined;
}
