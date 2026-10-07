import { describe, expect, it } from "vitest";
import { dataUrlBytes, suggestSlug, uniqueSlug, validateDemoForm, type DemoForm } from "./demo-rules";

const PROTO = (key: string, node = "1-2") => `https://www.figma.com/proto/${key}/X?node-id=${node}`;
const dev = (link = "", enabled = !!link, model = "") => ({ enabled, link, model });
const devices = (phone = dev(PROTO("KEY")), tablet = dev(), desktop = dev()) => ({ phone, tablet, desktop });
const PNG = (bytes: number) => `data:image/png;base64,${"A".repeat(Math.ceil(bytes / 3) * 4)}`;
const form = (over: Partial<DemoForm> = {}): DemoForm => ({
  name: "Acme App",
  slug: "acme-app",
  devices: devices(),
  flows: [],
  brandColor: "#0071E3",
  backgroundColor: "#1e1b4b",
  backgroundImage: null,
  logo: null,
  confirmedPublic: true,
  isNew: true,
  ...over,
});

describe("suggestSlug", () => {
  it.each([
    ["Acme App", "acme-app"],
    ["Ứng dụng Đặt Lịch!", "ung-dung-dat-lich"],
    ["  --Hello   World--  ", "hello-world"],
    ["a".repeat(60), "a".repeat(48)],
    ["x".repeat(47) + " y", "x".repeat(47)],
  ])("%s → %s", (name, slug) => expect(suggestSlug(name)).toBe(slug));
});

describe("uniqueSlug", () => {
  it("keeps a free slug", () => expect(uniqueSlug("acme", () => false)).toBe("acme"));
  it("adds -2, -3… until free", () => {
    const taken = new Set(["acme", "acme-2"]);
    expect(uniqueSlug("acme", (s) => taken.has(s))).toBe("acme-3");
  });
});

describe("validateDemoForm", () => {
  it("accepts a valid form and returns the parsed Demo", () => {
    const flows = [{ device: "phone" as const, name: " Login ", nodeId: "3:12", source: "figma" as const }];
    const r = validateDemoForm(
      form({ devices: devices(dev(PROTO("KEY", "3-10"), true, "iphone-17-pro-max"), dev(), dev(PROTO("KEY", "5-1"), true, "1920")), flows }),
    );
    expect(r).toEqual({
      ok: true,
      value: {
        name: "Acme App",
        slug: "acme-app",
        fileKey: "KEY",
        nodeIds: { phone: "3:10", desktop: "5:1" },
        devices: {
          desktop: { enabled: true, model: "1920" },
          tablet: { enabled: false, model: "ipad-pro-12-9" },
          phone: { enabled: true, model: "iphone-17-pro-max" },
        },
        flows: [{ device: "phone", name: "Login", nodeId: "3:12", source: "figma" }],
        brandColor: "#0071e3",
        backgroundColor: "#1e1b4b",
        backgroundImage: null,
        logo: null,
      },
    });
  });

  it("keeps the link of a Device that is turned off", () => {
    const r = validateDemoForm(form({ devices: devices(dev(PROTO("KEY")), dev(PROTO("KEY", "7-7"), false)) }));
    expect(r.ok && [r.value.nodeIds.tablet, r.value.devices.tablet.enabled]).toEqual(["7:7", false]);
  });

  it("trims the name", () => {
    const r = validateDemoForm(form({ name: "  Acme  " }));
    expect(r.ok && r.value.name).toBe("Acme");
  });

  it.each([
    [{ name: "   " }, "name"],
    [{ name: "x".repeat(81) }, "name"],
    [{ slug: "ab" }, "slug"],
    [{ slug: "app" }, "slug"],
    [{ backgroundColor: "red" }, "backgroundColor"],
    [{ confirmedPublic: false }, "confirmedPublic"],
    [{ devices: devices(dev(PROTO("KEY"), false)) }, "links"],
    [{ devices: devices(dev("", true)) }, "phone"],
    [{ devices: devices(dev("https://www.figma.com/design/KEY/X?node-id=1-2")) }, "phone"],
    [{ brandColor: "blue" }, "brandColor"],
    [{ flows: [{ device: "phone", name: "", nodeId: "1:2", source: "manual" }] }, "flows"],
    [{ flows: [{ device: "phone", name: "x", nodeId: "<script>", source: "manual" }] }, "flows"],
    [{ logo: "data:image/jpeg;base64,AAAA" }, "logo"],
    [{ logo: PNG(201 * 1024) }, "logo"],
    [{ backgroundImage: "https://example.com/x.png" }, "backgroundImage"],
  ] as const)("flags %o on %s", (over, field) => {
    const r = validateDemoForm(form(over as Partial<DemoForm>));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors[field]).toBeTruthy();
  });

  it("only asks for the public-link confirmation when creating", () => {
    expect(validateDemoForm(form({ confirmedPublic: false, isNew: false })).ok).toBe(true);
  });

  it("flags every link when they point at different files", () => {
    const r = validateDemoForm(form({ devices: devices(dev(PROTO("A")), dev(PROTO("B")), dev(PROTO("A"))) }));
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["desktop", "phone", "tablet"]);
  });

  it("falls back to the default device for an unknown one", () => {
    const r = validateDemoForm(form({ devices: devices(dev(PROTO("KEY"), true, "nokia-3310")) }));
    expect(r.ok && r.value.devices.phone.model).toBe("iphone-17-pro-max");
  });

  it("accepts brand images within their limits", () => {
    expect(validateDemoForm(form({ logo: PNG(200 * 1024 - 2), backgroundImage: PNG(1024 * 1024) })).ok).toBe(true);
  });
});

describe("dataUrlBytes", () => {
  it("counts decoded bytes, minus padding", () => {
    expect(dataUrlBytes("data:image/png;base64,QUJD", ["image/png"])).toBe(3);
    expect(dataUrlBytes("data:image/png;base64,QUI=", ["image/png"])).toBe(2);
    expect(dataUrlBytes("data:image/gif;base64,QUJD", ["image/png"])).toBeUndefined();
  });
});
