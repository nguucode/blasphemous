"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { buildEmbedUrl, parseFigmaLink, type FigmaLinkError } from "@/lib/figma-link";
import { PHONE_MODEL } from "@/lib/phone-model";

const Phone3D = dynamic(() => import("@/components/phone-3d").then((m) => m.Phone3D), { ssr: false });


type Device = "desktop" | "tablet" | "phone";
type Link = { fileKey: string; nodeId: string };

const DEVICES: { id: Device; label: string }[] = [
  { id: "desktop", label: "Desktop" },
  { id: "tablet", label: "Tablet" },
  { id: "phone", label: "Mobile" },
];
const FLAT_SIZE = { desktop: { w: 1440, h: 900 }, tablet: { w: 834, h: 1194 } };

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
      <div className="grid h-full place-items-center bg-stage-raised p-10 text-center font-display text-[17px] leading-snug tracking-[-0.022em] text-ink-secondary">
        Dán link prototype Figma vào thanh bên dưới để xem trên máy.
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
        className="absolute top-1/2 left-1/2 origin-top-left overflow-hidden rounded-[20px] bg-stage-raised shadow-[0_40px_120px_-20px_rgb(0_0_0/0.9)] ring-1 ring-white/10"
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
    <main className="relative grid h-dvh grid-rows-[auto_1fr] overflow-hidden bg-stage font-display text-ink antialiased">
      {/* Soft spotlight behind the device */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 38% 52% at 50% 46%, rgb(255 255 255 / 0.09), transparent 72%)" }}
      />

      <nav className="relative flex animate-rise justify-center px-4 pt-4">
        <div
          role="group"
          aria-label="Chọn thiết bị"
          className="inline-flex gap-1 rounded-[18px] bg-glass-strong p-1 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-xl"
        >
          {DEVICES.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={device === d.id}
              onClick={() => choose(d.id)}
              className="min-h-11 min-w-11 cursor-pointer rounded-[14px] px-5 text-sm tracking-[-0.016em] text-ink-secondary transition-colors duration-300 hover:text-ink focus-visible:outline-2 focus-visible:outline-link aria-pressed:bg-white/12 aria-pressed:font-semibold aria-pressed:text-ink"
            >
              {d.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Each device keeps its own iframe once opened; switching only hides, never remounts (spec 8.6). */}
      <div className={`relative min-h-0 pb-44 ${device === "phone" ? "lg:pb-8" : ""}`}>
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

      {/* Bottom-left: headline and phone controls, like the product name on a launch page.
          Only beside the phone; the wide Desktop and Tablet frames need the room. */}
      <div className={`pointer-events-none absolute bottom-8 left-8 hidden max-w-sm xl:max-w-md ${device === "phone" ? "lg:block" : ""}`}>
        <p className="animate-rise text-2xl font-semibold tracking-[0.009em] text-[#e8e8ed] [animation-delay:120ms]">Blasphemous</p>
        <h1 className="mt-1 animate-rise text-5xl leading-[1.05] font-semibold tracking-[-0.015em] [animation-delay:200ms] xl:text-[64px]">
          Xem prototype như sản phẩm thật.
        </h1>
        {device === "phone" && (
          <div className="pointer-events-auto mt-5 flex animate-rise flex-wrap items-center gap-x-5 gap-y-1 text-[17px] tracking-[-0.022em] [animation-delay:320ms]">
            <button
              type="button"
              onClick={() => setResetSignal((n) => n + 1)}
              className="min-h-11 cursor-pointer text-link hover:underline focus-visible:outline-2 focus-visible:outline-link"
            >
              Đưa về thẳng ›
            </button>
            <span className="text-ink-secondary">Kéo nền để xoay máy</span>
          </div>
        )}
        <p className="pointer-events-auto mt-2 animate-rise text-xs text-ink-secondary [animation-delay:400ms]">
          Mô hình “<a href={PHONE_MODEL.credit.url} target="_blank" rel="noopener" className="underline hover:text-ink">{PHONE_MODEL.credit.title}</a>” của{" "}
          <a href={PHONE_MODEL.credit.authorUrl} target="_blank" rel="noopener" className="underline hover:text-ink">{PHONE_MODEL.credit.author}</a>,{" "}
          <a href={PHONE_MODEL.credit.licenseUrl} target="_blank" rel="noopener" className="underline hover:text-ink">{PHONE_MODEL.credit.license}</a>
        </p>
      </div>

      {device === "phone" && (
        <button
          type="button"
          onClick={() => setResetSignal((n) => n + 1)}
          className="absolute bottom-[11.5rem] left-6 min-h-11 cursor-pointer text-[15px] text-link focus-visible:outline-2 focus-visible:outline-link lg:hidden"
        >
          Đưa về thẳng ›
        </button>
      )}

      {/* Bottom-right: frosted import bar */}
      <form
        onSubmit={importLink}
        className="absolute right-4 bottom-4 left-4 flex animate-rise flex-col gap-2 rounded-[28px] bg-glass p-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-md [animation-delay:260ms] md:right-8 md:bottom-8 md:left-auto md:w-[26rem]"
      >
        <label htmlFor="figma-url" className="px-2 pt-1 text-xs tracking-[-0.01em] text-ink-secondary">
          Link prototype cho {label}
        </label>
        <div className="flex gap-2">
          <input
            id="figma-url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://www.figma.com/proto/…"
            aria-invalid={!!error}
            aria-describedby={error ? "figma-url-error" : undefined}
            className="min-h-11 min-w-0 flex-1 rounded-full bg-white/8 px-4 text-sm text-ink placeholder:text-ink-secondary focus-visible:outline-2 focus-visible:outline-link aria-invalid:outline-2 aria-invalid:outline-danger-on-stage"
          />
          <button
            type="submit"
            className="min-h-11 cursor-pointer rounded-full bg-cta px-5 text-sm text-white transition-transform duration-150 hover:bg-cta-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link active:scale-[0.97]"
          >
            Import
          </button>
        </div>
        {error && (
          <p id="figma-url-error" className="px-2 text-xs text-danger-on-stage">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="min-h-11 cursor-pointer self-start rounded-full px-2 text-xs text-link hover:underline focus-visible:outline-2 focus-visible:outline-link"
        >
          Reset {label}
        </button>
      </form>
    </main>
  );
}
