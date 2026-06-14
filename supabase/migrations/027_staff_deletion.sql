-- ============================================================
-- Migration 027: Staff Soft-Delete & Disable Protection
-- Cafe Maestro Platform
-- ============================================================
-- Adds soft-delete support to staff_users.
-- All historical data (orders, audits, sessions) continues to
-- reference deleted users safely via FK to auth.users.
--
-- Changes:
--   Schema
--   ------
--   1. staff_users  ADD COLUMN deleted_at  timestamptz
--   2. staff_users  ADD COLUMN deleted_by  uuid → auth.users
--
--   Trigger
--   -------
--   3. protect_staff_users_before_update()
--        Prevents any UPDATE from disabling an owner account
--        (is_active = false on a row whose role = 'owner').
--        Fires before every direct-table UPDATE so the
--        protection is not bypassable via direct SQL clients.
--
--   RPCs (SECURITY DEFINER)
--   -----------------------
--   4. delete_staff_user(p_user_id uuid)
--        Soft-deletes a staff member.
--        Sets is_active=false, deleted_at=NOW(), deleted_by=auth.uid().
--        Business rules enforced server-side:
--          • Caller must be owner or manager (same cafe).
--          • Target role 'owner' is always protected — no one can delete.
--          • Manager may only delete staff/chef accounts.
--          • Self-deletion is blocked.
--
--   5. restore_staff_user(p_user_id uuid)
--        Reverses a soft-delete: sets is_active=true,
--        cleared deleted_at/deleted_by.
--        Same role constraints as delete_staff_user.
--
-- Safe on existing data:
--   • Both new columns are nullable; existing rows get NULL.
--   • No existing rows are modified.
--   • No indexes or FKs are dropped.
-- ============================================================


-- ============================================================
-- 1. deleted_at column
-- ============================================================

ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN staff_users.deleted_at IS
  'Set to NOW() when the account is soft-deleted by delete_staff_user().
   NULL means the account has not been deleted.
   Deleted accounts are excluded from the default staff list.';


-- ============================================================
-- 2. deleted_by column
-- ============================================================

ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS deleted_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN staff_users.deleted_by IS
  'auth.uid() of the staff member (owner or manager) who soft-deleted
   this account. NULL for accounts that have never been deleted.';


-- ============================================================
-- 3. Trigger: prevent disabling owner accounts
-- ============================================================
-- Fires BEFORE every UPDATE on staff_users.
-- Blocks any UPDATE that would set is_active = false on a row
-- whose role is 'owner'.  This is the only way to guarantee the
-- protection even when a client uses the Supabase JS client
-- directly rather than an RPC.
-- ============================================================

CREATE OR REPLACE FUNCTION protect_staff_users_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Block deactivation of owner accounts.
  -- An owner can only be deactivated by another means (platform admin).
  IF OLD.role = 'owner' AND NEW.is_active = false AND OLD.is_active = true THEN
    RAISE EXCEPTION 'CANNOT_DISABLE_OWNER'
      USING HINT = 'Owner accounts cannot be disabled';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION protect_staff_users_before_update() IS
  'BEFORE UPDATE trigger on staff_users.
   Blocks any attempt to set is_active = false on an owner account.
   Fires on all direct table UPDATEs regardless of caller.';

DROP TRIGGER IF EXISTS protect_staff_users_before_update_trigger ON staff_users;

CREATE TRIGGER protect_staff_users_before_update_trigger
  BEFORE UPDATE ON staff_users
  FOR EACH ROW
  EXECUTE FUNCTION protect_staff_users_before_update();


-- ============================================================
-- 4. delete_staff_user(p_user_id uuid)
-- ============================================================
-- Soft-deletes a staff member.
-- Caller must be authenticated owner or manager in the same cafe.
-- Target cannot be an owner. Manager can only delete staff/chef.
-- Cannot delete self.
-- ============================================================

CREATE OR REPLACE FUNCTION delete_staff_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   text;
  v_caller_cafe   uuid;
  v_target_role   text;
  v_target_cafe   uuid;
  v_target_active boolean;
BEGIN
  -- ── Resolve caller identity ──────────────────────────────
  SELECT su.role, su.cafe_id
  INTO   v_caller_role, v_caller_cafe
  FROM   staff_users su
  WHERE  su.id        = auth.uid()
    AND  su.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCESS_DENIED'
      USING HINT = 'You must be an active staff member to perform this action';
  END IF;

  -- ── Caller must be owner or manager ─────────────────────
  IF v_caller_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'ACCESS_DENIED'
      USING HINT = 'Only owners and managers can delete staff members';
  END IF;

  -- ── Cannot delete self ───────────────────────────────────
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'CANNOT_DELETE_SELF'
      USING HINT = 'You cannot delete your own account';
  END IF;

  -- ── Resolve target identity ──────────────────────────────
  SELECT su.role, su.cafe_id, su.is_active
  INTO   v_target_role, v_target_cafe, v_target_active
  FROM   staff_users su
  WHERE  su.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND'
      USING HINT = 'No staff member found with that ID';
  END IF;

  -- ── Same-cafe enforcement ────────────────────────────────
  IF v_target_cafe IS DISTINCT FROM v_caller_cafe THEN
    RAISE EXCEPTION 'ACCESS_DENIED'
      USING HINT = 'You may only manage staff in your own cafe';
  END IF;

  -- ── Owner accounts are permanently protected ─────────────
  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'CANNOT_DELETE_OWNER'
      USING HINT = 'Owner accounts cannot be deleted';
  END IF;

  -- ── Manager may only delete staff/chef ───────────────────
  IF v_caller_role = 'manager' AND v_target_role NOT IN ('staff', 'chef') THEN
    RAISE EXCEPTION 'ACCESS_DENIED'
      USING HINT = 'Managers may only delete staff and chef accounts';
  END IF;

  -- ── Already deleted: idempotent no-op ───────────────────
  IF NOT v_target_active THEN
    -- If already inactive (could be soft-deleted), just ensure deleted_at is set
    UPDATE staff_users
    SET    deleted_at = COALESCE(deleted_at, NOW()),
           deleted_by = COALESCE(deleted_by, auth.uid()),
           updated_at = NOW()
    WHERE  id = p_user_id
      AND  deleted_at IS NULL;
    RETURN;
  END IF;

  -- ── Perform soft-delete ──────────────────────────────────
  UPDATE staff_users
  SET    is_active   = false,
         deleted_at  = NOW(),
         deleted_by  = auth.uid(),
         updated_at  = NOW()
  WHERE  id = p_user_id;

END;
$$;

COMMENT ON FUNCTION delete_staff_user(uuid) IS
  'Soft-deletes a staff member: sets is_active=false, deleted_at=NOW(),
   deleted_by=auth.uid(). Business rules enforced server-side:
   • Caller must be active owner or manager in the same cafe.
   • Owner accounts are permanently protected — nobody can delete them.
   • Managers may only delete staff/chef accounts.
   • Self-deletion is blocked.
   Historical data (orders, sessions, audits) remains intact.';

GRANT EXECUTE ON FUNCTION delete_staff_user(uuid) TO authenticated;


-- ============================================================
-- 5. restore_staff_user(p_user_id uuid)
-- ============================================================
-- Reverses a soft-delete: sets is_active=true, clears deleted_at
-- and deleted_by. Same caller role constraints as delete_staff_user.
-- ============================================================

CREATE OR REPLACE FUNCTION restore_staff_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_caller_cafe uuid;
  v_target_role text;
  v_target_cafe uuid;
BEGIN
  -- ── Resolve caller ───────────────────────────────────────
  SELECT su.role, su.cafe_id
  INTO   v_caller_role, v_caller_cafe
  FROM   staff_users su
  WHERE  su.id        = auth.uid()
    AND  su.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCESS_DENIED'
      USING HINT = 'You must be an active staff member to perform this action';
  END IF;

  IF v_caller_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'ACCESS_DENIED'
      USING HINT = 'Only owners and managers can restore staff members';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'CANNOT_RESTORE_SELF'
      USING HINT = 'You cannot restore your own account this way';
  END IF;

  -- ── Resolve target ───────────────────────────────────────
  SELECT su.role, su.cafe_id
  INTO   v_target_role, v_target_cafe
  FROM   staff_users su
  WHERE  su.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND'
      USING HINT = 'No staff member found with that ID';
  END IF;

  IF v_target_cafe IS DISTINCT FROM v_caller_cafe THEN
    RAISE EXCEPTION 'ACCESS_DENIED'
      USING HINT = 'You may only manage staff in your own cafe';
  END IF;

  IF v_caller_role = 'manager' AND v_target_role NOT IN ('staff', 'chef') THEN
    RAISE EXCEPTION 'ACCESS_DENIED'
      USING HINT = 'Managers may only restore staff and chef accounts';
  END IF;

  -- ── Reverse the soft-delete ──────────────────────────────
  UPDATE staff_users
  SET    is_active   = true,
         deleted_at  = NULL,
         deleted_by  = NULL,
         updated_at  = NOW()
  WHERE  id = p_user_id;

END;
$$;

COMMENT ON FUNCTION restore_staff_user(uuid) IS
  'Reverses a soft-delete: sets is_active=true, clears deleted_at and
   deleted_by. Same caller role constraints as delete_staff_user.
   Idempotent — safe to call on an already-active account.';

GRANT EXECUTE ON FUNCTION restore_staff_user(uuid) TO authenticated;
