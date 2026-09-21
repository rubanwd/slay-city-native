import type { KnowledgeLevel } from "@slay/core/types";

import { callRpc, type Db } from "./rpc";

export async function setMyKnowledgeLevel(db: Db, level: KnowledgeLevel): Promise<void> {
  await callRpc(db, "set_my_knowledge_level", { p_level: level });
}
