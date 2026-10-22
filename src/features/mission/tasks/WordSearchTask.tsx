import { useState } from "react";
import { StyleSheet, View } from "react-native";

import type { WordSearchContent } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";

import type { TaskProps } from "../taskContract";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
// Placement directions; selection accepts these and their reverses.
const PLACE_DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/** Space between letters — upstream's `gap-1`. */
const GAP = 4;
/** Upstream's board stops at `max-w-sm`. */
const MAX_BOARD = 384;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

interface Generated {
  grid: string[][];
  placed: string[];
}

/** Upstream's `generateGrid`: places each word in a random straight line, then fills the gaps with noise. */
function generateGrid(words: string[], size: number): Generated {
  const grid: (string | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const placed: string[] = [];

  for (const word of words) {
    const len = word.length;
    if (len > size) continue;
    let done = false;
    for (let attempt = 0; attempt < 300 && !done; attempt++) {
      const [dr, dc] = PLACE_DIRS[randInt(0, PLACE_DIRS.length - 1)];
      const r0 = dr === 1 ? randInt(0, size - len) : randInt(0, size - 1);
      const c0 = dc === 1 ? randInt(0, size - len) : dc === -1 ? randInt(len - 1, size - 1) : randInt(0, size - 1);

      let fits = true;
      for (let k = 0; k < len; k++) {
        const cell = grid[r0 + dr * k][c0 + dc * k];
        if (cell !== null && cell !== word[k]) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;

      for (let k = 0; k < len; k++) grid[r0 + dr * k][c0 + dc * k] = word[k];
      placed.push(word);
      done = true;
    }
  }

  const filled = grid.map((row) => row.map((cell) => cell ?? ALPHABET[randInt(0, ALPHABET.length - 1)]));
  return { grid: filled, placed };
}

const cellKey = (r: number, c: number) => `${r},${c}`;

interface Point {
  r: number;
  c: number;
}

/** The cells on the straight line from `a` to `b`, or null when they aren't in a row, column or diagonal. */
function lineCells(a: Point, b: Point): Point[] | null {
  const dr = Math.sign(b.r - a.r);
  const dc = Math.sign(b.c - a.c);
  const straight = a.r === b.r || a.c === b.c || Math.abs(b.r - a.r) === Math.abs(b.c - a.c);
  if (!straight) return null;
  const steps = Math.max(Math.abs(b.r - a.r), Math.abs(b.c - a.c));
  const cells: Point[] = [];
  for (let k = 0; k <= steps; k++) cells.push({ r: a.r + dr * k, c: a.c + dc * k });
  return cells;
}

/**
 * Port of upstream's `WordSearchTask`: tap the first and last letter of a
 * word; if the straight line between them spells a hidden word (either way
 * round) it locks in green.
 *
 * The one task that may be finished early: the action button is always live
 * and reports the share of words found as the reward fraction (WP-3.2), which
 * `MissionScreen` turns into the reward — nothing here computes it.
 *
 * The board is sized from its measured width, never the window's (WP-3.6
 * AC1). The web's "?" tooltip isn't repeated beside the prompt: the mission
 * header's How-to-play button already carries the same instructions.
 */
export function WordSearchTask({ content, onComplete, actionLabel }: TaskProps<WordSearchContent>) {
  const { prompt, size } = content;
  // Content is re-parsed every render; the board is generated once for the task's life.
  const [{ grid, placed }] = useState(() => generateGrid(content.words, size));
  const [first, setFirst] = useState<Point | null>(null);
  const [found, setFound] = useState<Set<string>>(() => new Set());
  const [foundCells, setFoundCells] = useState<Set<string>>(() => new Set());
  const [width, setWidth] = useState<number | null>(null);

  const total = placed.length;
  const won = found.size === total && total > 0;
  const rewardFraction = total > 0 ? found.size / total : 1;
  const board = width === null ? 0 : Math.min(width, MAX_BOARD);
  const cell = board === 0 ? 0 : Math.floor((board - GAP * (size - 1)) / size);

  const tapCell = (r: number, c: number) => {
    if (won) return;
    if (!first) {
      setFirst({ r, c });
      return;
    }
    const cells = lineCells(first, { r, c });
    if (!cells) {
      setFirst({ r, c });
      return;
    }
    const word = cells.map((p) => grid[p.r][p.c]).join("");
    const reversed = word.split("").reverse().join("");
    const match = placed.includes(word) ? word : placed.includes(reversed) ? reversed : null;

    if (match && !found.has(match)) {
      setFound((prev) => new Set(prev).add(match));
      setFoundCells((prev) => {
        const next = new Set(prev);
        cells.forEach((p) => next.add(cellKey(p.r, p.c)));
        return next;
      });
    }
    setFirst(null);
  };

  return (
    <View style={styles.wrap}>
      <SlayText variant="bodyStrong" weight="600" style={styles.center}>
        {prompt}
      </SlayText>

      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {cell > 0 ? (
          <View style={[styles.board, { width: cell * size + GAP * (size - 1) }]}>
            {grid.map((row, r) => (
              <View key={r} style={styles.row}>
                {row.map((letter, c) => {
                  const key = cellKey(r, c);
                  const isFound = foundCells.has(key);
                  const isFirst = first?.r === r && first?.c === c;
                  return (
                    <SlayPressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={`${letter}, row ${r + 1} column ${c + 1}`}
                      accessibilityState={{ selected: isFirst }}
                      onPress={() => tapCell(r, c)}
                      style={[
                        styles.cell,
                        { width: cell, height: cell },
                        isFound ? styles.found : isFirst ? styles.first : styles.idle,
                      ]}
                    >
                      <SlayText
                        variant="h3"
                        weight="900"
                        color={isFound ? colors.limeGreen : isFirst ? colors.white : alpha.white80}
                        style={{ fontSize: Math.round(cell * 0.45), lineHeight: Math.round(cell * 0.6) }}
                      >
                        {letter}
                      </SlayText>
                    </SlayPressable>
                  );
                })}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.words}>
        {placed.map((word) => {
          const done = found.has(word);
          return (
            <View key={word} style={[styles.word, done ? styles.wordFound : styles.wordOpen]}>
              <SlayText
                variant="small"
                weight="700"
                color={done ? colors.limeGreen : alpha.white70}
                style={done ? styles.struck : undefined}
                accessibilityLabel={done ? `${word}, found` : word}
              >
                {word}
              </SlayText>
            </View>
          );
        })}
      </View>

      {won ? (
        <SlayText variant="bodyStrong" weight="700" color={colors.limeGreen} style={styles.center} accessibilityLiveRegion="polite">
          Every word found! 🎉
        </SlayText>
      ) : (
        <SlayText variant="small" color={alpha.white60} style={styles.center}>
          Found {found.size} of {total}. Finish now to keep going — you&apos;ll earn a reward for the words you found.
        </SlayText>
      )}

      <SlayButton variant="green" size="lg" onPress={() => onComplete(rewardFraction)}>
        {won ? actionLabel : `${actionLabel} (${found.size}/${total})`}
      </SlayButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  center: { textAlign: "center" },
  board: { alignSelf: "center", gap: GAP },
  row: { flexDirection: "row", gap: GAP },
  cell: { alignItems: "center", justifyContent: "center", borderRadius: 6 },
  idle: { backgroundColor: alpha.white5 },
  first: { backgroundColor: withAlpha(colors.cyan, 0.3), borderWidth: 2, borderColor: colors.cyan },
  found: { backgroundColor: withAlpha(colors.limeGreen, 0.25) },
  words: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  word: { borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4 },
  wordOpen: { borderColor: alpha.white20 },
  wordFound: { borderColor: withAlpha(colors.limeGreen, 0.5), backgroundColor: withAlpha(colors.limeGreen, 0.1) },
  struck: { textDecorationLine: "line-through" },
});
