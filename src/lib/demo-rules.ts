import type { Device } from "@/components/device-view";
import { parseFigmaLink, type FigmaLinkError } from "./figma-link";
import { isReservedSlug, isSlugFormat } from "./slug";

// Form rules for creating and editing a Demo (spec 7.2, 7.3, 8.4). Shared by the browser, for
// instant feedback, and the server actions, which never trust the browser.

export const LINK_ERRORS: Record<FigmaLinkError | "other-file", string> = {
  "not-figma": "Đây không phải link prototype Figma.",
  "design-link": "Đây là link thiết kế. Mở Present trong Figma rồi bấm Copy link.",
  "no-node": "Link thiếu điểm bắt đầu. Trong Present, bấm Copy link lại.",
  "other-file": "Các link phải thuộc cùng một file Figma.",
};

export const FORM_DEVICES: Device[] = ["phone", "tablet", "desktop"];

export type DemoForm = {
  name: string;
  slug: string;
  links: Record<Device, string>;
  backgroundColor: string;
  responsiveDesktop: boolean;
  confirmedPublic: boolean;
  isNew: boolean;
};

export type DemoValue = {
  name: string;
  slug: string;
  fileKey: string;
  nodeIds: Partial<Record<Device, string>>;
  backgroundColor: string;
  responsiveDesktop: boolean;
};

export type FormField = "name" | "slug" | "links" | "backgroundColor" | "confirmedPublic" | Device;
export type FormErrors = Partial<Record<FormField, string>>;

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

  const nodeIds: Partial<Record<Device, string>> = {};
  const fileKeys = new Map<Device, string>();
  for (const d of FORM_DEVICES) {
    if (!form.links[d].trim()) continue;
    const parsed = parseFigmaLink(form.links[d]);
    if (!parsed.ok) errors[d] = LINK_ERRORS[parsed.error];
    else {
      nodeIds[d] = parsed.nodeId;
      fileKeys.set(d, parsed.fileKey);
    }
  }
  if (new Set(fileKeys.values()).size > 1) for (const d of fileKeys.keys()) errors[d] = LINK_ERRORS["other-file"];
  if (!FORM_DEVICES.some((d) => form.links[d].trim())) errors.links = "Dán ít nhất một link prototype.";

  if (!/^#[0-9a-f]{6}$/i.test(form.backgroundColor)) errors.backgroundColor = "Màu có dạng #RRGGBB, ví dụ #1e1b4b.";
  if (form.isNew && !form.confirmedPublic) errors.confirmedPublic = "Xác nhận file đã bật “Anyone with the link can view”.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      slug: form.slug,
      fileKey: [...fileKeys.values()][0],
      nodeIds,
      backgroundColor: form.backgroundColor.toLowerCase(),
      responsiveDesktop: form.responsiveDesktop && !!nodeIds.desktop,
    },
  };
}
