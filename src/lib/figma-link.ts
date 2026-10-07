// Spec 7.2: one Figma prototype link per Device. We keep only the file key and starting node.

export type FigmaLinkError = "not-figma" | "design-link" | "no-node";
export type ParsedFigmaLink = { ok: true; fileKey: string; nodeId: string } | { ok: false; error: FigmaLinkError };

const FIGMA_HOSTS = new Set(["figma.com", "www.figma.com"]);

export function parseFigmaLink(input: string): ParsedFigmaLink {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, error: "not-figma" };
  }
  if (url.protocol !== "https:" || !FIGMA_HOSTS.has(url.hostname)) return { ok: false, error: "not-figma" };

  const [kind, fileKey] = url.pathname.split("/").filter(Boolean);
  if (kind === "design" || kind === "file") return { ok: false, error: "design-link" };
  if (kind !== "proto" || !fileKey) return { ok: false, error: "not-figma" };

  const raw = url.searchParams.get("starting-point-node-id") || url.searchParams.get("node-id");
  if (!raw) return { ok: false, error: "no-node" };
  return { ok: true, fileKey, nodeId: raw.replaceAll("-", ":") };
}

// Figma Embed API (D/A shortcuts) needs an OAuth app's client id; without one the prototype still plays.
export const FIGMA_CLIENT_ID = process.env.NEXT_PUBLIC_FIGMA_CLIENT_ID || undefined;

export function buildEmbedUrl({ fileKey, nodeId, clientId }: { fileKey: string; nodeId: string; clientId?: string }) {
  const params = new URLSearchParams({
    "node-id": nodeId.replaceAll(":", "-"),
    "starting-point-node-id": nodeId,
    "embed-host": "blasphemous",
    footer: "false",
    "hotspot-hints": "false",
    "viewport-controls": "false",
    scaling: "contain",
    "content-scaling": "fixed",
  });
  if (clientId) params.set("client-id", clientId);
  return `https://embed.figma.com/proto/${encodeURIComponent(fileKey)}?${params}`;
}
