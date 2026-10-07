import type { Device, Flow } from "./devices";

// Flow list from the Figma REST API (GET /v1/files/:key?depth=3). A page lists its flows in
// flowStartingPoints. Two ways a Designer lays out a file:
// - one page per Device: every flow on a Device's page belongs to that Device;
// - one page for every Device: each flow goes to the Device whose linked frame is closest in width
//   to the flow's starting frame.
// ponytail: depth=3 sees frames on a page and one section deep; a starting frame nested deeper has no
// known width and goes to the page's first Device.

type FigmaNode = { id: string; type?: string; absoluteBoundingBox?: { width: number } | null; children?: FigmaNode[] };
type FigmaPage = FigmaNode & { flowStartingPoints?: { nodeId: string; name: string }[] };
export type FigmaFile = { document: { children?: FigmaPage[] } };

function widths(page: FigmaPage) {
  const out = new Map<string, number | undefined>();
  const walk = (nodes: FigmaNode[] = []) => {
    for (const n of nodes) {
      out.set(n.id, n.absoluteBoundingBox?.width);
      walk(n.children);
    }
  };
  walk(page.children);
  return out;
}

export function flowsFromFile(file: FigmaFile, links: Partial<Record<Device, string>>): { flows: Flow[]; missing: Device[] } {
  const pages = (file.document.children ?? []).map((page) => ({ page, widths: widths(page) }));
  const missing: Device[] = [];
  const byPage = new Map<(typeof pages)[number], Device[]>();
  for (const [device, nodeId] of Object.entries(links) as [Device, string][]) {
    const p = pages.find((p) => p.widths.has(nodeId));
    if (!p) missing.push(device);
    else byPage.set(p, [...(byPage.get(p) ?? []), device]);
  }

  const flows: Flow[] = [];
  for (const [p, devices] of byPage) {
    for (const start of p.page.flowStartingPoints ?? []) {
      const w = p.widths.get(start.nodeId);
      let device = devices[0];
      if (devices.length > 1 && w !== undefined) {
        const distance = (d: Device) => Math.abs((p.widths.get(links[d]!) ?? Infinity) - w);
        device = devices.reduce((best, d) => (distance(d) < distance(best) ? d : best));
      }
      flows.push({ device, name: start.name, nodeId: start.nodeId, source: "figma" });
    }
  }
  return { flows, missing };
}
