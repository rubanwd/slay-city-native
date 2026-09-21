import { callRpc, type Db } from "./rpc";

export async function resetLocationProgress(db: Db, locationId: string): Promise<void> {
  await callRpc(db, "reset_location_progress", { p_location_id: locationId });
}
