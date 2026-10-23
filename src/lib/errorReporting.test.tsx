// A .tsx test so it runs in the React Native project, where `__DEV__` is defined.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function load() {
  vi.resetModules();
  return import("./errorReporting");
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as { ErrorUtils?: unknown }).ErrorUtils;
});

describe("reportError", () => {
  it("hands the error to the installed crash service, with where it happened", async () => {
    const { reportError, setErrorReporter } = await load();
    const reporter = vi.fn();
    setErrorReporter(reporter);
    const error = new Error("boom");
    reportError(error, { where: "student" });
    expect(reporter).toHaveBeenCalledWith(error, { where: "student" });
  });

  it("wraps a thrown non-Error so the service always gets an Error", async () => {
    const { reportError, setErrorReporter } = await load();
    const reporter = vi.fn();
    setErrorReporter(reporter);
    reportError("plain string", { where: "root" });
    expect(reporter.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(reporter.mock.calls[0][0].message).toBe("plain string");
  });

  it("never throws, even when the reporter does or none is installed", async () => {
    const { reportError, setErrorReporter } = await load();
    expect(() => reportError(new Error("x"), { where: "root" })).not.toThrow();
    setErrorReporter(() => {
      throw new Error("reporter down");
    });
    expect(() => reportError(new Error("x"), { where: "root" })).not.toThrow();
  });
});

describe("installGlobalErrorHandler", () => {
  it("reports uncaught errors, then lets React Native handle them as before", async () => {
    const previous = vi.fn();
    let handler: ((error: Error, isFatal?: boolean) => void) | undefined;
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = {
      getGlobalHandler: () => previous,
      setGlobalHandler: (next: typeof handler) => {
        handler = next;
      },
    };
    const { installGlobalErrorHandler, setErrorReporter } = await load();
    const reporter = vi.fn();
    setErrorReporter(reporter);
    installGlobalErrorHandler();
    installGlobalErrorHandler();

    const error = new Error("uncaught");
    handler?.(error, true);
    expect(reporter).toHaveBeenCalledWith(error, { where: "global", fatal: true });
    expect(previous).toHaveBeenCalledWith(error, true);
    expect(reporter).toHaveBeenCalledTimes(1);
  });
});
