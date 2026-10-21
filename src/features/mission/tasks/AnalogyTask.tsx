import { View } from "react-native";

import type { AnalogyContent } from "@slay/core";
import { alpha, colors } from "@slay/tokens";

import { SlayText } from "~/components/ui";

import type { TaskProps } from "../taskContract";
import { ChoiceTask } from "./ChoiceTask";

/** Port of upstream's `AnalogyTask`: "A is to B as C is to ___?" — tap what completes it. */
export function AnalogyTask({ content, onComplete, actionLabel }: TaskProps<AnalogyContent>) {
  const { wordA, wordB, wordC, options, correctIndex } = content;
  return (
    <ChoiceTask
      layout="grid"
      options={options}
      correctIndex={correctIndex}
      successText="Sharp thinking! 🎉"
      onComplete={onComplete}
      actionLabel={actionLabel}
      header={() => (
        <View>
          <SlayText variant="h3" weight="900" style={{ textAlign: "center" }}>
            {wordA} <SlayText variant="h3" weight="900" color={alpha.white40}>is to</SlayText> {wordB}
          </SlayText>
          <SlayText variant="h3" weight="900" color={colors.cyan} style={{ textAlign: "center", marginTop: 4 }}>
            {wordC} <SlayText variant="h3" weight="900" color={alpha.white40}>is to</SlayText> ___?
          </SlayText>
        </View>
      )}
    />
  );
}
