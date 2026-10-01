import { vi } from "vitest";

/**
 * A minimal stand-in for the Supabase server client, built for the WP-2.3
 * thin-caller tests and extended by WP-5.6. Only supports what these action files
 * actually call: `.auth.getUser()`,
 * `.from(table).select().eq().order().maybeSingle()` (one canned row per table,
 * `.eq`/`.order` are no-ops), `.rpc(name, args)`, and — new in WP-5.6 —
 * `.functions.invoke(name, { body })`.
 *
 * Not a general-purpose Supabase mock — extend it if a future action needs a
 * shape it doesn't cover yet.
 */

export type MockUser = { id: string } | null;

export interface RpcResult {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

/** What one `functions.invoke(name, …)` resolves to. */
export interface InvokeResult {
  data?: unknown;
  error?: unknown;
}

export interface MockSupabaseOptions {
  user?: MockUser;
  /** Table name -> the single row a `.maybeSingle()` read on it returns. */
  tables?: Record<string, unknown>;
  /** RPC name -> the `{ data, error }` pair `.rpc(name, args)` resolves to. */
  rpc?: Record<string, RpcResult>;
  /**
   * Edge Function name -> what `.functions.invoke(name, …)` resolves to. Set
   * `error` to a `FunctionsHttpError` to exercise `readFunctionError`.
   */
  functions?: Record<string, InvokeResult>;
}

export function createMockSupabase(options: MockSupabaseOptions = {}) {
  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  const invokeCalls: Array<{ name: string; body: unknown }> = [];

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
    functions: {
      invoke: vi.fn(async (name: string, init?: { body?: unknown }) => {
        invokeCalls.push({ name, body: init?.body });
        return options.functions?.[name] ?? { data: null, error: null };
      }),
    },
  };

  return { client, rpcCalls, invokeCalls };
}
