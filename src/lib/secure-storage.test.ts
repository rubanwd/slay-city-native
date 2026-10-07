import * as SecureStore from "expo-secure-store";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { secureStorage } from "./secure-storage";

vi.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: vi.fn((key: string) => Promise.resolve(store.has(key) ? store.get(key)! : null)),
    setItemAsync: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});

function rawStore(): Map<string, string> {
  return (SecureStore as unknown as { __store: Map<string, string> }).__store;
}

beforeEach(() => {
  rawStore().clear();
  vi.clearAllMocks();
});

describe("secureStorage", () => {
  it("round-trips a small value through a single key", async () => {
    await secureStorage.setItem("session", "short-value");

    expect(await secureStorage.getItem("session")).toBe("short-value");
    expect(rawStore().size).toBe(1);
  });

  it("returns null for a key that was never set", async () => {
    expect(await secureStorage.getItem("missing")).toBeNull();
  });

  it("chunks a value larger than the per-item limit across several keys", async () => {
    const large = "x".repeat(5000);

    await secureStorage.setItem("session", large);

    expect(rawStore().size).toBeGreaterThan(1);
    expect(await secureStorage.getItem("session")).toBe(large);
  });

  it("shrinks from a chunked value back to a single key and drops the orphaned chunks", async () => {
    await secureStorage.setItem("session", "x".repeat(5000));
    const chunkedCount = rawStore().size;
    expect(chunkedCount).toBeGreaterThan(1);

    await secureStorage.setItem("session", "short-again");

    expect(await secureStorage.getItem("session")).toBe("short-again");
    expect(rawStore().size).toBe(1);
  });

  it("shrinks from more chunks to fewer chunks and drops the orphaned tail", async () => {
    await secureStorage.setItem("session", "x".repeat(10000));
    await secureStorage.setItem("session", "y".repeat(4000));

    expect(await secureStorage.getItem("session")).toBe("y".repeat(4000));
  });

  it("removes every chunk when deleting a chunked value", async () => {
    await secureStorage.setItem("session", "x".repeat(5000));
    expect(rawStore().size).toBeGreaterThan(1);

    await secureStorage.removeItem("session");

    expect(rawStore().size).toBe(0);
    expect(await secureStorage.getItem("session")).toBeNull();
  });

  it("removes a non-chunked value cleanly", async () => {
    await secureStorage.setItem("session", "short-value");

    await secureStorage.removeItem("session");

    expect(rawStore().size).toBe(0);
  });
});
