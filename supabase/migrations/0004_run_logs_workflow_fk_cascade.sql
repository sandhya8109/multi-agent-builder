-- 0002_run_logs_repair.sql tried to add an ON DELETE CASCADE foreign key
-- from run_logs.workflow_id to workflows(id), but only if no constraint
-- named 'run_logs_workflow_id_fkey' already existed. On this database a
-- constraint with that exact name already existed from before these
-- migrations ever ran — WITHOUT cascade — so that guard silently skipped
-- the fix, leaving the old, non-cascading constraint in place. Symptom:
-- deleting any workflow that has run history fails with
-- 'update or delete on table "workflows" violates foreign key constraint
-- "run_logs_workflow_id_fkey" on table "run_logs"' instead of the
-- Dashboard's delete button just quietly removing it.
--
-- This migration doesn't guess whether the existing constraint is already
-- correct — it unconditionally drops whatever is there and re-adds it
-- with cascade, the same pattern 0003 used for the run_id FK.
alter table public.run_logs drop constraint if exists run_logs_workflow_id_fkey;

alter table public.run_logs
  add constraint run_logs_workflow_id_fkey
  foreign key (workflow_id) references public.workflows(id) on delete cascade;

notify pgrst, 'reload schema';
