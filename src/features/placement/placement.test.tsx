import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlacementQuestion } from "@slay/core";

import { PlacementTest, type PlacementTestProps } from "./PlacementTest";

const nav = vi.hoisted(() => ({ push: vi.fn(), navigate: vi.fn() }));
const data = vi.hoisted(() => ({ changeMyLevel: vi.fn(), submitPlacementTest: vi.fn() }));
const supabase = vi.hoisted(() => ({}));

vi.mock("expo-router", () => ({ useRouter: () => nav }));
vi.mock("@slay/data", () => data);
vi.mock("~/lib/supabase", () => ({ supabase }));
vi.mock("~/lib/imageSource", () => ({ imageSource: (url: string | null) => (url ? { uri: url } : null) }));
vi.mock("~/features/map", () => ({ MAP_QUERY_KEY: "map" }));

const Q1 = "11111111-1111-4111-8111-111111111111";
const Q2 = "22222222-2222-4222-8222-222222222222";
const questions: PlacementQuestion[] = [
  { id: Q1, level: "beginner", prompt: "I ___ a cat.", options: ["have", "has", "having"] },
  { id: Q2, level: "elementary", prompt: "She ___ to school yesterday.", options: ["go", "went", "gone"] },
];

const graded = (recommendedLevel: "beginner" | "elementary" | "intermediate") => ({
  ok: true as const,
  result: {
    totalCorrect: 1,
    totalQuestions: 2,
    levelScores: [
      { level: "beginner" as const, correct: 1, total: 1, passed: true },
      { level: "elementary" as const, correct: 0, total: 1, passed: false },
    ],
    recommendedLevel,
  },
});

let invalidate: ReturnType<typeof vi.spyOn>;
function renderTest(props: Partial<PlacementTestProps> = {}): ReturnType<typeof render> {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  invalidate = vi.spyOn(client, "invalidateQueries");
  const ui: ReactElement = (
    <QueryClientProvider client={client}>
      <PlacementTest questions={questions} currentLevel="elementary" availableLevels={["beginner", "elementary"]} mascotImageUrl="/m.webp" {...props} />
    </QueryClientProvider>
  );
  return render(ui);
}

const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const press = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const choose = (name: string) => fireEvent.click(screen.getByRole("radio", { name }));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("PlacementTest", () => {
  it("walks from the intro through each question to a graded result, then switches the map", async () => {
    const submit = vi.fn().mockResolvedValue(graded("beginner"));
    data.changeMyLevel.mockResolvedValue({ ok: true });
    renderTest({ submit });

    expect(screen.getByText("📝 2 questions — from Beginner to Upper Intermediate.")).toBeTruthy();
    press("Start the test");

    expect(screen.getByText("Beginner")).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();
    // Every option is offered, in some order.
    expect(screen.getAllByRole("radio").map((r) => r.textContent).sort()).toEqual(["has", "have", "having"]);

    choose("have");
    // The pick stays lit, and a second tap during it is ignored.
    expect(screen.getByRole("radio", { name: "have" }).getAttribute("aria-checked")).toBe("true");
    choose("has");
    await tick(450);

    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect(screen.getByText("1 answered")).toBeTruthy();
    press("I don't know");
    await tick(200);

    // Answers go as indices into the stored order; a skip is left out.
    expect(submit).toHaveBeenCalledWith({ [Q1]: 0 });
    expect(screen.getByText("Your English level")).toBeTruthy();
    expect(screen.getByText("1 of 2 answers right (50%)")).toBeTruthy();
    expect(screen.getByText("✓ Beginner")).toBeTruthy();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["profile"] });

    press("Play Beginner");
    await tick(0);
    expect(data.changeMyLevel).toHaveBeenCalledWith(supabase, "beginner");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["map"] });
    expect(nav.navigate).toHaveBeenCalledWith("/map");
  });

  it("finishes early with the answers given so far", async () => {
    const submit = vi.fn().mockResolvedValue(graded("elementary"));
    renderTest({ submit });
    press("Start the test");
    press("Finish now");
    await tick(0);
    expect(submit).toHaveBeenCalledWith({});
    // Already on the recommended level: straight to the map, no switch.
    press("Go to the map");
    expect(data.changeMyLevel).not.toHaveBeenCalled();
    expect(nav.navigate).toHaveBeenCalledWith("/map");
  });

  it("steps back a question, and from the first back to the intro", async () => {
    renderTest({ submit: vi.fn() });
    press("Start the test");
    choose("have");
    await tick(450);
    press("← Back");
    expect(screen.getByText("1 / 2")).toBeTruthy();
    // The earlier choice is still marked.
    expect(screen.getByRole("radio", { name: "have" }).getAttribute("aria-checked")).toBe("true");
    press("← Back");
    expect(screen.getByText("Start the test")).toBeTruthy();
  });

  it("recommends the nearest level with content when the result has none", async () => {
    renderTest({ submit: vi.fn().mockResolvedValue(graded("intermediate")) });
    press("Start the test");
    press("Finish now");
    await tick(0);
    expect(screen.getByText("Intermediate has no districts yet — start with Elementary.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to the map" })).toBeTruthy();
  });

  it("shows why grading failed and stays on the question", async () => {
    renderTest({ submit: vi.fn().mockResolvedValue({ ok: false, error: "offline" }) });
    press("Start the test");
    press("Finish now");
    await tick(0);
    expect(screen.getByRole("alert").textContent).toBe("offline");
    expect(screen.getByText("1 / 2")).toBeTruthy();
  });

  it("says when there are no questions yet", () => {
    renderTest({ questions: [] });
    expect(screen.getByText("The level test is not ready yet")).toBeTruthy();
    press("Back to profile");
    expect(nav.navigate).toHaveBeenCalledWith("/profile");
  });

  it("grades through submitPlacementTest by default", async () => {
    data.submitPlacementTest.mockResolvedValue(graded("elementary"));
    renderTest();
    press("Start the test");
    press("Finish now");
    await tick(0);
    expect(data.submitPlacementTest).toHaveBeenCalledWith(supabase, {});
  });
});
