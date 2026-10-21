import {
  parseAnalogyContent,
  parseAntonymMatchContent,
  parseCauseEffectContent,
  parseClockReadingContent,
  parseCountingGameContent,
  parseDialogueChoiceContent,
  parseEmojiDecodeContent,
  parseOddOneOutContent,
  parsePictureRevealContent,
  parseQuizContent,
  parseRhymeMatchContent,
  parseSpotTheDifferenceContent,
  parseTrueFalseContent,
  parseVocabularyContent,
  type MissionTaskType,
} from "@slay/core";

import { defineTask, type TaskRenderer } from "./taskContract";
import { AnalogyTask } from "./tasks/AnalogyTask";
import { AntonymMatchTask } from "./tasks/AntonymMatchTask";
import { CauseEffectTask } from "./tasks/CauseEffectTask";
import { ClockReadingTask } from "./tasks/ClockReadingTask";
import { CountingGameTask } from "./tasks/CountingGameTask";
import { DialogueChoiceTask } from "./tasks/DialogueChoiceTask";
import { EmojiDecodeTask } from "./tasks/EmojiDecodeTask";
import { OddOneOutTask } from "./tasks/OddOneOutTask";
import { PictureRevealTask } from "./tasks/PictureRevealTask";
import { QuizTask } from "./tasks/QuizTask";
import { RhymeMatchTask } from "./tasks/RhymeMatchTask";
import { SpotTheDifferenceTask } from "./tasks/SpotTheDifferenceTask";
import { TrueFalseTask } from "./tasks/TrueFalseTask";
import { VocabularyTask } from "./tasks/VocabularyTask";

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
  cause_effect: defineTask(parseCauseEffectContent, CauseEffectTask),
  clock_reading: defineTask(parseClockReadingContent, ClockReadingTask),
  counting_game: defineTask(parseCountingGameContent, CountingGameTask),
  dialogue_choice: defineTask(parseDialogueChoiceContent, DialogueChoiceTask),
  emoji_decode: defineTask(parseEmojiDecodeContent, EmojiDecodeTask),
  odd_one_out: defineTask(parseOddOneOutContent, OddOneOutTask),
  picture_reveal: defineTask(parsePictureRevealContent, PictureRevealTask),
  quiz: defineTask(parseQuizContent, QuizTask),
  rhyme_match: defineTask(parseRhymeMatchContent, RhymeMatchTask),
  spot_the_difference: defineTask(parseSpotTheDifferenceContent, SpotTheDifferenceTask),
  true_false: defineTask(parseTrueFalseContent, TrueFalseTask),
  vocabulary: defineTask(parseVocabularyContent, VocabularyTask),
};
