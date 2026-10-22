import { useLocalSearchParams } from "expo-router";

import { RewardLoader, type CompletionResult } from "~/features/reward";

/**
 * `/mission/[missionId]/reward`. `MissionScreen` passes what
 * `complete_mission` returned as `xp`, `coins` and `replay`; reopened without
 * them, the screen falls back to the completion's recorded amounts.
 */
export default function RewardRoute() {
  const { missionId, xp, coins, replay } = useLocalSearchParams<{
    missionId: string;
    xp?: string;
    coins?: string;
    replay?: string;
  }>();

  const result: CompletionResult | null =
    xp !== undefined && coins !== undefined && Number.isFinite(Number(xp)) && Number.isFinite(Number(coins))
      ? { xp: Number(xp), coins: Number(coins), alreadyCompleted: replay === "1" }
      : null;

  return <RewardLoader key={missionId} missionId={missionId} result={result} />;
}
