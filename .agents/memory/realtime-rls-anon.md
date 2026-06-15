---
name: Realtime RLS anon suppression
description: Supabase Realtime completely drops UPDATE events for anon subscribers when the new row state fails the anon SELECT RLS policy — fix by keeping visibility-changing columns out of RLS and filtering at the application layer instead.
---

## The rule

Never put soft-delete / visibility-changing column guards (e.g. `is_archived = false`, `is_deleted = false`) inside anon SELECT RLS policies on tables that use Supabase Realtime `postgres_changes` subscriptions.

**Why:** Supabase Realtime evaluates the anon RLS policy against `payload.new`. If the new row state doesn't pass the policy, the event is suppressed server-side entirely — the client WebSocket callback never fires. This means authenticated subscribers (staff with JWT) receive the event, but anon subscribers (QR menu customers) do not. The asymmetry is invisible in testing if both sessions are in the same browser.

**How to apply:** Keep the `is_archived = false` (or equivalent) filter only at the application layer:
- Initial queries: `.eq("is_archived", false)`
- RLS policies: only include stable security gates like `cafe_id IN (active cafes)` or `is_available = true`

This allows all UPDATE events (including archive/unarchive) to reach anon realtime subscribers. The client-side handler already checks `if (newRow.is_archived)` to filter from the local cache.

## Specific case in this project

Migration 032 added `is_archived = false` to both anon SELECT policies on `menu_items`:
- `menu_items__website__select`
- `menu_items_public_read`

This caused archive UPDATE events to be silently dropped for QR menu customers (anon) while desktop worked because the admin session had a staff JWT that could see archived rows. Migration 033 removes `is_archived = false` from both policies.

## Diagnostic signals

- Restore (is_archived → false): event delivered ✅ (new row passes anon RLS)
- Archive (is_archived → true): event dropped ❌ (new row fails anon RLS)
- Desktop works, real phone doesn't → check auth state: `supabase.auth.getSession()` will show `hasSession: true` on desktop (staff JWT) and `hasSession: false` on phone (anon)
