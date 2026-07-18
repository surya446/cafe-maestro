-- ============================================================
-- Migration 043: order_items anon realtime policy
-- Cafe Maestro Platform
-- ============================================================
-- Context:
--   Migration 022 added two anon SELECT policies so that guest
--   devices (running as the anon Postgres role) can receive
--   Supabase Realtime events and read recent rows without a JWT:
--
--     orders__anon__realtime        USING (created_at > NOW() - '4 hours')
--     table_sessions__anon__realtime USING (started_at > NOW() - '4 hours')
--
--   order_items was omitted from that set.  The only anon policy
--   on order_items is order_items__public__select, which requires
--   request.device_token to be set — a session variable the TV
--   KDS never provides (it is a kitchen display, not a guest device).
--
-- Symptom:
--   When the TV app's Supabase session is absent or expired the
--   WebView falls back to anon role.  PostgREST evaluates each
--   nested relation's RLS independently.  orders rows are visible
--   via orders__anon__realtime; the nested order_items query finds
--   no passing policy and returns [].  Result: cards show "0 items".
--
-- Fix:
--   Add the missing order_items__anon__realtime policy, scoped to
--   the same 4-hour window used by the two existing realtime
--   policies. This gives the TV KDS (and any anon realtime
--   subscriber) read access to recent order line-items without
--   requiring a device_token or a valid staff JWT.
--
-- Security note:
--   orders__anon__realtime already exposes order metadata
--   (id, status, created_at, …) to anon for the same 4-hour
--   window.  This policy extends that exposure to the associated
--   line items, which is consistent with the existing intent and
--   acceptable for a café context where order contents are not
--   sensitive.  The window limits the blast radius to recent data.
-- ============================================================

CREATE POLICY "order_items__anon__realtime"
  ON order_items FOR SELECT
  TO anon
  USING (created_at > NOW() - INTERVAL '4 hours');
