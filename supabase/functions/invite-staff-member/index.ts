// ============================================================
// Edge Function: invite-staff-member
// Cafe Maestro Platform
// ============================================================
// Sends a Supabase Auth invite email to a new staff member and
// creates / updates their staff_users row.
//
// Required environment variables (auto-injected by Supabase):
//   SUPABASE_URL              — project REST URL
//   SUPABASE_ANON_KEY         — public anon key
//   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS)
//
// Required environment variable (set manually via CLI or dashboard):
//   SITE_URL — base URL of the admin dashboard, used as the
//              redirectTo target in the invite email.
//              e.g. https://your-project.supabase.co
//              Set via: supabase secrets set SITE_URL=<value>
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

// ── Types ─────────────────────────────────────────────────────

const VALID_ROLES = ["owner", "manager", "staff", "chef"] as const;
type StaffRole = (typeof VALID_ROLES)[number];

interface InviteBody {
  email: unknown;
  full_name: unknown;
  role: unknown;
  cafe_id: unknown;
}

interface StaffRow {
  id: string;
  cafe_id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
}

// ── CORS headers ──────────────────────────────────────────────

const CORS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Response helper ───────────────────────────────────────────

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── Entry point ───────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ── Read environment ─────────────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const siteUrl = Deno.env.get("SITE_URL") ?? supabaseUrl ?? "";

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error(
      "[invite-staff-member] Missing required environment variables",
    );
    return json({ error: "Server configuration error" }, 500);
  }

  // ── Parse body ───────────────────────────────────────────────
  let body: InviteBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  const { email, full_name, role, cafe_id } = body;

  // ── Field validation ─────────────────────────────────────────
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

  // ── Verify Authorization header ───────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(
      { error: "Missing or malformed Authorization header" },
      401,
    );
  }

  // ── Build Supabase clients ────────────────────────────────────

  // Caller client — uses the caller's JWT; validates identity
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Admin client — service role; bypasses RLS; used for all writes
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Authenticate caller ───────────────────────────────────────
  const {
    data: { user: caller },
    error: callerAuthError,
  } = await callerClient.auth.getUser();

  if (callerAuthError || !caller) {
    return json({ error: "Invalid or expired token" }, 401);
  }

  // ── Verify caller is an active staff member ───────────────────
  const { data: callerStaff, error: callerStaffError } = await adminClient
    .from("staff_users")
    .select("role, cafe_id")
    .eq("id", caller.id)
    .eq("is_active", true)
    .single<{ role: StaffRole; cafe_id: string }>();

  if (callerStaffError || !callerStaff) {
    return json(
      { error: "Caller is not an active staff member of any cafe" },
      403,
    );
  }

  // ── Caller must belong to the target cafe ─────────────────────
  if (callerStaff.cafe_id !== cafe_id) {
    return json(
      { error: "Cannot invite members to a different cafe" },
      403,
    );
  }

  // ── Caller must be owner or manager ──────────────────────────
  if (!["owner", "manager"].includes(callerStaff.role)) {
    return json(
      { error: "Only owners and managers can invite staff members" },
      403,
    );
  }

  // ── Manager cannot create owner or manager accounts ───────────
  if (
    callerStaff.role === "manager" &&
    ["owner", "manager"].includes(staffRole)
  ) {
    return json(
      { error: "Managers can only invite staff or chef accounts" },
      403,
    );
  }

  // ── Send Supabase Auth invite ─────────────────────────────────
  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
      data: {
        full_name: full_name.trim(),
        cafe_id,
        role: staffRole,
      },
      redirectTo: `${siteUrl.replace(/\/$/, "")}/auth/confirm`,
    });

  // ── Handle duplicate email (user already has an auth account) ──
  if (inviteError) {
    const msg = inviteError.message?.toLowerCase() ?? "";
    const isDuplicate =
      msg.includes("already been registered") ||
      msg.includes("already registered") ||
      msg.includes("email_exists") ||
      (inviteError as unknown as { status: number }).status === 422;

    if (!isDuplicate) {
      console.error(
        "[invite-staff-member] inviteUserByEmail error:",
        inviteError,
      );
      return json(
        { error: "Failed to send invite email", detail: inviteError.message },
        500,
      );
    }

    // Find the existing auth user by email
    // listUsers is paginated; 1000 covers virtually all cafes at this scale
    const { data: listData, error: listError } =
      await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (listError) {
      console.error(
        "[invite-staff-member] listUsers error:",
        listError,
      );
      return json(
        {
          error:
            "This email is already registered. Could not retrieve user record.",
        },
        500,
      );
    }

    const existingUser = listData?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail,
    );

    if (!existingUser) {
      return json(
        {
          error:
            "This email is already registered but the account could not be located. Contact support.",
        },
        500,
      );
    }

    // Upsert staff record — existing auth user, new or updated cafe assignment
    const { data: existingStaffRecord, error: existingUpsertError } =
      await adminClient
        .from("staff_users")
        .upsert(
          {
            id: existingUser.id,
            cafe_id,
            email: normalizedEmail,
            full_name: full_name.trim(),
            role: staffRole,
            is_active: true,
          } satisfies Omit<StaffRow, never>,
          { onConflict: "id" },
        )
        .select()
        .single<StaffRow>();

    if (existingUpsertError) {
      console.error(
        "[invite-staff-member] staff_users upsert (existing user) error:",
        existingUpsertError,
      );
      return json(
        {
          error: "Failed to update staff record for existing user",
          detail: existingUpsertError.message,
        },
        500,
      );
    }

    return json(
      {
        success: true,
        already_registered: true,
        message: `${normalizedEmail} already has an account. Staff record updated — they can sign in immediately.`,
        user_id: existingUser.id,
        staff_user: existingStaffRecord,
      },
      200,
    );
  }

  // ── Invite succeeded — create staff_users row ─────────────────
  if (!inviteData?.user) {
    return json({ error: "Invite API returned no user data" }, 500);
  }

  const { data: newStaffRecord, error: staffInsertError } = await adminClient
    .from("staff_users")
    .upsert(
      {
        id: inviteData.user.id,
        cafe_id,
        email: normalizedEmail,
        full_name: full_name.trim(),
        role: staffRole,
        is_active: true,
      } satisfies Omit<StaffRow, never>,
      { onConflict: "id" },
    )
    .select()
    .single<StaffRow>();

  if (staffInsertError) {
    console.error(
      "[invite-staff-member] staff_users insert error:",
      staffInsertError,
    );
    // The invite email was sent successfully — return 207 so the caller
    // can surface a warning rather than a hard failure.
    return json(
      {
        success: true,
        warning:
          "Invite email sent but the staff record could not be created. Re-inviting will retry.",
        detail: staffInsertError.message,
        user_id: inviteData.user.id,
      },
      207,
    );
  }

  return json(
    {
      success: true,
      message: `Invite email sent to ${normalizedEmail}. They will receive a link to set their password.`,
      user_id: inviteData.user.id,
      staff_user: newStaffRecord,
    },
    200,
  );
});
