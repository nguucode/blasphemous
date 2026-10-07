"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { DeviceStage, DeviceSwitcher, StageCredit, type DeviceLink } from "@/components/device-view";
import { deviceForWidth, type Device, type Flow } from "@/lib/devices";
import { FIGMA_CLIENT_ID } from "@/lib/figma-link";

// The Demo layout from spec 12, shared by the editor and the Viewer: logo top left, Device tabs in the
// middle, the device on stage, the Flow list on the right, keyboard shortcuts along the bottom.

export const glass = "bg-glass-strong shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-xl";

export function backgroundStyle(color: string, image?: string | null) {
  return image ? { background: `${color} url("${image}") center / cover no-repeat` } : { background: color };
}

const noSubscribe = () => () => {};

// Which Device and which Flow is showing. Flow -1 is the Device's own link.
export function useDemoPlayer({ enabled, flows, fitToScreen = false }: { enabled: Device[]; flows: Flow[]; fitToScreen?: boolean }) {
  const [picked, setPicked] = useState<Device | undefined>();
  const [openedSet, setOpened] = useState<Set<Device>>(new Set());
  const [flowIndex, setFlowIndex] = useState<Partial<Record<Device, number>>>({});

  // The Viewer lands on the tab that fits the screen. The server can't know it, so it renders the first tab.
  const fits = useSyncExternalStore(
    noSubscribe,
    () => (fitToScreen ? deviceForWidth(innerWidth, enabled) : undefined),
    () => undefined,
  );

  const device = [picked, fits].find((d) => d && enabled.includes(d)) ?? enabled[0];
  const opened = device && !openedSet.has(device) ? new Set(openedSet).add(device) : openedSet;
  const deviceFlows = flows.filter((f) => f.device === device);
  const index = device ? (flowIndex[device] ?? -1) : -1;
  const current = index < deviceFlows.length ? index : -1;

  return {
    enabled,
    device,
    opened,
    deviceFlows,
    flow: current,
    choose: (d: Device) => {
      setPicked(d);
      setOpened((s) => new Set(s).add(d));
    },
    chooseFlow: (i: number) => device && setFlowIndex((m) => ({ ...m, [device]: i })),
  };
}
export type DemoPlayer = ReturnType<typeof useDemoPlayer>;

// The node each Device starts at: its chosen Flow, or its own link.
export function playerLinks(player: DemoPlayer, links: Partial<Record<Device, DeviceLink>>) {
  const out = { ...links };
  const flow = player.deviceFlows[player.flow];
  if (player.device && flow && links[player.device]) out[player.device] = { ...links[player.device]!, nodeId: flow.nodeId };
  return out;
}

function navigate(type: "NAVIGATE_FORWARD" | "NAVIGATE_BACKWARD") {
  const frame = document.querySelector<HTMLIFrameElement>("[data-device]:not([hidden]) iframe");
  if (frame?.contentWindow) frame.contentWindow.postMessage({ type }, new URL(frame.src).origin);
}

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

const SHORTCUTS = [
  { key: "W", arrow: "↑", label: "Flow trước", needs: "flows" },
  { key: "S", arrow: "↓", label: "Flow sau", needs: "flows" },
  { key: "D", arrow: "→", label: "Màn hình tiếp", needs: "embed-api" },
  { key: "A", arrow: "←", label: "Màn hình trước", needs: "embed-api" },
] as const;

function useShortcuts(player: DemoPlayer) {
  const { deviceFlows, flow, chooseFlow } = player;
  const actions: Record<string, () => void> = {
    w: () => deviceFlows.length && chooseFlow(Math.max(flow - 1, 0)),
    s: () => deviceFlows.length && chooseFlow(Math.min(flow + 1, deviceFlows.length - 1)),
    ...(FIGMA_CLIENT_ID && { d: () => navigate("NAVIGATE_FORWARD"), a: () => navigate("NAVIGATE_BACKWARD") }),
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const run = actions[e.key.toLowerCase()];
      if (!run) return;
      e.preventDefault();
      run();
    };
    // A click inside the prototype moves focus into the Figma iframe, where our keys never arrive.
    // Take it back right after, so W/S/D/A keep working. Keyboard triggers inside the prototype don't run.
    const onBlur = () =>
      setTimeout(() => {
        if (document.activeElement instanceof HTMLIFrameElement) {
          document.activeElement.blur();
          window.focus();
        }
      });
    addEventListener("keydown", onKey);
    addEventListener("blur", onBlur);
    return () => {
      removeEventListener("keydown", onKey);
      removeEventListener("blur", onBlur);
    };
  });
  return actions;
}

export function FlowList({
  player, brandColor, header, onRemove, empty,
}: {
  player: DemoPlayer;
  brandColor: string;
  header?: ReactNode;
  onRemove?: (flow: Flow) => void;
  empty?: ReactNode;
}) {
  return (
    <section aria-label="Flow list" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-ink">Flow list</h2>
        {header}
      </div>
      {player.deviceFlows.length === 0 ? (
        empty
      ) : (
        <ol className="flex flex-col gap-1">
          {player.deviceFlows.map((f, i) => (
            <li key={`${f.nodeId}-${i}`} className="group flex items-center gap-1">
              <button
                type="button"
                aria-current={player.flow === i}
                onClick={() => player.chooseFlow(i)}
                style={player.flow === i ? { background: brandColor } : undefined}
                className="min-h-10 min-w-0 flex-1 cursor-pointer truncate rounded-xl px-3 text-left text-[14px] text-ink-secondary transition-colors hover:bg-white/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-link aria-[current=true]:font-semibold aria-[current=true]:text-white"
              >
                {f.name}
              </button>
              {onRemove && (
                <button
                  type="button"
                  aria-label={`Xóa flow ${f.name}`}
                  onClick={() => onRemove(f)}
                  className="size-10 shrink-0 cursor-pointer rounded-xl text-ink-secondary hover:bg-white/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-link"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function DemoShell({
  player, links, models, background, brandColor, logo, actions, panel, footerEnd, emptyText = "",
}: {
  player: DemoPlayer;
  links: Partial<Record<Device, DeviceLink>>;
  models: Partial<Record<Device, string>>;
  background: { color: string; image?: string | null };
  brandColor: string;
  logo: ReactNode;
  actions?: ReactNode;
  panel?: ReactNode; // right column; omitted when there is nothing to show
  footerEnd?: ReactNode;
  emptyText?: string;
}) {
  const [resetSignal, setResetSignal] = useState(0);
  const run = useShortcuts(player);
  const { device } = player;
  const shortcuts = SHORTCUTS.filter((s) => (s.needs === "flows" ? player.deviceFlows.length > 0 : !!FIGMA_CLIENT_ID));

  return (
    <div
      className={`relative grid h-full min-h-0 overflow-hidden font-display text-ink antialiased ${panel ? "lg:grid-cols-[minmax(0,1fr)_20rem]" : ""}`}
      style={backgroundStyle(background.color, background.image)}
    >
      <div className="relative grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 38% 52% at 50% 50%, rgb(255 255 255 / 0.09), transparent 72%)" }}
        />
        <header className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 pt-4">
          <div className="min-w-0 justify-self-start">{logo}</div>
          {device && (
            <DeviceSwitcher devices={player.enabled} value={device} onChange={player.choose} brandColor={brandColor} />
          )}
          <div className="flex min-w-0 items-center gap-2 justify-self-end">{actions}</div>
        </header>

        <div className="relative min-h-0 py-4">
          {device ? (
            <DeviceStage
              device={device}
              opened={player.opened}
              links={playerLinks(player, links)}
              resetSignal={resetSignal}
              emptyText={emptyText}
              models={models}
            />
          ) : (
            <p className="grid h-full place-items-center px-8 text-center text-[15px] text-ink-secondary">{emptyText}</p>
          )}
        </div>

        <footer className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-5 pb-4 text-xs text-ink-secondary">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {shortcuts.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={run[s.key.toLowerCase()]}
                className="flex cursor-pointer items-center gap-2 text-left hover:text-ink focus-visible:outline-2 focus-visible:outline-link"
              >
                <kbd className={`grid size-8 place-items-center rounded-lg font-sans text-[13px] text-ink ${glass}`}>{s.key}</kbd>
                <span>
                  <span aria-hidden>{s.arrow} </span>
                  {s.label}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-4">
            {device && device !== "desktop" && (
              <button
                type="button"
                onClick={() => setResetSignal((n) => n + 1)}
                className="min-h-11 cursor-pointer text-[13px] text-link hover:underline focus-visible:outline-2 focus-visible:outline-link"
              >
                Đưa về thẳng ›
              </button>
            )}
            {device && (
              <span>
                <StageCredit device={device} models={models} />
              </span>
            )}
            {footerEnd}
          </div>
        </footer>
      </div>

      {panel && (
        <aside className={`relative flex min-h-0 flex-col gap-5 overflow-y-auto border-l border-white/10 p-5 ${glass}`}>{panel}</aside>
      )}
    </div>
  );
}
