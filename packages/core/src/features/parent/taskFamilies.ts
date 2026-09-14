import type { MissionTaskType } from "@/features/mission/types";

/**
 * The three kinds of practice a parent cares about.
 *
 * A mission is built from any of thirty-odd task types, and listing them one by
 * one on the dashboard would say very little ("3 Bubble Pop, 2 Odd One Out").
 * Grouping them answers the question a parent actually asks — *what* has my
 * child been practising: words, whole sentences, or thinking games.
 */
export type TaskFamily = "words" | "sentences" | "thinking";

/** Display order of the families wherever they are listed together. */
export const TASK_FAMILIES: readonly TaskFamily[] = ["words", "sentences", "thinking"] as const;

/**
 * Which family each task type belongs to. Typed as a total record so adding a
 * task type to the enum fails the build until it is classified here.
 */
const FAMILY_BY_TASK_TYPE: Record<MissionTaskType, TaskFamily> = {
  vocabulary: "words",
  matching: "words",
  flashcards: "words",
  spelling_bee: "words",
  word_scramble: "words",
  word_search: "words",
  crossword: "words",
  hangman: "words",
  letter_fill: "words",
  rhyme_match: "words",
  antonym_match: "words",
  emoji_decode: "words",
  picture_reveal: "words",

  quiz: "sentences",
  true_false: "sentences",
  sentence_builder: "sentences",
  fill_blank: "sentences",
  story_sequencing: "sentences",
  dialogue_choice: "sentences",
  cause_effect: "sentences",
  analogy: "sentences",

  snake_game: "thinking",
  bubble_pop: "thinking",
  memory_cards: "thinking",
  category_sort: "thinking",
  odd_one_out: "thinking",
  counting_game: "thinking",
  simon_sequence: "thinking",
  reaction_tap: "thinking",
  size_order: "thinking",
  spot_the_difference: "thinking",
  clock_reading: "thinking",
};

export function taskFamilyOf(taskType: MissionTaskType): TaskFamily {
  return FAMILY_BY_TASK_TYPE[taskType];
}
