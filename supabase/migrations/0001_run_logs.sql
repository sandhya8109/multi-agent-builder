-- Creates the run_logs table the Execution Logs panel (ExecutionLogsSheet.tsx)
-- reads from and subscribes to via Supabase Realtime, and that
-- /api/workflows/[id]/execute writes to as each node finishes.
--
-- This table does not exist anywhere in the current schema (there are no
-- migrations checked into this repo at all), so the Logs panel currently
-- opens to a permanently empty state. Run this file in the Supabase SQL
-- editor for this project to fix that.
--
-- Assumes `public.workflows.id` is `uuid` (Supabase's default for a
-- generated primary key, and consistent with how the app creates
-- workflows). If that's not the actual column type in your project, drop
-- the REFERENCES clause below and keep workflow_id as a plain uuid.

create table if not exists public.run_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  workflow_id uuid references public.workflows(id) on delete cascade,
  node_id text not null,
  node_label text,
  status text not null check (status in ('RUNNING', 'SUCCESS', 'FAILED', 'ERROR')),
  log_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists run_logs_run_id_idx on public.run_logs (run_id, created_at);
create index if not exists run_logs_workflow_id_idx on public.run_logs (workflow_id);

alter table public.run_logs enable row level security;

-- Mirrors the permissive access the `workflows` table already grants the
-- anon key (this app has no per-user row ownership enforced elsewhere
-- today). Tighten to auth.uid()-scoped policies if you add real
-- multi-tenant isolation later.
drop policy if exists "run_logs_select_all" on public.run_logs;
create policy "run_logs_select_all" on public.run_logs
  for select using (true);

drop policy if exists "run_logs_insert_all" on public.run_logs;
create policy "run_logs_insert_all" on public.run_logs
  for insert with check (true);

-- Required for the client-side realtime subscription in
-- ExecutionLogsSheet.tsx to receive INSERT events.
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
end $$;
