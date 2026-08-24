-- Multi-Agent Builder — base schema (idempotent & self-reconciling)
--
-- Apply in the Supabase SQL Editor (or `supabase db push`). Safe to run more
-- than once, AND safe to run over a pre-existing partial schema: every required
-- column is added with `add column if not exists`, so tables created by an
-- earlier/different script are upgraded in place without dropping data.

create extension if not exists pgcrypto;

-- ===========================================================================
-- workflows: the canvas graph (nodes + edges) the editor loads and saves.
-- ===========================================================================
create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid()
);

alter table public.workflows add column if not exists user_id     uuid;
alter table public.workflows add column if not exists name        text not null default 'New Multi-Agent Workflow';
alter table public.workflows add column if not exists description text;
alter table public.workflows add column if not exists nodes       jsonb not null default '[]'::jsonb;
alter table public.workflows add column if not exists edges       jsonb not null default '[]'::jsonb;
alter table public.workflows add column if not exists created_at  timestamptz not null default now();
alter table public.workflows add column if not exists updated_at  timestamptz not null default now();

-- Link user_id to auth.users only if the FK isn't already present.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'workflows'
      and constraint_name = 'workflows_user_id_fkey'
  ) then
    alter table public.workflows
      add constraint workflows_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete set null;
  end if;
end
$$;

-- ===========================================================================
-- workflow_runs: one row per execution of a workflow.
-- ===========================================================================
create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid()
);

alter table public.workflow_runs add column if not exists workflow_id uuid;
alter table public.workflow_runs add column if not exists status      text not null default 'RUNNING'; -- RUNNING | COMPLETED | FAILED
alter table public.workflow_runs add column if not exists input_data  jsonb;
alter table public.workflow_runs add column if not exists error       text;
alter table public.workflow_runs add column if not exists created_at  timestamptz not null default now();
alter table public.workflow_runs add column if not exists finished_at timestamptz;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'workflow_runs'
      and constraint_name = 'workflow_runs_workflow_id_fkey'
  ) then
    alter table public.workflow_runs
      add constraint workflow_runs_workflow_id_fkey
      foreign key (workflow_id) references public.workflows (id) on delete cascade;
  end if;
end
$$;

create index if not exists workflow_runs_workflow_id_idx
  on public.workflow_runs (workflow_id, created_at desc);

-- ===========================================================================
-- run_logs: one row per node executed within a run. The Execution Logs panel
-- reads these and subscribes to realtime INSERTs.
-- ===========================================================================
create table if not exists public.run_logs (
  id uuid primary key default gen_random_uuid()
);

alter table public.run_logs add column if not exists run_id     uuid;
alter table public.run_logs add column if not exists node_id    text;
alter table public.run_logs add column if not exists node_label text;
alter table public.run_logs add column if not exists status     text; -- RUNNING | SUCCESS | FAILED
alter table public.run_logs add column if not exists log_data   jsonb not null default '{}'::jsonb; -- { input_context, output }
alter table public.run_logs add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'run_logs'
      and constraint_name = 'run_logs_run_id_fkey'
  ) then
    alter table public.run_logs
      add constraint run_logs_run_id_fkey
      foreign key (run_id) references public.workflow_runs (id) on delete cascade;
  end if;
end
$$;

create index if not exists run_logs_run_id_idx
  on public.run_logs (run_id, created_at asc);

-- ===========================================================================
-- Realtime: the logs panel subscribes to postgres_changes on run_logs.
-- ===========================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'run_logs'
  ) then
    alter publication supabase_realtime add table public.run_logs;
  end if;
end
$$;

-- ===========================================================================
-- Row Level Security
--
-- The app currently ships WITHOUT an auth/login flow — it talks to Supabase
-- with the anon key and no signed-in user. Enabling RLS with per-user policies
-- now would deny every request and break the app, so RLS is left DISABLED to
-- match the current no-auth reality.
--
-- >>> When you add Supabase Auth (Tier 3), remove the three DISABLE lines and
--     uncomment the policy block beneath them. <<<
-- ===========================================================================
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
