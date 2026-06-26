// ============================================================
// Edge Function: delete-staff-member
// Cafe Maestro Platform
// ============================================================
// Fully removes a staff member:
//   1. Validates caller identity and role permissions.
//   2. Calls auth.admin.deleteUser() via the service role key.
//      Because staff_users.id has ON DELETE CASCADE, the
//      staff_users row is removed automatically by Postgres.
//      The audit trigger fires on that DELETE, preserving the
//      audit trail.
//
// Auto-injected by Supabase:
//   SUPABASE_URL              — project REST URL
//   SUPABASE_ANON_KEY         — public anon key
//   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ── Environment ───────────────────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("[delete-staff-member] Missing Supabase environment variables");
    return json({ error: "Server configuration error" }, 500);
  }

  // ── Parse body ────────────────────────────────────────────────
  let body: { user_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  const { user_id } = body;

  if (!user_id || typeof user_id !== "string") {
    return json({ error: "user_id is required and must be a string" }, 400);
  }

  // ── Authorization header ──────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Missing or malformed Authorization header" }, 401);
  }

  // ── Supabase clients ──────────────────────────────────────────
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Verify caller identity ────────────────────────────────────
  const {
    data: { user: caller },
    error: callerAuthError,
  } = await callerClient.auth.getUser();

  if (callerAuthError || !caller) {
    return json({ error: "Invalid or expired token" }, 401);
  }

  // ── Cannot delete self ────────────────────────────────────────
  if (caller.id === user_id) {
    return json({ error: "You cannot delete your own account", code: "CANNOT_DELETE_SELF" }, 400);
  }

  // ── Verify caller is active owner or manager ──────────────────
  const { data: callerStaff, error: callerStaffError } = await adminClient
    .from("staff_users")
    .select("role, cafe_id")
    .eq("id", caller.id)
    .eq("is_active", true)
    .single<{ role: string; cafe_id: string }>();

  if (callerStaffError || !callerStaff) {
    return json({ error: "Caller is not an active staff member" }, 403);
  }

  if (!["owner", "manager"].includes(callerStaff.role)) {
    return json({ error: "Only owners and managers can delete staff accounts" }, 403);
  }

  // ── Fetch target staff record ─────────────────────────────────
  const { data: targetStaff, error: targetError } = await adminClient
    .from("staff_users")
    .select("role, cafe_id, full_name, email")
    .eq("id", user_id)
    .single<{ role: string; cafe_id: string; full_name: string; email: string }>();

  if (targetError || !targetStaff) {
    return json({ error: "Staff member not found", code: "USER_NOT_FOUND" }, 404);
  }

  // ── Same-cafe enforcement ─────────────────────────────────────
  if (targetStaff.cafe_id !== callerStaff.cafe_id) {
    return json({ error: "You may only manage staff in your own cafe" }, 403);
  }

  // ── Owner accounts are permanently protected ──────────────────
  if (targetStaff.role === "owner") {
    return json({ error: "Owner accounts cannot be deleted", code: "CANNOT_DELETE_OWNER" }, 403);
  }

  // ── Manager may only delete staff/chef ───────────────────────
  if (callerStaff.role === "manager" && !["staff", "chef"].includes(targetStaff.role)) {
    return json({ error: "Managers may only delete staff and chef accounts" }, 403);
  }

  // ── Hard-delete from auth.users ───────────────────────────────
  // ON DELETE CASCADE on staff_users.id → auth.users(id) means
  // Postgres automatically removes the staff_users row, and the
  // audit trigger fires on that DELETE to preserve the audit trail.
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);

  if (deleteError) {
    console.error("[delete-staff-member] auth.admin.deleteUser error:", deleteError);
    return json(
      { error: "Failed to delete staff account", detail: deleteError.message },
      500,
    );
  }

  console.log(
    `[delete-staff-member] Deleted auth user ${user_id} (${targetStaff.email}) — staff_users row removed via CASCADE`,
  );

  return json(
    {
      success: true,
      message: `${targetStaff.full_name} has been permanently removed.`,
    },
    200,
  );
});
