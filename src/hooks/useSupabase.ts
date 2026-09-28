import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@slay/core/types";

import { supabase } from "~/lib/supabase";

/**
 * Returns the app's single Supabase client. A hook (rather than a bare import) so
 * screens depend on it the same way they depend on any other piece of app state,
 * and so a test can swap it out via mocking.
 */
export function useSupabase(): SupabaseClient<Database> {
  return supabase;
}
