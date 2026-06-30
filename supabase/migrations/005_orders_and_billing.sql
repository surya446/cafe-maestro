-- ============================================================
-- Migration 005: Orders, Order Items & Bill Requests
-- Cafe Maestro Platform
-- ============================================================

-- ------------------------------------
-- Orders
-- ------------------------------------
-- Order lifecycle:
--   pending_approval → [staff approves] → approved → [kitchen] → in_kitchen → ready → [staff] → served
--   pending_approval → [staff rejects] → cancelled
--
-- Staff act as a gatekeeper: kitchen never sees a pending_approval order.

CREATE TABLE orders (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id         uuid          NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  session_id      uuid          NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  table_id        uuid          NOT NULL REFERENCES cafe_tables(id) ON DELETE CASCADE,

  -- Which device placed this order (validated against session_devices)
  device_token    text          NOT NULL,

  status          text          NOT NULL DEFAULT 'pending_approval'
                  CHECK (status IN (
                    'pending_approval',
                    'approved',
                    'in_kitchen',
                    'ready',
                    'served',
                    'cancelled'
                  )),

  -- Staff notes visible to guest (e.g. rejection reason)
  staff_note      text,

  -- Approval tracking
  approved_at     timestamptz,
  approved_by     uuid          REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Cancellation tracking
  cancelled_at    timestamptz,
  cancelled_by    uuid          REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  created_at      timestamptz   NOT NULL DEFAULT NOW(),
  updated_at      timestamptz   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE orders IS
  'One order per "Place Order" action by a guest device. An order contains multiple order_items. Staff must approve before kitchen sees it.';

COMMENT ON COLUMN orders.device_token IS
  'Denormalized from session_devices for fast lookup. Validated against session_devices.device_token on insert.';

COMMENT ON COLUMN orders.table_id IS
  'Denormalized from session for query convenience and audit trail. Never changes after insert.';

SELECT create_updated_at_trigger('orders');

-- ------------------------------------
-- Order items
-- ------------------------------------

CREATE TABLE order_items (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id         uuid          NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  order_id        uuid          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id    uuid          NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,

  quantity        integer       NOT NULL CHECK (quantity > 0),

  -- Price snapshot at time of order. Preserves historical accuracy
  -- if menu_items.price is later changed by the owner.
  unit_price      numeric(10,2) NOT NULL CHECK (unit_price >= 0),

  -- Guest's special instructions ("no sugar", "oat milk please")
  notes           text,

  -- Audit
  created_at      timestamptz   NOT NULL DEFAULT NOW()

  -- order_items are immutable after creation (no updated_at)
);

COMMENT ON TABLE order_items IS
  'Line items within an order. unit_price is a snapshot — it does not change if menu_items.price is updated later. This preserves accurate financial history.';

COMMENT ON COLUMN order_items.menu_item_id IS
  'ON DELETE RESTRICT: prevents menu items from being deleted if they appear in any order. Use menu_items.is_available=false to retire items instead.';

-- ------------------------------------
-- Bill requests
-- ------------------------------------
-- Guest taps "Request Bill" → staff see it in their queue.
-- One request per active session (enforced by partial unique index).

CREATE TABLE bill_requests (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id         uuid          NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  session_id      uuid          NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  table_id        uuid          NOT NULL REFERENCES cafe_tables(id) ON DELETE CASCADE,

  device_token    text          NOT NULL,  -- Which guest requested the bill

  status          text          NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'acknowledged')),

  requested_at    timestamptz   NOT NULL DEFAULT NOW(),
  acknowledged_at timestamptz,
  acknowledged_by uuid          REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE bill_requests IS
  'Created when a guest taps Request Bill. Appears in the staff bill request queue. One pending request per session at a time (enforced by partial unique index).';

-- Only one pending bill request per session at a time
CREATE UNIQUE INDEX bill_requests_one_pending_per_session
  ON bill_requests (session_id)
  WHERE status = 'pending';
