import { describe, expect, it } from "vitest";
import { assertLocalDatabase, fakeAuthEnabled } from "./e2e-guard";

describe("fakeAuthEnabled", () => {
  it("is on only with E2E_FAKE_AUTH=1 outside production", () => {
    expect(fakeAuthEnabled({ E2E_FAKE_AUTH: "1", NODE_ENV: "development" })).toBe(true);
    expect(fakeAuthEnabled({ E2E_FAKE_AUTH: "1", NODE_ENV: "test" })).toBe(true);
  });

  it("can never be on in a production build", () => {
    expect(fakeAuthEnabled({ E2E_FAKE_AUTH: "1", NODE_ENV: "production" })).toBe(false);
  });

  it.each([undefined, "", "0", "true", "yes"])("is off for E2E_FAKE_AUTH=%s", (value) => {
    expect(fakeAuthEnabled({ E2E_FAKE_AUTH: value, NODE_ENV: "development" })).toBe(false);
  });
});

describe("assertLocalDatabase", () => {
  it.each(["postgres://postgres@localhost:5433/postgres", "postgresql://u:p@127.0.0.1:5433/db"])("accepts %s", (url) => {
    expect(() => assertLocalDatabase(url)).not.toThrow();
  });

  it.each([
    undefined,
    "postgresql://postgres.abc:pw@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres",
    "postgres://localhost.evil.com/db",
    "not a url",
  ])("refuses %s", (url) => {
    expect(() => assertLocalDatabase(url)).toThrow();
  });
});
