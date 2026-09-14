import { describe, expect, it } from "vitest";

import { pluralEn, pluralSlavic } from "./plural";

describe("pluralEn", () => {
  it("uses the singular only for exactly one", () => {
    expect(pluralEn(1, "word", "words")).toBe("word");
    expect(pluralEn(0, "word", "words")).toBe("words");
    expect(pluralEn(21, "word", "words")).toBe("words");
  });
});

describe("pluralSlavic", () => {
  const forms = (n: number) => pluralSlavic(n, "слово", "слова", "слів");

  it("picks the singular for 1, 21, 101", () => {
    expect(forms(1)).toBe("слово");
    expect(forms(21)).toBe("слово");
    expect(forms(101)).toBe("слово");
  });

  it("picks the paucal for 2-4 and 22-24", () => {
    expect(forms(2)).toBe("слова");
    expect(forms(4)).toBe("слова");
    expect(forms(23)).toBe("слова");
  });

  it("picks the plural for 0, 5-20 and the teens", () => {
    expect(forms(0)).toBe("слів");
    expect(forms(5)).toBe("слів");
    expect(forms(11)).toBe("слів");
    expect(forms(12)).toBe("слів");
    expect(forms(14)).toBe("слів");
    expect(forms(20)).toBe("слів");
  });
});
