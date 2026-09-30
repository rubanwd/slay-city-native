import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    // Next.js implements redirect() by throwing; callers never see it return.
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createMockSupabase } from "@/lib/testSupabase";

import { createProfile } from "./actions";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("createProfile", () => {
  it("creates the profile and stats row in one create_my_profile call, then redirects", async () => {
    const { client, rpcCalls } = createMockSupabase({
      user: { id: "user-1" },
      rpc: { available_knowledge_levels: { data: ["elementary"] } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    await expect(
      createProfile({}, formData({ username: "Anna Maria", age: "9", level: "elementary" }))
    ).rejects.toThrow("NEXT_REDIRECT");

    const createCall = rpcCalls.find((c) => c.name === "create_my_profile");
    expect(createCall).toEqual({
      name: "create_my_profile",
      args: { p_username: "Anna Maria", p_age: 9, p_level: "elementary" },
    });
    // The old two direct inserts (profiles, then user_stats) no longer happen.
    expect(client.from).not.toHaveBeenCalledWith("profiles");
    expect(client.from).not.toHaveBeenCalledWith("user_stats");
  });

  it("rejects an expired session before ever calling the RPC", async () => {
    const { client, rpcCalls } = createMockSupabase({ user: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await createProfile(
      {},
      formData({ username: "Anna Maria", age: "9", level: "elementary" })
    );

    expect(result).toEqual({ error: "Your session expired. Please log in again." });
    expect(rpcCalls).toHaveLength(0);
  });
});
