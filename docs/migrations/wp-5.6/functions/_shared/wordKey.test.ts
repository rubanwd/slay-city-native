import { describe, expect, it } from "vitest";

import { normalizeWordKey } from "./wordKey.ts";

describe("normalizeWordKey", () => {
  it("lowercases and trims", () => {
    expect(normalizeWordKey(" Cat ")).toBe("cat");
  });

  it("collapses inner whitespace", () => {
    expect(normalizeWordKey("ice   cream")).toBe("ice cream");
  });

  it("gives the same key for case and spacing variants", () => {
    expect(normalizeWordKey("Cat")).toBe(normalizeWordKey("cat"));
    expect(normalizeWordKey(" cat")).toBe(normalizeWordKey("cat "));
  });
});
