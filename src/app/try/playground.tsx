"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { buildEmbedUrl, parseFigmaLink, type FigmaLinkError } from "@/lib/figma-link";

const Phone3D = dynamic(() => import("@/components/phone-3d").then((m) => m.Phone3D), { ssr: false });

type Device = "desktop" | "tablet" | "phone";
type Link = { fileKey: string; nodeId: string };

const DEVICES: { id: Device; label: string }[] = [
  { id: "desktop", label: "Desktop" },
  { id: "tablet", label: "Tablet" },
  { id: "phone", label: "Mobile" },
];
const FLAT_SIZE = { desktop: { w: 1440, h: 900 }, tablet: { w: 834, h: 1194 } };
const BACKGROUND = "#1e1b4b"; // spec 7.1 default Background

const ERRORS: Record<FigmaLinkError | "other-file", string> = {
  "not-figma": "Đây không phải link prototype Figma.",
  "design-link": "Đây là link thiết kế. Mở Present trong Figma rồi bấm Copy link.",
  "no-node": "Link thiếu điểm bắt đầu. Trong Present, bấm Copy link lại.",
  "other-file": "Link này thuộc file Figma khác với các Device đã nhập.",
};

function Screen({ link, responsive }: { link?: Link; responsive: boolean }) {
  const src = link && buildEmbedUrl({ ...link, responsive });
  const [loadedSrc, setLoadedSrc] = useState<string>();
  if (!src) {
    return (
      <div className="grid h-full place-items-center bg-surface-subtle p-8 text-center text-text-muted">
        Dán link prototype Figma vào ô ở góc dưới để xem.
      </div>
    );
  }
  return (
    <div className="relative h-full w-full">
      <iframe key={src} src={src} title="Prototype" allowFullScreen className="h-full w-full border-0" onLoad={() => setLoadedSrc(src)} />
      {loadedSrc !== src && (
        <div className="absolute inset-0 grid place-items-center bg-black/60 text-sm text-white">Đang tải prototype…</div>
      )}
    </div>
  );
}

function FlatDevice({ size, children }: { size: { w: number; h: number }; children: React.ReactNode }) {
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
        className="absolute top-1/2 left-1/2 origin-top-left overflow-hidden rounded-xl bg-black shadow-2xl"
        style={{ width: size.w, height: size.h, transform: `scale(${scale}) translate(-50%, -50%)` }}
      >
        {children}
      </div>
    </div>
  );
}

export function Playground() {
  const [device, setDevice] = useState<Device>("phone");
  const [opened, setOpened] = useState<Set<Device>>(new Set(["phone"]));
  const [links, setLinks] = useState<Partial<Record<Device, Link>>>({});
  const [input, setInput] = useState("");
  const [error, setError] = useState<string>();
  const [resetSignal, setResetSignal] = useState(0);

  const choose = (d: Device) => {
    setDevice(d);
    setOpened((s) => new Set(s).add(d));
    setError(undefined);
  };

  const importLink = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseFigmaLink(input);
    if (!parsed.ok) return setError(ERRORS[parsed.error]);
    const other = Object.entries(links).find(([d, l]) => d !== device && l && l.fileKey !== parsed.fileKey);
    if (other) return setError(ERRORS["other-file"]);
    setLinks((l) => ({ ...l, [device]: { fileKey: parsed.fileKey, nodeId: parsed.nodeId } }));
    setError(undefined);
  };

  const reset = () => {
    setLinks((l) => ({ ...l, [device]: undefined }));
    setInput("");
    setError(undefined);
  };

  const label = DEVICES.find((d) => d.id === device)!.label;

  return (
    <main className="relative grid h-dvh grid-rows-[auto_1fr] overflow-hidden" style={{ background: BACKGROUND }}>
      <nav className="flex justify-center p-4">
        <div role="group" aria-label="Chọn thiết bị" className="inline-flex gap-1 rounded-full border border-border-input bg-surface p-1">
          {DEVICES.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={device === d.id}
              onClick={() => choose(d.id)}
              className="min-h-11 min-w-11 cursor-pointer rounded-full px-4 text-sm hover:bg-ui-hover focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-ui-active aria-pressed:font-semibold"
            >
              {d.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Each device keeps its own iframe once opened; switching only hides, never remounts (spec 8.6). */}
      <div className="relative min-h-0 pb-40 sm:pb-6">
        {opened.has("phone") && (
          <div hidden={device !== "phone"} className="h-full">
            <Phone3D resetSignal={resetSignal}>
              <Screen link={links.phone} responsive={false} />
            </Phone3D>
          </div>
        )}
        {(["desktop", "tablet"] as const).map(
          (d) =>
            opened.has(d) && (
              <div key={d} hidden={device !== d} className="h-full px-6">
                <FlatDevice size={FLAT_SIZE[d]}>
                  <Screen link={links[d]} responsive={false} />
                </FlatDevice>
              </div>
            ),
        )}
      </div>

      {device === "phone" && (
        <div className="absolute bottom-44 left-4 flex items-center gap-3 text-sm text-white/70 sm:bottom-6 sm:left-6">
          <button
            type="button"
            onClick={() => setResetSignal((n) => n + 1)}
            className="min-h-11 cursor-pointer rounded-lg border border-white/30 px-4 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-ring"
          >
            Đưa về thẳng
          </button>
          <span className="hidden sm:inline">Kéo nền để xoay máy</span>
        </div>
      )}

      <form
        onSubmit={importLink}
        className="absolute right-4 bottom-4 left-4 flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-2xl sm:right-6 sm:bottom-6 sm:left-auto sm:w-96"
      >
        <label htmlFor="figma-url" className="text-sm font-semibold">
          Link prototype cho {label}
        </label>
        <input
          id="figma-url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://www.figma.com/proto/…"
          aria-invalid={!!error}
          aria-describedby={error ? "figma-url-error" : undefined}
          className="min-h-11 rounded-lg border border-border-input bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-text-danger"
        />
        {error && (
          <p id="figma-url-error" className="text-xs text-text-danger">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={reset}
            className="min-h-11 cursor-pointer rounded-lg border border-border-input font-semibold hover:bg-ui-hover focus-visible:outline-2 focus-visible:outline-ring"
          >
            Reset
          </button>
          <button
            type="submit"
            className="min-h-11 cursor-pointer rounded-lg bg-accent font-semibold text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-ring"
          >
            Import
          </button>
        </div>
      </form>
    </main>
  );
}
