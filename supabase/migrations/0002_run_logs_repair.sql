-- Repairs a `run_logs` table that already exists but is missing columns
-- the app needs (this is why you saw "Could not find the 'workflow_id'
-- column of 'run_logs' in the schema cache" in the server logs — that
-- PostgREST error means the table exists, just without that column).
--
-- Safe to run whether 0001_run_logs.sql was already applied, applied
-- partially, or never applied — every statement below is additive and
-- idempotent. Run this in the Supabase SQL editor.

create table if not exists public.run_logs (
  id uuid primary key default gen_random_uuid()
);

alter table public.run_logs add column if not exists run_id uuid;
alter table public.run_logs add column if not exists workflow_id uuid;
alter table public.run_logs add column if not exists node_id text;
alter table public.run_logs add column if not exists node_label text;
alter table public.run_logs add column if not exists status text;
alter table public.run_logs add column if not exists log_data jsonb not null default '{}'::jsonb;
alter table public.run_logs add column if not exists created_at timestamptz not null default now();

-- Re-add the FK to workflows(id) if it's missing (skips cleanly if it's
-- already there, or if workflows.id isn't uuid — check manually in that
-- case rather than re-running this).
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'run_logs_workflow_id_fkey'
      and table_name = 'run_logs'
  ) then
    begin
      alter table public.run_logs
        add constraint run_logs_workflow_id_fkey
        foreign key (workflow_id) references public.workflows(id) on delete cascade;
    exception when others then
      raise notice 'Skipping workflow_id FK (likely a type mismatch with workflows.id) — % ', sqlerrm;
    end;
  end if;
end $$;

create index if not exists run_logs_run_id_idx on public.run_logs (run_id, created_at);
create index if not exists run_logs_workflow_id_idx on public.run_logs (workflow_id);

alter table public.run_logs enable row level security;

drop policy if exists "run_logs_select_all" on public.run_logs;
create policy "run_logs_select_all" on public.run_logs
  for select using (true);

drop policy if exists "run_logs_insert_all" on public.run_logs;
create policy "run_logs_insert_all" on public.run_logs
  for insert with check (true);

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

-- Force PostgREST to pick up the schema change immediately instead of
-- waiting for its next periodic reload.
notify pgrst, 'reload schema';
