-- ============================================================
-- Migration 018: set_audit_actor RPC
-- Cafe Maestro Platform
-- ============================================================
-- Exposes a callable RPC so API route handlers can stamp the
-- audit trail with the acting user before any DML.
--
-- Usage from server-side API route:
--   await supabase.rpc('set_audit_actor', {
--     p_actor_id:   user.id,
--     p_actor_type: 'staff'
--   });
--   // ... then perform INSERT/UPDATE/DELETE
--
-- The setting is LOCAL to the current transaction.
-- Mobile apps call the same RPC — audit attribution works identically.
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
  PERFORM set_config('app.actor_id',   p_actor_id,   true);
  PERFORM set_config('app.actor_type', p_actor_type, true);
END;
$$;

COMMENT ON FUNCTION set_audit_actor IS
  'Sets transaction-local session variables consumed by audit triggers (migration 013).
   p_actor_type: staff | guest | system.
   p_actor_id: auth.uid()::text for staff, device_token for guests.
   Must be called within the same transaction as any audited DML.';
