import { Redirect, useLocalSearchParams } from "expo-router";

import { DEV_MISSION_TASKS } from "~/features/dev/missionFixtures";
import { MissionScreen } from "~/features/mission";

/**
 * One task of every ported type with made-up content, in review mode so
 * nothing is recorded — for trying the tasks on a device with no backend. The
 * last has malformed content, to show the skip card. Dev-only.
 *
 * `?types=hangman,flashcards` plays only those types, in fixture order.
 */
export default function MissionPreviewScreen() {
  const { types } = useLocalSearchParams<{ types?: string }>();
  const only = types?.split(",");
  const tasks = only ? DEV_MISSION_TASKS.filter((task) => only.includes(task.taskType)) : DEV_MISSION_TASKS;

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <MissionScreen
      review
      exitHref="/dev/map"
      mission={{ id: "preview", title: "At the market", description: null, xpReward: 30, coinReward: 10 }}
      location={{ name: "Market", iconUrl: null }}
      tasks={tasks}
    />
  );
}
