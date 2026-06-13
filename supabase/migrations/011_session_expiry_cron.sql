-- ============================================================
-- Migration 011: Session Auto-Expiry (pg_cron)
-- Cafe Maestro Platform
-- ============================================================
-- A scheduled job runs every 5 minutes.
-- It expires active sessions whose expires_at has passed,
-- and invalidates all associated devices.
--
-- For high-accuracy expiry, a Supabase Edge Function cron
-- should also be deployed (see supabase/functions/expire-sessions/).
-- The Edge Function calls this same logic via supabase-js
-- with the service_role key.
-- ============================================================

CREATE OR REPLACE FUNCTION expire_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_ids uuid[];
BEGIN
  -- Step 1: Expire overdue active sessions
  UPDATE table_sessions
  SET
    status    = 'expired',
    ended_at  = NOW(),
    updated_at = NOW()
  WHERE
    status    = 'active'
    AND expires_at < NOW()
  RETURNING id INTO expired_ids;

  -- Step 2: Invalidate all devices in those sessions
  IF expired_ids IS NOT NULL AND array_length(expired_ids, 1) > 0 THEN
    UPDATE session_devices
    SET is_active = false
    WHERE session_id = ANY(expired_ids)
      AND is_active = true;
  END IF;

  -- pg_notify for each expired session so API layer can broadcast
  -- SESSION_EXPIRED event to guests via Supabase Realtime
  IF expired_ids IS NOT NULL THEN
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
END;
$$;

-- Schedule: every 5 minutes
SELECT cron.schedule(
  'expire-table-sessions',   -- Job name (unique)
  '*/5 * * * *',             -- Every 5 minutes
  'SELECT expire_sessions()'
);

COMMENT ON FUNCTION expire_sessions IS
  'Marks overdue active sessions as expired and invalidates all associated device tokens. Called by pg_cron every 5 minutes and by the Edge Function cron for redundancy.';
