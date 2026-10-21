import {
  parseAnalogyContent,
  parseAntonymMatchContent,
  parseBubblePopContent,
  parseCategorySortContent,
  parseCauseEffectContent,
  parseClockReadingContent,
  parseCountingGameContent,
  parseDialogueChoiceContent,
  parseEmojiDecodeContent,
  parseFlashcardsContent,
  parseHangmanContent,
  parseLetterFillContent,
  parseMatchingContent,
  parseMemoryCardsContent,
  parseOddOneOutContent,
  parsePictureRevealContent,
  parseQuizContent,
  parseReactionTapContent,
  parseRhymeMatchContent,
  parseSentenceBuilderContent,
  parseSimonSequenceContent,
  parseSizeOrderContent,
  parseSpotTheDifferenceContent,
  parseStorySequencingContent,
  parseTrueFalseContent,
  parseVocabularyContent,
  parseWordScrambleContent,
  type MissionTaskType,
} from "@slay/core";

import { defineTask, type TaskRenderer } from "./taskContract";
import { AnalogyTask } from "./tasks/AnalogyTask";
import { AntonymMatchTask } from "./tasks/AntonymMatchTask";
import { BubblePopTask } from "./tasks/BubblePopTask";
import { CategorySortTask } from "./tasks/CategorySortTask";
import { CauseEffectTask } from "./tasks/CauseEffectTask";
import { ClockReadingTask } from "./tasks/ClockReadingTask";
import { CountingGameTask } from "./tasks/CountingGameTask";
import { DialogueChoiceTask } from "./tasks/DialogueChoiceTask";
import { EmojiDecodeTask } from "./tasks/EmojiDecodeTask";
import { FlashcardsTask } from "./tasks/FlashcardsTask";
import { HangmanTask } from "./tasks/HangmanTask";
import { LetterFillTask } from "./tasks/LetterFillTask";
import { MatchingTask } from "./tasks/MatchingTask";
import { MemoryCardsTask } from "./tasks/MemoryCardsTask";
import { OddOneOutTask } from "./tasks/OddOneOutTask";
import { PictureRevealTask } from "./tasks/PictureRevealTask";
import { QuizTask } from "./tasks/QuizTask";
import { ReactionTapTask } from "./tasks/ReactionTapTask";
import { RhymeMatchTask } from "./tasks/RhymeMatchTask";
import { SentenceBuilderTask } from "./tasks/SentenceBuilderTask";
import { SimonSequenceTask } from "./tasks/SimonSequenceTask";
import { SizeOrderTask } from "./tasks/SizeOrderTask";
import { SpotTheDifferenceTask } from "./tasks/SpotTheDifferenceTask";
import { StorySequencingTask } from "./tasks/StorySequencingTask";
import { TrueFalseTask } from "./tasks/TrueFalseTask";
import { VocabularyTask } from "./tasks/VocabularyTask";
import { WordScrambleTask } from "./tasks/WordScrambleTask";

/**
 * Every task type the app can play, keyed by `mission_task_type`. A type that
 * is missing here plays as upstream's "not available yet — skip ahead" card,
 * so a mission is never blocked by a task that hasn't been ported.
 *
 * WP-3.3–3.6 each add one line: `type: defineTask(parseTypeContent, TypeTask)`.
 */
export const TASKS: Partial<Record<MissionTaskType, TaskRenderer>> = {
  analogy: defineTask(parseAnalogyContent, AnalogyTask),
  antonym_match: defineTask(parseAntonymMatchContent, AntonymMatchTask),
  bubble_pop: defineTask(parseBubblePopContent, BubblePopTask),
  category_sort: defineTask(parseCategorySortContent, CategorySortTask),
  cause_effect: defineTask(parseCauseEffectContent, CauseEffectTask),
  clock_reading: defineTask(parseClockReadingContent, ClockReadingTask),
  counting_game: defineTask(parseCountingGameContent, CountingGameTask),
  dialogue_choice: defineTask(parseDialogueChoiceContent, DialogueChoiceTask),
  emoji_decode: defineTask(parseEmojiDecodeContent, EmojiDecodeTask),
  flashcards: defineTask(parseFlashcardsContent, FlashcardsTask),
  hangman: defineTask(parseHangmanContent, HangmanTask),
  letter_fill: defineTask(parseLetterFillContent, LetterFillTask),
  matching: defineTask(parseMatchingContent, MatchingTask),
  memory_cards: defineTask(parseMemoryCardsContent, MemoryCardsTask),
  odd_one_out: defineTask(parseOddOneOutContent, OddOneOutTask),
  picture_reveal: defineTask(parsePictureRevealContent, PictureRevealTask),
  quiz: defineTask(parseQuizContent, QuizTask),
  reaction_tap: defineTask(parseReactionTapContent, ReactionTapTask),
  rhyme_match: defineTask(parseRhymeMatchContent, RhymeMatchTask),
  sentence_builder: defineTask(parseSentenceBuilderContent, SentenceBuilderTask),
  simon_sequence: defineTask(parseSimonSequenceContent, SimonSequenceTask),
  size_order: defineTask(parseSizeOrderContent, SizeOrderTask),
  spot_the_difference: defineTask(parseSpotTheDifferenceContent, SpotTheDifferenceTask),
  story_sequencing: defineTask(parseStorySequencingContent, StorySequencingTask),
  true_false: defineTask(parseTrueFalseContent, TrueFalseTask),
  vocabulary: defineTask(parseVocabularyContent, VocabularyTask),
  word_scramble: defineTask(parseWordScrambleContent, WordScrambleTask),
};
