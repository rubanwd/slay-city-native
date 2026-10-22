import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { Alert } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GrammarManager, type GrammarManagerProps } from "./GrammarManager";

const data = vi.hoisted(() => ({
  generateGrammarDraft: vi.fn(),
  publishGrammar: vi.fn(),
  clearGrammar: vi.fn(),
  copyGrammarFromTopic: vi.fn(),
}));
const supabase = vi.hoisted(() => ({}));

vi.mock("@slay/data", () => data);
vi.mock("~/lib/supabase", () => ({ supabase }));
vi.mock("~/features/mission", () => ({ HowToPlayButton: () => null, TaskRunner: () => null }));

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function withQueries(ui: ReactElement) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}

const quiz = (q: string) => ({ taskType: "quiz" as const, content: { question: q, options: ["a", "b"], correctIndex: 0 } });

const base: GrammarManagerProps = {
  topicId: "t1",
  groupId: "g1",
  initialPoints: [{ title: "Plurals", explanation: "Add -s to most nouns.", example: "two cats" }],
  initialTasks: [quiz("One cat, two ___?")],
  reuseSources: [{ topicId: "t9", title: "Verbs", groupName: "6-B", wordCount: 0, pointCount: 2 }],
};

describe("GrammarManager", () => {
  it("publishes edited rules with the test, once something changed", async () => {
    data.publishGrammar.mockResolvedValue({ ok: true });
    withQueries(<GrammarManager {...base} />);
    expect(screen.getByText("Test preview (1 task)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Published" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Rule 1 example"), { target: { value: "three dogs" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Publish to Topic" })));

    expect(data.publishGrammar).toHaveBeenCalledWith(supabase, {
      topicId: "t1",
      points: [{ title: "Plurals", explanation: "Add -s to most nouns.", example: "three dogs" }],
      tasks: base.initialTasks,
    });
    expect(await screen.findByText("Grammar published to this topic.")).toBeTruthy();
  });

  it("regenerates only the test, keeping the edited rules", async () => {
    data.generateGrammarDraft.mockResolvedValue({ ok: true, points: [{ title: "Other", explanation: "x", example: null }], tasks: [quiz("a"), quiz("b")] });
    withQueries(<GrammarManager {...base} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Regenerate test" })));
    expect(screen.getByText("Test preview (2 tasks)")).toBeTruthy();
    expect((screen.getByLabelText("Rule 1 title") as HTMLInputElement).value).toBe("Plurals");
  });

  it("replaces rules and test with an AI draft, or says why it couldn't", async () => {
    data.generateGrammarDraft
      .mockResolvedValueOnce({ ok: false, error: "Could not reach the AI model. Check your connection." })
      .mockResolvedValueOnce({ ok: true, points: [{ title: "Past Simple", explanation: "-ed", example: null }], tasks: [] });
    withQueries(<GrammarManager {...base} />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Regenerate Grammar with AI" })));
    expect(screen.getByRole("alert").textContent).toBe("Could not reach the AI model. Check your connection.");

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Regenerate Grammar with AI" })));
    expect((screen.getByLabelText("Rule 1 title") as HTMLInputElement).value).toBe("Past Simple");
    expect(screen.getByText("No test yet — generate with AI or set test tasks above.")).toBeTruthy();
  });

  it("copies another topic's rules and test", async () => {
    data.copyGrammarFromTopic.mockResolvedValue({ ok: true, points: [{ title: "Be", explanation: "am/is/are", example: null }], tasks: [quiz("I ___ happy")] });
    withQueries(<GrammarManager {...base} />);
    fireEvent.click(screen.getByRole("radio", { name: "Verbs — 6-B · 2 rules" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy grammar here" })));
    expect((screen.getByLabelText("Rule 1 title") as HTMLInputElement).value).toBe("Be");
    expect(screen.getByText("Copied 1 grammar points and 1 test tasks. Review and publish.")).toBeTruthy();
  });

  it("adds and removes rules by hand", () => {
    withQueries(<GrammarManager {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add point manually" }));
    expect(screen.getByLabelText("Rule 2 title")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove Plurals" }));
    expect(screen.queryByLabelText("Rule 2 title")).toBeNull();
  });

  it("clears the topic's grammar after a confirmation", async () => {
    data.clearGrammar.mockResolvedValue({ ok: true });
    const alert = vi.spyOn(Alert, "alert").mockImplementation(() => {});
    withQueries(<GrammarManager {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await act(async () => alert.mock.calls[0][2]![1].onPress?.());
    expect(data.clearGrammar).toHaveBeenCalledWith(supabase, "t1");
    expect(screen.queryByLabelText("Rule 1 title")).toBeNull();
  });
});
