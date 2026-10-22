import { useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import type { CrosswordContent, CrosswordEntry } from "@slay/core";
import { alpha, colors, fontFamilyByWeight, withAlpha } from "@slay/tokens";

import { SlayButton, SlayText } from "~/components/ui";

import type { TaskProps } from "../taskContract";
import { NO_HELP_KEYBOARD } from "./AnswerInput";

const cellKey = (r: number, c: number) => `${r},${c}`;

/** Space between cells — upstream's `gap-0.5`. */
const GAP = 2;
/** Upstream's `h-9 w-9` cell is the largest; a wide grid shrinks to fit the screen instead of scrolling sideways. */
const MAX_CELL = 36;
const MIN_CELL = 18;

interface NumberedEntry extends CrosswordEntry {
  number: number;
}

interface BuiltGrid {
  cells: Map<string, { letter: string }>;
  numbers: Map<string, number>;
  /** Cell keys in reading order — where the return key goes next. */
  order: string[];
  rows: number;
  cols: number;
  clues: { across: NumberedEntry[]; down: NumberedEntry[] };
}

function entryCells(entry: CrosswordEntry): { r: number; c: number }[] {
  return entry.answer.split("").map((_, k) => ({
    r: entry.row + (entry.direction === "down" ? k : 0),
    c: entry.col + (entry.direction === "across" ? k : 0),
  }));
}

/** Upstream's `buildGrid`: lays out cells from entry coordinates and assigns standard crossword numbers. */
function buildGrid(entries: CrosswordEntry[]): BuiltGrid {
  const cells = new Map<string, { letter: string }>();
  let rows = 0;
  let cols = 0;

  entries.forEach((entry) => {
    entryCells(entry).forEach((cell, k) => {
      cells.set(cellKey(cell.r, cell.c), { letter: entry.answer[k] });
      rows = Math.max(rows, cell.r + 1);
      cols = Math.max(cols, cell.c + 1);
    });
  });

  // Number the start cells in reading order (top-to-bottom, left-to-right).
  const starts = new Set(entries.map((e) => cellKey(e.row, e.col)));
  const numbers = new Map<string, number>();
  const order: string[] = [];
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = cellKey(r, c);
      if (starts.has(key)) numbers.set(key, ++n);
      if (cells.has(key)) order.push(key);
    }
  }

  const numbered = entries.map<NumberedEntry>((e) => ({
    ...e,
    number: numbers.get(cellKey(e.row, e.col)) ?? 0,
  }));

  return {
    cells,
    numbers,
    order,
    rows,
    cols,
    clues: {
      across: numbered.filter((e) => e.direction === "across").sort((a, b) => a.number - b.number),
      down: numbered.filter((e) => e.direction === "down").sort((a, b) => a.number - b.number),
    },
  };
}

type Direction = CrosswordEntry["direction"];

/**
 * Port of upstream's `CrosswordTask`: type letters into the numbered grid
 * from the across and down clues, then check. Wrong cells show pink until
 * edited; the task finishes once the whole grid is right.
 *
 * What a phone adds: typing a letter moves on to the next cell of the word
 * being filled (across first, as a fresh tap starts), the return key steps
 * to the next cell in reading order (WP-3.5 AC4), and the keyboard is upper
 * case with no corrections or suggestions (AC2–3). The grid is sized from
 * its measured width, so even a 16-wide puzzle fits without sideways scroll.
 */
export function CrosswordTask({ content, onComplete, actionLabel }: TaskProps<CrosswordContent>) {
  const { prompt } = content;
  // Content is re-parsed every render; the grid is fixed for the task's life.
  const [{ cells, numbers, order, rows, cols, clues }] = useState(() => buildGrid(content.entries));
  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [width, setWidth] = useState<number | null>(null);

  const inputs = useRef(new Map<string, TextInput>());
  // The way the student is typing, once a letter has moved them on; a fresh tap clears it.
  const direction = useRef<Direction | null>(null);

  const allCorrect = [...cells.entries()].every(([key, cell]) => (values[key] ?? "") === cell.letter);
  const size = width === null ? 0 : Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor((width - GAP * (cols - 1)) / cols)));

  const focus = (key: string) => inputs.current.get(key)?.focus();

  const advanceFrom = (r: number, c: number) => {
    const across = cellKey(r, c + 1);
    const down = cellKey(r + 1, c);
    const way = direction.current ?? (cells.has(across) ? "across" : "down");
    const next = way === "across" ? across : down;
    if (cells.has(next)) {
      direction.current = way;
      focus(next);
    } else {
      direction.current = null;
    }
  };

  const setCell = (r: number, c: number, raw: string) => {
    const key = cellKey(r, c);
    const char = raw.slice(-1).toUpperCase();
    setValues((prev) => ({ ...prev, [key]: char }));
    setChecked(false);
    if (char) advanceFrom(r, c);
  };

  const stepFrom = (key: string) => {
    const next = order[order.indexOf(key) + 1];
    direction.current = null;
    if (next) focus(next);
  };

  return (
    <View style={styles.wrap}>
      <SlayText variant="h3" weight="600" style={styles.center}>
        {prompt}
      </SlayText>

      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width === null ? null : (
          <View style={[styles.grid, { width: cols * size + GAP * (cols - 1) }]}>
            {Array.from({ length: rows }, (_, r) => (
              <View key={r} style={styles.row}>
                {Array.from({ length: cols }, (_, c) => {
                  const key = cellKey(r, c);
                  const cell = cells.get(key);
                  if (!cell) return <View key={key} style={{ width: size, height: size }} />;

                  const value = values[key] ?? "";
                  const number = numbers.get(key);
                  const isWrong = checked && value !== cell.letter;
                  const isRight = checked && value === cell.letter;
                  const isLast = key === order[order.length - 1];
                  return (
                    <View key={key} style={{ width: size, height: size }}>
                      <TextInput
                        ref={(input) => {
                          if (input) inputs.current.set(key, input);
                          else inputs.current.delete(key);
                        }}
                        {...NO_HELP_KEYBOARD}
                        accessibilityLabel={`${number ? `${number}, ` : ""}Row ${r + 1} column ${c + 1}`}
                        value={value}
                        onChangeText={(text) => setCell(r, c, text)}
                        onPressIn={() => {
                          direction.current = null;
                        }}
                        autoCapitalize="characters"
                        // Typing over a filled cell replaces its letter rather than appending.
                        selectTextOnFocus
                        returnKeyType={isLast ? "done" : "next"}
                        submitBehavior={isLast ? "blurAndSubmit" : "submit"}
                        onSubmitEditing={() => stepFrom(key)}
                        selectionColor={colors.neonPink}
                        style={[
                          styles.cell,
                          { fontSize: Math.round(size * 0.5) },
                          isWrong ? styles.wrong : isRight ? styles.right : styles.idle,
                        ]}
                      />
                      {number ? (
                        <SlayText
                          variant="label"
                          weight="700"
                          color={alpha.white60}
                          pointerEvents="none"
                          style={[styles.number, { fontSize: Math.max(7, Math.round(size * 0.24)) }]}
                        >
                          {number}
                        </SlayText>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.clues}>
        <ClueList title="Across" entries={clues.across} />
        <ClueList title="Down" entries={clues.down} />
      </View>

      {checked && !allCorrect ? (
        <SlayText variant="bodyStrong" weight="700" color={colors.neonPink} style={styles.center} accessibilityLiveRegion="polite">
          Not quite — check the red cells.
        </SlayText>
      ) : null}

      {allCorrect ? (
        <SlayButton variant="green" size="lg" onPress={() => onComplete()}>
          {actionLabel}
        </SlayButton>
      ) : (
        <SlayButton variant="pink" size="lg" onPress={() => setChecked(true)}>
          Check
        </SlayButton>
      )}
    </View>
  );
}

function ClueList({ title, entries }: { title: string; entries: NumberedEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <View style={styles.clueList}>
      <SlayText variant="label" color={alpha.white50} accessibilityRole="header">
        {title}
      </SlayText>
      {entries.map((entry) => (
        <SlayText key={`${entry.number}-${entry.direction}`} variant="small" color={alpha.white80}>
          <SlayText variant="small" weight="700">
            {entry.number}.
          </SlayText>{" "}
          {entry.clue}
        </SlayText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  center: { textAlign: "center" },
  grid: { alignSelf: "center", gap: GAP },
  row: { flexDirection: "row", gap: GAP },
  cell: {
    width: "100%",
    height: "100%",
    padding: 0,
    borderRadius: 3,
    borderWidth: 1,
    textAlign: "center",
    fontFamily: fontFamilyByWeight["900"],
    textTransform: "uppercase",
    color: colors.white,
  },
  idle: { borderColor: alpha.white25, backgroundColor: alpha.white10 },
  right: { borderColor: colors.limeGreen, backgroundColor: withAlpha(colors.limeGreen, 0.15), color: colors.limeGreen },
  wrong: { borderColor: colors.neonPink, backgroundColor: withAlpha(colors.neonPink, 0.15), color: colors.neonPink },
  number: { position: "absolute", top: 0, left: 2, letterSpacing: 0 },
  clues: { gap: 16 },
  clueList: { gap: 6 },
});
