---
name: Schema field names
description: Non-obvious column name choices that differ from early design assumptions.
---

Key field names that differ from intuitive guesses:

| Table | Column | NOT | Notes |
|---|---|---|---|
| `menu_categories` | `position` | `display_order` | Sort order |
| `menu_items` | `position` | `display_order` | Sort order |
| `menu_items` | — | `is_popular` | Column does not exist |
| `gallery_images` | `position` | `display_order` | Sort order |
| `gallery_images` | `storage_path` | — | Required, not nullable |
| `cafe_tables` | `number` | `table_number` | Table number |
| `cafe_tables` | `name` | `label` | Optional display name |
| `cafe_tables` | `qr_code_token` | `qr_token` | QR identifier |
| `table_sessions` | `expires_at` | `expired_at` | Session expiry |
| `table_sessions` | `started_at` | `created_at` | Session start time |
| `bill_requests` | `"pending"\|"acknowledged"` | `"completed"` | No "completed" status |
| `order_items` | `menu_item_id` | `item_id` | FK to menu_items |

**Why:** The schema evolved through 20 migrations; early type stubs used guessed names.

**How to apply:** Always verify column names against `supabase/migrations/` before writing queries. The `src/types/index.ts` in admin-dashboard now reflects the correct names.
