import { callRpc, firstRow, type Db } from "./rpc";

export type MissionCompletionResult = Awaited<ReturnType<typeof callRpc<"complete_mission">>>[number];

export async function completeMission(
  db: Db,
  missionId: string,
  rewardFraction?: number,
): Promise<MissionCompletionResult> {
  const rows = await callRpc(db, "complete_mission", {
    p_mission_id: missionId,
    ...(rewardFraction === undefined ? {} : { p_reward_fraction: rewardFraction }),
  });
  return firstRow(rows, "complete_mission");
}
