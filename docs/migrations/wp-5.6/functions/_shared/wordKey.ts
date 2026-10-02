/**
 * Cache key for the shared vocabulary image library, so "Cat", " cat " and
 * "cat" all reuse one generated image.
 *
 * Duplicated rather than imported from `src/features/homework/vocabulary.ts`:
 * that file also exports `buildVocabTest`, `clampWordCount` and
 * `defaultTestTaskCount`, which drive the browser UI and have no business
 * running in Deno, and its own copy of `normalizeWordKey` has to stay — the UI
 * computes the same key client-side to decide whether a word already has an
 * image. Five lines is cheaper to re-derive here than to share across the
 * repository boundary (EDGE-FUNCTIONS-PLAN.md §4.5's `clampWordCount`
 * precedent). Keep the two definitions identical: changing one without the
 * other orphans the cache for every word normalized differently.
 */
export function normalizeWordKey(word: string): string {
  return String(word ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
