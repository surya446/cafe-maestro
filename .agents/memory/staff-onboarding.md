---
name: Staff onboarding flow
description: Direct account creation with temp password replaced invite-based onboarding; forced password change on first login.
---

## Decision
Invite-based onboarding (`invite-staff-member` edge function) was removed entirely. All invite-related problems (rate limits, broken/expired links, redirect issues) are avoided.

## New flow
1. Owner/Manager opens "Add member" dialog on `/staff`.
2. Frontend calls `create-staff-member` edge function.
3. Edge function generates a cryptographically random temp password.
4. Creates Supabase Auth user via `auth.admin.createUser` (email_confirm: true — no confirmation email needed).
5. Inserts/updates `staff_users` row with `must_change_password = true`.
6. Sends login credentials email via Resend API (`RESEND_API_KEY` secret). If Resend not configured, returns `temp_password` in the response body for manual sharing.
7. Staff logs in with temp password → `useAuth` reads `must_change_password` → `ProtectedRoute` redirects to `/change-password`.
8. Staff sets new password → `supabase.auth.updateUser({ password })` → `clear_must_change_password()` RPC sets flag to false → redirect to dashboard.

## Why
- Supabase invite emails hit rate limits and produce broken/expired links.
- Direct creation is synchronous, predictable, and has no token expiry.

## Key secrets (must be set in Supabase dashboard → Edge Functions → Secrets)
- `RESEND_API_KEY` — Resend API key for sending credential emails
- `FROM_EMAIL` — sender address (default: noreply@cafemaestro.app)
- `SITE_URL` — admin dashboard base URL for the login link in the email

## Files
- Edge function: `supabase/functions/create-staff-member/index.ts`
- Old edge function kept but no longer called: `supabase/functions/invite-staff-member/`
- Force-change page: `artifacts/admin-dashboard/src/pages/ChangePasswordPage.tsx`
- Route `/change-password` added to App.tsx (unprotected route)
- `ProtectedRoute` redirects to `/change-password` when `user.mustChangePassword === true`
- RPC: `clear_must_change_password()` (migration 029)
- Schema: `must_change_password boolean` on `staff_users` (migration 028)
