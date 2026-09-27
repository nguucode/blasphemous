"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { buildEmbedUrl } from "@/lib/figma-link";

// Shared by every page that presents a Demo: the device switcher and the stage that shows
// the 3D phone or a flat Desktop/Tablet frame.

const Phone3D = dynamic(() => import("@/components/phone-3d").then((m) => m.Phone3D), { ssr: false });

export type Device = "desktop" | "tablet" | "phone";
export type DeviceLink = { fileKey: string; nodeId: string };

export const DEVICES: { id: Device; label: string }[] = [
  { id: "desktop", label: "Desktop" },
  { id: "tablet", label: "Tablet" },
  { id: "phone", label: "Mobile" },
];
const FLAT_SIZE = { desktop: { w: 1440, h: 900 }, tablet: { w: 834, h: 1194 } };

export function DeviceSwitcher({ devices, value, onChange }: { devices: Device[]; value: Device; onChange: (d: Device) => void }) {
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
          className="min-h-11 min-w-11 cursor-pointer rounded-[14px] px-5 text-sm tracking-[-0.016em] text-ink-secondary transition-colors duration-300 hover:text-ink focus-visible:outline-2 focus-visible:outline-link aria-pressed:bg-white/12 aria-pressed:font-semibold aria-pressed:text-ink"
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

function Screen({ link, emptyText }: { link?: DeviceLink; emptyText: string }) {
  const src = link && buildEmbedUrl({ ...link, responsive: false });
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

function FlatDevice({ size, children }: { size: { w: number; h: number }; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setScale(Math.min(el.clientWidth / size.w, el.clientHeight / size.h, 1)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);
  return (
    <div ref={ref} className="relative h-full w-full">
      <div
        className="absolute top-1/2 left-1/2 origin-top-left overflow-hidden rounded-[20px] bg-stage-raised shadow-[0_40px_120px_-20px_rgb(0_0_0/0.9)] ring-1 ring-white/10"
        style={{ width: size.w, height: size.h, transform: `scale(${scale}) translate(-50%, -50%)` }}
      >
        {children}
      </div>
    </div>
  );
}

// Each device keeps its own iframe once opened; switching only hides, never remounts (spec 8.6).
export function DeviceStage({
  device, opened, links, resetSignal, emptyText,
}: { device: Device; opened: Set<Device>; links: Partial<Record<Device, DeviceLink>>; resetSignal: number; emptyText: string }) {
  return (
    <>
      {opened.has("phone") && (
        <div hidden={device !== "phone"} className="h-full">
          <Phone3D resetSignal={resetSignal}>
            <Screen link={links.phone} emptyText={emptyText} />
          </Phone3D>
        </div>
      )}
      {(["desktop", "tablet"] as const).map(
        (d) =>
          opened.has(d) && (
            <div key={d} hidden={device !== d} className="h-full px-6">
              <FlatDevice size={FLAT_SIZE[d]}>
                <Screen link={links[d]} emptyText={emptyText} />
              </FlatDevice>
            </div>
          ),
      )}
    </>
  );
}
