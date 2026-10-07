import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDemo, deleteDemo, findPublishedMedia, isSlugTaken, listDemos, resolveSlug, setPublished, updateDemo, type DemoInput, type Designer } from "./repo";
import * as schema from "./schema";

// Real Postgres (PGlite, in process) with the real migration: spec 10's integration tests.
const ME: Designer = { id: "00000000-0000-4000-8000-000000000001", email: "me@studio.vn" };
const OTHER: Designer = { id: "00000000-0000-4000-8000-000000000002", email: "other@studio.vn" };
const input = (slug: string, over: Partial<DemoInput> = {}): DemoInput => ({
  name: slug,
  slug,
  fileKey: "KEY",
  nodeIds: { phone: "1:2" },
  devices: {
    desktop: { enabled: false, model: "1440" },
    tablet: { enabled: false, model: "ipad-pro-12-9" },
    phone: { enabled: true, model: "iphone-17-pro-max" },
  },
  flows: [],
  brandColor: "#0071e3",
  backgroundColor: "#000000",
  backgroundImage: null,
  logo: null,
  ...over,
});
const LIMIT = 3;

const client = new PGlite();
const db = drizzle(client, { schema });

beforeAll(async () => {
  // Supabase owns auth.users; a minimal stand-in is enough for the foreign key.
  await client.exec(`create schema auth; create table auth.users (id uuid primary key);`);
  await migrate(db, { migrationsFolder: "drizzle" });
  await client.query(`insert into auth.users (id) values ($1), ($2)`, [ME.id, OTHER.id]);
}, 30_000);

beforeEach(async () => {
  await db.execute(sql`truncate slug_redirects, demos`);
});

async function created(owner: Designer, slug: string, over: Partial<DemoInput> = {}) {
  const r = await createDemo(db, owner, input(slug, over), LIMIT);
  if (!r.ok) throw new Error(r.error);
  return r.demo;
}

describe("createDemo", () => {
  it("creates a published Demo owned by the Designer, keeping each Device's node", async () => {
    const flows = [{ device: "phone" as const, name: "Login", nodeId: "1:3", source: "figma" as const }];
    await created(ME, "acme", { nodeIds: { phone: "1:2", desktop: "5:6" }, flows, logo: "data:image/png;base64,QUJD" });
    expect(await listDemos(db, ME)).toMatchObject([
      { slug: "acme", ownerId: ME.id, isPublished: true, deletedAt: null, nodeIds: { phone: "1:2", desktop: "5:6" }, flows, logo: "data:image/png;base64,QUJD" },
    ]);
  });

  it("rejects a slug someone already has", async () => {
    await created(ME, "acme");
    expect(await createDemo(db, OTHER, input("acme"), LIMIT)).toEqual({ ok: false, error: "slug-taken" });
  });

  it("enforces the Beta limit, counting hidden Demos but not deleted ones (spec 7.4)", async () => {
    const a = await created(ME, "a-1");
    const b = await created(ME, "a-2");
    await created(ME, "a-3");
    await setPublished(db, ME, a.id, false);
    expect(await createDemo(db, ME, input("a-4"), LIMIT)).toEqual({ ok: false, error: "limit" });
    await deleteDemo(db, ME, b.id);
    expect((await createDemo(db, ME, input("a-4"), LIMIT)).ok).toBe(true);
  });

  it("does not let concurrent creates slip past the limit", async () => {
    await created(ME, "a-1");
    await created(ME, "a-2");
    const results = await Promise.all(["b-1", "b-2", "b-3"].map((s) => createDemo(db, ME, input(s), LIMIT)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });
});

describe("slugs are never reissued (spec 7.3)", () => {
  it("keeps a deleted Demo's slug", async () => {
    const d = await created(ME, "acme");
    await deleteDemo(db, ME, d.id);
    expect(await isSlugTaken(db, "acme")).toBe(true);
    expect(await listDemos(db, ME)).toEqual([]);
  });

  it("treats reserved slugs as taken", async () => {
    expect(await isSlugTaken(db, "app")).toBe(true);
  });

  it("redirects an old slug after a rename and keeps it for the owner", async () => {
    const d = await created(ME, "acme");
    expect((await updateDemo(db, ME, d.id, input("acme-v2"))).ok).toBe(true);
    expect(await resolveSlug(db, "acme")).toEqual({ redirectTo: "acme-v2" });
    expect(await resolveSlug(db, "acme-v2")).toMatchObject({ demo: { slug: "acme-v2" } });
    expect(await createDemo(db, OTHER, input("acme"), LIMIT)).toEqual({ ok: false, error: "slug-taken" });
  });

  it("lets a Demo take back its own old slug", async () => {
    const d = await created(ME, "acme");
    await updateDemo(db, ME, d.id, input("acme-v2"));
    expect((await updateDemo(db, ME, d.id, input("acme"))).ok).toBe(true);
    expect(await resolveSlug(db, "acme")).toMatchObject({ demo: { slug: "acme" } });
    expect(await resolveSlug(db, "acme-v2")).toEqual({ redirectTo: "acme" });
  });

  it("does not let a Demo take another Demo's old slug", async () => {
    const d = await created(ME, "acme");
    const e = await created(ME, "beta");
    await updateDemo(db, ME, d.id, input("acme-v2"));
    expect(await updateDemo(db, ME, e.id, input("acme"))).toEqual({ ok: false, error: "slug-taken" });
  });
});

describe("resolveSlug (Viewer)", () => {
  it("hides unpublished and deleted Demos", async () => {
    const a = await created(ME, "a-1");
    const b = await created(ME, "a-2");
    await setPublished(db, ME, a.id, false);
    await deleteDemo(db, ME, b.id);
    expect(await resolveSlug(db, "a-1")).toBeUndefined();
    expect(await resolveSlug(db, "a-2")).toBeUndefined();
    expect(await resolveSlug(db, "nope")).toBeUndefined();
  });
});

describe("findPublishedMedia", () => {
  it("serves a published Demo's brand images, nothing for a hidden one", async () => {
    const d = await created(ME, "acme", { logo: "data:image/png;base64,QUJD" });
    expect(await findPublishedMedia(db, d.id, "logo")).toBe("data:image/png;base64,QUJD");
    expect(await findPublishedMedia(db, d.id, "background")).toBeUndefined();
    await setPublished(db, ME, d.id, false);
    expect(await findPublishedMedia(db, d.id, "logo")).toBeUndefined();
    expect(await findPublishedMedia(db, "nope", "logo")).toBeUndefined();
  });
});

describe("ownership (spec 7.5)", () => {
  it("does not let another Designer edit, hide or delete a Demo", async () => {
    const d = await created(ME, "acme");
    expect(await updateDemo(db, OTHER, d.id, input("x-x-x"))).toEqual({ ok: false, error: "not-found" });
    expect(await setPublished(db, OTHER, d.id, false)).toEqual({ ok: false, error: "not-found" });
    expect(await deleteDemo(db, OTHER, d.id)).toEqual({ ok: false, error: "not-found" });
    expect(await listDemos(db, OTHER)).toEqual([]);
  });

  it("treats a malformed id as not found instead of throwing", async () => {
    expect(await setPublished(db, ME, "not-a-uuid", false)).toEqual({ ok: false, error: "not-found" });
  });
});

describe("schema", () => {
  it("refuses a Demo with no Device at all", async () => {
    await expect(createDemo(db, ME, input("acme", { nodeIds: {} }), LIMIT)).rejects.toThrow();
  });
});
