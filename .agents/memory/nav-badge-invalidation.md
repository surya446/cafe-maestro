---
name: Nav badge invalidation gaps
description: Mutations in useTableGroups must explicitly invalidate nav badge query keys because Supabase drops the realtime events server-side via RLS.
---

## The rule
When a session ends or a bill request changes state, the corresponding `table_sessions` or `bill_requests` realtime UPDATE event is dropped server-side by Supabase because the new row (e.g. `status='ended'`) fails the anon SELECT RLS filter (which only passes `status='active'`). The nav badge subscriptions therefore never fire, so badge counts go stale.

**Why:** `useNavBadges` uses a single realtime channel on `table_sessions` + `bill_requests`. It has a 30-second poll fallback, but without explicit query invalidation after mutations, staff see stale badge counts for up to 30 seconds after clearing tables or ending sessions.

**How to apply:**
- Any mutation that ends a session → invalidate `["nav_badge_sessions"]`.
- Any mutation that creates or resolves a bill request → invalidate `["nav_badge_bills"]`.
- `useTableSessions.endSessionMutation` already does this correctly. `useTableGroups` mutations did not (fixed: clearTable, endSession, staffRequestBill).
- `useBillRequests.deliverBillMutation` already does this correctly.
- Check any future mutations that touch `table_sessions.status` or `bill_requests.status`.
