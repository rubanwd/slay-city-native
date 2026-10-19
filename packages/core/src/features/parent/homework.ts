/** One row as `parent_student_homework()` returns it. */
export interface HomeworkTopicRow {
  topic_id: string;
  title: string;
  group_name: string;
  teacher_username: string | null;
  word_count: number;
  grammar_count: number;
  vocab_completed_at: string | null;
  grammar_completed_at: string | null;
}

/** One homework topic the student's teacher assigned, with its pass state. */
export interface HomeworkTopicProgress {
  topicId: string;
  /** Authored by the teacher — shown as written, never translated. */
  title: string;
  groupName: string;
  teacherUsername: string | null;
  /** Words in the topic's vocabulary set; 0 when it has none. */
  wordCount: number;
  /** Grammar rules in the topic's grammar set; 0 when it has none. */
  grammarCount: number;
  vocabCompletedAt: string | null;
  grammarCompletedAt: string | null;
  /** Every module the topic actually has is done. */
  passed: boolean;
  /** At least one module done, but not all of them. */
  started: boolean;
}

/**
 * Turns one homework row into the state the dashboard shows.
 *
 * A topic can carry a vocabulary set, a grammar set, or both, and "passed"
 * means every module it *has* is done — a vocabulary-only topic is passed on
 * the vocabulary alone, and demanding a grammar pass it never offered would
 * leave it permanently unfinished. `started` deliberately excludes a finished
 * topic, so the two flags map onto three distinct chips: not started, in
 * progress, passed.
 */
export function toHomeworkTopicProgress(row: HomeworkTopicRow): HomeworkTopicProgress {
  const needsVocab = row.word_count > 0;
  const needsGrammar = row.grammar_count > 0;
  const vocabDone = row.vocab_completed_at !== null;
  const grammarDone = row.grammar_completed_at !== null;
  const passed = (!needsVocab || vocabDone) && (!needsGrammar || grammarDone);

  return {
    topicId: row.topic_id,
    title: row.title,
    groupName: row.group_name,
    teacherUsername: row.teacher_username,
    wordCount: row.word_count,
    grammarCount: row.grammar_count,
    vocabCompletedAt: row.vocab_completed_at,
    grammarCompletedAt: row.grammar_completed_at,
    passed,
    started: !passed && (vocabDone || grammarDone),
  };
}

/**
 * Puts each group's topics newest first.
 *
 * `parent_student_homework()` returns rows grouped by group name with each
 * group's topics oldest first. Reversing each run of rows from the same group
 * keeps the groups where they are and puts the latest topic at the top, like
 * every other topic list.
 */
export function newestTopicsFirst<T extends { group_name: string }>(rows: T[]): T[] {
  const result: T[] = [];
  let run: T[] = [];
  for (const row of rows) {
    if (run.length > 0 && run[0].group_name !== row.group_name) {
      result.push(...run.reverse());
      run = [];
    }
    run.push(row);
  }
  result.push(...run.reverse());
  return result;
}
