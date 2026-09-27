import { describe, expect, it } from "vitest";
import { routeRequest } from "./host-routing";
import { isSlugFormat, isReservedSlug } from "./slug";

describe("slug rules (spec 7.3)", () => {
  it.each(["abc", "acme-app", "a1-b2", "x".repeat(48)])("accepts %s", (s) => expect(isSlugFormat(s)).toBe(true));
  it.each(["ab", "x".repeat(49), "-acme", "acme-", "Acme", "acme app", "acme_app", "tiếng"])("rejects %s", (s) =>
    expect(isSlugFormat(s)).toBe(false),
  );
  it.each(["app", "try", "login", "privacy", "_next", "_anything"])("reserves %s", (s) => expect(isReservedSlug(s)).toBe(true));
  it("does not reserve ordinary slugs", () => expect(isReservedSlug("acme-app")).toBe(false));
});

describe("routeRequest (spec 6)", () => {
  const hosts = { appHost: "blasphemous.app", demoHost: "bls.to" };

  it("passes everything through when hosts are not configured (local dev)", () => {
    expect(routeRequest({ host: "localhost:3000", pathname: "/acme-app" })).toEqual({ type: "next" });
  });

  it("serves slugs on the demo host", () => {
    expect(routeRequest({ ...hosts, host: "bls.to", pathname: "/acme-app" })).toEqual({ type: "next" });
  });

  it("sends the bare demo host to the homepage", () => {
    expect(routeRequest({ ...hosts, host: "bls.to", pathname: "/" })).toEqual({ type: "redirect", url: "https://blasphemous.app/" });
  });

  it("sends app routes typed on the demo host to the app host", () => {
    expect(routeRequest({ ...hosts, host: "bls.to", pathname: "/try" })).toEqual({ type: "redirect", url: "https://blasphemous.app/try" });
    expect(routeRequest({ ...hosts, host: "bls.to", pathname: "/app/demos/1" })).toEqual({
      type: "redirect",
      url: "https://blasphemous.app/app/demos/1",
    });
  });

  it("moves a slug typed on the app host to the demo host", () => {
    expect(routeRequest({ ...hosts, host: "blasphemous.app", pathname: "/acme-app" })).toEqual({
      type: "redirect",
      url: "https://bls.to/acme-app",
    });
  });

  it("leaves app routes on the app host alone", () => {
    for (const pathname of ["/", "/try", "/app", "/app/new", "/privacy"]) {
      expect(routeRequest({ ...hosts, host: "blasphemous.app", pathname })).toEqual({ type: "next" });
    }
  });

  it("ignores the port when matching hosts", () => {
    expect(routeRequest({ appHost: "app.localhost", demoHost: "demo.localhost", host: "demo.localhost:3000", pathname: "/" })).toEqual({
      type: "redirect",
      url: "https://app.localhost/",
    });
  });
});
