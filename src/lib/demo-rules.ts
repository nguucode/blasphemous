import { DEFAULT_MODEL, DEVICES, isDeviceModel, type Device, type DeviceSettings, type Flow } from "./devices";
import { parseFigmaLink, type FigmaLinkError } from "./figma-link";
import { isReservedSlug, isSlugFormat } from "./slug";

// Form rules for creating and editing a Demo (spec 7.2, 7.3, 8.4, 12). Shared by the browser, for
// instant feedback, and the server actions, which never trust the browser.

export const LINK_ERRORS: Record<FigmaLinkError | "other-file", string> = {
  "not-figma": "Đây không phải link prototype Figma.",
  "design-link": "Đây là link thiết kế. Mở Present trong Figma rồi bấm Copy link.",
  "no-node": "Link thiếu điểm bắt đầu. Trong Present, bấm Copy link lại.",
  "other-file": "Các link phải thuộc cùng một file Figma.",
};

export const DEFAULT_BACKGROUND = "#1e1b4b"; // spec 7.1
export const DEFAULT_BRAND = "#0071e3";
export const MAX_FLOWS = 200;
// Brand images are stored in the row as data URLs (spec 12), so they stay small.
export const IMAGE_RULES = {
  logo: { types: ["image/png", "image/svg+xml"], maxBytes: 200 * 1024, label: "PNG hoặc SVG, tối đa 200 KB" },
  backgroundImage: { types: ["image/png", "image/jpeg", "image/webp"], maxBytes: 1.5 * 1024 * 1024, label: "PNG, JPEG hoặc WebP, tối đa 1,5 MB" },
} as const;
export type ImageKind = keyof typeof IMAGE_RULES;

export type DeviceForm = { enabled: boolean; model: string; link: string };

export type DemoForm = {
  name: string;
  slug: string;
  devices: Record<Device, DeviceForm>;
  flows: Flow[];
  brandColor: string;
  backgroundColor: string;
  backgroundImage: string | null;
  logo: string | null;
  confirmedPublic: boolean;
  isNew: boolean;
};

export type DemoValue = {
  name: string;
  slug: string;
  fileKey: string;
  nodeIds: Partial<Record<Device, string>>;
  devices: DeviceSettings;
  flows: Flow[];
  brandColor: string;
  backgroundColor: string;
  backgroundImage: string | null;
  logo: string | null;
};

export type FormField = "name" | "slug" | "links" | "flows" | "brandColor" | "backgroundColor" | "backgroundImage" | "logo" | "confirmedPublic" | Device;
export type FormErrors = Partial<Record<FormField, string>>;

const HEX = /^#[0-9a-f]{6}$/i;
const NODE_ID = /^\d+:\d+$/;

// Size in bytes of a base64 data URL of an allowed type, or undefined if it is not one.
export function dataUrlBytes(url: string, types: readonly string[]) {
  const m = /^data:([a-z+/]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(url);
  if (!m || !types.includes(m[1])) return undefined;
  return Math.floor((m[2].length * 3) / 4) - (m[2].endsWith("==") ? 2 : m[2].endsWith("=") ? 1 : 0);
}

export function imageError(kind: ImageKind, url: string | null) {
  if (url === null) return undefined;
  const rule = IMAGE_RULES[kind];
  const bytes = dataUrlBytes(url, rule.types);
  return bytes === undefined || bytes > rule.maxBytes ? `Ảnh phải là ${rule.label}.` : undefined;
}

export function suggestSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
}

export function uniqueSlug(base: string, isTaken: (slug: string) => boolean) {
  if (!isTaken(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = base.slice(0, 48 - suffix.length).replace(/-+$/, "") + suffix;
    if (!isTaken(candidate)) return candidate;
  }
}

export function validateDemoForm(form: DemoForm): { ok: true; value: DemoValue } | { ok: false; errors: FormErrors } {
  const errors: FormErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = "Nhập tên Demo.";
  else if (name.length > 80) errors.name = "Tên dài tối đa 80 ký tự.";

  if (!isSlugFormat(form.slug)) errors.slug = "Đường dẫn dài 3–48 ký tự, chỉ gồm a-z, 0-9 và dấu -, không bắt đầu hay kết thúc bằng -.";
  else if (isReservedSlug(form.slug)) errors.slug = "Đường dẫn này dành riêng cho hệ thống. Chọn tên khác.";

  // A turned-off Device keeps its link, so it is back as it was when turned on again.
  const nodeIds: Partial<Record<Device, string>> = {};
  const fileKeys = new Map<Device, string>();
  for (const { id: d } of DEVICES) {
    const link = form.devices[d].link.trim();
    if (!link) {
      if (form.devices[d].enabled) errors[d] = "Dán link prototype cho thiết bị này.";
      continue;
    }
    const parsed = parseFigmaLink(link);
    if (!parsed.ok) errors[d] = LINK_ERRORS[parsed.error];
    else {
      nodeIds[d] = parsed.nodeId;
      fileKeys.set(d, parsed.fileKey);
    }
  }
  if (new Set(fileKeys.values()).size > 1) for (const d of fileKeys.keys()) errors[d] = LINK_ERRORS["other-file"];
  if (!DEVICES.some(({ id }) => form.devices[id].enabled)) errors.links = "Bật ít nhất một thiết bị.";

  const flows = form.flows.map((f) => ({ ...f, name: f.name.trim() }));
  if (
    flows.length > MAX_FLOWS ||
    flows.some((f) => !f.name || f.name.length > 80 || !NODE_ID.test(f.nodeId) || !DEVICES.some(({ id }) => id === f.device) || (f.source !== "figma" && f.source !== "manual"))
  ) {
    errors.flows = `Mỗi flow cần tên dài 1–80 ký tự, tối đa ${MAX_FLOWS} flow.`;
  }

  if (!HEX.test(form.brandColor)) errors.brandColor = "Màu có dạng #RRGGBB, ví dụ #0071e3.";
  if (!HEX.test(form.backgroundColor)) errors.backgroundColor = "Màu có dạng #RRGGBB, ví dụ #1e1b4b.";
  const logoError = imageError("logo", form.logo);
  if (logoError) errors.logo = logoError;
  const backgroundError = imageError("backgroundImage", form.backgroundImage);
  if (backgroundError) errors.backgroundImage = backgroundError;
  if (form.isNew && !form.confirmedPublic) errors.confirmedPublic = "Xác nhận file đã bật “Anyone with the link can view”.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      slug: form.slug,
      fileKey: [...fileKeys.values()][0],
      nodeIds,
      devices: Object.fromEntries(
        DEVICES.map(({ id: d }) => [d, { enabled: form.devices[d].enabled, model: isDeviceModel(d, form.devices[d].model) ? form.devices[d].model : DEFAULT_MODEL[d] }]),
      ) as DeviceSettings,
      flows: flows.map(({ device, name, nodeId, source }) => ({ device, name, nodeId, source })),
      brandColor: form.brandColor.toLowerCase(),
      backgroundColor: form.backgroundColor.toLowerCase(),
      backgroundImage: form.backgroundImage,
      logo: form.logo,
    },
  };
}
