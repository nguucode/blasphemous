"use server";

import { revalidatePath } from "next/cache";
import { validateDemoForm, type DemoForm, type FormErrors } from "@/lib/demo-rules";
import { getDb } from "@/db";
import { createDemo, deleteDemo, isSlugTaken, setPublished, updateDemo } from "@/db/repo";
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
  const db = getDb();

  if (!id) {
    const r = await createDemo(db, designer, checked.value, { limit: DEMO_LIMIT, unlimitedEmails: UNLIMITED_EMAILS });
    if (!r.ok) {
      return r.error === "limit"
        ? { ok: false, errors: {}, message: `Beta giới hạn ${DEMO_LIMIT} Demo. Xóa một Demo để tạo mới.` }
        : { ok: false, errors: { slug: "Đường dẫn này đã có người dùng." } };
    }
    revalidatePath("/app");
    return { ok: true, id: r.demo.id, slug: r.demo.slug };
  }

  const r = await updateDemo(db, designer, id, checked.value);
  if (!r.ok) return r.error === "slug-taken" ? { ok: false, errors: { slug: "Đường dẫn này đã có người dùng." } } : { ok: false, errors: {}, message: "Không tìm thấy Demo này." };
  revalidatePath("/app");
  return { ok: true, id, slug: checked.value.slug };
}

export async function isSlugAvailable(slug: string, id?: string) {
  await designerOrThrow();
  return typeof slug === "string" && !(await isSlugTaken(getDb(), slug, typeof id === "string" ? id : undefined));
}

export async function publishDemo(id: string, isPublished: boolean) {
  const designer = await designerOrThrow();
  const r = await setPublished(getDb(), designer, String(id), isPublished === true);
  if (!r.ok) return false;
  revalidatePath("/app");
  return true;
}

export async function removeDemo(id: string) {
  const designer = await designerOrThrow();
  const r = await deleteDemo(getDb(), designer, String(id));
  if (!r.ok) return false;
  revalidatePath("/app");
  return true;
}
