"use server";

import { revalidatePath } from "next/cache";
import { validateDemoForm, type DemoForm, type FormErrors } from "@/lib/demo-rules";
import { DEVICES, type Device, type Flow } from "@/lib/devices";
import { flowsFromFile, type FigmaFile } from "@/lib/figma-flows";
import { getDb } from "@/db";
import { createDemo, deleteDemo, isSlugTaken, setPublished, updateDemo } from "@/db/repo";
import { DEMO_LIMIT, getDesigner } from "@/lib/session";

// Every action checks the Designer and re-validates input: actions are reachable by direct POST (spec 7.5).

async function designerOrThrow() {
  const designer = await getDesigner();
  if (!designer) throw new Error("Unauthorized");
  return designer;
}

export type SaveResult = { ok: true; id: string; slug: string } | { ok: false; errors: FormErrors; message?: string };

// Actions receive whatever the request carries, not what the TypeScript types promise.
const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const image = (v: unknown) => (typeof v === "string" && v ? v : null);
function normalizeForm(raw: unknown, isNew: boolean): DemoForm {
  const f = obj(raw);
  const devices = obj(f.devices);
  return {
    name: str(f.name),
    slug: str(f.slug),
    devices: Object.fromEntries(
      DEVICES.map(({ id }) => {
        const d = obj(devices[id]);
        return [id, { enabled: d.enabled === true, model: str(d.model), link: str(d.link) }];
      }),
    ) as DemoForm["devices"],
    flows: (Array.isArray(f.flows) ? f.flows : []).map((x) => {
      const flow = obj(x);
      return { device: str(flow.device) as Device, name: str(flow.name), nodeId: str(flow.nodeId), source: str(flow.source) as Flow["source"] };
    }),
    brandColor: str(f.brandColor),
    backgroundColor: str(f.backgroundColor),
    backgroundImage: image(f.backgroundImage),
    logo: image(f.logo),
    confirmedPublic: f.confirmedPublic === true,
    isNew,
  };
}

export async function saveDemo(form: DemoForm, id?: string): Promise<SaveResult> {
  if (id !== undefined && typeof id !== "string") return { ok: false, errors: {}, message: "Không tìm thấy Demo này." };
  const checked = validateDemoForm(normalizeForm(form, !id));
  if (!checked.ok) return checked;
  let designer;
  try {
    designer = await getDesigner();
  } catch (e) {
    console.error(e);
    return { ok: false, errors: {}, message: "Chưa lưu được Demo. Thử lại sau ít phút." };
  }
  // Creating needs an account; an anonymous Designer from before sign-in may still edit their Demo.
  if (!designer || (!id && designer.isAnonymous)) return { ok: false, errors: {}, message: "Đăng nhập để lưu Demo." };
  const db = getDb();

  if (!id) {
    const r = await createDemo(db, designer, checked.value, DEMO_LIMIT);
    if (!r.ok) {
      return r.error === "limit"
        ? { ok: false, errors: {}, message: `Mỗi tài khoản tạo được ${DEMO_LIMIT} Demo. Xóa một Demo để tạo mới.` }
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

export type FlowsResult = { ok: true; flows: Flow[]; missing: Device[] } | { ok: false; message: string };

// Reads the file's flows once with the Designer's personal access token. The token is used for this
// one request and never stored or logged (spec 12). Open to everyone: it only reads with the caller's own token.
export async function fetchFigmaFlows(token: string, fileKey: string, nodeIds: Partial<Record<Device, string>>): Promise<FlowsResult> {
  if (typeof token !== "string" || !token.trim() || typeof fileKey !== "string" || !/^[A-Za-z0-9]+$/.test(fileKey)) {
    return { ok: false, message: "Thiếu token hoặc link Figma." };
  }
  const links = Object.fromEntries(
    DEVICES.map(({ id }) => [id, obj(nodeIds)[id]]).filter(([, v]) => typeof v === "string" && /^\d+:\d+$/.test(v)),
  ) as Partial<Record<Device, string>>;
  let res: Response;
  try {
    res = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=3`, {
      headers: { "X-Figma-Token": token.trim() },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { ok: false, message: "Không kết nối được Figma. Thử lại sau." };
  }
  if (res.status === 403 || res.status === 401) return { ok: false, message: "Token không đúng, hoặc không có quyền đọc file này." };
  if (res.status === 404) return { ok: false, message: "Không tìm thấy file Figma này." };
  if (res.status === 429) return { ok: false, message: "Figma đang giới hạn lượt gọi. Thử lại sau ít phút." };
  if (!res.ok) return { ok: false, message: "Figma báo lỗi. Thử lại sau." };
  const { flows, missing } = flowsFromFile((await res.json()) as FigmaFile, links);
  return { ok: true, flows, missing };
}
