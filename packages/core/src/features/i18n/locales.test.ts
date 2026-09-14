import { describe, expect, it } from "vitest";

import { isLocale, matchLocale, STUDENT_DEFAULT_LOCALE, studentLocaleFrom } from "./locales";

describe("isLocale", () => {
  it("accepts the three supported languages", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("uk")).toBe(true);
    expect(isLocale("ru")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isLocale("de")).toBe(false);
    expect(isLocale("uk-UA")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});

describe("matchLocale", () => {
  it("returns null when there is no header", () => {
    expect(matchLocale(null)).toBeNull();
    expect(matchLocale(undefined)).toBeNull();
    expect(matchLocale("")).toBeNull();
  });

  it("matches on the primary subtag, ignoring region and case", () => {
    expect(matchLocale("uk-UA")).toBe("uk");
    expect(matchLocale("RU-ru")).toBe("ru");
    expect(matchLocale("en-GB,en;q=0.9")).toBe("en");
  });

  it("honours q-values rather than header order", () => {
    expect(matchLocale("de;q=0.9,ru;q=0.4,uk;q=0.8")).toBe("uk");
    expect(matchLocale("en;q=0.2,ru;q=0.7")).toBe("ru");
  });

  it("skips languages we do not speak", () => {
    expect(matchLocale("de-DE,de;q=0.9,pl;q=0.8")).toBeNull();
    expect(matchLocale("de-DE,de;q=0.9,ru;q=0.1")).toBe("ru");
  });

  it("ignores entries explicitly refused with q=0", () => {
    expect(matchLocale("ru;q=0,uk;q=0.5")).toBe("uk");
  });

  it("treats a malformed q-value as refused", () => {
    expect(matchLocale("ru;q=abc,en;q=0.3")).toBe("en");
  });
});

describe("studentLocaleFrom", () => {
  it("starts a student off in English, whatever the browser asks for", () => {
    expect(STUDENT_DEFAULT_LOCALE).toBe("en");
    expect(studentLocaleFrom(undefined)).toBe("en");
    expect(studentLocaleFrom(null)).toBe("en");
    expect(studentLocaleFrom("")).toBe("en");
  });

  it("honours a language the student picked", () => {
    expect(studentLocaleFrom("en")).toBe("en");
    expect(studentLocaleFrom("ru")).toBe("ru");
    expect(studentLocaleFrom("uk")).toBe("uk");
  });

  it("falls back rather than trusting an unsupported cookie value", () => {
    expect(studentLocaleFrom("de")).toBe(STUDENT_DEFAULT_LOCALE);
    expect(studentLocaleFrom("uk-UA")).toBe(STUDENT_DEFAULT_LOCALE);
    expect(studentLocaleFrom(42)).toBe(STUDENT_DEFAULT_LOCALE);
  });
});
