import {
  parseAnalogyContent,
  parseAntonymMatchContent,
  parseCategorySortContent,
  parseCauseEffectContent,
  parseClockReadingContent,
  parseCountingGameContent,
  parseDialogueChoiceContent,
  parseEmojiDecodeContent,
  parseLetterFillContent,
  parseMatchingContent,
  parseOddOneOutContent,
  parsePictureRevealContent,
  parseQuizContent,
  parseRhymeMatchContent,
  parseSentenceBuilderContent,
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
import { CategorySortTask } from "./tasks/CategorySortTask";
import { CauseEffectTask } from "./tasks/CauseEffectTask";
import { ClockReadingTask } from "./tasks/ClockReadingTask";
import { CountingGameTask } from "./tasks/CountingGameTask";
import { DialogueChoiceTask } from "./tasks/DialogueChoiceTask";
import { EmojiDecodeTask } from "./tasks/EmojiDecodeTask";
import { LetterFillTask } from "./tasks/LetterFillTask";
import { MatchingTask } from "./tasks/MatchingTask";
import { OddOneOutTask } from "./tasks/OddOneOutTask";
import { PictureRevealTask } from "./tasks/PictureRevealTask";
import { QuizTask } from "./tasks/QuizTask";
import { RhymeMatchTask } from "./tasks/RhymeMatchTask";
import { SentenceBuilderTask } from "./tasks/SentenceBuilderTask";
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
  category_sort: defineTask(parseCategorySortContent, CategorySortTask),
  cause_effect: defineTask(parseCauseEffectContent, CauseEffectTask),
  clock_reading: defineTask(parseClockReadingContent, ClockReadingTask),
  counting_game: defineTask(parseCountingGameContent, CountingGameTask),
  dialogue_choice: defineTask(parseDialogueChoiceContent, DialogueChoiceTask),
  emoji_decode: defineTask(parseEmojiDecodeContent, EmojiDecodeTask),
  letter_fill: defineTask(parseLetterFillContent, LetterFillTask),
  matching: defineTask(parseMatchingContent, MatchingTask),
  odd_one_out: defineTask(parseOddOneOutContent, OddOneOutTask),
  picture_reveal: defineTask(parsePictureRevealContent, PictureRevealTask),
  quiz: defineTask(parseQuizContent, QuizTask),
  rhyme_match: defineTask(parseRhymeMatchContent, RhymeMatchTask),
  sentence_builder: defineTask(parseSentenceBuilderContent, SentenceBuilderTask),
  size_order: defineTask(parseSizeOrderContent, SizeOrderTask),
  spot_the_difference: defineTask(parseSpotTheDifferenceContent, SpotTheDifferenceTask),
  story_sequencing: defineTask(parseStorySequencingContent, StorySequencingTask),
  true_false: defineTask(parseTrueFalseContent, TrueFalseTask),
  vocabulary: defineTask(parseVocabularyContent, VocabularyTask),
  word_scramble: defineTask(parseWordScrambleContent, WordScrambleTask),
};
