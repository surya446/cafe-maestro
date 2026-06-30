import { Redirect } from "wouter";

// Invite-based onboarding has been removed.
// Old invite email links that hit this route are redirected to /login.
export function AuthConfirmPage() {
  return <Redirect to="/login" />;
}
