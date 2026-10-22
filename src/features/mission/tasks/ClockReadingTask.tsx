import { View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";

import type { ClockReadingContent } from "@slay/core";
import { alpha, colors } from "@slay/tokens";

import type { TaskProps } from "../taskContract";
import { ChoiceTask } from "./ChoiceTask";
import { TaskPrompt } from "./TaskText";

const TICKS = Array.from({ length: 12 }, (_, i) => i);

/** Port of upstream's `ClockReadingTask`: read the analog clock, tap the digital time. */
export function ClockReadingTask({ content, onComplete, actionLabel }: TaskProps<ClockReadingContent>) {
  const { prompt, hour, minute, options, correctIndex } = content;
  const hourAngle = (hour % 12) * 30 + minute * 0.5;
  const minuteAngle = minute * 6;

  return (
    <ChoiceTask
      layout="grid"
      options={options}
      correctIndex={correctIndex}
      successText="Right on time! 🎉"
      onComplete={onComplete}
      actionLabel={actionLabel}
      header={() => (
        <View style={{ gap: 24 }}>
          <TaskPrompt>{prompt}</TaskPrompt>
          <Svg viewBox="0 0 200 200" width={176} height={176} style={{ alignSelf: "center" }} accessibilityLabel="Clock face">
            <Circle cx={100} cy={100} r={96} fill={alpha.white5} stroke={alpha.white20} strokeWidth={3} />
            {TICKS.map((i) => {
              const angle = (i * 30 * Math.PI) / 180;
              return (
                <Line
                  key={i}
                  x1={100 + 82 * Math.sin(angle)}
                  y1={100 - 82 * Math.cos(angle)}
                  x2={100 + 92 * Math.sin(angle)}
                  y2={100 - 92 * Math.cos(angle)}
                  stroke={alpha.white40}
                  strokeWidth={3}
                />
              );
            })}
            <Line
              x1={100}
              y1={100}
              x2={100}
              y2={55}
              stroke={colors.cyan}
              strokeWidth={5}
              strokeLinecap="round"
              transform={`rotate(${hourAngle} 100 100)`}
            />
            <Line
              x1={100}
              y1={100}
              x2={100}
              y2={32}
              stroke={colors.limeGreen}
              strokeWidth={3.5}
              strokeLinecap="round"
              transform={`rotate(${minuteAngle} 100 100)`}
            />
            <Circle cx={100} cy={100} r={5} fill={colors.white} />
          </Svg>
        </View>
      )}
    />
  );
}
