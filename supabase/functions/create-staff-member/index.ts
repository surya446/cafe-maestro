// ============================================================
// Edge Function: create-staff-member
// Cafe Maestro Platform
// ============================================================
// Creates a Supabase Auth user directly with a temporary
// password (no invite email). Sends login credentials via
// Resend email. Staff must change password on first login.
//
// Auto-injected by Supabase:
//   SUPABASE_URL              — project REST URL
//   SUPABASE_ANON_KEY         — public anon key
//   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS)
//
// Must be set manually via Supabase dashboard → Project Settings
// → Edge Functions → Secrets:
//   RESEND_API_KEY  — Resend API key for sending credential emails
//   FROM_EMAIL      — sender address, e.g. noreply@yourcafe.com
//   SITE_URL        — admin dashboard base URL, e.g. https://your-domain.replit.app/admin
// ============================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Types ─────────────────────────────────────────────────────

const VALID_ROLES = ["owner", "manager", "staff", "chef"] as const;
type StaffRole = (typeof VALID_ROLES)[number];

interface CreateBody {
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
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

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

// Generate a secure random temporary password:
// 16 characters — uppercase, lowercase, digits, symbols.
// Excludes visually ambiguous chars (0/O, 1/l/I).
function generateTempPassword(): string {
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;

  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);

  // Guarantee at least one of each character class
  const guaranteed = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    symbols[bytes[3] % symbols.length],
  ];

  const rest = Array.from(bytes.slice(4, 16)).map(
    (b) => all[b % all.length],
  );

  const combined = [...guaranteed, ...rest];

  // Fisher-Yates shuffle using remaining random bytes
  const shuffleBytes = new Uint8Array(combined.length);
  crypto.getRandomValues(shuffleBytes);
  for (let i = combined.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join("");
}

// ── Email sender via Resend ────────────────────────────────────

async function sendCredentialEmail(opts: {
  resendKey: string;
  fromEmail: string;
  toEmail: string;
  fullName: string;
  tempPassword: string;
  loginUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { resendKey, fromEmail, toEmail, fullName, tempPassword, loginUrl } = opts;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;color:#111;">
  <h2 style="margin-bottom:4px;">Welcome to Cafe Maestro</h2>
  <p style="color:#666;margin-top:0;">Your staff account is ready.</p>

  <p>Hi <strong>${fullName}</strong>,</p>
  <p>An account has been created for you on the Cafe Maestro Admin Dashboard. Use the credentials below to sign in.</p>

  <div style="background:#f5f5f5;border-radius:8px;padding:20px 24px;margin:24px 0;">
    <p style="margin:0 0 8px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:.05em;">Your login details</p>
    <p style="margin:0 0 6px;"><strong>Email:</strong> ${toEmail}</p>
    <p style="margin:0;"><strong>Temporary password:</strong> <code style="background:#e5e5e5;padding:2px 6px;border-radius:4px;">${tempPassword}</code></p>
  </div>

  <a href="${loginUrl}"
     style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Sign in to dashboard
  </a>

  <p style="margin-top:24px;font-size:13px;color:#888;">
    You will be asked to set a new password when you first sign in.<br>
    Keep this email safe — do not share your password with anyone.
  </p>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: "Your Cafe Maestro staff account is ready",
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${body}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Shared staff_users write logic ────────────────────────────

async function applyStaffRow(
  adminClient: SupabaseClient,
  opts: {
    targetUserId: string;
    cafe_id: string;
    email: string;
    full_name: string;
    role: StaffRole;
    callerRole: StaffRole;
  },
): Promise<Response | StaffRow> {
  const { targetUserId, cafe_id, email, full_name, role, callerRole } = opts;

  const { data: existingRow, error: readError } = await adminClient
    .from("staff_users")
    .select("id, cafe_id, role, is_active")
    .eq("id", targetUserId)
    .maybeSingle<ExistingStaffRow>();

  if (readError) {
    console.error("[create-staff-member] pre-flight read error:", readError);
    return json(
      { error: "Failed to check existing staff record", detail: readError.message },
      500,
    );
  }

  // Cross-cafe protection
  if (existingRow && existingRow.cafe_id !== cafe_id) {
    return json(
      {
        error: "User already belongs to another cafe",
        code: "CROSS_CAFE_CONFLICT",
        detail:
          "This auth account is already assigned to a different cafe.",
      },
      409,
    );
  }

  // Role guards on existing rows
  if (existingRow) {
    if (
      callerRole === "manager" &&
      ["owner", "manager"].includes(existingRow.role)
    ) {
      return json(
        {
          error: "Managers cannot modify owner or manager accounts",
          code: "INSUFFICIENT_ROLE",
        },
        403,
      );
    }
    if (existingRow.role === "owner" && role !== "owner") {
      return json(
        {
          error: "Cannot change an existing owner's role via this endpoint",
          code: "OWNER_ROLE_PROTECTED",
        },
        403,
      );
    }
  }

  if (!existingRow) {
    const { data: inserted, error: insertError } = await adminClient
      .from("staff_users")
      .insert({
        id: targetUserId,
        cafe_id,
        email,
        full_name,
        role,
        is_active: true,
        must_change_password: true,
      })
      .select()
      .single<StaffRow>();

    if (insertError) {
      console.error("[create-staff-member] INSERT error:", insertError);
      return json(
        { error: "Failed to create staff record", detail: insertError.message },
        500,
      );
    }

    return inserted!;
  } else {
    const { data: updated, error: updateError } = await adminClient
      .from("staff_users")
      .update({
        email,
        full_name,
        role,
        must_change_password: true,
      })
      .eq("id", targetUserId)
      .select()
      .single<StaffRow>();

    if (updateError) {
      console.error("[create-staff-member] UPDATE error:", updateError);
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
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const fromEmail = Deno.env.get("FROM_EMAIL") ?? "noreply@cafemaestro.app";
  const siteUrl = Deno.env.get("SITE_URL") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("[create-staff-member] Missing environment variables");
    return json({ error: "Server configuration error" }, 500);
  }

  // ── Parse body ────────────────────────────────────────────────
  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  const { email, full_name, role, cafe_id } = body;

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

  const normalizedEmail = (email as string).trim().toLowerCase();
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

  // ── Verify caller is active staff ────────────────────────────
  const { data: callerStaff, error: callerStaffError } = await adminClient
    .from("staff_users")
    .select("role, cafe_id")
    .eq("id", caller.id)
    .eq("is_active", true)
    .single<{ role: StaffRole; cafe_id: string }>();

  if (callerStaffError || !callerStaff) {
    return json({ error: "Caller is not an active staff member" }, 403);
  }

  if (callerStaff.cafe_id !== cafe_id) {
    return json({ error: "Cannot create members for a different cafe" }, 403);
  }

  if (!["owner", "manager"].includes(callerStaff.role)) {
    return json({ error: "Only owners and managers can create staff accounts" }, 403);
  }

  if (
    callerStaff.role === "manager" &&
    ["owner", "manager"].includes(staffRole)
  ) {
    return json(
      { error: "Managers can only create staff or chef accounts" },
      403,
    );
  }

  // ── Generate temporary password ───────────────────────────────
  const tempPassword = generateTempPassword();

  // ── Check if auth user already exists ────────────────────────
  const { data: listData, error: listError } =
    await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listError) {
    console.error("[create-staff-member] listUsers error:", listError);
    return json({ error: "Failed to check existing users", detail: listError.message }, 500);
  }

  const existingAuthUser = listData?.users?.find(
    (u) => u.email?.toLowerCase() === normalizedEmail,
  );

  let targetUserId: string;
  let alreadyRegistered = false;

  if (existingAuthUser) {
    // User already has an auth account — update their password and reuse
    alreadyRegistered = true;
    targetUserId = existingAuthUser.id;

    const { error: pwError } = await adminClient.auth.admin.updateUserById(
      targetUserId,
      { password: tempPassword },
    );

    if (pwError) {
      console.error("[create-staff-member] password reset error:", pwError);
      return json(
        { error: "Failed to reset password for existing user", detail: pwError.message },
        500,
      );
    }
  } else {
    // Create brand-new auth user with temp password
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true, // skip email confirmation — admin is creating the account
        user_metadata: { full_name: trimmedName, cafe_id, role: staffRole },
      });

    if (createError || !newUser?.user) {
      console.error("[create-staff-member] createUser error:", createError);
      return json(
        { error: "Failed to create auth user", detail: createError?.message },
        500,
      );
    }

    targetUserId = newUser.user.id;
  }

  // ── Write staff_users row ─────────────────────────────────────
  const result = await applyStaffRow(adminClient, {
    targetUserId,
    cafe_id,
    email: normalizedEmail,
    full_name: trimmedName,
    role: staffRole,
    callerRole: callerStaff.role,
  });

  if (result instanceof Response) return result;

  // ── Send credential email ─────────────────────────────────────
  let emailSent = false;
  let emailError: string | undefined;

  const loginUrl = siteUrl
    ? `${siteUrl.replace(/\/$/, "")}/login`
    : "(your dashboard login URL)";

  if (resendKey) {
    const emailResult = await sendCredentialEmail({
      resendKey,
      fromEmail,
      toEmail: normalizedEmail,
      fullName: trimmedName,
      tempPassword,
      loginUrl,
    });
    emailSent = emailResult.ok;
    if (!emailResult.ok) {
      console.warn("[create-staff-member] email send failed:", emailResult.error);
      emailError = emailResult.error;
    }
  } else {
    console.warn("[create-staff-member] RESEND_API_KEY not set — email not sent");
    emailError = "RESEND_API_KEY not configured";
  }

  return json(
    {
      success: true,
      already_registered: alreadyRegistered,
      email_sent: emailSent,
      email_error: emailSent ? undefined : emailError,
      // temp_password is returned only when email failed so admin can share manually
      temp_password: emailSent ? undefined : tempPassword,
      message: emailSent
        ? `Account created for ${normalizedEmail}. Login credentials sent by email.`
        : `Account created for ${normalizedEmail}. Email delivery failed — share the temporary password manually.`,
      user_id: targetUserId,
      staff_user: result,
    },
    200,
  );
});
