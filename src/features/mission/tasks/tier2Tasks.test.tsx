import { act, fireEvent, render, screen } from "@testing-library/react";
import * as Haptics from "expo-haptics";
import { AppState, type AppStateStatus } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskRunner } from "../TaskRunner";

vi.mock("~/lib/imageSource", () => ({ imageSource: (url: string | null) => (url ? { uri: url } : null) }));
vi.mock("expo-haptics", () => ({ impactAsync: vi.fn(() => Promise.resolve()), ImpactFeedbackStyle: { Light: "light" } }));
// Deterministic order: every shuffle reverses.
vi.mock("@slay/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@slay/core")>()),
  shuffle: <T,>(input: readonly T[]) => [...input].reverse(),
}));

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const isDisabled = (name: string | RegExp) => screen.getByRole("button", { name }).getAttribute("aria-disabled") === "true";
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));

let appStateListeners: ((state: AppStateStatus) => void)[] = [];
const moveApp = (state: AppStateStatus) => act(() => appStateListeners.forEach((listener) => listener(state)));

beforeEach(() => {
  appStateListeners = [];
  vi.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appStateListeners.push(listener as (state: AppStateStatus) => void);
    return { remove: () => (appStateListeners = appStateListeners.filter((l) => l !== listener)) };
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.mocked(Haptics.impactAsync).mockClear();
});

function run(taskType: Parameters<typeof TaskRunner>[0]["taskType"], content: Parameters<typeof TaskRunner>[0]["content"]) {
  const onComplete = vi.fn();
  render(<TaskRunner taskType={taskType} content={content} onComplete={onComplete} actionLabel="Next" />);
  return onComplete;
}

describe("hangman", () => {
  it("saves the word letter by letter, then shows the translation and Next", () => {
    const onComplete = run("hangman", { word: "cat", hint: "It says meow", translation: "кіт" });
    expect(screen.getByText("Hint: It says meow")).toBeTruthy();
    expect(screen.getByLabelText("Word: blank blank blank")).toBeTruthy();

    press("C");
    press("A");
    expect(screen.getByLabelText("Word: C A blank")).toBeTruthy();
    press("T");

    expect(screen.getByText("You saved the word! 🎉")).toBeTruthy();
    expect(screen.getByText("кіт")).toBeTruthy();
    press("Next");
    expect(onComplete).toHaveBeenCalledWith(undefined);
  });

  it("shows letters the keyboard can't type for free", () => {
    run("hangman", { word: "it's ok" });
    expect(screen.getByLabelText("Word: blank blank ' blank , blank blank")).toBeTruthy();
  });

  it("counts lives down, reveals the word when they run out, and offers a retry", () => {
    run("hangman", { word: "cat" });
    ["B", "D", "E", "F", "G"].forEach(press);
    expect(screen.getByText("1 life left")).toBeTruthy();
    press("H");

    expect(screen.getByText("Out of lives — the word is revealed.")).toBeTruthy();
    expect(screen.getByLabelText("Word: C A T")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();

    press("Try Again");
    expect(screen.getByText("6 lives left")).toBeTruthy();
  });
});

describe("memory_cards", () => {
  // Reversed deck: Пес, Dog, Кіт, Cat.
  const content = { pairs: [{ word: "Cat", match: "Кіт" }, { word: "Dog", match: "Пес" }] };

  it("keeps a found pair face-up and flips a mismatch back after a beat", () => {
    vi.useFakeTimers();
    run("memory_cards", content);

    press("Card 1, face down");
    press("Card 3, face down");
    expect(screen.getByRole("button", { name: "Пес" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Кіт" })).toBeTruthy();
    // Busy: a third card can't be turned while the mismatch shows.
    press("Card 2, face down");
    expect(screen.queryByRole("button", { name: "Dog" })).toBeNull();

    tick(900);
    expect(screen.getByRole("button", { name: "Card 1, face down" })).toBeTruthy();

    press("Card 1, face down");
    press("Card 2, face down");
    press("Card 3, face down");
    press("Card 4, face down");
    expect(screen.getByText("Every pair found! 🎉")).toBeTruthy();
    expect(isDisabled("Next")).toBe(false);
  });
});

describe("bubble_pop", () => {
  it("pops the right bubbles, flashes a wrong one, and unlocks Next once all are popped", () => {
    vi.useFakeTimers();
    run("bubble_pop", { prompt: "Pop the fruits", correct: ["Apple", "Pear"], distractors: ["Bus"] });
    expect(screen.getByText("2 left to pop")).toBeTruthy();

    press("Bus");
    expect(screen.getByText("2 left to pop")).toBeTruthy();
    tick(450);

    press("Apple");
    expect(screen.getByText("1 left to pop")).toBeTruthy();
    expect(isDisabled("Next")).toBe(true);
    press("Pear");

    expect(screen.getByText("All popped! 🎉")).toBeTruthy();
    expect(isDisabled("Next")).toBe(false);
  });
});

describe("reaction_tap", () => {
  const content = { correct: ["Cat", "Dog"], distractors: ["Cup"], roundSeconds: 10 };

  it("wins when every correct word is tapped in time", () => {
    vi.useFakeTimers();
    run("reaction_tap", content);
    expect(screen.getByText("⏱ 10s left")).toBeTruthy();
    expect(isDisabled("Next")).toBe(true);

    press("Cup");
    tick(3000);
    expect(screen.getByText("⏱ 7s left")).toBeTruthy();
    press("Cat");
    press("Dog");

    expect(screen.getByText("All tapped! 🎉")).toBeTruthy();
    expect(isDisabled("Next")).toBe(false);
    // The clock stops with the round.
    tick(10_000);
    expect(screen.getByText("All tapped! 🎉")).toBeTruthy();
  });

  it("times out, and the student can still move on", () => {
    vi.useFakeTimers();
    run("reaction_tap", content);
    press("Cat");
    tick(10_000);

    expect(screen.getByText("Time's up!")).toBeTruthy();
    expect(isDisabled("Dog")).toBe(true);
    expect(isDisabled("Next")).toBe(false);
  });

  it("stops the clock while the app is in the background (AC1)", () => {
    vi.useFakeTimers();
    run("reaction_tap", content);
    tick(2000);

    moveApp("background");
    tick(60_000);
    moveApp("active");
    expect(screen.getByText("⏱ 8s left")).toBeTruthy();

    tick(1000);
    expect(screen.getByText("⏱ 7s left")).toBeTruthy();
  });
});

describe("simon_sequence", () => {
  const content = { colors: ["Red", "Blue", "Green", "Purple"], sequence: [2, 0, 3] };
  // A lit tile is its hue at full strength; an idle one is translucent.
  const lit = () =>
    ["Red", "Blue", "Green", "Purple"].filter((name) =>
      screen.getByRole("button", { name }).style.backgroundColor.startsWith("rgb("),
    );

  it("lights each tile with a haptic tick in the same beat (AC3), then hands over", () => {
    vi.useFakeTimers();
    run("simon_sequence", content);
    expect(screen.getByText("Watch the pattern…")).toBeTruthy();
    expect(isDisabled("Red")).toBe(true);

    tick(0);
    expect(lit()).toEqual(["Green"]);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

    tick(450);
    expect(lit()).toEqual([]);
    tick(250);
    expect(lit()).toEqual(["Red"]);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);

    tick(700);
    expect(lit()).toEqual(["Purple"]);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(3);

    tick(700);
    expect(screen.getByText("Your turn — tile 1 of 3")).toBeTruthy();
    press("Green");
    press("Red");
    press("Purple");
    expect(screen.getByText("You got it! 🎉")).toBeTruthy();
    expect(isDisabled("Next")).toBe(false);
  });

  it("offers to watch again after a wrong tap", () => {
    vi.useFakeTimers();
    run("simon_sequence", content);
    tick(2100);

    press("Blue");
    expect(screen.getByText("Not quite that order.")).toBeTruthy();
    expect(isDisabled("Next")).toBe(true);

    press("Watch again");
    expect(screen.getByText("Watch the pattern…")).toBeTruthy();
    tick(0);
    expect(lit()).toEqual(["Green"]);
    tick(2100);
    expect(screen.getByText("Your turn — tile 1 of 3")).toBeTruthy();
  });

  it("starts the pattern over when the app comes back from the background (AC1)", () => {
    vi.useFakeTimers();
    run("simon_sequence", content);
    tick(750);
    expect(lit()).toEqual(["Red"]);

    moveApp("background");
    tick(10_000);
    expect(screen.getByText("Watch the pattern…")).toBeTruthy();

    moveApp("active");
    tick(0);
    expect(lit()).toEqual(["Green"]);
  });
});

describe("flashcards", () => {
  const content = {
    cards: [
      { front: "Apple", back: "Яблуко" },
      { front: "Bread", back: "Хліб" },
    ],
  };

  it("flips each card and finishes on the last one", () => {
    const onComplete = run("flashcards", content);
    expect(screen.getByText("1/2")).toBeTruthy();

    press("Apple. Show the answer");
    press("Яблуко. Show the front of the card");
    press("Apple. Show the answer");

    press("Next card");
    expect(screen.getByText("2/2")).toBeTruthy();
    // A new card always starts face-up.
    expect(screen.getByRole("button", { name: "Bread. Show the answer" })).toBeTruthy();

    press("Next");
    expect(onComplete).toHaveBeenCalledWith(undefined);
  });
});
