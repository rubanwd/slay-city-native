import { memo, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";

import {
  cellKey as key,
  GRID,
  nextHead,
  OPPOSITE,
  type Cell,
  type Direction,
  type SnakeGameContent,
} from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { useAppStateAwareInterval } from "~/hooks/useAppStateAwareInterval";

import type { TaskProps } from "../taskContract";

const TICK_MS = 260;
/** Wrong-letter flash duration, in game ticks. */
const FLASH_TICKS = 2;
/** Space between cells and around the board — upstream's `gap-[2px] p-[3px]`. */
const GAP = 2;
const PAD = 3;
const BORDER = 2;
/** What the board leaves of the window's height for the header, word, D-pad and footer. */
const CHROME_HEIGHT = 470;

type Status = "idle" | "playing" | "paused" | "dead" | "won";

interface LetterCell extends Cell {
  char: string;
}

interface GameState {
  snake: Cell[];
  direction: Direction;
  letters: LetterCell[];
  collected: number;
  status: Status;
  /** Ticks remaining on the wrong-letter flash; counts down in the game loop. */
  flashTicks: number;
}

const INITIAL_SNAKE: Cell[] = [
  { x: 5, y: 6 },
  { x: 4, y: 6 },
  { x: 3, y: 6 },
];

/** Picks `count` random cells that aren't already occupied by the snake. */
function randomFreeCells(occupied: Cell[], count: number): Cell[] {
  const taken = new Set(occupied.map(key));
  const free: Cell[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!taken.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [free[i], free[j]] = [free[j], free[i]];
  }
  return free.slice(0, count);
}

/**
 * Scatters every letter of the word across the board at once. Nothing marks
 * which one comes next — the student reads that off the word above the board.
 */
function spawnLetters(snake: Cell[], word: string): LetterCell[] {
  return randomFreeCells(snake, word.length).map((cell, index) => ({ ...cell, char: word[index] }));
}

function createGame(word: string, status: Status): GameState {
  return {
    snake: INITIAL_SNAKE,
    direction: "right",
    letters: spawnLetters(INITIAL_SNAKE, word),
    collected: 0,
    status,
    flashTicks: 0,
  };
}

/** Upstream's game loop, one tick: move, then eat, grow, flash or die. */
function step(prev: GameState, word: string, turn: Direction | undefined): GameState {
  if (prev.status !== "playing") return prev;

  prev = { ...prev, flashTicks: Math.max(0, prev.flashTicks - 1) };
  const direction = turn ?? prev.direction;
  const head = nextHead(prev.snake[0], direction);

  // The tail cell frees up as the snake moves, so it isn't a collision.
  const hitSelf = prev.snake.slice(0, -1).some((cell) => key(cell) === key(head));
  if (hitSelf) return { ...prev, direction, status: "dead" };

  const letter = prev.letters.find((cell) => key(cell) === key(head));

  // Matched by character, not by cell, so a repeated letter (MOON) can be
  // taken from whichever of its copies the snake reaches first.
  if (letter && letter.char === word[prev.collected]) {
    const collected = prev.collected + 1;
    const snake = [head, ...prev.snake]; // grow: keep the tail
    const letters = prev.letters.filter((cell) => key(cell) !== key(head));
    const status = collected === word.length ? "won" : prev.status;
    return { ...prev, direction, snake, collected, letters, status };
  }

  const snake = [head, ...prev.snake.slice(0, -1)];

  // Out-of-order letter: it stays put and costs only a flash, so a wrong
  // guess never strands the student mid-word.
  if (letter) return { ...prev, direction, snake, flashTicks: FLASH_TICKS };

  return { ...prev, direction, snake };
}

/** The empty 12×12 floor. It never changes, so it never re-renders with the game. */
const Floor = memo(function Floor({ cell }: { cell: number }) {
  return (
    <View style={[styles.floor, { width: GRID * cell + (GRID - 1) * GAP }]}>
      {Array.from({ length: GRID * GRID }, (_, index) => (
        <View key={index} style={[styles.floorCell, { width: cell, height: cell }]} />
      ))}
    </View>
  );
});

/**
 * Port of upstream's `SnakeGameTask`: every letter of the word is scattered on
 * the board, and the student steers the snake to eat them in order. A letter
 * out of order only costs a flash; running into its own body ends the run and
 * restarts the word; the edges wrap.
 *
 * On a phone (WP-3.6 AC2):
 * - The tick is a `useAppStateAwareInterval`, and leaving the app pauses the
 *   game outright: the board is kept exactly as it was and waits behind a
 *   Resume card, so the snake never lurches on return or dies unseen.
 * - The D-pad answers on press-in, not release, with 60pt buttons centred
 *   under the board for one thumb; the web's arrow-key handler is gone.
 * - Only the snake and the letters move. The floor is drawn once and laid
 *   under them, so a tick re-renders a handful of views, not 144 (AC3).
 * - The Ready / Game over / Won cards cover the game, not the whole screen as
 *   the web's portal does, so the mission's exit and skip stay reachable.
 */
export function SnakeGameTask({ content, onComplete, actionLabel }: TaskProps<SnakeGameContent>) {
  const { word, translation, prompt } = content;
  const { height: windowHeight } = useWindowDimensions();
  const [game, setGame] = useState<GameState>(() => createGame(word, "idle"));
  const [width, setWidth] = useState<number | null>(null);

  // Queued turns, so two taps within one tick don't collapse into a single turn
  // (which would let the snake reverse into its own neck).
  const turnQueue = useRef<Direction[]>([]);
  // Read by `turn`, which must not touch state to decide whether a turn is legal.
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useAppStateAwareInterval(
    () => setGame((prev) => step(prev, word, turnQueue.current.shift())),
    game.status === "playing" ? TICK_MS : null,
  );

  // Leaving the app pauses the run; turns queued before it are dropped.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") return;
      turnQueue.current = [];
      setGame((prev) => (prev.status === "playing" ? { ...prev, status: "paused" } : prev));
    });
    return () => subscription.remove();
  }, []);

  const reset = (status: Status) => {
    turnQueue.current = [];
    setGame(createGame(word, status));
  };

  const turn = (direction: Direction) => {
    if (gameRef.current.status !== "playing") return;
    const last = turnQueue.current.at(-1) ?? gameRef.current.direction;
    if (direction === last || direction === OPPOSITE[last]) return;
    turnQueue.current.push(direction);
  };

  // Square, as wide as the task allows but short enough to leave the D-pad on screen.
  const board = width === null ? 0 : Math.max(180, Math.min(width, windowHeight - CHROME_HEIGHT));
  // Whole points, so the floor's 12 cells a row never wrap on a rounding error.
  const cell = board === 0 ? 0 : Math.floor((board - BORDER * 2 - PAD * 2 - GAP * (GRID - 1)) / GRID);
  const at = (c: Cell) => ({ left: PAD + c.x * (cell + GAP), top: PAD + c.y * (cell + GAP), width: cell, height: cell });

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <SlayText variant="h3" weight="700" style={styles.center}>
          {prompt}
        </SlayText>
        {translation ? (
          <SlayText variant="body" color={colors.cyan} style={styles.center}>
            {translation}
          </SlayText>
        ) : null}
      </View>

      {/* Every letter starts visible and clears as it's collected; the next one glows. */}
      <View style={styles.word} accessible accessibilityLabel={`Next letter: ${word[game.collected] ?? "none"}`}>
        {word.split("").map((char, index) => {
          const done = index < game.collected;
          const next = index === game.collected;
          return (
            <View key={index} style={[styles.wordTile, done ? styles.tileDone : next ? styles.tileNext : styles.tileOpen]}>
              <SlayText variant="h3" weight="900">
                {done ? "" : char}
              </SlayText>
            </View>
          );
        })}
      </View>

      <View style={styles.stage} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {board > 0 ? (
          <View
            style={[styles.board, { width: board, height: board }, game.flashTicks > 0 && styles.boardFlash]}
            accessibilityLabel="Snake board"
          >
            <Floor cell={cell} />
            {game.letters.map((letter) => (
              <View key={`${letter.x},${letter.y}`} style={[styles.piece, styles.letter, at(letter)]}>
                <SlayText variant="label" weight="900" style={[styles.letterText, { fontSize: Math.max(9, Math.round(cell * 0.45)) }]}>
                  {letter.char}
                </SlayText>
              </View>
            ))}
            {game.snake.map((segment, index) => (
              <View
                // Segments keep their position in the body, so React reuses the same views as it moves.
                key={index}
                style={[styles.piece, index === 0 ? styles.head : styles.body, at(segment)]}
              />
            ))}
          </View>
        ) : null}

        {game.status !== "playing" ? (
          <View style={styles.overlay}>
            <View
              style={[
                styles.card,
                game.status === "dead" ? styles.cardDead : game.status === "won" ? styles.cardWon : styles.cardReady,
              ]}
              accessibilityViewIsModal
              accessibilityLiveRegion="polite"
            >
              {game.status === "idle" ? (
                <>
                  <SlayText variant="h1" weight="900" style={styles.center}>
                    Ready?
                  </SlayText>
                  <SlayText variant="body" color={alpha.white70} style={styles.center}>
                    All the letters are on the board. Eat them in the word&apos;s order, avoid your own tail, and you can
                    pass through the edges.
                  </SlayText>
                  <SlayButton variant="green" size="lg" onPress={() => reset("playing")}>
                    Start
                  </SlayButton>
                </>
              ) : game.status === "paused" ? (
                <>
                  <SlayText variant="h1" weight="900" style={styles.center}>
                    Paused
                  </SlayText>
                  <SlayButton
                    variant="green"
                    size="lg"
                    onPress={() => setGame((prev) => ({ ...prev, status: "playing" }))}
                  >
                    Resume
                  </SlayButton>
                </>
              ) : game.status === "dead" ? (
                <>
                  <SlayText variant="h2" weight="900" color={colors.neonPink} style={styles.center}>
                    Oops! Game over.
                  </SlayText>
                  <SlayButton variant="pink" size="lg" onPress={() => reset("playing")}>
                    Try Again
                  </SlayButton>
                </>
              ) : (
                <>
                  <SlayText variant="h1" weight="900" color={colors.limeGreen} style={styles.center}>
                    {word}
                  </SlayText>
                  <SlayText variant="body" color={alpha.white70} style={styles.center}>
                    You collected every letter!
                  </SlayText>
                  <SlayButton variant="green" size="lg" onPress={() => onComplete()}>
                    {actionLabel}
                  </SlayButton>
                </>
              )}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.dpad}>
        <DPadButton direction="up" label="▲" onPress={turn} style={styles.up} />
        <DPadButton direction="left" label="◀" onPress={turn} style={styles.left} />
        <DPadButton direction="right" label="▶" onPress={turn} style={styles.right} />
        <DPadButton direction="down" label="▼" onPress={turn} style={styles.down} />
      </View>
    </View>
  );
}

function DPadButton({
  direction,
  label,
  onPress,
  style,
}: {
  direction: Direction;
  label: string;
  onPress: (direction: Direction) => void;
  style: StyleProp<ViewStyle>;
}) {
  return (
    <SlayPressable
      accessibilityRole="button"
      accessibilityLabel={direction}
      haptic
      hitSlop={4}
      // On press-in, as the web's pointerdown: a release-time press lands a beat late.
      onPressIn={() => onPress(direction)}
      style={({ pressed }) => [styles.pad, style, pressed && styles.padPressed]}
    >
      <SlayText variant="h3" color={alpha.white80} accessible={false}>
        {label}
      </SlayText>
    </SlayPressable>
  );
}

/** One D-pad button, and the gap between them — upstream's `h-14 w-14 gap-2`. */
const PAD_SIZE = 60;
const PAD_GAP = 8;

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  header: { alignItems: "center", gap: 2 },
  center: { textAlign: "center" },
  word: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  wordTile: { width: 36, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1 },
  tileDone: { borderColor: alpha.white10, backgroundColor: withAlpha(colors.white, 0.03) },
  tileNext: {
    borderColor: colors.limeGreen,
    backgroundColor: withAlpha(colors.limeGreen, 0.15),
    boxShadow: `0 0 12px 2px ${withAlpha(colors.limeGreen, 0.3)}`,
  },
  tileOpen: { borderColor: alpha.white15, backgroundColor: alpha.white5 },
  stage: { alignItems: "center", justifyContent: "center" },
  board: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: BORDER,
    borderColor: alpha.white20,
    backgroundColor: withAlpha(colors.black, 0.5),
  },
  boardFlash: { borderColor: colors.neonPink, boxShadow: `0 0 20px 4px ${withAlpha(colors.neonPink, 0.35)}` },
  floor: { flexDirection: "row", flexWrap: "wrap", gap: GAP, margin: PAD },
  floorCell: { borderRadius: 3, backgroundColor: withAlpha(colors.white, 0.04) },
  piece: { position: "absolute", borderRadius: 3 },
  head: { backgroundColor: colors.limeGreen, boxShadow: `0 0 6px 1px ${withAlpha(colors.limeGreen, 0.7)}` },
  body: { backgroundColor: withAlpha(colors.limeGreen, 0.6) },
  letter: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: withAlpha(colors.cyan, 0.4),
    backgroundColor: withAlpha(colors.cyan, 0.2),
  },
  letterText: { letterSpacing: 0 },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(colors.black, 0.8),
    borderRadius: radii.lg,
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 384,
    alignItems: "stretch",
    gap: 16,
    borderRadius: radii.card,
    borderWidth: 2,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  cardReady: { borderColor: withAlpha(colors.cyan, 0.5), boxShadow: `0 0 50px 10px ${withAlpha(colors.cyan, 0.2)}` },
  cardDead: { borderColor: withAlpha(colors.neonPink, 0.6), boxShadow: `0 0 50px 10px ${withAlpha(colors.neonPink, 0.3)}` },
  cardWon: { borderColor: withAlpha(colors.limeGreen, 0.6), boxShadow: `0 0 50px 10px ${withAlpha(colors.limeGreen, 0.3)}` },
  dpad: { alignSelf: "center", width: PAD_SIZE * 3 + PAD_GAP * 2, height: PAD_SIZE * 3 + PAD_GAP * 2 },
  pad: {
    position: "absolute",
    width: PAD_SIZE,
    height: PAD_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha.white20,
    backgroundColor: withAlpha(colors.white, 0.07),
  },
  padPressed: { borderColor: withAlpha(colors.cyan, 0.6), backgroundColor: withAlpha(colors.cyan, 0.2) },
  up: { top: 0, left: PAD_SIZE + PAD_GAP },
  left: { top: PAD_SIZE + PAD_GAP, left: 0 },
  right: { top: PAD_SIZE + PAD_GAP, left: (PAD_SIZE + PAD_GAP) * 2 },
  down: { top: (PAD_SIZE + PAD_GAP) * 2, left: PAD_SIZE + PAD_GAP },
});
