import { callRpc, type Db } from "./rpc";

/** Returns the caller's total recorded study seconds after adding this heartbeat. */
export async function recordStudyTime(db: Db, seconds: number): Promise<number> {
  return callRpc(db, "record_study_time", { p_seconds: seconds });
}
