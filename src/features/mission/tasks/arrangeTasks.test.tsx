import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { blankIndicesFor } from "@slay/core";

import { TaskRunner } from "../TaskRunner";

vi.mock("~/lib/imageSource", () => ({ imageSource: (url: string | null) => (url ? { uri: url } : null) }));
// Deterministic order: every shuffle reverses, so the puzzle is never already solved.
vi.mock("@slay/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@slay/core")>()),
  shuffle: <T,>(input: readonly T[]) => [...input].reverse(),
}));

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const nextLocked = () => screen.getByRole("button", { name: "Next" }).getAttribute("aria-disabled") === "true";

function run(taskType: Parameters<typeof TaskRunner>[0]["taskType"], content: Parameters<typeof TaskRunner>[0]["content"]) {
  const onComplete = vi.fn();
  render(<TaskRunner taskType={taskType} content={content} onComplete={onComplete} actionLabel="Next" />);
  return onComplete;
}

describe("sentence_builder", () => {
  it("builds the sentence word by word, with Clear, then unlocks Next", () => {
    const onComplete = run("sentence_builder", { words: ["I", "like", "cats"], translation: "Я люблю котів" });

    expect(screen.getByText("Tap the words below…")).toBeTruthy();
    press("like");
    press("Clear");
    expect(screen.getByText("Tap the words below…")).toBeTruthy();

    press("I");
    press("like");
    expect(nextLocked()).toBe(true);
    press("cats");
    expect(screen.getByText("Great sentence! 🎉")).toBeTruthy();

    press("Next");
    expect(onComplete).toHaveBeenCalledWith(undefined);
  });

  it("takes a word back out when tapped in the answer", () => {
    run("sentence_builder", { words: ["I", "like", "cats"] });
    press("cats");
    press("Remove cats");
    expect(screen.getByText("Tap the words below…")).toBeTruthy();
  });
});

describe("size_order", () => {
  it("numbers the placed items and praises the right order", () => {
    run("size_order", { items: ["Ant", "Dog", "Whale"] });
    press("Ant");
    press("Dog");
    press("Whale");
    expect(screen.getByText("1. Ant")).toBeTruthy();
    expect(screen.getByText("Perfect order! 🎉")).toBeTruthy();
    expect(nextLocked()).toBe(false);
  });

  it("stays locked on a wrong order", () => {
    run("size_order", { items: ["Ant", "Dog", "Whale"] });
    press("Whale");
    press("Dog");
    press("Ant");
    expect(screen.queryByText("Perfect order! 🎉")).toBeNull();
    expect(nextLocked()).toBe(true);
  });
});

describe("word_scramble", () => {
  it("spells the word from the letter tiles", () => {
    run("word_scramble", { word: "CAT", translation: "кіт", hint: "It says meow" });
    expect(screen.getByText("кіт")).toBeTruthy();
    expect(screen.getByText("Hint: It says meow")).toBeTruthy();

    press("Place C");
    press("Place A");
    press("Place T");
    expect(screen.getByText("Perfect! 🎉")).toBeTruthy();
    expect(nextLocked()).toBe(false);
  });
});

describe("letter_fill", () => {
  const word = "BREAD";
  const missing = blankIndicesFor(word).map((i) => word[i]);

  it("fills the blanks in order", () => {
    run("letter_fill", { word, translation: "хліб" });
    missing.forEach((char) => press(`Place ${char}`));
    expect(screen.getByText("Perfect! 🎉")).toBeTruthy();
    expect(nextLocked()).toBe(false);
  });

  it("offers Clear after a wrong fill — upstream hides it there and strands the student", () => {
    // Only meaningful when the blanks are not all the same letter.
    if (new Set(missing).size < 2) return;
    run("letter_fill", { word });
    [...missing].reverse().forEach((char) => {
      const pool = screen.getAllByRole("button", { name: `Place ${char}` }).find((b) => b.getAttribute("aria-disabled") !== "true");
      if (pool) fireEvent.click(pool);
    });
    expect(screen.getByText("Not quite right — tap Clear to try again.")).toBeTruthy();
    expect(nextLocked()).toBe(true);

    press("Clear");
    missing.forEach((char) => press(`Place ${char}`));
    expect(screen.getByText("Perfect! 🎉")).toBeTruthy();
  });
});

describe("matching", () => {
  const content = {
    pairs: [
      { word: "Cat", match: "Кіт" },
      { word: "Dog", match: "Пес" },
    ],
  };

  it("locks a right pair, flashes a wrong one, and unlocks Next when all match", () => {
    vi.useFakeTimers();
    run("matching", content);

    press("Cat");
    press("Пес");
    expect(nextLocked()).toBe(true);
    act(() => vi.advanceTimersByTime(600));

    press("Кіт");
    press("Dog");
    press("Пес");
    expect(nextLocked()).toBe(false);
    vi.useRealTimers();
  });
});

describe("category_sort", () => {
  it("sorts each word into its category", () => {
    run("category_sort", {
      categories: ["Fruit", "Animals"],
      items: [
        { text: "Apple", categoryIndex: 0 },
        { text: "Cat", categoryIndex: 1 },
      ],
    });

    press("Apple");
    press("Put in Animals");
    // A wrong bucket sends the word back to the tray.
    expect(screen.getByRole("button", { name: "Apple" })).toBeTruthy();

    press("Apple");
    press("Put in Fruit");
    press("Cat");
    press("Put in Animals");
    expect(screen.getByText("All sorted! 🎉")).toBeTruthy();
    expect(nextLocked()).toBe(false);
  });
});

describe("story_sequencing", () => {
  it("asks to check until the order is right, then offers the action", () => {
    const onComplete = run("story_sequencing", {
      steps: [{ text: "Wake up" }, { text: "Eat breakfast" }, { text: "Go to school" }],
    });

    // Reversed: Go to school, Eat breakfast, Wake up.
    press("Check Order");
    expect(screen.getByText("Not yet — keep rearranging.")).toBeTruthy();

    // Move "Wake up" (3rd) to the top, then "Go to school" (now 2nd) to the bottom.
    fireEvent.click(screen.getAllByRole("button", { name: "Move up" })[2]);
    fireEvent.click(screen.getAllByRole("button", { name: "Move up" })[1]);
    fireEvent.click(screen.getAllByRole("button", { name: "Move down" })[1]);

    press("Next");
    expect(onComplete).toHaveBeenCalledWith(undefined);
  });
});
