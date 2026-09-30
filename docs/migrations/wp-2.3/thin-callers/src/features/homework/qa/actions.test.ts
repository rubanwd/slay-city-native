import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createMockSupabase } from "@/lib/testSupabase";

import { deleteTopicMessage, postTopicMessage } from "./actions";

describe("postTopicMessage", () => {
  it("posts through post_topic_message, which sets author_id and created_at in SQL", async () => {
    const { client, rpcCalls } = createMockSupabase({ user: { id: "student-1" } });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await postTopicMessage("topic-1", "  When is this due?  ");

    expect(result).toEqual({ ok: true });
    expect(rpcCalls).toEqual([
      { name: "post_topic_message", args: { p_topic_id: "topic-1", p_body: "When is this due?" } },
    ]);
  });
});

describe("deleteTopicMessage", () => {
  it("surfaces the RPC's authorization failure cleanly instead of the old silent no-op", async () => {
    // Before WP-2.3, a delete the caller wasn't allowed to perform relied
    // purely on RLS and returned `{ ok: true }` having changed nothing.
    // delete_topic_message raises 42501 instead — this is the behaviour change
    // the migration's comment calls out, verified here rather than assumed.
    const { client } = createMockSupabase({
      user: { id: "student-2" },
      rpc: {
        delete_topic_message: {
          error: { message: "That message is not yours to delete.", code: "42501" },
        },
      },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await deleteTopicMessage("message-1");

    expect(result).toEqual({ ok: false, error: "That message is not yours to delete." });
  });
});
