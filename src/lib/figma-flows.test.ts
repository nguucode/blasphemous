import { describe, expect, it } from "vitest";
import { deviceForWidth } from "./devices";
import { flowsFromFile, type FigmaFile } from "./figma-flows";

const frame = (id: string, width: number) => ({ id, type: "FRAME", absoluteBoundingBox: { width } });

describe("flowsFromFile", () => {
  it("one page per Device: every flow on a page goes to that page's Device", () => {
    const file: FigmaFile = {
      document: {
        children: [
          { id: "0:1", children: [frame("1:1", 1440), frame("1:2", 1440)], flowStartingPoints: [{ nodeId: "1:1", name: "Login" }, { nodeId: "1:2", name: "Checkout" }] },
          { id: "0:2", children: [frame("2:1", 393)], flowStartingPoints: [{ nodeId: "2:1", name: "Onboarding" }] },
        ],
      },
    };
    const { flows, missing } = flowsFromFile(file, { desktop: "1:1", phone: "2:1" });
    expect(missing).toEqual([]);
    expect(flows.map((f) => [f.device, f.name])).toEqual([["desktop", "Login"], ["desktop", "Checkout"], ["phone", "Onboarding"]]);
  });

  it("one page for every Device: a flow goes to the Device whose linked frame is closest in width", () => {
    const file: FigmaFile = {
      document: {
        children: [
          {
            id: "0:1",
            children: [
              frame("1:1", 1440),
              frame("1:2", 834),
              frame("1:3", 393),
              { id: "9:1", type: "SECTION", absoluteBoundingBox: { width: 5000 }, children: [frame("1:4", 1280), frame("1:5", 390)] },
              { id: "9:2", type: "SECTION", children: [{ id: "9:3", children: [frame("1:6", 390)] }] },
            ],
            flowStartingPoints: [
              { nodeId: "1:1", name: "Desktop home" },
              { nodeId: "1:4", name: "Desktop pricing" },
              { nodeId: "1:5", name: "Mobile pricing" },
              { nodeId: "1:2", name: "Tablet home" },
            ],
          },
        ],
      },
    };
    const { flows } = flowsFromFile(file, { desktop: "1:1", tablet: "1:2", phone: "1:3" });
    expect(flows.map((f) => [f.name, f.device])).toEqual([
      ["Desktop home", "desktop"],
      ["Desktop pricing", "desktop"],
      ["Mobile pricing", "phone"],
      ["Tablet home", "tablet"],
    ]);
  });

  it("reports a Device whose linked frame is not on any page", () => {
    const file: FigmaFile = { document: { children: [{ id: "0:1", children: [frame("1:1", 393)] }] } };
    expect(flowsFromFile(file, { phone: "1:1", tablet: "7:7" })).toEqual({ flows: [], missing: ["tablet"] });
  });
});

describe("deviceForWidth", () => {
  it("opens the Device that fits the screen, else the closest enabled one", () => {
    expect(deviceForWidth(390, ["desktop", "tablet", "phone"])).toBe("phone");
    expect(deviceForWidth(800, ["desktop", "tablet", "phone"])).toBe("tablet");
    expect(deviceForWidth(1440, ["desktop", "phone"])).toBe("desktop");
    expect(deviceForWidth(390, ["desktop"])).toBe("desktop");
    expect(deviceForWidth(1440, ["phone"])).toBe("phone");
    expect(deviceForWidth(800, ["desktop", "phone"])).toBe("desktop");
  });
});
