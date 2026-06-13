---
name: Supabase staff table
description: The auth/staff table is staff_users, not cafe_members. Key field differences from early design.
---

The table for authenticated staff is `staff_users`, not `cafe_members`.

- `staff_users.id` = Supabase auth UID (no separate `user_id` FK)
- `staff_users.full_name` (not `display_name`)
- `staff_users.cafe_id` — which cafe they belong to
- `staff_users.role` — one of `owner | manager | staff | chef`
- `staff_users.is_active` — boolean

**Why:** Early design had a `cafe_members` junction table with `user_id` FK, but the final migration (015) settled on `staff_users` where the row id IS the auth user id. The `cafes` table is joined via `cafe_id`.

**How to apply:** Any query to get the logged-in staff profile uses `.from("staff_users").eq("id", supabaseUser.id)`. Self-check in pages uses `member.id === user?.id` (not `member.user_id`).
