import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Alert } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MissionTaskViewModel } from "@slay/core";

import { MissionScreen } from "./MissionScreen";
import { TaskRunner } from "./TaskRunner";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
const submitMissionCompletion = vi.hoisted(() => vi.fn());

vi.mock("expo-router", () => ({ useRouter: () => nav }));
vi.mock("~/lib/supabase", () => ({ supabase: {} }));
vi.mock("~/lib/imageSource", () => ({ imageSource: () => null }));
vi.mock("@slay/data", () => ({ submitMissionCompletion }));

const quiz = { question: "Which is a fruit?", imageUrl: null, options: ["Apple", "Chair"], correctIndex: 0 };

beforeEach(() => {
  nav.replace.mockReset();
  submitMissionCompletion.mockReset();
  // Every confirmation is accepted.
  vi.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => buttons?.[1]?.onPress?.());
});

describe("TaskRunner", () => {
  it("plays a registered task and passes completion through with no fraction", () => {
    const onComplete = vi.fn();
    render(<TaskRunner taskType="quiz" content={quiz} onComplete={onComplete} actionLabel="Next" />);

    expect(screen.getByText("Which is a fruit?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" }).getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(screen.getByRole("radio", { name: "Chair" }));
    expect(screen.getByText("Not quite — the answer is highlighted.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onComplete).toHaveBeenCalledWith(undefined);
  });

  it("offers Skip for a task type that is not playable here yet", () => {
    const onSkip = vi.fn();
    render(<TaskRunner taskType="hangman" content={{}} onComplete={vi.fn()} onSkip={onSkip} actionLabel="Next" />);

    expect(screen.getByText("This task type isn't available yet — skip ahead.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onSkip).toHaveBeenCalled();
  });

  it("treats malformed content like an unknown type, and completes when there is no skip", () => {
    const onComplete = vi.fn();
    render(<TaskRunner taskType="quiz" content={{ question: "?" }} onComplete={onComplete} actionLabel="Finish Mission" />);

    fireEvent.click(screen.getByRole("button", { name: "Finish Mission" }));
    expect(onComplete).toHaveBeenCalledWith(undefined);
  });
});

describe("MissionScreen", () => {
  const tasks: MissionTaskViewModel[] = [
    { id: "t1", taskType: "quiz", orderIndex: 0, content: quiz },
    { id: "t2", taskType: "quiz", orderIndex: 1, content: { ...quiz, question: "Which is a colour?", options: ["Red", "Run"] } },
  ];
  const mission = { id: "m1", title: "Shopping", description: null, xpReward: 30, coinReward: 10 };

  function renderMission(props: Partial<React.ComponentProps<typeof MissionScreen>> = {}) {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <MissionScreen mission={mission} location={{ name: "Market", iconUrl: null }} tasks={tasks} {...props} />
      </QueryClientProvider>,
    );
  }

  it("runs every task, then records a full completion and opens the reward screen", async () => {
    submitMissionCompletion.mockResolvedValue({ ok: true });
    renderMission();

    expect(screen.getByText("1/2")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Apple" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Which is a colour?")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish Mission" }));

    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith({ pathname: "/mission/[missionId]/reward", params: { missionId: "m1" } }),
    );
    expect(submitMissionCompletion).toHaveBeenCalledWith({}, "m1", 1);
  });

  it("pays half for a two-task mission with one task skipped (AC2)", async () => {
    submitMissionCompletion.mockResolvedValue({ ok: true });
    renderMission();

    fireEvent.click(screen.getByRole("button", { name: "Skip this task" }));
    // The skip waits for its confirmation before moving on.
    fireEvent.click(await screen.findByRole("radio", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish Mission" }));

    await waitFor(() => expect(submitMissionCompletion).toHaveBeenCalledWith({}, "m1", 0.5));
  });

  it("keeps the run when saving fails and lets the player try again", async () => {
    submitMissionCompletion.mockResolvedValueOnce({ ok: false, error: "Mission not found." }).mockResolvedValue({ ok: true });
    renderMission({ tasks: [tasks[0]] });

    fireEvent.click(screen.getByRole("radio", { name: "Apple" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish Mission" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Mission not found.");
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalled());
  });

  it("records nothing in review mode", () => {
    renderMission({ tasks: [tasks[0]], review: true });

    fireEvent.click(screen.getByRole("radio", { name: "Apple" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish Review" }));

    expect(screen.getByText(/Reviews aren't recorded/)).toBeTruthy();
    expect(submitMissionCompletion).not.toHaveBeenCalled();
  });

  it("asks before leaving, then goes back to the map", () => {
    renderMission();

    fireEvent.click(screen.getByRole("button", { name: "Exit mission" }));
    return waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/map"));
  });
});
