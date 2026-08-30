-- Drops a foreign key on run_logs.run_id that's left over from an earlier
-- version of this app (before the current rewrite) which tracked runs via
-- a parent `workflow_runs` table. The current code (execute/route.ts)
-- generates a plain client-side UUID as a correlation id for each run and
-- never creates a matching workflow_runs row, so every run_logs insert was
-- failing with:
--   insert or update on table "run_logs" violates foreign key constraint
--   "run_logs_run_id_fkey"
--
-- run_id here is just a correlation id grouping the rows of one execution
-- (what ExecutionLogsSheet.tsx filters/subscribes on) — it doesn't need
-- referential integrity to a parent table. Run this in the Supabase SQL
-- editor.

alter table public.run_logs drop constraint if exists run_logs_run_id_fkey;

notify pgrst, 'reload schema';
