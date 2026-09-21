import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";

/**
 * Every function in this package takes this as its first argument and never
 * constructs one — see docs/SYNC.md §6 for why packages/data is not sync-tracked.
 */
export type Db = SupabaseClient<Database>;

type Functions = Database["public"]["Functions"];

/**
 * A `SECURITY DEFINER` RPC declared `RETURNS TABLE (...)` comes back from
 * PostgREST as an array even when the function only ever produces one row.
 * Callers of a single-row RPC want the row, not the array — an empty array
 * means the RPC's own guard rejected the call (e.g. an unauthorised caller),
 * which is a bug in the caller, not a value to shrug off as `undefined`.
 */
export function firstRow<Row>(rows: Row[], fnName: string): Row {
  const [row] = rows;
  if (!row) throw new Error(`${fnName} returned no row`);
  return row;
}

export async function callRpc<Name extends keyof Functions & string>(
  db: Db,
  fnName: Name,
  ...args: Functions[Name]["Args"] extends never ? [] : [Functions[Name]["Args"]]
): Promise<Functions[Name]["Returns"]> {
  const { data, error } = await db.rpc(fnName, ...(args as [never]));
  if (error) throw error;
  return data as Functions[Name]["Returns"];
}
