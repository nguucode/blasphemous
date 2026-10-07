"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { preload } from "react-dom";
import { DEVICE_MODELS, LICENSE, type ModelId } from "@/lib/device-models";
import { DEFAULT_MODEL, DESKTOP_SIZES, DEVICES, type Device, type Size } from "@/lib/devices";
import { buildEmbedUrl, FIGMA_CLIENT_ID } from "@/lib/figma-link";

// Shared by every page that presents a Demo: the device switcher and the stage that shows a 3D
// phone or tablet, or a flat desktop monitor.

const Device3D = dynamic(() => import("@/components/device-3d").then((m) => m.Device3D), { ssr: false });

export { DEVICES, type Device };
export type DeviceLink = { fileKey: string; nodeId: string };

const modelOf = (d: Device, models: Partial<Record<Device, string>>) => (models[d] ?? DEFAULT_MODEL[d]) as ModelId;

// CC BY 4.0 requires this credit on every page that shows a model. Callers choose the wrapper.
export function ModelCredit({ model = "iphone-17-pro-max" }: { model?: ModelId }) {
  const c = DEVICE_MODELS[model].credit;
  const link = "underline hover:text-ink";
  return (
    <>
      Mô hình “<a href={c.url} target="_blank" rel="noopener" className={link}>{c.title}</a>” của{" "}
      {c.authorUrl ? <a href={c.authorUrl} target="_blank" rel="noopener" className={link}>{c.author}</a> : c.author},{" "}
      <a href={LICENSE.url} target="_blank" rel="noopener" className={link}>{LICENSE.name}</a>
    </>
  );
}

// Credit for whatever the Viewer is looking at; a flat desktop has none.
export function StageCredit({ device, models = {} }: { device: Device; models?: Partial<Record<Device, string>> }) {
  return device === "desktop" ? null : <ModelCredit model={modelOf(device, models)} />;
}

export function DeviceSwitcher({
  devices, value, onChange, brandColor,
}: { devices: Device[]; value: Device; onChange: (d: Device) => void; brandColor?: string }) {
  return (
    <div
      role="group"
      aria-label="Chọn thiết bị"
      className="inline-flex gap-1 rounded-[18px] bg-glass-strong p-1 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-xl"
    >
      {DEVICES.filter((d) => devices.includes(d.id)).map((d) => (
        <button
          key={d.id}
          type="button"
          aria-pressed={value === d.id}
          onClick={() => onChange(d.id)}
          style={value === d.id && brandColor ? { background: brandColor } : undefined}
          className="min-h-11 min-w-11 cursor-pointer rounded-[14px] px-5 text-sm tracking-[-0.016em] text-ink-secondary transition-colors duration-300 hover:text-ink focus-visible:outline-2 focus-visible:outline-link aria-pressed:bg-white/12 aria-pressed:font-semibold aria-pressed:text-ink"
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

export function Screen({ link, emptyText }: { link?: DeviceLink; emptyText: string }) {
  const src = link && buildEmbedUrl({ ...link, clientId: FIGMA_CLIENT_ID });
  const [loadedSrc, setLoadedSrc] = useState<string>();
  if (!src) {
    return (
      <div className="grid h-full place-items-center bg-stage-raised p-10 text-center font-display text-[17px] leading-snug tracking-[-0.022em] text-ink-secondary">
        {emptyText}
      </div>
    );
  }
  return (
    <div className="relative h-full w-full">
      <iframe key={src} src={src} title="Prototype" allowFullScreen className="h-full w-full border-0" onLoad={() => setLoadedSrc(src)} />
      {loadedSrc !== src && (
        <div className="absolute inset-0 grid place-items-center bg-stage-raised text-sm text-ink-secondary">Đang tải prototype…</div>
      )}
    </div>
  );
}

// Flat monitor with a stand, scaled down to fit. Proportions follow a 24″ display.
const BEZEL = 0.012; // of the screen width
const NECK = { w: 0.16, h: 0.16 }; // of the screen width / height
const FOOT = { w: 0.3, h: 0.014 };

function Monitor({ size, children }: { size: Size; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const bezel = Math.round(size.w * BEZEL);
  const total = { w: size.w + 2 * bezel, h: size.h + 2 * bezel + size.h * NECK.h + size.w * FOOT.h };
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setScale(Math.min(el.clientWidth / total.w, el.clientHeight / total.h, 1)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [total.w, total.h]);
  const metal: CSSProperties = { background: "linear-gradient(90deg, #8e8e93, #d1d1d6 45%, #aeaeb2 55%, #8e8e93)" };
  return (
    <div ref={ref} className="relative h-full w-full">
      <div
        className="absolute top-1/2 left-1/2 flex origin-top-left flex-col items-center"
        style={{ width: total.w, height: total.h, transform: `scale(${scale}) translate(-50%, -50%)` }}
      >
        <div
          className="overflow-hidden bg-black shadow-[0_40px_120px_-20px_rgb(0_0_0/0.9)] ring-1 ring-white/15"
          style={{ padding: bezel, borderRadius: bezel * 1.5, width: total.w }}
        >
          <div className="overflow-hidden bg-stage-raised" style={{ width: size.w, height: size.h }}>
            {children}
          </div>
        </div>
        <div style={{ ...metal, width: size.w * NECK.w, height: size.h * NECK.h }} />
        <div className="rounded-t-[6px]" style={{ ...metal, width: size.w * FOOT.w, height: size.w * FOOT.h }} />
      </div>
    </div>
  );
}

// Each device keeps its own iframe once opened; switching only hides, never remounts (spec 8.6).
// data-device lets the keyboard shortcuts find the visible prototype.
export function DeviceStage({
  device, opened, links, resetSignal, emptyText, models = {},
}: {
  device: Device;
  opened: Set<Device>;
  links: Partial<Record<Device, DeviceLink>>;
  resetSignal: number;
  emptyText: string;
  models?: Partial<Record<Device, string>>;
}) {
  return (
    <>
      {DEVICES.map(({ id: d }) => {
        if (!opened.has(d)) return null;
        const model = modelOf(d, models);
        const screen = <Screen link={links[d]} emptyText={emptyText} />;
        if (d === "desktop") {
          return (
            <div key={d} data-device={d} hidden={device !== d} className="h-full px-6">
              <Monitor size={DESKTOP_SIZES[model] ?? DESKTOP_SIZES[DEFAULT_MODEL.desktop]}>{screen}</Monitor>
            </div>
          );
        }
        return (
          <div key={d} data-device={d} hidden={device !== d} className="h-full">
            <Preload url={DEVICE_MODELS[model].url} />
            {/* Keyed by model: a different device is a different scene. */}
            <Device3D key={model} model={model} resetSignal={resetSignal}>
              {screen}
            </Device3D>
          </div>
        );
      })}
    </>
  );
}

// Put the model in the server HTML as a preload, so it downloads while the page's JavaScript loads.
// crossOrigin matches GLTFLoader's fetch, so the browser reuses this download instead of fetching twice.
function Preload({ url }: { url: string }) {
  preload(url, { as: "fetch", crossOrigin: "anonymous" });
  return null;
}
