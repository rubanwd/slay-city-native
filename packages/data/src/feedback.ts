import { callRpc, type Db } from "./rpc";

export async function unreadFeedbackCount(db: Db): Promise<number> {
  return callRpc(db, "unread_feedback_count");
}

/** Returns how many reports were marked read. */
export async function markFeedbackRead(db: Db): Promise<number> {
  return callRpc(db, "mark_feedback_read");
}
