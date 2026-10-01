-- SLAY CITY — WP-5.6 (1/1) rollback: AI generation ledger + rate-limit claim
--
-- Undoes `20260930000010_ai_generation_rate_limit.sql`.
--
-- Running this while `draft-vocabulary` / `draft-grammar` are still deployed
-- makes every drafting call fail: the functions call `claim_ai_generation`
-- before their outbound request and treat an RPC error as `internal` (500)
-- rather than proceeding unmetered. That is deliberate — a rate limiter that
-- fails open is not a rate limiter. Undeploy or revert the functions first,
-- or accept that AI drafting is off until this is re-applied.
--
-- Dropping the table discards the spend history. Nothing else reads it, so no
-- other object breaks, but the §6.4 budget tuning that history is for has to
-- start over. Copy it out first if the rollback is for anything other than an
-- incident.

drop function if exists public.claim_ai_generation(uuid, uuid, text, uuid);
drop function if exists public.ai_window_retry_after(uuid, text, interval);

-- The two indexes and the RLS setting go with the table.
drop table if exists public.ai_generation_events;
