-- Multi-Agent Builder — base schema
-- Apply this in the Supabase SQL Editor (or `supabase db push`).
-- It is idempotent: safe to run more than once.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- workflows: the canvas graph (nodes + edges) the editor loads and saves.
-- ---------------------------------------------------------------------------
create table if not exists public.workflows (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null,
  name        text not null default 'New Multi-Agent Workflow',
  description text,
  nodes       jsonb not null default '[]'::jsonb,
  edges       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- workflow_runs: one row per execution of a workflow.
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_runs (
  id          uuid primary key default gen_random_uuid(),
  workflow_id uuid references public.workflows (id) on delete cascade,
  status      text not null default 'RUNNING',   -- RUNNING | COMPLETED | FAILED
  input_data  jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists workflow_runs_workflow_id_idx
  on public.workflow_runs (workflow_id, created_at desc);

-- ---------------------------------------------------------------------------
-- run_logs: one row per node executed within a run. The Execution Logs panel
-- reads these and subscribes to realtime INSERTs.
-- ---------------------------------------------------------------------------
create table if not exists public.run_logs (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid not null references public.workflow_runs (id) on delete cascade,
  node_id    text not null,
  node_label text,
  status     text not null,                        -- RUNNING | SUCCESS | FAILED
  log_data   jsonb not null default '{}'::jsonb,   -- { input_context, output }
  created_at timestamptz not null default now()
);

create index if not exists run_logs_run_id_idx
  on public.run_logs (run_id, created_at asc);

-- ---------------------------------------------------------------------------
-- Realtime: the logs panel subscribes to postgres_changes on run_logs.
-- Add the table to the supabase_realtime publication (guarded so re-runs
-- don't error if it is already a member).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'run_logs'
  ) then
    alter publication supabase_realtime add table public.run_logs;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- The app currently ships WITHOUT an auth/login flow — it talks to Supabase
-- with the anon key and no signed-in user. Enabling RLS with per-user
-- policies now would deny every request and break the app. RLS is therefore
-- left DISABLED here to match the current no-auth reality.
--
-- >>> When you add Supabase Auth (Tier 3), delete the four lines directly
--     below and uncomment the policy block beneath them. <<<
-- ---------------------------------------------------------------------------
alter table public.workflows     disable row level security;
alter table public.workflow_runs disable row level security;
alter table public.run_logs      disable row level security;

-- -- Per-user policies to enable once auth is wired up:
-- alter table public.workflows     enable row level security;
-- alter table public.workflow_runs enable row level security;
-- alter table public.run_logs      enable row level security;
--
-- create policy "owner reads own workflows" on public.workflows
--   for select using (auth.uid() = user_id);
-- create policy "owner writes own workflows" on public.workflows
--   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
--
-- create policy "owner reads own runs" on public.workflow_runs
--   for select using (exists (
--     select 1 from public.workflows w
--     where w.id = workflow_runs.workflow_id and w.user_id = auth.uid()));
-- create policy "owner writes own runs" on public.workflow_runs
--   for all using (exists (
--     select 1 from public.workflows w
--     where w.id = workflow_runs.workflow_id and w.user_id = auth.uid()))
--   with check (exists (
--     select 1 from public.workflows w
--     where w.id = workflow_runs.workflow_id and w.user_id = auth.uid()));
--
-- create policy "owner reads own logs" on public.run_logs
--   for select using (exists (
--     select 1 from public.workflow_runs r
--     join public.workflows w on w.id = r.workflow_id
--     where r.id = run_logs.run_id and w.user_id = auth.uid()));
-- create policy "owner writes own logs" on public.run_logs
--   for all using (exists (
--     select 1 from public.workflow_runs r
--     join public.workflows w on w.id = r.workflow_id
--     where r.id = run_logs.run_id and w.user_id = auth.uid()))
--   with check (exists (
--     select 1 from public.workflow_runs r
--     join public.workflows w on w.id = r.workflow_id
--     where r.id = run_logs.run_id and w.user_id = auth.uid()));
