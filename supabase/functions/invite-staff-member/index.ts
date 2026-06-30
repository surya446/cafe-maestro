// ============================================================
// Edge Function: invite-staff-member
// Cup & Cozy Management System
// ============================================================
// Sends a Supabase Auth invite email to a new staff member and
// creates / updates their staff_users row with full security
// validation.
//
// Auto-injected by Supabase (do NOT set manually):
//   SUPABASE_URL              — project REST URL
//   SUPABASE_ANON_KEY         — public anon key
//   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS)
//
// Must be set manually via CLI or Supabase dashboard:
//   SITE_URL — admin dashboard base URL used in invite email link
//              supabase secrets set SITE_URL=https://your-domain
// ============================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Types ─────────────────────────────────────────────────────

const VALID_ROLES = ["owner", "manager", "staff", "chef"] as const;
type StaffRole = (typeof VALID_ROLES)[number];

interface InviteBody {
  email: unknown;
  full_name: unknown;
  role: unknown;
  cafe_id: unknown;
}

// The full set of columns read back from staff_users
interface StaffRow {
  id: string;
  cafe_id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Columns read for the pre-flight existence check
interface ExistingStaffRow {
  id: string;
  cafe_id: string;
  role: StaffRole;
  is_active: boolean;
}

// ── CORS ──────────────────────────────────────────────────────

const CORS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Helpers ───────────────────────────────────────────────────

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── Shared write logic ─────────────────────────────────────────
//
// Called after the target auth UID is known (both the new-user
// path and the existing-user path converge here).
//
// Runs all security checks against the existing staff_users row
// (if any), then performs an explicit INSERT or UPDATE — never
// a blind upsert.

async function applyStaffRow(
  adminClient: SupabaseClient,
  opts: {
    targetUserId: string;
    cafe_id: string;
    email: string;
    full_name: string;
    role: StaffRole;
    callerRole: StaffRole;
    alreadyRegistered: boolean; // true = auth user already existed
  },
): Promise<Response | StaffRow> {
  const { targetUserId, cafe_id, email, full_name, role, callerRole } = opts;

  // ── 1. Read existing staff_users row ──────────────────────────
  const { data: existingRow, error: readError } = await adminClient
    .from("staff_users")
    .select("id, cafe_id, role, is_active")
    .eq("id", targetUserId)
    .maybeSingle<ExistingStaffRow>();

  if (readError) {
    console.error("[invite-staff-member] pre-flight read error:", readError);
    return json(
      { error: "Failed to check existing staff record", detail: readError.message },
      500,
    );
  }

  // ── 2. Cross-cafe protection ──────────────────────────────────
  // An existing staff_users row that belongs to a DIFFERENT cafe
  // must never be overwritten. This prevents owner-of-A from
  // stealing or overwriting a user who belongs to cafe B.
  if (existingRow && existingRow.cafe_id !== cafe_id) {
    return json(
      {
        error: "User already belongs to another cafe",
        code: "CROSS_CAFE_CONFLICT",
        detail:
          "This auth account is already assigned to a different cafe. " +
          "The user must be removed from their current cafe before being added to this one.",
      },
      409,
    );
  }

  // ── 3. Role guards on existing rows ───────────────────────────
  if (existingRow) {
    // Manager cannot touch any existing owner or manager account.
    // This blocks: manager demoting a peer manager, manager
    // re-inviting a deactivated manager to re-activate them, etc.
    if (
      callerRole === "manager" &&
      ["owner", "manager"].includes(existingRow.role)
    ) {
      return json(
        {
          error: "Managers cannot modify owner or manager accounts",
          code: "INSUFFICIENT_ROLE",
          detail:
            `Target account has role '${existingRow.role}'. ` +
            "Only an owner can modify this account.",
        },
        403,
      );
    }

    // Owner accounts are protected from role changes via the invite
    // endpoint. Changing one owner to a different role requires
    // deliberate action through account management, not a re-invite.
    // This prevents accidental demotion of an existing owner.
    if (existingRow.role === "owner" && role !== "owner") {
      return json(
        {
          error: "Cannot change an existing owner's role via invite",
          code: "OWNER_ROLE_PROTECTED",
          detail:
            "This account currently has role 'owner'. " +
            "Role changes for owners must be performed through account management.",
        },
        403,
      );
    }
  }

  // ── 4. Write: INSERT (new row) or UPDATE (existing row) ───────

  if (!existingRow) {
    // ── INSERT: brand-new staff_users row ─────────────────────
    // cafe_id is set ONLY here, on creation. is_active defaults true.
    const { data: inserted, error: insertError } = await adminClient
      .from("staff_users")
      .insert({
        id: targetUserId,
        cafe_id,          // set once on creation; never overwritten after
        email,
        full_name,
        role,
        is_active: true,  // new accounts start active
      })
      .select()
      .single<StaffRow>();

    if (insertError) {
      console.error("[invite-staff-member] INSERT error:", insertError);
      return json(
        { error: "Failed to create staff record", detail: insertError.message },
        500,
      );
    }

    return inserted!;
  } else {
    // ── UPDATE: existing staff_users row ──────────────────────
    // cafe_id is NOT included — it is immutable after creation.
    // is_active is NOT included — preserves deliberate deactivation.
    // Only mutable identity/role fields are updated.
    const { data: updated, error: updateError } = await adminClient
      .from("staff_users")
      .update({
        email,       // sync in case auth email changed
        full_name,
        role,
        // cafe_id:   omitted — immutable
        // is_active: omitted — preserved
      })
      .eq("id", targetUserId)
      .select()
      .single<StaffRow>();

    if (updateError) {
      console.error("[invite-staff-member] UPDATE error:", updateError);
      return json(
        { error: "Failed to update staff record", detail: updateError.message },
        500,
      );
    }

    return updated!;
  }
}

// ── Entry point ───────────────────────────────────────────────

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
  const siteUrl = Deno.env.get("SITE_URL") ?? supabaseUrl ?? "";

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("[invite-staff-member] Missing environment variables");
    return json({ error: "Server configuration error" }, 500);
  }

  // ── Parse body ────────────────────────────────────────────────
  let body: InviteBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  const { email, full_name, role, cafe_id } = body;

  // ── Field validation ──────────────────────────────────────────
  if (!email || typeof email !== "string") {
    return json({ error: "email is required and must be a string" }, 400);
  }
  if (!full_name || typeof full_name !== "string") {
    return json({ error: "full_name is required and must be a string" }, 400);
  }
  if (!role || typeof role !== "string") {
    return json({ error: "role is required and must be a string" }, 400);
  }
  if (!cafe_id || typeof cafe_id !== "string") {
    return json({ error: "cafe_id is required and must be a string" }, 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = (full_name as string).trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return json({ error: "Invalid email address format" }, 400);
  }

  if (!(VALID_ROLES as readonly string[]).includes(role)) {
    return json(
      { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
      400,
    );
  }
  const staffRole = role as StaffRole;

  // ── Authorization header ──────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Missing or malformed Authorization header" }, 401);
  }

  // ── Supabase clients ──────────────────────────────────────────

  // Caller client — bound to the caller's JWT
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Admin client — service role; bypasses RLS for all privileged writes
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

  // ── Verify caller is active staff ────────────────────────────
  const { data: callerStaff, error: callerStaffError } = await adminClient
    .from("staff_users")
    .select("role, cafe_id")
    .eq("id", caller.id)
    .eq("is_active", true)
    .single<{ role: StaffRole; cafe_id: string }>();

  if (callerStaffError || !callerStaff) {
    return json(
      { error: "Caller is not an active staff member" },
      403,
    );
  }

  // ── Caller must belong to the target cafe ────────────────────
  if (callerStaff.cafe_id !== cafe_id) {
    return json(
      { error: "Cannot invite members to a different cafe" },
      403,
    );
  }

  // ── Caller must be owner or manager ──────────────────────────
  if (!["owner", "manager"].includes(callerStaff.role)) {
    return json(
      { error: "Only owners and managers can send invites" },
      403,
    );
  }

  // ── Manager: cannot create owner or manager accounts ─────────
  // (Checked here for NEW invites. Existing-row protection is
  //  enforced inside applyStaffRow for the duplicate-email path.)
  if (
    callerStaff.role === "manager" &&
    ["owner", "manager"].includes(staffRole)
  ) {
    return json(
      { error: "Managers can only invite staff or chef accounts" },
      403,
    );
  }

  // ── Send invite via Supabase Auth ─────────────────────────────
  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
      data: { full_name: trimmedName, cafe_id, role: staffRole },
      redirectTo: `${siteUrl.replace(/\/$/, "")}/admin/auth/confirm`,
    });

  // ── Path A: New auth user (invite sent successfully) ──────────
  if (!inviteError) {
    if (!inviteData?.user) {
      return json({ error: "Invite API returned no user data" }, 500);
    }

    const result = await applyStaffRow(adminClient, {
      targetUserId: inviteData.user.id,
      cafe_id,
      email: normalizedEmail,
      full_name: trimmedName,
      role: staffRole,
      callerRole: callerStaff.role,
      alreadyRegistered: false,
    });

    // applyStaffRow returns a Response on error, StaffRow on success
    if (result instanceof Response) return result;

    return json(
      {
        success: true,
        already_registered: false,
        message: `Invite email sent to ${normalizedEmail}. They will receive a link to set their password.`,
        user_id: inviteData.user.id,
        staff_user: result,
      },
      200,
    );
  }

  // ── Path B: Auth user already exists ─────────────────────────
  const msg = inviteError.message?.toLowerCase() ?? "";
  const isDuplicate =
    msg.includes("already been registered") ||
    msg.includes("already registered") ||
    msg.includes("email_exists") ||
    (inviteError as unknown as { status: number }).status === 422;

  if (!isDuplicate) {
    console.error(
      "[invite-staff-member] inviteUserByEmail unexpected error:",
      inviteError,
    );
    return json(
      { error: "Failed to send invite email", detail: inviteError.message },
      500,
    );
  }

  // Find existing auth user by email.
  // listUsers with perPage:1000 is safe for cafe-scale user counts.
  const { data: listData, error: listError } =
    await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listError) {
    console.error("[invite-staff-member] listUsers error:", listError);
    return json(
      {
        error: "Email is already registered but the account could not be retrieved",
        detail: listError.message,
      },
      500,
    );
  }

  const existingAuthUser = listData?.users?.find(
    (u) => u.email?.toLowerCase() === normalizedEmail,
  );

  if (!existingAuthUser) {
    return json(
      {
        error:
          "Email is already registered but the account could not be located. Contact support.",
      },
      500,
    );
  }

  const result = await applyStaffRow(adminClient, {
    targetUserId: existingAuthUser.id,
    cafe_id,
    email: normalizedEmail,
    full_name: trimmedName,
    role: staffRole,
    callerRole: callerStaff.role,
    alreadyRegistered: true,
  });

  if (result instanceof Response) return result;

  return json(
    {
      success: true,
      already_registered: true,
      message:
        `${normalizedEmail} already has an account. ` +
        (result.is_active
          ? "Staff record updated — they can sign in immediately."
          : "Staff record updated — account is currently deactivated."),
      user_id: existingAuthUser.id,
      staff_user: result,
    },
    200,
  );
});
