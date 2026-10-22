import { Redirect, useLocalSearchParams, useRouter } from "expo-router";

import { RewardScreen } from "~/features/reward";

/**
 * The reward screen with made-up amounts and no backend — for trying the
 * celebration on a device. `?replay=1` shows the already-completed case,
 * `?milestone=location|district|level` each milestone card. Dev-only.
 */
export default function RewardPreviewScreen() {
  const router = useRouter();
  const { replay, milestone } = useLocalSearchParams<{ replay?: string; milestone?: "location" | "district" | "level" }>();

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  const alreadyCompleted = replay === "1";
  return (
    <RewardScreen
      coins={alreadyCompleted ? 0 : 10}
      xp={alreadyCompleted ? 0 : 30}
      alreadyCompleted={alreadyCompleted}
      missionTitle="At the market"
      taskNames={["Quiz", "Matching", "Spelling Bee"]}
      locationName="Market"
      missionsCompletedAtLocation={2}
      totalMissionsAtLocation={3}
      milestone={milestone ?? null}
      clearedLevelName="Beginner"
      nextLevelName="Elementary"
      advancedToLevelName="Elementary"
      onContinue={() => router.replace("/dev/map")}
    />
  );
}
