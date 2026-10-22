import { act, fireEvent, render, screen } from "@testing-library/react";
import { AppState, type AppStateStatus } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskRunner } from "../TaskRunner";

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
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
});

function run(taskType: Parameters<typeof TaskRunner>[0]["taskType"], content: Parameters<typeof TaskRunner>[0]["content"]) {
  const onComplete = vi.fn();
  render(<TaskRunner taskType={taskType} content={content} onComplete={onComplete} actionLabel="Next" />);
  return onComplete;
}

/** react-native-web reports layout through a ResizeObserver, which jsdom lacks — call the handler directly. */
function measure(width: number) {
  const nodes = [...document.querySelectorAll("div")].filter(
    (node) => typeof (node as unknown as Record<string, unknown>).__reactLayoutHandler === "function",
  ) as unknown as { __reactLayoutHandler: (event: object) => void }[];
  act(() => nodes.forEach((node) => node.__reactLayoutHandler({ nativeEvent: { layout: { x: 0, y: 0, width, height: 0 } } })));
}

describe("word_search", () => {
  /**
   * `Math.random` scripted so the board is
   *   C A T A
   *   D O G A
   *   A A A A
   *   A A A A
   */
  function renderBoard() {
    const script = [0, 0, 0, 0, 0.3, 0];
    vi.spyOn(Math, "random").mockImplementation(() => script.shift() ?? 0);
    const onComplete = run("word_search", { words: ["cat", "dog"] });
    measure(358);
    return onComplete;
  }
  const cell = (letter: string, r: number, c: number) => screen.getByRole("button", { name: `${letter}, row ${r} column ${c}` });

  it("finds a word from its first and last letter, either way round", () => {
    const onComplete = renderBoard();
    expect(screen.getByText("Found 0 of 2. Finish now to keep going — you'll earn a reward for the words you found.")).toBeTruthy();

    fireEvent.click(cell("C", 1, 1));
    fireEvent.click(cell("T", 1, 3));
    expect(screen.getByLabelText("CAT, found")).toBeTruthy();

    // Backwards: G to D.
    fireEvent.click(cell("G", 2, 3));
    fireEvent.click(cell("D", 2, 1));
    expect(screen.getByText("Every word found! 🎉")).toBeTruthy();

    press("Next");
    expect(onComplete).toHaveBeenCalledWith(1);
  });

  it("lets the student finish early for the share of words found (AC1)", () => {
    const onComplete = renderBoard();
    fireEvent.click(cell("C", 1, 1));
    fireEvent.click(cell("T", 1, 3));
    press("Next (1/2)");
    expect(onComplete).toHaveBeenCalledWith(0.5);
  });

  it("starts over from the second tap when the two aren't in a line", () => {
    renderBoard();
    fireEvent.click(cell("C", 1, 1));
    // Not a row, column or diagonal from C: becomes the new first letter.
    fireEvent.click(cell("G", 2, 3));
    fireEvent.click(cell("D", 2, 1));
    expect(screen.getByLabelText("DOG, found")).toBeTruthy();
  });

  it("waits for its measured width before laying out the board", () => {
    run("word_search", { words: ["cat"] });
    expect(screen.queryByRole("button", { name: /row 1 column 1/ })).toBeNull();
    measure(358);
    expect(screen.getByRole("button", { name: /row 1 column 1/ })).toBeTruthy();
  });
});

describe("snake_game", () => {
  const TICK = 260;
  // The D-pad acts on press-in. react-native-web delays a pointer's press-in by
  // 50ms (a phone doesn't); a key press starts it at once, so tests steer with Enter.
  const steer = (direction: string) => {
    const button = screen.getByRole("button", { name: direction });
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyUp(button, { key: "Enter" });
  };

  /**
   * With `Math.random` near 1 the letter shuffle leaves the free cells in
   * reading order: A at (0,0), B at (1,0). The snake starts at (5,6) heading
   * right, so: six ticks right to x=11, six up to y=0, then right wraps it
   * onto A and B.
   */
  function start(word = "AB") {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const onComplete = run("snake_game", { word, translation: "test" });
    measure(358);
    expect(screen.getByText("Ready?")).toBeTruthy();
    press("Start");
    return onComplete;
  }

  it("collects the letters in order and wins", () => {
    const onComplete = start();
    expect(screen.queryByText("Ready?")).toBeNull();
    expect(screen.getByLabelText("Next letter: A")).toBeTruthy();

    tick(TICK * 6);
    steer("up");
    tick(TICK * 6);
    steer("right");
    tick(TICK);
    expect(screen.getByLabelText("Next letter: B")).toBeTruthy();
    tick(TICK);

    expect(screen.getByText("You collected every letter!")).toBeTruthy();
    press("Next");
    expect(onComplete).toHaveBeenCalledWith(undefined);
  });

  it("ignores a turn straight back into its own neck", () => {
    start();
    steer("left");
    tick(TICK * 6);
    steer("up");
    tick(TICK * 6);
    steer("right");
    tick(TICK * 2);
    // Still on course: the reversal was dropped, so the same path wins.
    expect(screen.getByText("You collected every letter!")).toBeTruthy();
  });

  it("pauses when the app leaves the foreground, and resumes where it was (AC2)", () => {
    start();
    tick(TICK * 6);
    steer("up");

    moveApp("background");
    tick(60_000);
    moveApp("active");
    expect(screen.getByText("Paused")).toBeTruthy();
    // A turn queued before leaving is dropped, so steer again after resuming.
    press("Resume");
    steer("up");
    tick(TICK * 6);
    steer("right");
    tick(TICK * 2);
    expect(screen.getByText("You collected every letter!")).toBeTruthy();
  });

  it("ends the run on its own tail and offers a retry", () => {
    // ABCD lies along the top row; eating A, B and C grows the snake to six.
    start("ABCD");
    tick(TICK * 6);
    steer("up");
    tick(TICK * 6);
    steer("right");
    tick(TICK * 3);
    expect(screen.getByLabelText("Next letter: D")).toBeTruthy();

    // A tight turn back into the body: down, left, up lands on B's old cell.
    steer("down");
    tick(TICK);
    steer("left");
    tick(TICK);
    steer("up");
    tick(TICK);
    expect(screen.getByText("Oops! Game over.")).toBeTruthy();

    press("Try Again");
    expect(screen.queryByText("Oops! Game over.")).toBeNull();
    expect(screen.getByLabelText("Next letter: A")).toBeTruthy();
  });
});
