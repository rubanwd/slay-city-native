import { View } from "react-native";

import type { RhymeMatchContent } from "@slay/core";

import type { TaskProps } from "../taskContract";
import { ChoiceTask } from "./ChoiceTask";
import { TaskHint, TaskWord } from "./TaskText";

/** Port of upstream's `RhymeMatchTask`: tap the word that rhymes with the target. */
export function RhymeMatchTask({ content, onComplete, actionLabel }: TaskProps<RhymeMatchContent>) {
  return (
    <ChoiceTask
      layout="grid"
      options={content.options}
      correctIndex={content.correctIndex}
      successText="Nice rhyme! 🎉"
      onComplete={onComplete}
      actionLabel={actionLabel}
      header={() => (
        <View>
          <TaskHint>{content.prompt}</TaskHint>
          <TaskWord>{content.targetWord}</TaskWord>
        </View>
      )}
    />
  );
}
