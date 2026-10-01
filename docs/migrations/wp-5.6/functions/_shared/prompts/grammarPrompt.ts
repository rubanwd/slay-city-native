/**
 * Pure prompt builder for AI grammar generation, the sibling of
 * `vocabularyPrompt.ts`. Kept framework-free and unit-tested so the exact
 * instructions sent to OpenRouter are verifiable without a network call.
 *
 * MOVED unchanged from `src/features/teacher/grammarPrompt.ts` by WP-5.6, with
 * its tests. See the header of `vocabularyPrompt.ts` for why (move, not copy).
 */

export interface GrammarPromptInput {
  /** The homework topic title (e.g. "Present Simple", "At the Airport"). */
  topicTitle: string;
  /** The topic description, if the teacher wrote one. */
  topicDescription?: string | null;
  /** Optional extra guidance from the teacher (level, focus, exclusions). */
  extraInstructions?: string | null;
  /** How many grammar rule points to generate. */
  pointCount: number;
  /** How many test questions to generate. */
  taskCount: number;
}

const MAX_FIELD_LEN = 500;

function clean(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_FIELD_LEN);
}

/**
 * Builds the chat prompt that asks the model for a JSON object with grammar rule
 * points and a matching test for a topic. The response contract is a strict JSON
 * object so {@link parseGeneratedGrammar} can read it back.
 */
export function buildGrammarPrompt(input: GrammarPromptInput): string {
  const title = clean(input.topicTitle);
  const description = clean(input.topicDescription);
  const extra = clean(input.extraInstructions);
  const points = Math.max(1, Math.round(input.pointCount));
  const tasks = Math.max(0, Math.round(input.taskCount));

  const lines: string[] = [
    `You are helping an English teacher build a grammar lesson for young learners (ages 7-14).`,
    `Topic: "${title}".`,
  ];
  if (description) lines.push(`Topic description: ${description}`);
  if (extra) lines.push(`Extra instructions from the teacher: ${extra}`);

  lines.push(
    ``,
    `Produce exactly ${points} short grammar rule point(s) relevant to the topic, suitable for children.`,
    `For each point provide:`,
    `- "title": a short name for the rule (e.g. "Present Simple: he/she/it + s").`,
    `- "explanation": one or two simple sentences explaining the rule in kid-friendly language.`,
    `- "example": one short English example sentence that demonstrates the rule.`,
    ``,
    `Also produce exactly ${tasks} test question(s) that check those rules. Each question is one of two types:`,
    `- {"type":"fill_blank","sentence":"She ___ to school every day.","answer":"goes","options":["goes","go","going","gone"],"translation":""}`,
    `  The sentence MUST contain "___" where the answer goes; "answer" is the correct word; "options" are 3-4 choices including the answer.`,
    `- {"type":"quiz","question":"Choose the correct form: He ___ football.","options":["plays","play","playing","played"],"correctIndex":0}`,
    `  "options" are 3-4 choices; "correctIndex" is the 0-based index of the correct one.`,
    ``,
    `Respond with ONLY a JSON object of this exact shape, no markdown, no commentary:`,
    `{"points":[{"title":"","explanation":"","example":""}],"tasks":[{"type":"fill_blank","sentence":"","answer":"","options":[""],"translation":""}]}`,
  );

  return lines.join("\n");
}
