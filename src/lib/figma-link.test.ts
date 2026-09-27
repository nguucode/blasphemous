import { describe, expect, it } from "vitest";
import { buildEmbedUrl, parseFigmaLink } from "./figma-link";

const PROTO =
  "https://www.figma.com/proto/k0piuu0Zxvnmz3rpCaGLfa/Live-Chat?node-id=3-10&starting-point-node-id=3%3A10&page-id=2%3A2";

describe("parseFigmaLink", () => {
  it("reads file key and starting point from a copied prototype link", () => {
    expect(parseFigmaLink(PROTO)).toEqual({ ok: true, fileKey: "k0piuu0Zxvnmz3rpCaGLfa", nodeId: "3:10" });
  });

  it("prefers starting-point-node-id over node-id", () => {
    const link = "https://figma.com/proto/KEY/X?node-id=5-1&starting-point-node-id=3%3A10";
    expect(parseFigmaLink(link)).toMatchObject({ ok: true, nodeId: "3:10" });
  });

  it("falls back to node-id, converting dashes to colons", () => {
    expect(parseFigmaLink("https://www.figma.com/proto/KEY/X?node-id=12-345")).toMatchObject({ ok: true, nodeId: "12:345" });
  });

  it("falls back to node-id when starting-point-node-id is empty", () => {
    expect(parseFigmaLink("https://www.figma.com/proto/KEY/X?starting-point-node-id=&node-id=1-2")).toMatchObject({ ok: true, nodeId: "1:2" });
  });

  it("trims surrounding whitespace", () => {
    expect(parseFigmaLink(`  ${PROTO}\n`)).toMatchObject({ ok: true });
  });

  it.each(["https://www.figma.com/design/KEY/X?node-id=1-2", "https://www.figma.com/file/KEY/X?node-id=1-2"])(
    "rejects design links: %s",
    (link) => {
      expect(parseFigmaLink(link)).toEqual({ ok: false, error: "design-link" });
    },
  );

  it("rejects a prototype link with no node id", () => {
    expect(parseFigmaLink("https://www.figma.com/proto/KEY/X")).toEqual({ ok: false, error: "no-node" });
  });

  it.each(["", "not a url", "https://evil.com/proto/KEY/X?node-id=1-2", "https://figma.com.evil.com/proto/KEY/X?node-id=1-2", "http://www.figma.com/proto/KEY/X?node-id=1-2"])(
    "rejects non-Figma input: %s",
    (link) => {
      expect(parseFigmaLink(link)).toEqual({ ok: false, error: "not-figma" });
    },
  );
});

describe("buildEmbedUrl", () => {
  it("builds the embed URL from spec 7.2", () => {
    const url = new URL(buildEmbedUrl({ fileKey: "KEY", nodeId: "3:10", responsive: false }));
    expect(url.origin + url.pathname).toBe("https://embed.figma.com/proto/KEY");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      "node-id": "3-10",
      "starting-point-node-id": "3:10",
      "embed-host": "blasphemous",
      footer: "false",
      "hotspot-hints": "false",
      "viewport-controls": "false",
      scaling: "contain",
      "content-scaling": "fixed",
    });
  });

  it("uses responsive content scaling when asked", () => {
    const url = new URL(buildEmbedUrl({ fileKey: "KEY", nodeId: "1:2", responsive: true }));
    expect(url.searchParams.get("content-scaling")).toBe("responsive");
  });
});
