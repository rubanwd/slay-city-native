/**
 * Letter-puzzle maths shared by the tile-based word tasks (word scramble,
 * missing letters), kept free of React so it stays unit-testable.
 *
 * The rule these helpers exist to enforce: **a student can only ever be asked
 * to place a character they can see.** Answers are real vocabulary entries, so
 * they may be several words long ("adventure tourist") or carry punctuation.
 * Turning such an answer into one tile per character produces blank-looking
 * tiles for the spaces, which read as unusable and leave the task unsolvable —
 * the answer row never matches and the Finish button stays disabled. Spaces are
 * therefore never tiles: they are drawn as gaps in the answer instead.
 */

/** Characters the student is never asked to place — they are shown for free. */
const FREE_CHAR = /[\s\p{P}\p{S}]/u;

export interface ScrambleWord {
  /** The characters the student taps, in answer order, with spaces removed. */
  letters: string[];
  /** Length of each whitespace-separated word, so the answer can show its gaps. */
  groupSizes: number[];
}

/**
 * Splits an answer into the tiles a scramble is played with and the word
 * lengths its answer row is grouped by. Whitespace is collapsed and dropped
 * from the tiles; everything else (letters, digits, hyphens, apostrophes) stays
 * a visible, tappable tile.
 */
export function scrambleWord(word: string): ScrambleWord {
  const groups = String(word ?? "")
    .normalize("NFKC")
    .split(/\s+/)
    .filter((group) => group.length > 0);

  return {
    letters: groups.join("").split(""),
    groupSizes: groups.map((group) => group.length),
  };
}

/** Groups slot positions by word, so the answer row can lay them out with gaps. */
export function slotGroups(groupSizes: number[]): number[][] {
  const groups: number[][] = [];
  let next = 0;
  for (const size of groupSizes) {
    groups.push(Array.from({ length: size }, () => next++));
  }
  return groups;
}

/** Comparable form of an answer: case-, whitespace- and Unicode-form-insensitive. */
export function normalizeSpelling(value: string): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, "")
    .toLowerCase();
}

/** Whether the letters the student placed spell the answer. */
export function isSpelledCorrectly(built: string, word: string): boolean {
  const target = normalizeSpelling(word);
  return target.length > 0 && normalizeSpelling(built) === target;
}

/**
 * Which positions of a word are blanked out in the missing-letters task.
 *
 * Only characters the student can be asked for are candidates — spaces and
 * punctuation stay visible, so a multi-word answer never hides an invisible
 * blank. Every other candidate is blanked, always leaving the first one
 * showing; a word with a single candidate blanks that one.
 */
export function blankIndicesFor(word: string): number[] {
  const candidates = String(word ?? "")
    .split("")
    .map((char, index) => ({ char, index }))
    .filter(({ char }) => !FREE_CHAR.test(char));

  if (candidates.length === 0) return [];
  const blanks = candidates.filter((_, position) => position % 2 === 1).map((entry) => entry.index);
  return blanks.length > 0 ? blanks : [candidates[candidates.length - 1].index];
}
