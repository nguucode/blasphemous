import { describe, expect, it } from "vitest";
import { isSlugFormat, isReservedSlug } from "./slug";

describe("slug rules (spec 7.3)", () => {
  it.each(["abc", "acme-app", "a1-b2", "x".repeat(48)])("accepts %s", (s) => expect(isSlugFormat(s)).toBe(true));
  it.each(["ab", "x".repeat(49), "-acme", "acme-", "Acme", "acme app", "acme_app", "tiếng"])("rejects %s", (s) =>
    expect(isSlugFormat(s)).toBe(false),
  );
  it.each(["app", "try", "login", "privacy", "_next", "_anything"])("reserves %s", (s) => expect(isReservedSlug(s)).toBe(true));
  it("does not reserve ordinary slugs", () => expect(isReservedSlug("acme-app")).toBe(false));
});

