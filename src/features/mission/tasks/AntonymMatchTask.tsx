import { View } from "react-native";

import type { AntonymMatchContent } from "@slay/core";

import type { TaskProps } from "../taskContract";
import { ChoiceTask } from "./ChoiceTask";
import { TaskHint, TaskWord } from "./TaskText";

/** Port of upstream's `AntonymMatchTask`: tap the option that means the opposite. */
export function AntonymMatchTask({ content, onComplete, actionLabel }: TaskProps<AntonymMatchContent>) {
  return (
    <ChoiceTask
      layout="grid"
      options={content.options}
      correctIndex={content.correctIndex}
      successText="Exactly opposite! 🎉"
      onComplete={onComplete}
      actionLabel={actionLabel}
      header={() => (
        <View>
          <TaskHint>Tap the opposite of</TaskHint>
          <TaskWord>{content.word}</TaskWord>
        </View>
      )}
    />
  );
}
