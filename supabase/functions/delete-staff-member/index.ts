// ============================================================
// Edge Function: delete-staff-member
// Cafe Maestro Platform
// ============================================================
// Fully removes a staff member's authentication access while
// preserving their historical record:
//
//   Step 1 — Soft-delete staff_users row
//             Sets is_active=false, deleted_at=NOW(),
//             deleted_by=<caller uuid>.
//             The audit trigger fires here, writing a
//             'staff.deactivated' + context snapshot to audit_logs.
//
//   Step 2 — Hard-delete auth user
//             Calls auth.admin.deleteUser() with the service role key.
//             Because migration 037 dropped the ON DELETE CASCADE
//             constraint on staff_users.id, the staff_users row is
//             NOT removed — it survives as a permanent historical record.
//             The email address is freed immediately for reuse.
//
// Attribution columns (approved_by, cancelled_by, etc.) on orders,
// bookings, and sessions will be SET NULL by Postgres (their existing
// FK behaviour). The full actor history is preserved in audit_logs,
// where actor_id is stored as plain text (no FK).
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

  console.log("SUPABASE_URL present:", !!supabaseUrl);
  console.log("SUPABASE_ANON_KEY present:", !!anonKey);
  console.log("SUPABASE_SERVICE_ROLE_KEY present:", !!serviceRoleKey);
  console.log(
    "SUPABASE_SERVICE_ROLE_KEY prefix:",
    serviceRoleKey ? serviceRoleKey.substring(0, 20) : "<missing>",
  );
  console.log("SUPABASE_URL:", supabaseUrl);

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
    return json(
      { error: "You cannot delete your own account", code: "CANNOT_DELETE_SELF" },
      400,
    );
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
    return json(
      { error: "Only owners and managers can delete staff accounts" },
      403,
    );
  }

  // ── Fetch target staff record ─────────────────────────────────
  const { data: targetStaff, error: targetError } = await adminClient
    .from("staff_users")
    .select("role, cafe_id, full_name, email, is_active")
    .eq("id", user_id)
    .single<{
      role: string;
      cafe_id: string;
      full_name: string;
      email: string;
      is_active: boolean;
    }>();

  if (targetError || !targetStaff) {
    return json({ error: "Staff member not found", code: "USER_NOT_FOUND" }, 404);
  }

  // ── Same-cafe enforcement ─────────────────────────────────────
  if (targetStaff.cafe_id !== callerStaff.cafe_id) {
    return json(
      { error: "You may only manage staff in your own cafe" },
      403,
    );
  }

  // ── Owner accounts are permanently protected ──────────────────
  if (targetStaff.role === "owner") {
    return json(
      { error: "Owner accounts cannot be deleted", code: "CANNOT_DELETE_OWNER" },
      403,
    );
  }

  // ── Manager may only delete staff/chef ───────────────────────
  if (
    callerStaff.role === "manager" &&
    !["staff", "chef"].includes(targetStaff.role)
  ) {
    return json(
      { error: "Managers may only delete staff and chef accounts" },
      403,
    );
  }

  // ── Step 1: Soft-delete staff_users row ───────────────────────
  // Sets is_active=false, deleted_at=NOW(), deleted_by=caller.id.
  // The audit trigger fires here and writes a 'staff.deactivated'
  // event to audit_logs with old_data/new_data snapshots, preserving
  // the full context of who was deleted, by whom, and when.
  // We use the adminClient (service role) to bypass RLS so this
  // works regardless of how RLS policies are currently configured.
  const { error: softDeleteError } = await adminClient
    .from("staff_users")
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
      deleted_by: caller.id,
    })
    .eq("id", user_id);

  if (softDeleteError) {
    console.error(
      "[delete-staff-member] soft-delete error:",
      softDeleteError,
    );
    return json(
      {
        error: "Failed to soft-delete staff record",
        detail: softDeleteError.message,
      },
      500,
    );
  }

  console.log(
    `[delete-staff-member] Soft-deleted staff_users row for ${user_id} (${targetStaff.email}) — deleted_by=${caller.id}`,
  );

  // ── Step 2: Hard-delete auth user ────────────────────────────
  const health = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });

  console.log("listUsers result:", {
    data: !!health.data,
    error: health.error,
  });

  // ── Pre-delete user verification ──────────────────────────────
  const [staffRecord, authRecord] = await Promise.all([
    adminClient
      .from("staff_users")
      .select("id, email, is_active")
      .eq("id", user_id)
      .single(),
    adminClient.auth.admin.getUserById(user_id),
  ]);

  console.log("pre-delete staff_users record:", {
    data: staffRecord.data,
    error: staffRecord.error,
  });
  console.log("pre-delete auth.users record:", {
    data: authRecord.data?.user ?? null,
    error: authRecord.error,
  });
  console.log("user_id passed to deleteUser:", user_id);
  console.log("typeof user_id:", typeof user_id);
  console.log("staff_users.id match:", staffRecord.data?.id === user_id);
  console.log("auth.users.id match:", authRecord.data?.user?.id === user_id);
  console.log(
    "email match:",
    staffRecord.data?.email === authRecord.data?.user?.email,
  );
  console.log("staff email:", staffRecord.data?.email);
  console.log("auth email:", authRecord.data?.user?.email);
  console.log("full auth user object:", JSON.stringify(authRecord.data?.user, null, 2));

  try {
    const result = await adminClient.auth.admin.deleteUser(user_id);

    console.log("deleteUser returned:", result);
    console.log("deleteUser result.error:", result.error);
    console.log("deleteUser result.error truthy:", !!result.error);

    if (result.error) {
      console.error("deleteUser error object:", result.error);
      console.error("deleteUser error constructor:", result.error.constructor?.name);
      console.error("deleteUser error own keys:", Object.getOwnPropertyNames(result.error));
      console.error("deleteUser error descriptors:", Object.getOwnPropertyDescriptors(result.error));

      const body500 = {
        error: "Failed to delete auth account. Staff record has been deactivated.",
        code: "AUTH_DELETE_FAILED",
      };
      console.log("RETURNING HTTP 500", body500);
      return json(body500, 500);
    }
  } catch (e) {
    console.error("deleteUser threw:", e);
    console.error("constructor:", e?.constructor?.name);
    console.error("keys:", Object.getOwnPropertyNames(e));
    console.error("descriptors:", Object.getOwnPropertyDescriptors(e));
    console.log("RETURNING HTTP 500 (thrown)", String(e));
    throw e;
  }

  console.log(
    `[delete-staff-member] Deleted auth user ${user_id} (${targetStaff.email}). Email is now reusable. staff_users row preserved.`,
  );

  const body200 = {
    success: true,
    message: `${targetStaff.full_name} has been permanently removed. Their email address is now available for a new account.`,
  };
  console.log("RETURNING HTTP 200", body200);
  return json(body200, 200);
});
