import { describe, expect, it } from "vitest";
import { createDemo, deleteDemo, emptyState, isSlugTaken, listDemos, resolveSlug, setPublished, updateDemo, type DemoInput } from "./demo-store";

const ME = { id: "me", email: "me@studio.vn" };
const OTHER = { id: "other", email: "other@studio.vn" };
const NOW = "2026-09-27T00:00:00.000Z";
const input = (slug: string, over: Partial<DemoInput> = {}): DemoInput => ({
  name: slug,
  slug,
  fileKey: "KEY",
  nodeIds: { phone: "1:2" },
  backgroundColor: "#000000",
  responsiveDesktop: false,
  ...over,
});
const opts = { limit: 3, unlimitedEmails: [] as string[], now: NOW };

function withDemos(...slugs: string[]) {
  let state = emptyState();
  const ids: string[] = [];
  for (const s of slugs) {
    const r = createDemo(state, ME, input(s), opts);
    if (!r.ok) throw new Error(r.error);
    state = r.state;
    ids.push(r.demo.id);
  }
  return { state, ids };
}

describe("createDemo", () => {
  it("creates a published Demo owned by the Designer", () => {
    const { state } = withDemos("acme");
    expect(listDemos(state, ME)).toMatchObject([{ slug: "acme", ownerId: "me", isPublished: true, deletedAt: null }]);
  });

  it("rejects a slug someone already has", () => {
    const { state } = withDemos("acme");
    expect(createDemo(state, OTHER, input("acme"), opts)).toEqual({ ok: false, error: "slug-taken" });
  });

  it("enforces the Beta limit, counting hidden Demos but not deleted ones (spec 7.4)", () => {
    const { state, ids } = withDemos("a-1", "a-2", "a-3");
    const hidden = setPublished(state, ME, ids[0], false);
    if (!hidden.ok) throw new Error();
    expect(createDemo(hidden.state, ME, input("a-4"), opts)).toEqual({ ok: false, error: "limit" });
    const deleted = deleteDemo(hidden.state, ME, ids[1], NOW);
    if (!deleted.ok) throw new Error();
    expect(createDemo(deleted.state, ME, input("a-4"), opts).ok).toBe(true);
  });

  it("lets UNLIMITED_EMAILS past the limit, case-insensitively", () => {
    const { state } = withDemos("a-1", "a-2", "a-3");
    expect(createDemo(state, ME, input("a-4"), { ...opts, unlimitedEmails: ["ME@studio.vn"] }).ok).toBe(true);
  });
});

describe("slugs are never reissued (spec 7.3)", () => {
  it("keeps a deleted Demo's slug", () => {
    const { state, ids } = withDemos("acme");
    const r = deleteDemo(state, ME, ids[0], NOW);
    if (!r.ok) throw new Error();
    expect(isSlugTaken(r.state, "acme")).toBe(true);
    expect(listDemos(r.state, ME)).toEqual([]);
  });

  it("redirects an old slug after a rename and keeps it for the owner", () => {
    const { state, ids } = withDemos("acme");
    const r = updateDemo(state, ME, ids[0], input("acme-v2"), NOW);
    if (!r.ok) throw new Error();
    expect(resolveSlug(r.state, "acme")).toEqual({ redirectTo: "acme-v2" });
    expect(resolveSlug(r.state, "acme-v2")).toMatchObject({ demo: { slug: "acme-v2" } });
    expect(createDemo(r.state, OTHER, input("acme"), opts)).toEqual({ ok: false, error: "slug-taken" });
  });

  it("lets a Demo take back its own old slug", () => {
    const { state, ids } = withDemos("acme");
    const renamed = updateDemo(state, ME, ids[0], input("acme-v2"), NOW);
    if (!renamed.ok) throw new Error();
    const back = updateDemo(renamed.state, ME, ids[0], input("acme"), NOW);
    if (!back.ok) throw new Error();
    expect(resolveSlug(back.state, "acme")).toMatchObject({ demo: { slug: "acme" } });
    expect(resolveSlug(back.state, "acme-v2")).toEqual({ redirectTo: "acme" });
  });
});

describe("resolveSlug (Viewer)", () => {
  it("hides unpublished and deleted Demos", () => {
    const { state, ids } = withDemos("a-1", "a-2");
    const hidden = setPublished(state, ME, ids[0], false);
    if (!hidden.ok) throw new Error();
    const deleted = deleteDemo(hidden.state, ME, ids[1], NOW);
    if (!deleted.ok) throw new Error();
    expect(resolveSlug(deleted.state, "a-1")).toBeUndefined();
    expect(resolveSlug(deleted.state, "a-2")).toBeUndefined();
    expect(resolveSlug(deleted.state, "nope")).toBeUndefined();
  });
});

describe("ownership (spec 7.5)", () => {
  it("does not let another Designer edit, hide or delete a Demo", () => {
    const { state, ids } = withDemos("acme");
    expect(updateDemo(state, OTHER, ids[0], input("x-x-x"), NOW)).toEqual({ ok: false, error: "not-found" });
    expect(setPublished(state, OTHER, ids[0], false)).toEqual({ ok: false, error: "not-found" });
    expect(deleteDemo(state, OTHER, ids[0], NOW)).toEqual({ ok: false, error: "not-found" });
  });
});
