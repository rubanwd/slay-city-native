import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as ImagePicker from "expo-image-picker";
import type { ReactElement } from "react";
import { Alert } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GroupTopicsData, TeacherTopicData } from "@slay/data";

import { GroupTopicsScreen } from "./GroupTopicsScreen";
import { ImageUploadField } from "./ImageUploadField";
import { TeacherTopicScreen } from "./TeacherTopicScreen";

const nav = vi.hoisted(() => ({ push: vi.fn(), navigate: vi.fn() }));
const data = vi.hoisted(() => ({
  createTopic: vi.fn(),
  updateTopic: vi.fn(),
  deleteHomeworkTopic: vi.fn(),
  signOut: vi.fn(),
  uploadContentImage: vi.fn(),
}));
const supabase = vi.hoisted(() => ({}));

vi.mock("expo-router", () => ({ useRouter: () => nav }));
vi.mock("@slay/data", () => data);
vi.mock("~/lib/supabase", () => ({ supabase }));
vi.mock("~/lib/imageSource", () => ({ imageSource: (url: string | null) => (url ? { uri: url } : null) }));
vi.mock("~/features/feedback", () => ({ prepareScreenshot: vi.fn(async () => ({ body: new ArrayBuffer(1), contentType: "image/jpeg", ext: "jpg" })) }));
vi.mock("~/features/homework", () => ({
  TopicChat: ({ currentUserId }: { currentUserId: string }) => <span>{`chat as ${currentUserId}`}</span>,
  UnreadBadge: ({ count }: { count: number }) => (count > 0 ? <span>{`${count} unread`}</span> : null),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function withQueries(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  return { ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>), invalidate };
}

const topic = (id: string, title: string, extra = {}) => ({
  id,
  title,
  description: null,
  orderIndex: 0,
  noteText: null,
  noteLinkUrl: null,
  noteImageUrl: null,
  wordCount: 0,
  grammarCount: 0,
  unreadCount: 0,
  ...extra,
});

const group: GroupTopicsData = {
  group: { id: "g1", name: "5-A" },
  topics: [topic("t2", "Food", { wordCount: 12, grammarCount: 1, unreadCount: 3, noteLinkUrl: "https://x.y" }), topic("t1", "Animals")],
  nextOrder: 2,
};

describe("GroupTopicsScreen", () => {
  it("lists the topics with their counts, and opens one", () => {
    withQueries(<GroupTopicsScreen {...group} />);
    expect(screen.getByText("Lesson Topics (2)")).toBeTruthy();
    expect(screen.getByText("12 words · 1 rule")).toBeTruthy();
    expect(screen.getByText("3 unread")).toBeTruthy();
    expect(screen.getByLabelText("Has extra info for students")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: /^Food\./ }));
    expect(nav.push).toHaveBeenCalledWith({ pathname: "/teacher/groups/[groupId]/topics/[topicId]", params: { groupId: "g1", topicId: "t2" } });
  });

  it("adds a topic at the next order, then confirms it", async () => {
    data.createTopic.mockResolvedValue({ ok: true, id: "t3" });
    const { invalidate } = withQueries(<GroupTopicsScreen {...group} />);

    fireEvent.click(screen.getByRole("button", { name: "Add Topic" }));
    expect(screen.getByText("A shared Q&A thread opens", { exact: false })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Topic Title"), { target: { value: "Weather" } });
    fireEvent.change(screen.getByLabelText("Link (optional)"), { target: { value: "https://weather.example" } });
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Add Topic" }).at(-1)!));

    expect(data.createTopic).toHaveBeenCalledWith(
      supabase,
      "g1",
      { title: "Weather", description: "", noteLinkUrl: "https://weather.example", noteImageUrl: "" },
      2,
    );
    expect(await screen.findByText('Topic "Weather" added.')).toBeTruthy();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["teacher-group", "g1"] });
    expect(screen.queryByLabelText("Topic Title")).toBeNull();
  });

  it("shows why a topic was refused and keeps the form open", async () => {
    data.createTopic.mockResolvedValue({ ok: false, error: "Title is required." });
    withQueries(<GroupTopicsScreen {...group} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Topic" }));
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Add Topic" }).at(-1)!));
    expect((await screen.findByRole("alert")).textContent).toBe("Title is required.");
    expect(screen.getByLabelText("Topic Title")).toBeTruthy();
  });

  it("edits a topic in place of its own values", async () => {
    data.updateTopic.mockResolvedValue({ ok: true });
    withQueries(<GroupTopicsScreen {...group} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Food" }));
    expect((screen.getByLabelText("Link (optional)") as HTMLInputElement).value).toBe("https://x.y");
    fireEvent.change(screen.getByLabelText("Topic Title"), { target: { value: "Food & drinks" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    expect(data.updateTopic).toHaveBeenCalledWith(supabase, "t2", expect.objectContaining({ title: "Food & drinks" }), 0);
  });

  it("deletes a topic only after a confirmation", async () => {
    data.deleteHomeworkTopic.mockResolvedValue({ ok: true });
    const alert = vi.spyOn(Alert, "alert").mockImplementation(() => {});
    withQueries(<GroupTopicsScreen {...group} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Animals" }));
    expect(data.deleteHomeworkTopic).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2]!;
    await act(async () => buttons[1].onPress?.());
    expect(data.deleteHomeworkTopic).toHaveBeenCalledWith(supabase, "t1");
  });

  it("invites the first topic", () => {
    withQueries(<GroupTopicsScreen {...group} topics={[]} />);
    expect(screen.getByText("No topics yet. Add the first one below.")).toBeTruthy();
  });
});

const topicData: TeacherTopicData = {
  group: { id: "g1", name: "5-A" },
  topic: { id: "t1", title: "Animals", description: "Pets", orderIndex: 0, noteText: null, noteLinkUrl: null, noteImageUrl: null },
  teacherId: "me",
  vocabWords: [{ word: "cat", transcription: "/kæt/", translation: "кіт", imageUrl: null }],
  vocabTaskCount: 4,
  grammarPoints: [],
  grammarTasks: [],
  vocabRows: [
    { studentId: "s1", username: "anna", passed: true },
    { studentId: "s2", username: "bo", passed: false },
  ],
  grammarRows: [],
  reuseSources: [],
  messages: [],
  unreadCount: 2,
};

describe("TeacherTopicScreen", () => {
  it("opens each section on demand", () => {
    withQueries(<TeacherTopicScreen {...topicData} />);
    expect(screen.queryByLabelText("Topic Title")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Topic Info/ }));
    expect((screen.getByLabelText("Topic Title") as HTMLInputElement).value).toBe("Animals");

    fireEvent.click(screen.getByRole("button", { name: /^Vocabulary Learning/ }));
    expect(screen.getByText("1 word · 4 test tasks")).toBeTruthy();
    expect(screen.getByText("/kæt/ · кіт")).toBeTruthy();
    expect(screen.getByText("Vocabulary Passed (1/2)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Grammar Learning/ }));
    expect(screen.getByText("No grammar yet.")).toBeTruthy();
  });

  it("clears the Q&A badge once the teacher opens the thread", () => {
    withQueries(<TeacherTopicScreen {...topicData} />);
    expect(screen.getByText("2 unread")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Q&A/ }));
    expect(screen.queryByText("2 unread")).toBeNull();
    expect(screen.getByText("chat as me")).toBeTruthy();
  });

  it("uses a module editor when one is given", () => {
    withQueries(<TeacherTopicScreen {...topicData} vocabularyEditor={<span>editor</span>} />);
    fireEvent.click(screen.getByRole("button", { name: /^Vocabulary Learning/ }));
    expect(screen.getByText("editor")).toBeTruthy();
    expect(screen.queryByText("1 word · 4 test tasks")).toBeNull();
  });
});

describe("ImageUploadField", () => {
  it("uploads the picked picture to the folder and hands back its URL; Remove clears it", async () => {
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({ canceled: false, assets: [{ uri: "file:///a.jpg", width: 10, height: 10 }] } as never);
    data.uploadContentImage.mockResolvedValue("https://x.supabase.co/storage/v1/object/public/content/homework/uuid.jpg");
    const onChange = vi.fn();
    const { rerender } = render(<ImageUploadField label="Image (optional)" folder="homework" value="" onChange={onChange} />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add picture" })));
    expect(data.uploadContentImage).toHaveBeenCalledWith(supabase, "homework", expect.objectContaining({ id: "uuid", ext: "jpg" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("https://x.supabase.co/storage/v1/object/public/content/homework/uuid.jpg"));

    rerender(<ImageUploadField label="Image (optional)" folder="homework" value="https://img" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Replace picture" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});
