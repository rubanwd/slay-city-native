-- SLAY CITY — stock-Postgres bootstrap for replaying the migration timeline
--
-- Supplies only what a Supabase project provides and a plain `postgres:16-alpine`
-- container does not, so `supabase/migrations/*.sql` — including the `wp-2.3`
-- files staged in `docs/migrations/wp-2.3/` — replay unmodified against the real
-- schema instead of a hand-written stub. See
-- [[upstream-schema-replays-on-stock-postgres]] in project memory for how this
-- was derived (`SCN-11`) and CI.md in this directory for how it is run.
--
-- Run this once, before applying any migration, against a fresh database.

-- =========================================================================
-- Roles — PostgREST's four, matching what Supabase provisions
-- =========================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login password 'postgres';
  end if;
end;
$$;

grant anon to authenticator;
grant authenticated to authenticator;
grant service_role to authenticator;

-- The migrations run as the container's superuser, and fixtures/tests need to
-- switch into `authenticated` with `set local role` — both need the grant.
grant anon to current_user;
grant authenticated to current_user;
grant service_role to current_user;

-- =========================================================================
-- Schemas Supabase provisions that a migration or RPC references
-- =========================================================================

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

grant usage on schema auth, storage, extensions to anon, authenticated, service_role;

-- =========================================================================
-- auth.users — only the columns any migration or fixture reads
-- =========================================================================

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select on auth.users to anon, authenticated, service_role;

-- auth.uid() / auth.role() read the PostgREST-shaped claims a real request
-- carries in `request.jwt.claims` — the same setting the tests fake with
-- `set_config('request.jwt.claims', ..., true)`.

create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;

create or replace function auth.role()
returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    current_setting('role')
  );
$$;

-- =========================================================================
-- storage.buckets / storage.objects — only what content_images.sql,
-- homework_topic_notes.sql and feedback_reports.sql reference
-- =========================================================================

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

grant select, insert, update, delete on storage.buckets to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;

-- Matches Supabase's implementation closely enough for the one thing the
-- migrations call it for: splitting the folder segments out of an object key.
create or replace function storage.foldername(name text)
returns text[]
language sql immutable
as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1];
$$;

-- =========================================================================
-- Realtime publication — 20260722000002_homework_qa.sql adds a table to it
-- =========================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;
