import { Redirect } from "expo-router";

import { DEV_MISSION_TASKS } from "~/features/dev/missionFixtures";
import { MissionScreen } from "~/features/mission";

/**
 * One task of every ported type with made-up content, in review mode so
 * nothing is recorded — for trying the tasks on a device with no backend. The
 * last is a type not ported yet, to show the skip card. Dev-only.
 */
export default function MissionPreviewScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <MissionScreen
      review
      exitHref="/dev/map"
      mission={{ id: "preview", title: "At the market", description: null, xpReward: 30, coinReward: 10 }}
      location={{ name: "Market", iconUrl: null }}
      tasks={DEV_MISSION_TASKS}
    />
  );
}
