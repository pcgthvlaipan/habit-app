-- ═══════════════════════════════════════════════════════════════
-- Fix: a column-level REVOKE does nothing while the table-level grant
-- stands, so users could still set profiles.is_admin = true. Drop the
-- table-wide INSERT/UPDATE grants and re-grant only the safe columns.
--
-- Run this in the SQL Editor if you applied an earlier copy of 0001.
-- (0001_init.sql has been updated to match, so a fresh run doesn't need this.)
-- ═══════════════════════════════════════════════════════════════
revoke insert, update on public.profiles from authenticated, anon;
grant  insert (id, name, email, department) on public.profiles to authenticated;
grant  update (name, email, department)     on public.profiles to authenticated;

-- Undo any escalation that happened before the lock (edit / remove as needed).
update public.profiles set is_admin = false where is_admin = true;
