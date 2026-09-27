import { expect, it } from "vitest";
import { safeNext } from "./safe-next";

it.each([
  ["/app/new", "/app/new"],
  ["/app/demos/1?x=1", "/app/demos/1?x=1"],
  [null, "/app"],
  ["", "/app"],
  ["https://evil.com", "/app"],
  ["//evil.com", "/app"],
  ["/\\evil.com", "/app"],
  ["app", "/app"],
])("safeNext(%s) → %s", (input, out) => expect(safeNext(input)).toBe(out));
