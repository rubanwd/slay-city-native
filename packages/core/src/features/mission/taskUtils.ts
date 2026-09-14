/** Returns a new array with the elements of `input` in random order (Fisher–Yates). */
export function shuffle<T>(input: readonly T[]): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Normalizes an answer for forgiving comparison (case- and whitespace-insensitive). */
export function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
