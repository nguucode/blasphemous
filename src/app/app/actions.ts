"use server";

import { revalidatePath } from "next/cache";
import { validateDemoForm, type DemoForm, type FormErrors } from "@/lib/demo-rules";
import { createDemo, deleteDemo, isSlugTaken, setPublished, updateDemo } from "@/lib/demo-store";
import { readState, writeState } from "@/lib/dev-db";
import { DEMO_LIMIT, UNLIMITED_EMAILS, getDesigner } from "@/lib/session";

// Every action checks the Designer and re-validates input: actions are reachable by direct POST (spec 7.5).

async function designerOrThrow() {
  const designer = await getDesigner();
  if (!designer) throw new Error("Unauthorized");
  return designer;
}

export type SaveResult = { ok: true; id: string; slug: string } | { ok: false; errors: FormErrors; message?: string };

// Actions receive whatever the request carries, not what the TypeScript types promise.
const str = (v: unknown) => (typeof v === "string" ? v : "");
function normalizeForm(raw: unknown, isNew: boolean): DemoForm {
  const f = (raw ?? {}) as Record<string, unknown>;
  const links = (f.links ?? {}) as Record<string, unknown>;
  return {
    name: str(f.name),
    slug: str(f.slug),
    links: { phone: str(links.phone), tablet: str(links.tablet), desktop: str(links.desktop) },
    backgroundColor: str(f.backgroundColor),
    responsiveDesktop: f.responsiveDesktop === true,
    confirmedPublic: f.confirmedPublic === true,
    isNew,
  };
}

export async function saveDemo(form: DemoForm, id?: string): Promise<SaveResult> {
  const designer = await designerOrThrow();
  if (id !== undefined && typeof id !== "string") return { ok: false, errors: {}, message: "Không tìm thấy Demo này." };
  const checked = validateDemoForm(normalizeForm(form, !id));
  if (!checked.ok) return checked;
  const state = readState();
  const now = new Date().toISOString();

  if (!id) {
    const r = createDemo(state, designer, checked.value, { limit: DEMO_LIMIT, unlimitedEmails: UNLIMITED_EMAILS, now });
    if (!r.ok) {
      return r.error === "limit"
        ? { ok: false, errors: {}, message: `Beta giới hạn ${DEMO_LIMIT} Demo. Xóa một Demo để tạo mới.` }
        : { ok: false, errors: { slug: "Đường dẫn này đã có người dùng." } };
    }
    writeState(r.state);
    revalidatePath("/app");
    return { ok: true, id: r.demo.id, slug: r.demo.slug };
  }

  const r = updateDemo(state, designer, id, checked.value, now);
  if (!r.ok) return r.error === "slug-taken" ? { ok: false, errors: { slug: "Đường dẫn này đã có người dùng." } } : { ok: false, errors: {}, message: "Không tìm thấy Demo này." };
  writeState(r.state);
  revalidatePath("/app");
  return { ok: true, id, slug: checked.value.slug };
}

export async function isSlugAvailable(slug: string, id?: string) {
  await designerOrThrow();
  return typeof slug === "string" && !isSlugTaken(readState(), slug, typeof id === "string" ? id : undefined);
}

export async function publishDemo(id: string, isPublished: boolean) {
  const designer = await designerOrThrow();
  const r = setPublished(readState(), designer, String(id), isPublished === true);
  if (!r.ok) return false;
  writeState(r.state);
  revalidatePath("/app");
  return true;
}

export async function removeDemo(id: string) {
  const designer = await designerOrThrow();
  const r = deleteDemo(readState(), designer, String(id), new Date().toISOString());
  if (!r.ok) return false;
  writeState(r.state);
  revalidatePath("/app");
  return true;
}
