"use client";

import { useState } from "react";
import { DeviceStage, DeviceSwitcher, ModelCredit, type Device } from "@/components/device-view";

// Homepage sample Demo (spec 8.1). ponytail: "Live Chat" stands in until the showcase file with
// real phone, tablet and desktop flows exists; the same desktop flow is shown on both devices.
const SAMPLE = { fileKey: "k0piuu0Zxvnmz3rpCaGLfa", nodeId: "3:10" };
const SAMPLE_DEVICES: Device[] = ["desktop", "phone"];

export function SampleDemo() {
  const [device, setDevice] = useState<Device>("phone");
  const [opened, setOpened] = useState<Set<Device>>(new Set(["phone"]));
  const [resetSignal, setResetSignal] = useState(0);

  return (
    <div className="relative grid h-full grid-rows-[auto_1fr_auto] gap-3">
      <div className="flex justify-center">
        <DeviceSwitcher
          devices={SAMPLE_DEVICES}
          value={device}
          onChange={(d) => {
            setDevice(d);
            setOpened((s) => new Set(s).add(d));
          }}
        />
      </div>
      <div className="relative min-h-0">
        <DeviceStage
          device={device}
          opened={opened}
          links={{ phone: SAMPLE, desktop: SAMPLE }}
          resetSignal={resetSignal}
          emptyText=""
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 text-xs text-ink-secondary">
        <span>Demo mẫu · bấm thử được{device === "phone" && " · kéo nền để xoay"}</span>
        {device === "phone" && (
          <button
            type="button"
            onClick={() => setResetSignal((n) => n + 1)}
            className="min-h-11 cursor-pointer text-link hover:underline focus-visible:outline-2 focus-visible:outline-link"
          >
            Đưa về thẳng ›
          </button>
        )}
        {device === "phone" && (
          <span>
            <ModelCredit />
          </span>
        )}
      </div>
    </div>
  );
}
