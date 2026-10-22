import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as Speech from "expo-speech";
import type { ReactElement } from "react";
import { Alert } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HomeworkTopicData, TopicMessage } from "@slay/data";

import { HomeworkScreen } from "./HomeworkScreen";
import { HomeworkTopicScreen } from "./HomeworkTopicScreen";
import { TopicChat } from "./TopicChat";

const nav = vi.hoisted(() => ({ push: vi.fn(), navigate: vi.fn() }));
const data = vi.hoisted(() => ({
  completeHomeworkVocab: vi.fn(),
  completeHomeworkGrammar: vi.fn(),
  getTopicMessages: vi.fn(),
  markTopicRead: vi.fn(),
  postTopicMessage: vi.fn(),
  deleteTopicMessage: vi.fn(),
}));
const channel = vi.hoisted(() => {
  const ch = { on: vi.fn(), subscribe: vi.fn() };
  ch.on.mockReturnValue(ch);
  ch.subscribe.mockReturnValue(ch);
  return ch;
});
const supabase = vi.hoisted(() => ({ channel: vi.fn(() => channel), removeChannel: vi.fn() }));

vi.mock("expo-router", () => ({ useRouter: () => nav }));
vi.mock("~/lib/supabase", () => ({ supabase }));
vi.mock("~/lib/imageSource", () => ({ imageSource: (url: string | null) => (url ? { uri: url } : null) }));
vi.mock("@slay/data", () => data);

beforeEach(() => {
  data.markTopicRead.mockResolvedValue({ ok: true });
  data.getTopicMessages.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

function withQueries(ui: ReactElement) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{ui}</QueryClientProvider>);
}

describe("HomeworkScreen", () => {
  const topics = [
    { id: "t2", title: "Food", description: "Fruit and veg", teacherUsername: "ms_kate", totalModules: 2, passedModules: 1, unreadCount: 12 },
    { id: "t1", title: "Animals", description: null, teacherUsername: "ms_kate", totalModules: 1, passedModules: 1, unreadCount: 0 },
    { id: "t0", title: "Draft", description: null, teacherUsername: "ms_kate", totalModules: 0, passedModules: 0, unreadCount: 0 },
  ];

  it("lists each topic with its progress, unread badge and action", () => {
    render(<HomeworkScreen groupNames={["5-A"]} topics={topics} />);

    expect(screen.getByText("5-A")).toBeTruthy();
    expect(screen.getByText("1/2 passed")).toBeTruthy();
    expect(screen.getByText("Continue")).toBeTruthy();
    // More than nine unread reads "9+", as on the web.
    expect(screen.getByLabelText("12 unread messages").textContent).toBe("9+");
    expect(screen.getByText("Completed")).toBeTruthy();
    expect(screen.getByText("Review")).toBeTruthy();
    expect(screen.getByText("Nothing to study yet")).toBeTruthy();
  });

  it("opens a topic", () => {
    render(<HomeworkScreen groupNames={["5-A"]} topics={topics} />);
    fireEvent.click(screen.getByRole("button", { name: /^Food, by ms_kate/ }));
    expect(nav.push).toHaveBeenCalledWith({ pathname: "/homework/[topicId]", params: { topicId: "t2" } });
  });

  it("says when there is no homework yet", () => {
    render(<HomeworkScreen groupNames={[]} topics={[]} />);
    expect(screen.getByText("No homework yet. Check back once your teacher assigns some.")).toBeTruthy();
  });
});

describe("HomeworkTopicScreen", () => {
  const topic: HomeworkTopicData = {
    topic: { id: "t1", title: "Animals", description: "Pets at home" },
    note: { text: "Read p. 12", linkUrl: null, imageUrl: null },
    currentUserId: "u1",
    messages: [],
    vocab: {
      words: [
        { id: "w1", word: "cat", transcription: "/kæt/", translation: "кіт", imageUrl: null, orderIndex: 0 },
        { id: "w2", word: "dog", transcription: null, translation: "пес", imageUrl: null, orderIndex: 1 },
      ],
      tasks: [
        { id: "q1", taskType: "quiz", orderIndex: 0, content: { question: "Кіт?", options: ["cat", "dog"], correctIndex: 0 } },
      ],
      passed: false,
    },
    grammar: null,
  };

  it("shows the note and the modules the topic has", () => {
    withQueries(<HomeworkTopicScreen {...topic} />);
    expect(screen.getByText("Read p. 12")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Learn the Words, 2 words + test" })).toBeTruthy();
    expect(screen.queryByText("Learn the Grammar")).toBeNull();
  });

  it("runs the words, then the test, and records a first pass with its XP", async () => {
    data.completeHomeworkVocab.mockResolvedValue({ ok: true, xpEarned: 20, alreadyPassed: false });
    withQueries(<HomeworkTopicScreen {...topic} />);

    fireEvent.click(screen.getByRole("button", { name: /^Learn the Words/ }));
    expect(screen.getByText("2 words to study, then a 1-task test.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(screen.getByText("Word 1 of 2")).toBeTruthy();
    expect(screen.getByText("/kæt/")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Listen to cat" }));
    expect(Speech.speak).toHaveBeenCalledWith("cat", expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Test" }));

    expect(screen.getByText("Word Test")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "cat" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    expect(screen.getByText("Words passed!")).toBeTruthy();
    expect(await screen.findByLabelText("Earned 20 XP")).toBeTruthy();
    expect(data.completeHomeworkVocab).toHaveBeenCalledWith(supabase, "t1");

    fireEvent.click(screen.getByRole("button", { name: "Back to Topic" }));
    expect(screen.getByText("Pets at home")).toBeTruthy();
  });

  it("says when saving the pass failed, and retries", async () => {
    data.completeHomeworkVocab.mockResolvedValueOnce({ ok: false, error: "Network down" }).mockResolvedValue({ ok: true, xpEarned: 0, alreadyPassed: true });
    withQueries(<HomeworkTopicScreen {...topic} vocab={{ ...topic.vocab!, tasks: [] }} />);

    fireEvent.click(screen.getByRole("button", { name: /^Learn the Words/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // No test: the last card finishes.
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Network down");
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(data.completeHomeworkVocab).toHaveBeenCalledTimes(2);
  });

  it("offers the way back on a topic with nothing to study", () => {
    withQueries(<HomeworkTopicScreen {...topic} vocab={null} />);
    expect(screen.getByText("This topic has nothing to study yet.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to Homework" }));
    expect(nav.navigate).toHaveBeenCalledWith("/homework");
  });
});

describe("TopicChat", () => {
  const messages: TopicMessage[] = [
    { id: "m1", authorId: "t9", authorUsername: "ms_kate", authorIsTeacher: true, body: "Questions?", createdAt: "2026-10-22T10:00:00Z" },
    { id: "m2", authorId: "u1", authorUsername: "sam", authorIsTeacher: false, body: "Is it cat?", createdAt: "2026-10-22T10:01:00Z" },
  ];

  it("marks the thread read on open and listens for changes to this topic only", async () => {
    const { unmount } = render(<TopicChat topicId="t1" currentUserId="u1" initialMessages={messages} />);

    expect(data.markTopicRead).toHaveBeenCalledWith(supabase, "t1");
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ table: "homework_topic_messages", filter: "topic_id=eq.t1" }),
      expect.any(Function),
    );

    // A change refetches the thread and marks it read again.
    data.getTopicMessages.mockResolvedValue([...messages, { ...messages[0], id: "m3", body: "Yes!" }]);
    await act(async () => channel.on.mock.calls[0][2]());
    expect(await screen.findByText("Yes!")).toBeTruthy();
    expect(data.markTopicRead).toHaveBeenCalledTimes(2);

    unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });

  it("labels the teacher and the student's own messages", () => {
    render(<TopicChat topicId="t1" currentUserId="u1" initialMessages={messages} />);
    expect(screen.getByText("Teacher")).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("ms_kate")).toBeTruthy();
  });

  it("sends a message and refetches", async () => {
    data.postTopicMessage.mockResolvedValue({ ok: true, id: "m3" });
    render(<TopicChat topicId="t1" currentUserId="u1" initialMessages={[]} />);
    expect(screen.getByText(/No messages yet/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "  Hello  " } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send" })));

    expect(data.postTopicMessage).toHaveBeenCalledWith(supabase, "t1", "Hello");
    expect(data.getTopicMessages).toHaveBeenCalledWith(supabase, "t1");
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("");
  });

  it("shows why a message didn't send", async () => {
    data.postTopicMessage.mockResolvedValue({ ok: false, error: "You can't post here." });
    render(<TopicChat topicId="t1" currentUserId="u1" initialMessages={[]} />);
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hi" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send" })));
    expect(screen.getByRole("alert").textContent).toBe("You can't post here.");
  });

  it("deletes the student's own message after a confirmation", async () => {
    data.deleteTopicMessage.mockResolvedValue({ ok: true });
    vi.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => buttons?.[1]?.onPress?.());
    render(<TopicChat topicId="t1" currentUserId="u1" initialMessages={messages} />);

    // Only the student's own message offers it.
    expect(screen.queryByRole("button", { name: "ms_kate: Questions?" })).toBeNull();
    // Hold the press past react-native-web's 500ms long-press delay.
    vi.useFakeTimers();
    const mine = screen.getByRole("button", { name: "You: Is it cat?" });
    fireEvent.mouseDown(mine, { button: 0 });
    act(() => vi.advanceTimersByTime(600));
    fireEvent.mouseUp(mine, { button: 0 });
    vi.useRealTimers();
    await waitFor(() => expect(data.deleteTopicMessage).toHaveBeenCalledWith(supabase, "m2"));
  });
});
