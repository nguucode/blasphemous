import { DEVICE_MODELS, type ModelId } from "./device-models";

// The three Devices a Demo can show, the device each one is drawn as, and its Flows.

export type Device = "desktop" | "tablet" | "phone";

// Tab order, left to right (also Figma's frame-preset order, reversed).
export const DEVICES: { id: Device; label: string }[] = [
  { id: "desktop", label: "Desktop" },
  { id: "tablet", label: "Tablet" },
  { id: "phone", label: "Mobile" },
];

export type Size = { w: number; h: number };
export const DESKTOP_SIZES: Record<string, Size> = {
  "1280": { w: 1280, h: 800 },
  "1440": { w: 1440, h: 900 },
  "1920": { w: 1920, h: 1080 },
};

// "Select devices": what each Device is drawn as. Desktop is a flat monitor, the others are 3D models.
export const DEVICE_OPTIONS: Record<Device, { value: string; label: string }[]> = {
  desktop: Object.entries(DESKTOP_SIZES).map(([value, s]) => ({ value, label: `Màn hình ${s.w} × ${s.h}` })),
  tablet: (["ipad-pro-12-9", "ipad-air-11"] as ModelId[]).map((value) => ({ value, label: DEVICE_MODELS[value].label })),
  phone: (["iphone-17-pro-max"] as ModelId[]).map((value) => ({ value, label: DEVICE_MODELS[value].label })),
};
export const DEFAULT_MODEL: Record<Device, string> = { desktop: "1440", tablet: "ipad-pro-12-9", phone: "iphone-17-pro-max" };

export const isDeviceModel = (d: Device, model: unknown) => DEVICE_OPTIONS[d].some((o) => o.value === model);

export type DeviceSetting = { enabled: boolean; model: string };
export type DeviceSettings = Record<Device, DeviceSetting>;
export const DEFAULT_DEVICES: DeviceSettings = {
  desktop: { enabled: false, model: DEFAULT_MODEL.desktop },
  tablet: { enabled: false, model: DEFAULT_MODEL.tablet },
  phone: { enabled: false, model: DEFAULT_MODEL.phone },
};

// A starting point in the prototype. "figma" ones come from the file's flows and are replaced on every
// fetch; "manual" ones were added by link and stay.
export type Flow = { device: Device; name: string; nodeId: string; source: "figma" | "manual" };

// The tab a Viewer lands on: the one that fits their screen, or the enabled one closest to it.
const PREFERENCE: Record<Device, Device[]> = {
  phone: ["phone", "tablet", "desktop"],
  tablet: ["tablet", "desktop", "phone"],
  desktop: ["desktop", "tablet", "phone"],
};
export function deviceForWidth(width: number, enabled: Device[]): Device | undefined {
  const fits: Device = width <= 640 ? "phone" : width < 1024 ? "tablet" : "desktop";
  return PREFERENCE[fits].find((d) => enabled.includes(d));
}
