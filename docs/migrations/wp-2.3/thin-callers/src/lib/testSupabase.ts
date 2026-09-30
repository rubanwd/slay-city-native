import { vi } from "vitest";

/**
 * A minimal stand-in for the Supabase server client, built for the WP-2.3
 * thin-caller tests. Only supports what these action files actually call:
 * `.auth.getUser()`, `.from(table).select().eq().order().maybeSingle()`
 * (one canned row per table, `.eq`/`.order` are no-ops), and `.rpc(name, args)`.
 *
 * Not a general-purpose Supabase mock — extend it if a future action needs a
 * shape it doesn't cover yet.
 */

export type MockUser = { id: string } | null;

export interface RpcResult {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

export interface MockSupabaseOptions {
  user?: MockUser;
  /** Table name -> the single row a `.maybeSingle()` read on it returns. */
  tables?: Record<string, unknown>;
  /** RPC name -> the `{ data, error }` pair `.rpc(name, args)` resolves to. */
  rpc?: Record<string, RpcResult>;
}

export function createMockSupabase(options: MockSupabaseOptions = {}) {
  const rpcCalls: Array<{ name: string; args: unknown }> = [];

  function tableBuilder(table: string) {
    const row = options.tables?.[table] ?? null;
    const result = { data: row, error: null };
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      maybeSingle: async () => result,
      then: (resolve: (v: typeof result) => unknown) => resolve(result),
    };
    return builder;
  }

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: options.user ?? null } }),
    },
    from: vi.fn((table: string) => tableBuilder(table)),
    rpc: vi.fn(async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return options.rpc?.[name] ?? { data: null, error: null };
    }),
  };

  return { client, rpcCalls };
}
