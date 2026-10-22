import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { deviceLocale, LocaleProvider, useLocalePreference, useStudentLocale } from "./locale";

const storage = vi.hoisted(() => ({
  readSecureItem: vi.fn(),
  writeSecureItem: vi.fn(async () => {}),
  deleteSecureItem: vi.fn(async () => {}),
}));
vi.mock("./secure-storage", () => storage);

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const captured: { preference?: ReturnType<typeof useLocalePreference> } = {};
function Probe() {
  const preference = useLocalePreference();
  const locale = useStudentLocale();
  useEffect(() => {
    captured.preference = preference;
  });
  return <span>{`${locale}:${preference.ready ? "ready" : "loading"}`}</span>;
}
const choose = (value: Parameters<ReturnType<typeof useLocalePreference>["choose"]>[0]) => captured.preference!.choose(value);

describe("LocaleProvider", () => {
  it("restores the stored choice", async () => {
    storage.readSecureItem.mockResolvedValue("ru");
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    expect(await screen.findByText("ru:ready")).toBeTruthy();
    expect(storage.readSecureItem).toHaveBeenCalledWith("slay_locale");
  });

  it("gives a student English until they choose, then stores the choice", async () => {
    storage.readSecureItem.mockResolvedValue(null);
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    expect(await screen.findByText("en:ready")).toBeTruthy();

    await act(() => choose("uk"));
    expect(screen.getByText("uk:ready")).toBeTruthy();
    expect(storage.writeSecureItem).toHaveBeenCalledWith("slay_locale", "uk");

    await act(() => choose(null));
    expect(screen.getByText("en:ready")).toBeTruthy();
    expect(storage.deleteSecureItem).toHaveBeenCalledWith("slay_locale");
  });

  it("ignores a stored value that isn't a language we speak", async () => {
    storage.readSecureItem.mockResolvedValue("de");
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    expect(await screen.findByText("en:ready")).toBeTruthy();
  });

  it("survives storage that can't be read or written", async () => {
    storage.readSecureItem.mockRejectedValue(new Error("keychain locked"));
    storage.writeSecureItem.mockRejectedValueOnce(new Error("keychain locked"));
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    expect(await screen.findByText("en:ready")).toBeTruthy();
    await act(() => choose("ru"));
    await waitFor(() => expect(screen.getByText("ru:ready")).toBeTruthy());
  });
});

describe("deviceLocale", () => {
  const withDeviceLocale = (locale: string) =>
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({ resolvedOptions: () => ({ locale }) } as never);

  it("matches the phone's language to one we speak", () => {
    withDeviceLocale("uk-UA");
    expect(deviceLocale()).toBe("uk");
  });

  it("falls back to English for any other language", () => {
    withDeviceLocale("de-DE");
    expect(deviceLocale()).toBe("en");
  });
});
