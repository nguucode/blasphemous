"use client";

import { useEffect, useState } from "react";
import { backgroundStyle, DemoShell, FlowList, glass, playerLinks, useDemoPlayer } from "@/components/demo-shell";
import { Screen } from "@/components/device-view";
import type { PublishedDemo } from "@/lib/demos";

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
  const player = useDemoPlayer({ enabled: demo.enabled, flows: demo.flows, fitToScreen: true });
  const small = useSmallScreen();

  // Spec 8.6: on a phone the prototype fills the screen, no chrome.
  if (small) {
    return (
      <main className="h-dvh" style={backgroundStyle(demo.backgroundColor, demo.backgroundImage)}>
        <Screen link={player.device && playerLinks(player, demo.links)[player.device]} emptyText="" />
      </main>
    );
  }

  return (
    <main className="h-dvh">
      <DemoShell
        player={player}
        links={demo.links}
        models={demo.models}
        background={{ color: demo.backgroundColor, image: demo.backgroundImage }}
        brandColor={demo.brandColor}
        logo={
          // Text sits on glass so it stays readable on any background the Designer picks.
          demo.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- served from the Demo row, sizes unknown
            <img src={demo.logo} alt={demo.name} className="max-h-11 max-w-56 object-contain" />
          ) : (
            <h1 className={`min-h-11 content-center truncate rounded-[18px] px-5 text-[17px] font-semibold tracking-[-0.022em] ${glass}`}>{demo.name}</h1>
          )
        }
        // The Flow list hides when the open Device has none, so the device gets the whole width.
        panel={player.deviceFlows.length > 0 && <FlowList player={player} brandColor={demo.brandColor} />}
        footerEnd={
          <details className="group relative">
            <summary className="min-h-11 cursor-pointer list-none content-center text-[13px] text-ink-secondary hover:text-ink focus-visible:outline-2 focus-visible:outline-link">
              Không xem được?
            </summary>
            <div className={`absolute right-0 bottom-12 z-10 w-80 rounded-[20px] p-5 text-[13px] leading-relaxed text-ink ${glass}`}>
              <p>Nếu khung trống hoặc đòi đăng nhập Figma:</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-ink-secondary">
                <li>Tải lại trang.</li>
                <li>Trên Safari, cho phép cookie của bên thứ ba hoặc thử Chrome.</li>
                <li>Báo người gửi link bật “Anyone with the link can view” cho file Figma.</li>
              </ul>
            </div>
          </details>
        }
      />
    </main>
  );
}
