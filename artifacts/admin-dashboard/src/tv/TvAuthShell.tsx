/**
 * TvAuthShell — authentication gate for the TV Kitchen Display System.
 *
 * Sits between TvApp's provider stack and TvKitchenPage. Handles three states:
 *
 *   loading  → TvLoadingScreen  (auth state not yet resolved from localStorage)
 *   no user  → TvLoginScreen    (no session, or session exists but no staff row)
 *   user     → {children}       (authenticated — renders TvKitchenPage)
 *
 * The Supabase client is initialised with persistSession:true and
 * autoRefreshToken:true (see src/lib/supabase.ts). Once a staff member
 * signs in, the session and refresh token are stored in the WebView's
 * localStorage and survive restarts. onAuthStateChange fires whenever the
 * session is established, refreshed, or expired, keeping this gate in sync
 * without polling.
 *
 * Edge case — session present but no staff_users row:
 *   useAuth resolves { session: non-null, user: null }. This screen is still
 *   shown, with an accountError prop explaining the situation. The user must
 *   contact their manager to have a staff_users record created.
 *
 * Phase 3 extension points (add inside this file):
 *   - PIN-pad login alternative
 *   - Multi-station / kitchen-selector after login
 *   - "Session expired" toast before re-showing the login form
 */

import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { TvLoadingScreen } from "./TvLoadingScreen";
import { TvLoginScreen } from "./TvLoginScreen";

interface TvAuthShellProps {
  children: React.ReactNode;
}

export function TvAuthShell({ children }: TvAuthShellProps) {
  const { user, session, loading } = useAuth();

  // Auth state not yet resolved (localStorage read + optional token refresh)
  if (loading) return <TvLoadingScreen />;

  // Supabase session present but no matching staff_users row — authenticated
  // to Supabase Auth but not provisioned as a cafe staff member.
  const accountError =
    session && !user
      ? "This account has no kitchen staff profile. Contact your cafe manager."
      : undefined;

  // No valid staff user → show login (with optional account error message)
  if (!user) return <TvLoginScreen accountError={accountError} />;

  // Authenticated — render the kitchen display
  return <>{children}</>;
}
