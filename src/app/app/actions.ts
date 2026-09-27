"use server";

import { revalidatePath } from "next/cache";
import { validateDemoForm, type DemoForm, type FormErrors } from "@/lib/demo-rules";
import { getDb } from "@/db";
import { createDemo, deleteDemo, isSlugTaken, setPublished, updateDemo } from "@/db/repo";
import { getDesigner, getOrCreateDesigner, limitFor } from "@/lib/session";

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
  if (id !== undefined && typeof id !== "string") return { ok: false, errors: {}, message: "Không tìm thấy Demo này." };
  const checked = validateDemoForm(normalizeForm(form, !id));
  if (!checked.ok) return checked;
  // Creating is open to everyone: the first save gives this browser an anonymous Designer.
  let designer;
  try {
    designer = id ? await designerOrThrow() : await getOrCreateDesigner();
  } catch (e) {
    console.error(e);
    return { ok: false, errors: {}, message: "Chưa lưu được Demo. Thử lại sau ít phút." };
  }
  const db = getDb();

  if (!id) {
    const limits = limitFor(designer);
    const r = await createDemo(db, designer, checked.value, limits);
    if (!r.ok) {
      return r.error === "limit"
        ? { ok: false, errors: {}, message: `Mỗi trình duyệt tạo được ${limits.limit} Demo. Xóa Demo hiện có để tạo mới.` }
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

// Read-only and open to everyone: whether a slug exists is already public through the Viewer.
export async function isSlugAvailable(slug: string, id?: string) {
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
