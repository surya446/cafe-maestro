-- ============================================================
-- Migration 019: Orders Immutability & Archived Status
-- Cafe Maestro Platform
-- ============================================================
-- Historical orders are NEVER hard deleted.
-- All order lifecycle changes use status transitions.
--
-- Full status machine:
--   pending_approval  → approved        (staff | manager | owner)
--   pending_approval  → cancelled       (staff | manager | owner — rejection)
--   approved          → in_kitchen      (chef | manager | owner)
--   approved          → cancelled       (staff | manager | owner)
--   in_kitchen        → ready           (chef | manager | owner)
--   ready             → served          (staff | manager | owner)
--   served            → archived        (manager | owner — housekeeping)
--   cancelled         → archived        (manager | owner — housekeeping)
--
-- No status may transition to a PREVIOUS state.
-- No order row may ever be DELETE'd.
-- ============================================================

-- Add 'archived' to the valid status set
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending_approval',
    'approved',
    'in_kitchen',
    'ready',
    'served',
    'cancelled',
    'archived'
  ));

-- Add cancellation reason (used when staff reject with a note)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

COMMENT ON COLUMN orders.cancellation_reason IS
  'Set when status transitions to cancelled. Visible to the guest as feedback.';

COMMENT ON COLUMN orders.status IS
  'Order lifecycle: pending_approval → approved | cancelled.
   approved → in_kitchen | cancelled.
   in_kitchen → ready.
   ready → served.
   served | cancelled → archived (soft housekeeping, never delete).
   Transitions are enforced at the API layer. No DELETE policy exists on orders.';

-- ------------------------------------
-- Forbid hard deletes at the DB level
-- ------------------------------------
-- A BEFORE DELETE trigger that always raises an exception.
-- Even service_role cannot delete an order without explicitly
-- removing this trigger first — making accidental deletes obvious.

CREATE OR REPLACE FUNCTION prevent_order_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Order deletion is prohibited. Use status=cancelled or status=archived instead. (order_id: %)',
    OLD.id;
END;
$$;

CREATE TRIGGER orders_no_delete
  BEFORE DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION prevent_order_delete();

COMMENT ON FUNCTION prevent_order_delete IS
  'Hard guard: raises an exception on any attempt to DELETE an order row.
   Use status transitions (cancelled → archived) instead.';

-- ------------------------------------
-- Forbid hard deletes on order_items too
-- ------------------------------------

CREATE OR REPLACE FUNCTION prevent_order_item_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Order item deletion is prohibited. Cancel the parent order instead. (order_item_id: %)',
    OLD.id;
END;
$$;

CREATE TRIGGER order_items_no_delete
  BEFORE DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION prevent_order_item_delete();

-- ------------------------------------
-- Update audit trigger to record cancellation_reason
-- (replaces the orders trigger from migration 013)
-- ------------------------------------

CREATE OR REPLACE FUNCTION audit_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM insert_audit_log(
      NEW.cafe_id, 'order.created', 'orders', NEW.id,
      NULL, to_jsonb(NEW), NULL
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    v_event_type := CASE NEW.status
      WHEN 'approved'    THEN 'order.approved'
      WHEN 'cancelled'   THEN 'order.cancelled'
      WHEN 'in_kitchen'  THEN 'order.in_kitchen'
      WHEN 'ready'       THEN 'order.ready'
      WHEN 'served'      THEN 'order.served'
      WHEN 'archived'    THEN 'order.archived'
      ELSE 'order.status_changed'
    END;

    PERFORM insert_audit_log(
      NEW.cafe_id,
      v_event_type,
      'orders',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW),
      jsonb_changed_fields(to_jsonb(OLD), to_jsonb(NEW))
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger so the updated function is used
DROP TRIGGER IF EXISTS audit_orders_trigger ON orders;

CREATE TRIGGER audit_orders_trigger
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION audit_orders();
