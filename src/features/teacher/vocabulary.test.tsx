import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { Alert } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TestPreviewRunner } from "./TestPreviewRunner";
import { VocabularyManager, type VocabularyManagerProps } from "./VocabularyManager";

const data = vi.hoisted(() => ({
  generateVocabularyDraft: vi.fn(),
  generateWordImage: vi.fn(),
  publishVocabulary: vi.fn(),
  clearVocabulary: vi.fn(),
  copyVocabularyFromTopic: vi.fn(),
}));
const upload = vi.hoisted(() => ({ pickAndUploadImage: vi.fn() }));
const supabase = vi.hoisted(() => ({}));

vi.mock("@slay/data", () => data);
vi.mock("~/lib/supabase", () => ({ supabase }));
vi.mock("~/lib/imageSource", () => ({ imageSource: (url: string | null) => (url ? { uri: url } : null) }));
vi.mock("./pickAndUpload", () => upload);
vi.mock("~/features/mission", () => ({
  HowToPlayButton: () => null,
  TaskRunner: ({ taskType, onComplete, actionLabel }: { taskType: string; onComplete: () => void; actionLabel: string }) => (
    <button onClick={onComplete}>{`${taskType} → ${actionLabel}`}</button>
  ),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function withQueries(ui: ReactElement) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}

const base: VocabularyManagerProps = {
  topicId: "t1",
  groupId: "g1",
  initialWords: [
    { word: "cat", transcription: "/kæt/", translation: "кіт", imageUrl: null },
    { word: "dog", transcription: null, translation: "пес", imageUrl: null },
  ],
  initialTaskCount: 2,
  reuseSources: [{ topicId: "t9", title: "Pets", groupName: "6-B", wordCount: 3, pointCount: 0 }],
};

describe("VocabularyManager", () => {
  it("starts published, and only offers Publish once something changes", async () => {
    data.publishVocabulary.mockResolvedValue({ ok: true });
    withQueries(<VocabularyManager {...base} />);

    expect(screen.getByText("Test preview (2 tasks)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Published" }).getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "+ Add word manually" }));
    fireEvent.change(screen.getByLabelText("Word 3"), { target: { value: "fish" } });
    fireEvent.change(screen.getByLabelText("Translation 3"), { target: { value: "риба" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Publish to Topic" })));

    expect(data.publishVocabulary).toHaveBeenCalledWith(supabase, {
      topicId: "t1",
      words: expect.arrayContaining([expect.objectContaining({ word: "fish", translation: "риба" })]),
      taskCount: 2,
      testSeed: 0,
    });
    expect(await screen.findByText("Vocabulary published to this topic.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Published" })).toBeTruthy();
  });

  it("regenerating the test is a change worth publishing", () => {
    withQueries(<VocabularyManager {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "Regenerate test" }));
    expect(screen.getByRole("button", { name: "Publish to Topic" })).toBeTruthy();
  });

  it("falls back to manual authoring with a readable message when AI is unavailable", async () => {
    data.generateVocabularyDraft.mockResolvedValue({ ok: false, error: "Could not reach the AI model. Check your connection." });
    withQueries(<VocabularyManager {...base} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Regenerate Words with AI" })));
    expect(screen.getByRole("alert").textContent).toBe("Could not reach the AI model. Check your connection.");
    // The draft is untouched.
    expect((screen.getByLabelText("Word 1") as HTMLInputElement).value).toBe("cat");
  });

  it("replaces the list with an AI draft and illustrates every word in the background", async () => {
    data.generateVocabularyDraft.mockResolvedValue({
      ok: true,
      words: [
        { word: "sun", transcription: null, translation: "сонце", exampleSentence: null, imagePrompt: "the sun" },
        { word: "rain", transcription: null, translation: "дощ", exampleSentence: null, imagePrompt: "rain" },
      ],
    });
    data.generateWordImage.mockImplementation(async (_db, { word }: { word: string }) => ({ ok: true, imageUrl: `https://img/${word}` }));
    withQueries(<VocabularyManager {...base} />);

    fireEvent.change(screen.getByLabelText("Words"), { target: { value: "2" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Regenerate Words with AI" })));

    expect(data.generateVocabularyDraft).toHaveBeenCalledWith(supabase, { topicId: "t1", extraInstructions: null, wordCount: 2 });
    expect((screen.getByLabelText("Word 1") as HTMLInputElement).value).toBe("sun");
    await waitFor(() => expect(screen.getByLabelText("sun")).toBeTruthy());
    expect(data.generateWordImage).toHaveBeenCalledWith(supabase, { topicId: "t1", word: "rain", imagePrompt: "rain" });
  });

  it("copies another topic's words into the draft", async () => {
    data.copyVocabularyFromTopic.mockResolvedValue({ ok: true, words: [{ word: "parrot", transcription: null, translation: "папуга", imageUrl: null }], taskCount: 0 });
    withQueries(<VocabularyManager {...base} />);
    fireEvent.click(screen.getByRole("radio", { name: "Pets — 6-B · 3 words" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy vocabulary here" })));
    expect(data.copyVocabularyFromTopic).toHaveBeenCalledWith(supabase, "t9");
    expect((screen.getByLabelText("Word 1") as HTMLInputElement).value).toBe("parrot");
    expect(screen.getByText("Copied 1 words. Review and publish.")).toBeTruthy();
  });

  it("uploads a picture for one word", async () => {
    upload.pickAndUploadImage.mockResolvedValue({ kind: "uploaded", url: "https://img/cat.jpg" });
    withQueries(<VocabularyManager {...base} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Upload a picture for cat" })));
    expect(upload.pickAndUploadImage).toHaveBeenCalledWith("homework");
    expect(screen.getByLabelText("cat")).toBeTruthy();
  });

  it("clears the topic's vocabulary after a confirmation", async () => {
    data.clearVocabulary.mockResolvedValue({ ok: true });
    const alert = vi.spyOn(Alert, "alert").mockImplementation(() => {});
    withQueries(<VocabularyManager {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await act(async () => alert.mock.calls[0][2]![1].onPress?.());
    expect(data.clearVocabulary).toHaveBeenCalledWith(supabase, "t1");
    expect(screen.queryByLabelText("Word 1")).toBeNull();
  });
});

describe("TestPreviewRunner", () => {
  it("plays every task, then offers a restart; nothing is saved", () => {
    render(
      <TestPreviewRunner
        open
        onClose={vi.fn()}
        title="Preview — Vocabulary test"
        tasks={[
          { taskType: "quiz", content: {} },
          { taskType: "matching", content: {} },
        ]}
      />,
    );
    expect(screen.getByText("Task 1 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "quiz → Next" }));
    fireEvent.click(screen.getByRole("button", { name: "matching → Finish" }));
    expect(screen.getByText("You went through the whole test.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(screen.getByText("Task 1 of 2")).toBeTruthy();
  });
});
