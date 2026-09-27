import { describe, expect, it } from "vitest";
import { suggestSlug, uniqueSlug, validateDemoForm, type DemoForm } from "./demo-rules";

const PROTO = (key: string, node = "1-2") => `https://www.figma.com/proto/${key}/X?node-id=${node}`;
const form = (over: Partial<DemoForm> = {}): DemoForm => ({
  name: "Acme App",
  slug: "acme-app",
  links: { phone: PROTO("KEY"), tablet: "", desktop: "" },
  backgroundColor: "#1e1b4b",
  responsiveDesktop: false,
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
    const r = validateDemoForm(form({ links: { phone: PROTO("KEY", "3-10"), tablet: "", desktop: PROTO("KEY", "5-1") }, responsiveDesktop: true }));
    expect(r).toEqual({
      ok: true,
      value: {
        name: "Acme App",
        slug: "acme-app",
        fileKey: "KEY",
        nodeIds: { phone: "3:10", desktop: "5:1" },
        backgroundColor: "#1e1b4b",
        responsiveDesktop: true,
      },
    });
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
    [{ links: { phone: "", tablet: "", desktop: "" } }, "links"],
    [{ links: { phone: "https://www.figma.com/design/KEY/X?node-id=1-2", tablet: "", desktop: "" } }, "phone"],
  ] as const)("flags %o on %s", (over, field) => {
    const r = validateDemoForm(form(over as Partial<DemoForm>));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors[field]).toBeTruthy();
  });

  it("only asks for the public-link confirmation when creating", () => {
    expect(validateDemoForm(form({ confirmedPublic: false, isNew: false })).ok).toBe(true);
  });

  it("flags every link when they point at different files", () => {
    const r = validateDemoForm(form({ links: { phone: PROTO("A"), tablet: PROTO("B"), desktop: PROTO("A") } }));
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["desktop", "phone", "tablet"]);
  });

  it("drops Responsive Desktop when there is no desktop link", () => {
    const r = validateDemoForm(form({ responsiveDesktop: true }));
    expect(r.ok && r.value.responsiveDesktop).toBe(false);
  });
});
