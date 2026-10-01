// SLAY CITY — `draft-grammar` Edge Function.
//
// Drafts a grammar set (rule points plus a short test) for a homework topic via
// OpenRouter. Writes nothing: the draft comes back for the teacher to review,
// edit and publish.
//
// Replaces `generateGrammarDraft` in `src/features/teacher/grammarActions.ts`.
// The sibling of `draft-vocabulary` — see that function's header for why the
// OpenRouter call moved off every client (`OD-1`) and which authorization gap the
// move closes.
//
// Runtime: Deno (Supabase Edge Runtime). All of the logic is in `./spec.ts` and
// `../_shared/`, which are dependency-free and unit-tested under Node/Vitest.
// `verify_jwt = true` in `supabase/config.toml`.

import { serveDraftFunction } from "../_shared/edgeRuntime.ts";

import { draftGrammarSpec } from "./spec.ts";

serveDraftFunction(draftGrammarSpec);
