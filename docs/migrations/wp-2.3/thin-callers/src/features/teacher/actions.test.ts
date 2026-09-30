import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./requireTeacher", () => ({ requireTeacher: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createMockSupabase } from "@/lib/testSupabase";

import { requireTeacher } from "./requireTeacher";
import { createHomeworkTopic, updateHomeworkTopic } from "./actions";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("createHomeworkTopic", () => {
  it("calls create_homework_topic and reports the same success message as the direct insert", async () => {
    const { client, rpcCalls } = createMockSupabase();
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(requireTeacher).mockResolvedValue({ ok: true, userId: "teacher-1" });

    const result = await createHomeworkTopic(
      {},
      formData({ group_id: "group-1", title: "Unit 1", description: "", order_index: "3" })
    );

    expect(result).toEqual({ success: 'Topic "Unit 1" added.' });
    expect(rpcCalls).toEqual([
      {
        name: "create_homework_topic",
        args: {
          p_group_id: "group-1",
          p_title: "Unit 1",
          p_description: null,
          p_order_index: 3,
          p_note_link_url: null,
          p_note_image_url: null,
        },
      },
    ]);
  });

  it("rejects a non-teacher before ever calling the RPC — no direct write path survives", async () => {
    const { client, rpcCalls } = createMockSupabase();
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(requireTeacher).mockResolvedValue({
      ok: false,
      error: "Only teachers can manage homework.",
    });

    const result = await createHomeworkTopic({}, formData({ group_id: "group-1", title: "Unit 1" }));

    expect(result).toEqual({ error: "Only teachers can manage homework." });
    expect(rpcCalls).toHaveLength(0);
  });
});

describe("updateHomeworkTopic", () => {
  it("surfaces the RPC's ownership rejection cleanly, without leaking a raw Postgres error", async () => {
    // requireTeacher passes (the caller IS a teacher) but the topic belongs to
    // a different teacher's group — update_homework_topic's can_author_topic
    // check is what actually rejects it, the same case the negative-test
    // harness covers as "AC4".
    const { client } = createMockSupabase({
      rpc: {
        update_homework_topic: {
          error: { message: "Topic not found or not yours to edit.", code: "42501" },
        },
      },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(requireTeacher).mockResolvedValue({ ok: true, userId: "teacher-2" });

    const result = await updateHomeworkTopic(
      {},
      formData({ id: "topic-1", group_id: "group-1", title: "Renamed" })
    );

    expect(result).toEqual({ error: "Topic not found or not yours to edit." });
  });
});
