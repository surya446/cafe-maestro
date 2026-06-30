---
name: Mutation input omissions
description: Server-managed fields that must be omitted from insert/update mutation input types.
---

When defining `Omit<T, ...>` for mutation inputs, always exclude these server-managed fields in addition to `id | cafe_id | created_at`:

- `updated_at` — always set by DB trigger on update
- `confirmed_at`, `confirmed_by` — set by server when booking is confirmed
- `approved_at`, `approved_by` — set by server when order is approved
- `cancelled_at`, `cancelled_by`, `cancellation_reason` — set by server on cancel
- `acknowledged_at`, `acknowledged_by` — set by server on bill acknowledgment

**Why:** TypeScript will error if the form's submit shape doesn't match the hook's mutation input type. Supabase will reject or ignore these fields anyway since they're set by triggers/server logic.

**How to apply:** Both the hook's `mutationFn` input type and the page's `onSubmit` prop type must agree on which fields are excluded. If you add a new server-managed field to a type, add it to both the hook and the form's `Omit`.
