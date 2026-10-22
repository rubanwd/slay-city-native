import { act, fireEvent, render, screen } from "@testing-library/react";
import * as Speech from "expo-speech";
import { afterEach, describe, expect, it, vi } from "vitest";

import { audioAdapter } from "~/lib/audio-adapter";

import { TaskRunner } from "../TaskRunner";

vi.mock("expo-speech", () => ({ speak: vi.fn(), stop: vi.fn() }));
vi.mock("~/lib/audio-adapter", () => ({ audioAdapter: { createSoundPlayer: vi.fn() } }));

afterEach(() => {
  vi.clearAllMocks();
});

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const type = (label: string, text: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: text } });
const submit = (label: string) => fireEvent.keyDown(screen.getByLabelText(label), { key: "Enter" });

function run(taskType: Parameters<typeof TaskRunner>[0]["taskType"], content: Parameters<typeof TaskRunner>[0]["content"]) {
  const onComplete = vi.fn();
  render(<TaskRunner taskType={taskType} content={content} onComplete={onComplete} actionLabel="Next" />);
  return onComplete;
}

/** WP-3.5 AC2: no autocorrect, no spelling suggestions, no autofill. */
function expectNoKeyboardHelp(field: HTMLElement) {
  expect(field.getAttribute("autocorrect")).toBe("off");
  expect(field.getAttribute("spellcheck")).toBe("false");
  expect(field.getAttribute("autocomplete")).toBe("off");
}

describe("spelling_bee", () => {
  it("speaks the word when there is no clip", () => {
    run("spelling_bee", { word: "bread" });
    press("Play the word");
    expect(Speech.speak).toHaveBeenCalledWith("bread", expect.objectContaining({ language: "en-US" }));
  });

  it("plays the authored clip when there is one", async () => {
    const player = { seekTo: vi.fn(() => Promise.resolve()), play: vi.fn(), pause: vi.fn(), remove: vi.fn() };
    vi.mocked(audioAdapter.createSoundPlayer).mockResolvedValue(player as never);
    run("spelling_bee", { word: "bread", audioUrl: "https://cdn/bread.mp3" });

    await act(async () => press("Play the word"));
    expect(audioAdapter.createSoundPlayer).toHaveBeenCalledWith({ uri: "https://cdn/bread.mp3" });
    expect(player.play).toHaveBeenCalled();
    expect(Speech.speak).not.toHaveBeenCalled();
  });

  it("falls back to speech when the clip's player can't be made", async () => {
    vi.mocked(audioAdapter.createSoundPlayer).mockRejectedValue(new Error("no audio"));
    run("spelling_bee", { word: "bread", audioUrl: "https://cdn/bread.mp3" });
    await act(async () => press("Play the word"));
    expect(Speech.speak).toHaveBeenCalledWith("bread", expect.anything());
  });

  it("keeps the keyboard from helping, and starts lowercase (AC2–3)", () => {
    run("spelling_bee", { word: "bread" });
    const field = screen.getByLabelText("Your spelling");
    expectNoKeyboardHelp(field);
    expect(field.getAttribute("autocapitalize")).toBe("none");
  });

  it("checks on the return key, ignoring case and spaces (AC4)", () => {
    const onComplete = run("spelling_bee", { word: "bread", translation: "хліб" });
    expect(screen.getByRole("button", { name: "Check" }).getAttribute("aria-disabled")).toBe("true");

    type("Your spelling", "  BREAD ");
    submit("Your spelling");
    expect(screen.getByText("Correct — хліб! 🎉")).toBeTruthy();

    press("Next");
    expect(onComplete).toHaveBeenCalledWith(undefined);
  });

  it("shows the spelling after a miss and lets the student try again", () => {
    run("spelling_bee", { word: "bread" });
    type("Your spelling", "bred");
    press("Check");
    expect(screen.getByText(`Not quite — it's spelled "bread".`)).toBeTruthy();

    press("Try Again");
    expect((screen.getByLabelText("Your spelling") as HTMLInputElement).value).toBe("");
  });

  it("stops speaking when the task closes", () => {
    const { unmount } = render(
      <TaskRunner taskType="spelling_bee" content={{ word: "bread" }} onComplete={vi.fn()} actionLabel="Next" />,
    );
    vi.mocked(Speech.stop).mockClear();
    unmount();
    expect(Speech.stop).toHaveBeenCalled();
  });
});

describe("fill_blank", () => {
  it("fills the gap from a typed word, checked on return", () => {
    run("fill_blank", { sentence: "I ___ to school.", answer: "go", translation: "Я ходжу до школи." });
    expect(screen.getByText("Я ходжу до школи.")).toBeTruthy();

    const field = screen.getByLabelText("The missing word");
    expectNoKeyboardHelp(field);
    expect(field.getAttribute("autocapitalize")).toBe("none");

    type("The missing word", "Go");
    expect(screen.getByText("Go")).toBeTruthy();
    submit("The missing word");
    expect(screen.getByText("Correct! 🎉")).toBeTruthy();
  });

  it("offers options when authored, and reveals the answer after a wrong pick", () => {
    run("fill_blank", { sentence: "The cat is ___ the box.", answer: "in", options: ["in", "on"] });
    expect(screen.queryByLabelText("The missing word")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "on" }));
    press("Check");
    expect(screen.getByText(`The answer is "in".`)).toBeTruthy();
    expect(screen.getByRole("radio", { name: "in" }).getAttribute("aria-disabled")).toBe("true");

    press("Try Again");
    fireEvent.click(screen.getByRole("radio", { name: "in" }));
    press("Check");
    expect(screen.getByText("Correct! 🎉")).toBeTruthy();
  });
});

describe("crossword", () => {
  // C A T
  // U . E
  // P . A
  const content = {
    entries: [
      { answer: "CAT", clue: "It says meow", row: 0, col: 0, direction: "across" },
      { answer: "CUP", clue: "You drink from it", row: 0, col: 0, direction: "down" },
      { answer: "TEA", clue: "A hot drink", row: 0, col: 2, direction: "down" },
    ],
  };
  const cell = (r: number, c: number) =>
    screen.getByLabelText(new RegExp(`^(\\d+, )?Row ${r} column ${c}$`)) as HTMLInputElement;

  function renderCrossword() {
    const onComplete = run("crossword", content);
    // The grid waits for its measured width. react-native-web reports layout
    // through a ResizeObserver, which jsdom lacks, so the handler is called directly.
    const measured = [...document.querySelectorAll("div")].find(
      (node) => typeof (node as unknown as Record<string, unknown>).__reactLayoutHandler === "function",
    ) as unknown as { __reactLayoutHandler: (event: object) => void };
    act(() => measured.__reactLayoutHandler({ nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 0 } } }));
    return onComplete;
  }

  it("numbers the clues in reading order", () => {
    run("crossword", content);
    expect(screen.getByText("Across")).toBeTruthy();
    expect(screen.getByText("Down")).toBeTruthy();
    expect(screen.getByText("It says meow")).toBeTruthy();
    expect(screen.getByText("A hot drink")).toBeTruthy();
  });

  it("types upper case with no keyboard help, moves on along the word, and steps on return (AC2–4)", () => {
    renderCrossword();
    const first = cell(1, 1);
    expectNoKeyboardHelp(first);
    expect(first.getAttribute("autocapitalize")).toBe("characters");
    expect(first.getAttribute("enterkeyhint")).toBe("next");

    first.focus();
    fireEvent.change(first, { target: { value: "c" } });
    expect(first.value).toBe("C");
    // Across first: on to the A.
    expect(document.activeElement).toBe(cell(1, 2));

    fireEvent.change(cell(1, 2), { target: { value: "a" } });
    fireEvent.change(cell(1, 3), { target: { value: "t" } });
    // T ends the across word; nothing further that way, so focus stays.
    expect(document.activeElement).toBe(cell(1, 3));

    // Return walks the grid in reading order: row 2's first cell is U.
    fireEvent.keyDown(cell(1, 3), { key: "Enter" });
    expect(document.activeElement).toBe(cell(2, 1));
  });

  it("marks wrong cells after a check and finishes once every cell is right", () => {
    const onComplete = renderCrossword();
    const letters: [number, number, string][] = [
      [1, 1, "C"], [1, 2, "A"], [1, 3, "T"], [2, 1, "U"], [2, 3, "E"], [3, 1, "P"], [3, 3, "X"],
    ];
    letters.forEach(([r, c, l]) => fireEvent.change(cell(r, c), { target: { value: l } }));

    press("Check");
    expect(screen.getByText("Not quite — check the red cells.")).toBeTruthy();

    fireEvent.change(cell(3, 3), { target: { value: "A" } });
    expect(screen.queryByText("Not quite — check the red cells.")).toBeNull();
    press("Next");
    expect(onComplete).toHaveBeenCalledWith(undefined);
  });
});
