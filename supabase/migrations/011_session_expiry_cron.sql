-- ============================================================
-- Migration 011: Session Expiry — Trigger-Based (Free Tier)
-- Cafe Maestro Platform
-- ============================================================
-- REPLACES: pg_cron scheduled job (removed for Free Tier compatibility).
--
-- Session expiry is now enforced at THREE layers:
--
--   Layer 1 — BEFORE INSERT trigger (this migration)
--     When a new session is created for a table, any existing
--     active session whose expires_at has passed is immediately
--     transitioned to 'expired' and its devices are invalidated.
--     This unblocks the partial unique index and prevents stale
--     sessions from blocking new QR scans.
--
--   Layer 2 — Views (migration 012)
--     active_sessions_with_devices filters expires_at > NOW()
--     so stale sessions never appear on the staff dashboard,
--     even if their status column hasn't been updated yet.
--
--   Layer 3 — RLS (migration 020)
--     Staff session queries gate on expires_at > NOW() in addition
--     to status = 'active', providing a database-level safety net.
--
--   Layer 4 — expire_sessions() callable RPC
--     Available for manual invocation from Edge Functions,
--     API routes, or admin tooling without needing pg_cron.
--     Call it on any user action that touches sessions (e.g.
--     "get active sessions") to lazily clean up expired rows.
--
-- No scheduled jobs. No pg_cron. No paid-tier features.
-- Works correctly even when the Supabase project auto-pauses.
-- ============================================================


-- ============================================================
-- expire_sessions() — callable function (no cron scheduling)
-- ============================================================
-- Transitions all active sessions past their expires_at to
-- 'expired' and invalidates their devices.
-- Call from API routes or Edge Functions as needed.

CREATE OR REPLACE FUNCTION expire_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_ids uuid[];
  affected    integer;
BEGIN
  -- Step 1: Mark overdue active sessions as expired
  WITH updated AS (
    UPDATE table_sessions
    SET
      status     = 'expired',
      ended_at   = NOW(),
      updated_at = NOW()
    WHERE
      status    = 'active'
      AND expires_at < NOW()
    RETURNING id
  )
  SELECT ARRAY_AGG(id) INTO expired_ids FROM updated;

  GET DIAGNOSTICS affected = ROW_COUNT;

  -- Step 2: Invalidate all devices in expired sessions
  IF expired_ids IS NOT NULL AND array_length(expired_ids, 1) > 0 THEN
    UPDATE session_devices
    SET is_active = false
    WHERE session_id = ANY(expired_ids)
      AND is_active = true;

    -- Notify API layer so it can broadcast SESSION_EXPIRED to guests
    DECLARE
      sid uuid;
    BEGIN
      FOREACH sid IN ARRAY expired_ids
      LOOP
        PERFORM pg_notify(
          'session_status_change',
          json_build_object(
            'session_id', sid,
            'old_status', 'active',
            'new_status', 'expired'
          )::text
        );
      END LOOP;
    END;
  END IF;

  RETURN COALESCE(affected, 0);
END;
$$;

COMMENT ON FUNCTION expire_sessions IS
  'Lazily expires all overdue active sessions and invalidates their devices.
   Returns the number of sessions expired.
   Call from API routes or Edge Functions — no pg_cron scheduling needed.
   Safe to call on every request that reads session state.';


-- ============================================================
-- BEFORE INSERT trigger: auto-expire stale sessions on new scan
-- ============================================================
-- When a guest scans a QR code on a table that still has an
-- active session in the DB (but whose expires_at has passed),
-- this trigger fires BEFORE the new session INSERT, transitioning
-- the stale session to 'expired' and invalidating its devices.
-- This unblocks the partial unique index:
--   table_sessions_one_active_per_table ON (table_id) WHERE status='active'
-- without needing a background job.

CREATE OR REPLACE FUNCTION expire_stale_session_for_table()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stale_ids uuid[];
BEGIN
  -- Find active sessions for this table that are past their expires_at
  SELECT ARRAY_AGG(id)
  INTO stale_ids
  FROM table_sessions
  WHERE table_id  = NEW.table_id
    AND status    = 'active'
    AND expires_at < NOW();

  IF stale_ids IS NOT NULL AND array_length(stale_ids, 1) > 0 THEN
    -- Transition stale sessions to expired
    UPDATE table_sessions
    SET
      status     = 'expired',
      ended_at   = NOW(),
      updated_at = NOW()
    WHERE id = ANY(stale_ids);

    -- Invalidate their devices immediately
    UPDATE session_devices
    SET is_active = false
    WHERE session_id = ANY(stale_ids)
      AND is_active = true;

    -- Notify API layer for each expired session
    DECLARE
      sid uuid;
    BEGIN
      FOREACH sid IN ARRAY stale_ids
      LOOP
        PERFORM pg_notify(
          'session_status_change',
          json_build_object(
            'session_id', sid,
            'old_status', 'active',
            'new_status', 'expired'
          )::text
        );
      END LOOP;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER expire_stale_sessions_before_insert
  BEFORE INSERT ON table_sessions
  FOR EACH ROW
  EXECUTE FUNCTION expire_stale_session_for_table();

COMMENT ON FUNCTION expire_stale_session_for_table IS
  'BEFORE INSERT trigger on table_sessions.
   Expires any active sessions on the target table whose expires_at has passed,
   and invalidates their devices. Unblocks the partial unique index
   (one active session per table) without requiring a background job.
   Fired on every new QR scan — zero infrastructure overhead.';
