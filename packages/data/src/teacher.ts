import { callRpc, type Db } from "./rpc";

export type TeachingGroup = Awaited<ReturnType<typeof callRpc<"my_groups">>>[number];

export async function myGroups(db: Db): Promise<TeachingGroup[]> {
  return callRpc(db, "my_groups");
}
