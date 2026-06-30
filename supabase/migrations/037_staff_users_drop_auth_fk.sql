-- ============================================================
-- Migration 037: Remove CASCADE FK from staff_users.id → auth.users
-- Cafe Maestro Platform
-- ============================================================
--
-- REASON
-- ------
-- staff_users.id was created with:
--   REFERENCES auth.users(id) ON DELETE CASCADE
--
-- This means deleting a Supabase Auth user physically removes the
-- staff_users row, destroying the historical record (name, email,
-- role, deleted_at, deleted_by) for that staff member.
--
-- Historical business data that must be preserved:
--   • The staff member's name / email / role for audit reporting
--   • Who deleted them (deleted_by) and when (deleted_at)
--   • The audit_logs trigger captures a full JSON snapshot on
--     DELETE, but only if the row has already been soft-deleted
--     (is_active=false, deleted_by set) before auth deletion fires.
--
-- WHAT THIS MIGRATION DOES
-- ------------------------
-- Drops the FK constraint staff_users_id_fkey.
-- The id column keeps the same auth.users UUID values; we just
-- remove the Postgres-enforced link so that deleting from auth.users
-- no longer cascades to staff_users.
--
-- SAFETY
-- ------
-- • No existing data is modified.
-- • The delete-staff-member Edge Function enforces the correct
--   deletion order:
--     1. Soft-delete staff_users (is_active=false, deleted_at, deleted_by)
--     2. auth.admin.deleteUser()  → auth row gone, email freed
--     staff_users row is NOT cascade-deleted; it persists as a
--     historical record with is_active=false and deleted_at set.
-- • New staff are still created by create-staff-member which always
--   creates the auth user first, so the referential integrity is
--   maintained in practice by the application layer.
-- • No other table FKs to staff_users.id, so nothing else is affected.
--
-- ATTRIBUTION COLUMNS (approved_by, cancelled_by, etc.)
-- ------------------------------------------------------
-- Columns on orders, bookings, table_sessions, etc. that reference
-- auth.users(id) ON DELETE SET NULL will still become NULL when an
-- auth user is deleted. This is acceptable because:
--   • audit_logs.actor_id is stored as plain TEXT (no FK), so it
--     permanently records the UUID of who performed every action.
--   • audit_logs.old_data / new_data capture full JSONB row snapshots
--     at every change, preserving complete operational history.
--   • The orders, bookings, and sessions rows themselves are not
--     deleted — only the "who acted" FK reference is nulled.
-- ============================================================


ALTER TABLE staff_users
  DROP CONSTRAINT IF EXISTS staff_users_id_fkey;

COMMENT ON COLUMN staff_users.id IS
  'Supabase Auth user UUID. Matches auth.users.id but the FK constraint
   was intentionally removed (migration 037) so that deleting an auth
   user does not cascade-delete this historical staff record.
   The application layer (delete-staff-member edge function) enforces
   the correct deletion order: soft-delete staff_users first, then
   delete the auth user, preserving this row as a permanent record.';
