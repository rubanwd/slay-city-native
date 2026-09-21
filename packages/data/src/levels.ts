import type { KnowledgeLevel } from "@slay/core/types";

import { callRpc, type Db } from "./rpc";

export async function availableKnowledgeLevels(db: Db): Promise<KnowledgeLevel[]> {
  return callRpc(db, "available_knowledge_levels");
}

export async function resetLevelProgress(db: Db): Promise<void> {
  await callRpc(db, "reset_level_progress");
}
