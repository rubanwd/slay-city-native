import type { OddOneOutContent } from "@slay/core";

import type { TaskProps } from "../taskContract";
import { ChoiceTask } from "./ChoiceTask";
import { TaskPrompt } from "./TaskText";

/** Port of upstream's `OddOneOutTask`: tap the word that doesn't belong. */
export function OddOneOutTask({ content, onComplete, actionLabel }: TaskProps<OddOneOutContent>) {
  return (
    <ChoiceTask
      layout="grid"
      options={content.words}
      correctIndex={content.oddIndex}
      successText="Spot on! 🎉"
      failText="Not quite — the odd one is highlighted."
      onComplete={onComplete}
      actionLabel={actionLabel}
      header={() => <TaskPrompt>{content.prompt}</TaskPrompt>}
    />
  );
}
