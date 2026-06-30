-- ============================================================
-- DB Function: set_audit_actor
-- Cafe Maestro Platform
-- ============================================================
-- Sets session-local variables that audit triggers read.
-- Must be called inside the same transaction as any DML.
--
-- Called via supabase.rpc('set_audit_actor', { ... })
-- from server-side API route handlers before mutations.
--
-- Add to a new migration if not already present:
-- ============================================================

CREATE OR REPLACE FUNCTION set_audit_actor(
  p_actor_id    text,
  p_actor_type  text DEFAULT 'staff'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.actor_id',   p_actor_id,   true);  -- true = local to transaction
  PERFORM set_config('app.actor_type', p_actor_type, true);
END;
$$;

COMMENT ON FUNCTION set_audit_actor IS
  'Sets transaction-local session variables consumed by audit triggers.
   Call before any INSERT/UPDATE/DELETE that should be attributed to a user.
   The "true" flag makes the setting local to the current transaction only.
   Mobile apps call the same RPC — audit attribution works identically.';
