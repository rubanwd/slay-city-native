import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MissionTaskType } from "@slay/core";
import type { Json } from "@slay/core/types";

import { haptic } from "~/lib/haptics";

import { TaskRunner } from "../TaskRunner";

vi.mock("~/lib/imageSource", () => ({ imageSource: (url: string | null) => (url ? { uri: url } : null) }));
vi.mock("~/lib/haptics", () => ({ haptic: vi.fn() }));

afterEach(() => {
  vi.mocked(haptic).mockClear();
});

const NOT_QUITE = "Not quite — the answer is highlighted.";

/**
 * One row per single-choice task: content in the database's own shape (so it
 * goes through the real `@slay/core` parser), the right and a wrong option, and
 * upstream's verdict for each.
 */
const CASES: {
  type: MissionTaskType;
  content: Json;
  prompt: string | RegExp;
  right: string;
  wrong: string;
  success: string;
  fail?: string;
}[] = [
  {
    type: "analogy",
    content: { wordA: "Hot", wordB: "Cold", wordC: "Up", options: ["Down", "Left"], correctIndex: 0 },
    prompt: /Hot/,
    right: "Down",
    wrong: "Left",
    success: "Sharp thinking! 🎉",
  },
  {
    type: "antonym_match",
    content: { word: "Big", options: ["Huge", "Small"], correctIndex: 1 },
    prompt: "Big",
    right: "Small",
    wrong: "Huge",
    success: "Exactly opposite! 🎉",
  },
  {
    type: "cause_effect",
    content: { cause: "It rains", options: ["The ground gets wet", "The sun sets"], correctIndex: 0 },
    prompt: "It rains",
    right: "The ground gets wet",
    wrong: "The sun sets",
    success: "Good thinking! 🎉",
  },
  {
    type: "clock_reading",
    content: { hour: 3, minute: 30, options: ["3:30", "6:15"], correctIndex: 0 },
    prompt: "What time is it?",
    right: "3:30",
    wrong: "6:15",
    success: "Right on time! 🎉",
  },
  {
    type: "counting_game",
    content: { emoji: "🍎", count: 3, options: [2, 3, 4] },
    prompt: "How many do you see?",
    right: "3",
    wrong: "4",
    success: "Correct! 🎉",
    fail: "Not quite — there are 3.",
  },
  {
    type: "dialogue_choice",
    content: { prompt: "How are you?", speaker: "Mia", options: ["I'm fine, thanks!", "Blue."], correctIndex: 0, translation: "Як справи?" },
    prompt: "How are you?",
    right: "I'm fine, thanks!",
    wrong: "Blue.",
    success: "Great reply! 🎉",
    fail: "Not quite — the best reply is highlighted.",
  },
  {
    type: "emoji_decode",
    content: { emojis: "☀️🌻", options: ["Sunflower", "Moon"], correctIndex: 0, translation: "соняшник" },
    prompt: "Which word does this emoji mean?",
    right: "Sunflower",
    wrong: "Moon",
    success: "Yes — соняшник! 🎉",
  },
  {
    type: "odd_one_out",
    content: { words: ["Cat", "Dog", "Car"], oddIndex: 2 },
    prompt: "Which one doesn't belong?",
    right: "Car",
    wrong: "Dog",
    success: "Spot on! 🎉",
    fail: "Not quite — the odd one is highlighted.",
  },
  {
    type: "picture_reveal",
    content: { imageUrl: "https://cdn/cat.png", options: ["Cat", "Bus"], correctIndex: 0 },
    prompt: "What's in the picture?",
    right: "Cat",
    wrong: "Bus",
    success: "Sharp eyes! 🎉",
  },
  {
    type: "quiz",
    content: { question: "Which is a fruit?", options: ["Apple", "Chair"], correctIndex: 0 },
    prompt: "Which is a fruit?",
    right: "Apple",
    wrong: "Chair",
    success: "You got this! 🎉",
  },
  {
    type: "rhyme_match",
    content: { targetWord: "Cat", options: ["Hat", "Dog"], correctIndex: 0 },
    prompt: "Cat",
    right: "Hat",
    wrong: "Dog",
    success: "Nice rhyme! 🎉",
  },
];

describe.each(CASES)("$type", ({ type, content, prompt, right, wrong, success, fail = NOT_QUITE }) => {
  function renderTask() {
    const onComplete = vi.fn();
    render(<TaskRunner taskType={type} content={content} onComplete={onComplete} actionLabel="Next" />);
    return onComplete;
  }

  it("renders its content, with Next locked until the student answers", () => {
    renderTask();
    expect(screen.getAllByText(prompt).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Next" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("praises the right answer and reports a plain completion", () => {
    const onComplete = renderTask();
    fireEvent.click(screen.getByRole("radio", { name: right }));
    expect(screen.getByText(success)).toBeTruthy();
    expect(haptic).toHaveBeenCalledWith("correct");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onComplete).toHaveBeenCalledWith(undefined);
  });

  it("marks a wrong pick and locks the options", () => {
    renderTask();
    fireEvent.click(screen.getByRole("radio", { name: wrong }));
    expect(screen.getByText(fail)).toBeTruthy();
    expect(haptic).toHaveBeenCalledWith("wrong");
    expect(screen.getByRole("radio", { name: right }).getAttribute("aria-disabled")).toBe("true");
  });
});

describe("dialogue_choice", () => {
  it("shows the translation once answered", () => {
    render(<TaskRunner taskType="dialogue_choice" content={CASES[5].content} onComplete={vi.fn()} actionLabel="Next" />);
    expect(screen.queryByText("Як справи?")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Blue." }));
    expect(screen.getByText("Як справи?")).toBeTruthy();
  });
});

describe("picture_reveal", () => {
  it("offers to reveal more until the last hint, then stops", () => {
    render(<TaskRunner taskType="picture_reveal" content={CASES[8].content} onComplete={vi.fn()} actionLabel="Next" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal more" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal more" }));
    expect(screen.queryByRole("button", { name: "Reveal more" })).toBeNull();
  });
});

describe("true_false", () => {
  it("praises a right answer", () => {
    const onComplete = vi.fn();
    render(<TaskRunner taskType="true_false" content={{ statement: "Fish can swim.", isTrue: true }} onComplete={onComplete} actionLabel="Next" />);

    fireEvent.click(screen.getByRole("radio", { name: "True" }));
    expect(screen.getByText("Correct! 🎉")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onComplete).toHaveBeenCalledWith(undefined);
  });

  it("says what the statement actually is after a wrong answer", () => {
    render(<TaskRunner taskType="true_false" content={{ statement: "Cats can fly.", isTrue: false }} onComplete={vi.fn()} actionLabel="Next" />);

    fireEvent.click(screen.getByRole("radio", { name: "True" }));
    expect(screen.getByText("Actually, that's false.")).toBeTruthy();
  });
});

describe("spot_the_difference", () => {
  const content = { emoji: "🐱", oddEmoji: "🐶", gridSize: 9, oddIndex: 4 };

  it("lets the student keep looking after a wrong tap, then unlocks Next", () => {
    render(<TaskRunner taskType="spot_the_difference" content={content} onComplete={vi.fn()} actionLabel="Next" />);

    fireEvent.click(screen.getAllByRole("button", { name: "🐱" })[0]);
    expect(screen.queryByText("Found it! 🎉")).toBeNull();
    expect(screen.getByRole("button", { name: "Next" }).getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "🐶" }));
    expect(screen.getByText("Found it! 🎉")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" }).getAttribute("aria-disabled")).not.toBe("true");
  });
});

describe("vocabulary", () => {
  it("shows the card and needs no answer", () => {
    const onComplete = vi.fn();
    render(
      <TaskRunner
        taskType="vocabulary"
        content={{ word: "Apple", translation: "Яблуко", exampleSentence: "I eat an apple." }}
        onComplete={onComplete}
        actionLabel="Next"
      />,
    );

    expect(screen.getByText("Apple")).toBeTruthy();
    expect(screen.getByText("Яблуко")).toBeTruthy();
    expect(screen.getByText("“I eat an apple.”")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onComplete).toHaveBeenCalledWith(undefined);
  });
});
