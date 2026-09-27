"use client";

import { useEffect, useState } from "react";
import { DESKTOP_SIZES, DEVICES, DeviceStage, DeviceSwitcher, Screen, type Device } from "@/components/device-view";
import type { PublishedDemo } from "@/lib/demos";
import { PHONE_MODEL } from "@/lib/phone-model";

// Designer's order in the form is Phone, Tablet, Desktop; the Viewer opens on the first one assigned.
const OPEN_ORDER: Device[] = ["phone", "tablet", "desktop"];
const SMALL_SCREEN = "(max-width: 640px)";

function useSmallScreen() {
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const mq = matchMedia(SMALL_SCREEN);
    const update = () => setSmall(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return small;
}

export function Viewer({ demo }: { demo: PublishedDemo }) {
  const devices = OPEN_ORDER.filter((d) => demo.links[d]);
  const [device, setDevice] = useState<Device>(devices[0]);
  const [opened, setOpened] = useState<Set<Device>>(new Set([devices[0]]));
  const [resetSignal, setResetSignal] = useState(0);
  const [desktopSize, setDesktopSize] = useState(DESKTOP_SIZES[1]);
  const small = useSmallScreen();

  // Spec 8.6: on a phone the prototype fills the screen, phone flow first, no chrome.
  if (small) {
    return (
      <main className="h-dvh" style={{ background: demo.backgroundColor }}>
        <Screen link={demo.links.phone ?? demo.links[devices[0]]} emptyText="" />
      </main>
    );
  }

  const choose = (d: Device) => {
    setDevice(d);
    setOpened((s) => new Set(s).add(d));
  };

  return (
    <main
      className="relative grid h-dvh grid-rows-[auto_1fr] overflow-hidden font-display text-ink antialiased"
      style={{ background: demo.backgroundColor }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 38% 52% at 50% 50%, rgb(255 255 255 / 0.09), transparent 72%)" }}
      />

      {/* Text sits on glass so it stays readable on any Background colour the Designer picks. */}
      <header className="relative flex animate-rise items-center justify-between gap-4 px-6 pt-4">
        <h1 className="min-h-11 content-center truncate rounded-[18px] bg-glass-strong px-5 text-[17px] font-semibold tracking-[-0.022em] shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-xl">
          {demo.name}
        </h1>
        <div className="flex items-center gap-2">
          {device === "desktop" && demo.responsiveDesktop && (
            <label className="flex min-h-[52px] items-center rounded-[18px] bg-glass-strong px-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-xl">
              <span className="sr-only">Kích thước màn hình</span>
              <select
                value={`${desktopSize.w}x${desktopSize.h}`}
                onChange={(e) => setDesktopSize(DESKTOP_SIZES.find((s) => `${s.w}x${s.h}` === e.target.value)!)}
                className="min-h-11 cursor-pointer rounded-[14px] bg-transparent px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-link"
              >
                {DESKTOP_SIZES.map((s) => (
                  <option key={s.w} value={`${s.w}x${s.h}`} className="bg-stage-raised">
                    {s.w} × {s.h}
                  </option>
                ))}
              </select>
            </label>
          )}
          {/* Hidden when the Demo has a single Device (spec 8.6). */}
          {devices.length > 1 && <DeviceSwitcher devices={DEVICES.map((d) => d.id).filter((d) => devices.includes(d))} value={device} onChange={choose} />}
        </div>
      </header>

      <div className="relative min-h-0 pb-20">
        <DeviceStage
          device={device}
          opened={opened}
          links={demo.links}
          resetSignal={resetSignal}
          emptyText=""
          responsiveDesktop={demo.responsiveDesktop}
          desktopSize={desktopSize}
        />
      </div>

      <footer className="pointer-events-none absolute inset-x-6 bottom-5 flex items-end justify-between gap-4 text-xs text-ink-secondary">
        <div className="pointer-events-auto flex flex-wrap items-center gap-x-4">
          {device === "phone" && (
            <>
              <button
                type="button"
                onClick={() => setResetSignal((n) => n + 1)}
                className="min-h-11 cursor-pointer text-[15px] text-link hover:underline focus-visible:outline-2 focus-visible:outline-link"
              >
                Đưa về thẳng ›
              </button>
              <span>
                Mô hình “<a href={PHONE_MODEL.credit.url} target="_blank" rel="noopener" className="underline hover:text-ink">{PHONE_MODEL.credit.title}</a>” của{" "}
                <a href={PHONE_MODEL.credit.authorUrl} target="_blank" rel="noopener" className="underline hover:text-ink">{PHONE_MODEL.credit.author}</a>,{" "}
                <a href={PHONE_MODEL.credit.licenseUrl} target="_blank" rel="noopener" className="underline hover:text-ink">{PHONE_MODEL.credit.license}</a>
              </span>
            </>
          )}
        </div>
        <details className="group pointer-events-auto relative">
          <summary className="min-h-11 cursor-pointer list-none content-center text-[13px] text-ink-secondary hover:text-ink focus-visible:outline-2 focus-visible:outline-link">
            Không xem được?
          </summary>
          <div className="absolute right-0 bottom-12 w-80 rounded-[20px] bg-glass-strong p-5 text-[13px] leading-relaxed text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-xl">
            <p>Nếu khung trống hoặc đòi đăng nhập Figma:</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-ink-secondary">
              <li>Tải lại trang.</li>
              <li>Trên Safari, cho phép cookie của bên thứ ba hoặc thử Chrome.</li>
              <li>Báo người gửi link bật “Anyone with the link can view” cho file Figma.</li>
            </ul>
          </div>
        </details>
      </footer>
    </main>
  );
}
