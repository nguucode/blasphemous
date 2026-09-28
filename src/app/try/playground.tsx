"use client";

import { useState, type FormEvent } from "react";
import { DEVICES, DeviceStage, DeviceSwitcher, ModelCredit, type Device, type DeviceLink } from "@/components/device-view";
import { LINK_ERRORS } from "@/lib/demo-rules";
import { parseFigmaLink } from "@/lib/figma-link";

export function Playground() {
  const [device, setDevice] = useState<Device>("phone");
  const [opened, setOpened] = useState<Set<Device>>(new Set(["phone"]));
  const [links, setLinks] = useState<Partial<Record<Device, DeviceLink>>>({});
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
    if (!parsed.ok) return setError(LINK_ERRORS[parsed.error]);
    const other = Object.entries(links).find(([d, l]) => d !== device && l && l.fileKey !== parsed.fileKey);
    if (other) return setError(LINK_ERRORS["other-file"]);
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
        <DeviceSwitcher devices={DEVICES.map((d) => d.id)} value={device} onChange={choose} />
      </nav>

      <div className={`relative min-h-0 pb-44 ${device === "phone" ? "lg:pb-8" : ""}`}>
        <DeviceStage
          device={device}
          opened={opened}
          links={links}
          resetSignal={resetSignal}
          emptyText="Dán link prototype Figma vào thanh bên dưới để xem trên máy."
        />
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
          <ModelCredit />
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
