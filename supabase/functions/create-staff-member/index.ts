// ============================================================
// Edge Function: create-staff-member
// Cafe Maestro Platform
// ============================================================
// Directly creates a Supabase Auth user with a secure temporary
// password, writes the staff_users row, and optionally sends a
// credentials email via Resend (RESEND_API_KEY secret).
//
// The temporary password and login URL are always returned in
// the response so the admin can share credentials manually if
// email is not configured.
//
// Auto-injected by Supabase (do NOT set manually):
//   SUPABASE_URL              — project REST URL
//   SUPABASE_ANON_KEY         — public anon key
//   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS)
//
// Set via CLI or Supabase dashboard:
//   SITE_URL         — bare domain, e.g. https://xyz.repl.co
//   RESEND_API_KEY   — (optional) Resend API key for email delivery
//   FROM_EMAIL       — (optional) sender address, defaults to noreply@resend.dev
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

// ── CORS ──────────────────────────────────────────────────────

const CORS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── Secure temporary password generator ───────────────────────
// 12 characters: at least 2 uppercase, 2 lowercase, 2 digits,
// 1 symbol. Excludes visually ambiguous chars (0, O, l, 1, I).

function generateTempPassword(): string {
  const upper   = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower   = "abcdefghjkmnpqrstuvwxyz";
  const digits  = "23456789";
  const symbols = "!@#$%&";
  const all     = upper + lower + digits + symbols;

  const buf = new Uint8Array(20);
  crypto.getRandomValues(buf);

  const chars: string[] = [
    upper[buf[0]  % upper.length],
    upper[buf[1]  % upper.length],
    lower[buf[2]  % lower.length],
    lower[buf[3]  % lower.length],
    digits[buf[4] % digits.length],
    digits[buf[5] % digits.length],
    symbols[buf[6] % symbols.length],
  ];

  for (let i = 7; i < 12; i++) {
    chars.push(all[buf[i] % all.length]);
  }

  // Fisher-Yates shuffle using remaining random bytes
  for (let i = chars.length - 1; i > 0; i--) {
    const j = buf[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

// ── Optional email delivery via Resend ────────────────────────

async function sendCredentialsEmail(opts: {
  resendApiKey: string;
  fromEmail: string;
  toEmail: string;
  recipientName: string;
  tempPassword: string;
  loginUrl: string;
  cafeName?: string;
}): Promise<boolean> {
  const { resendApiKey, fromEmail, toEmail, recipientName, tempPassword, loginUrl, cafeName } = opts;

  const subject = cafeName
    ? `Your ${cafeName} staff account is ready`
    : "Your Cafe Maestro staff account is ready";

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111">
      <h2 style="margin-bottom:4px">Welcome, ${recipientName}!</h2>
      <p style="color:#555;margin-top:0">An account has been created for you${cafeName ? ` at <strong>${cafeName}</strong>` : ""}.</p>

      <div style="background:#f4f4f5;border-radius:8px;padding:20px;margin:24px 0">
        <p style="margin:0 0 8px 0;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:.05em">Your login details</p>
        <table style="border-collapse:collapse;width:100%">
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#555;width:120px">Email</td>
            <td style="padding:6px 0;font-size:14px;font-weight:600">${toEmail}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#555">Password</td>
            <td style="padding:6px 0;font-size:14px;font-weight:600;font-family:monospace;letter-spacing:.1em">${tempPassword}</td>
          </tr>
        </table>
      </div>

      <a href="${loginUrl}"
         style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">
        Sign in to your dashboard →
      </a>

      <p style="color:#888;font-size:13px;margin-top:24px">
        You will be asked to set a new password on your first login.
      </p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toEmail,
        subject,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Entry point ───────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── Environment ───────────────────────────────────────────────
  const supabaseUrl      = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey          = Deno.env.get("SUPABASE_ANON_KEY")!;
  const siteUrl          = Deno.env.get("SITE_URL") ?? supabaseUrl ?? "";
  const resendApiKey     = Deno.env.get("RESEND_API_KEY") ?? "";
  const fromEmail        = Deno.env.get("FROM_EMAIL") ?? "noreply@resend.dev";

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: "Server configuration error" }, 500);
  }

  const loginUrl = `${siteUrl.replace(/\/$/, "")}/admin/login`;

  // ── Parse body ────────────────────────────────────────────────
  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  const { email, full_name, role, cafe_id } = body;

  if (!email || typeof email !== "string")
    return json({ error: "email is required and must be a string" }, 400);
  if (!full_name || typeof full_name !== "string")
    return json({ error: "full_name is required and must be a string" }, 400);
  if (!role || typeof role !== "string")
    return json({ error: "role is required and must be a string" }, 400);
  if (!cafe_id || typeof cafe_id !== "string")
    return json({ error: "cafe_id is required and must be a string" }, 400);

  const normalizedEmail = (email as string).trim().toLowerCase();
  const trimmedName     = (full_name as string).trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
    return json({ error: "Invalid email address format" }, 400);

  if (!(VALID_ROLES as readonly string[]).includes(role))
    return json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` }, 400);

  const staffRole = role as StaffRole;

  // ── Authorization header ──────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    return json({ error: "Missing or malformed Authorization header" }, 401);

  // ── Supabase clients ──────────────────────────────────────────
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Verify caller ─────────────────────────────────────────────
  const { data: { user: caller }, error: callerErr } =
    await callerClient.auth.getUser();

  if (callerErr || !caller)
    return json({ error: "Invalid or expired token" }, 401);

  const { data: callerStaff, error: callerStaffErr } = await adminClient
    .from("staff_users")
    .select("role, cafe_id, cafes(name)")
    .eq("id", caller.id)
    .eq("is_active", true)
    .single<{ role: StaffRole; cafe_id: string; cafes: { name: string } | null }>();

  if (callerStaffErr || !callerStaff)
    return json({ error: "Caller is not an active staff member" }, 403);

  if (callerStaff.cafe_id !== cafe_id)
    return json({ error: "Cannot create members in a different cafe" }, 403);

  if (!["owner", "manager"].includes(callerStaff.role))
    return json({ error: "Only owners and managers can create staff accounts" }, 403);

  if (callerStaff.role === "manager" && ["owner", "manager"].includes(staffRole))
    return json({ error: "Managers can only create staff or chef accounts" }, 403);

  // ── Generate temporary password ───────────────────────────────
  const tempPassword = generateTempPassword();

  // ── Create or update auth user ───────────────────────────────
  let targetUserId: string;
  let alreadyExisted = false;

  const { data: createData, error: createErr } =
    await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: trimmedName, cafe_id, role: staffRole },
    });

  if (!createErr) {
    targetUserId = createData.user!.id;
  } else {
    // User already exists in auth — find them and reset their password
    const errMsg = createErr.message?.toLowerCase() ?? "";
    const isDuplicate =
      errMsg.includes("already been registered") ||
      errMsg.includes("already registered") ||
      errMsg.includes("email_exists") ||
      (createErr as unknown as { status: number }).status === 422;

    if (!isDuplicate) {
      console.error("[create-staff-member] createUser error:", createErr);
      return json({ error: "Failed to create auth user", detail: createErr.message }, 500);
    }

    // Find existing auth user
    const { data: listData, error: listErr } =
      await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (listErr)
      return json({ error: "Could not locate existing user", detail: listErr.message }, 500);

    const existing = listData?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    if (!existing)
      return json({ error: "Email already registered but user could not be located" }, 500);

    targetUserId  = existing.id;
    alreadyExisted = true;

    // Reset password for re-onboarding
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(
      targetUserId,
      { password: tempPassword }
    );

    if (updateErr)
      return json({ error: "Failed to reset user password", detail: updateErr.message }, 500);
  }

  // ── Cross-cafe protection ─────────────────────────────────────
  const { data: existingRow } = await adminClient
    .from("staff_users")
    .select("id, cafe_id, role")
    .eq("id", targetUserId)
    .maybeSingle<{ id: string; cafe_id: string; role: StaffRole }>();

  if (existingRow && existingRow.cafe_id !== cafe_id) {
    return json({
      error: "User already belongs to another cafe",
      code: "CROSS_CAFE_CONFLICT",
    }, 409);
  }

  if (existingRow && callerStaff.role === "manager" &&
      ["owner", "manager"].includes(existingRow.role)) {
    return json({
      error: "Managers cannot modify owner or manager accounts",
      code: "INSUFFICIENT_ROLE",
    }, 403);
  }

  // ── Write staff_users row ─────────────────────────────────────
  let staffRow: StaffRow;

  if (!existingRow) {
    const { data: inserted, error: insertErr } = await adminClient
      .from("staff_users")
      .insert({
        id: targetUserId,
        cafe_id,
        email: normalizedEmail,
        full_name: trimmedName,
        role: staffRole,
        is_active: true,
        must_change_password: true,
      })
      .select()
      .single<StaffRow>();

    if (insertErr)
      return json({ error: "Failed to create staff record", detail: insertErr.message }, 500);

    staffRow = inserted!;
  } else {
    const { data: updated, error: updateErr } = await adminClient
      .from("staff_users")
      .update({
        email: normalizedEmail,
        full_name: trimmedName,
        role: staffRole,
        is_active: true,
        must_change_password: true,
      })
      .eq("id", targetUserId)
      .select()
      .single<StaffRow>();

    if (updateErr)
      return json({ error: "Failed to update staff record", detail: updateErr.message }, 500);

    staffRow = updated!;
  }

  // ── Optional email delivery ───────────────────────────────────
  let emailSent = false;

  if (resendApiKey) {
    emailSent = await sendCredentialsEmail({
      resendApiKey,
      fromEmail,
      toEmail: normalizedEmail,
      recipientName: trimmedName,
      tempPassword,
      loginUrl,
      cafeName: (callerStaff.cafes as unknown as { name: string } | null)?.name,
    });
  }

  return json({
    success:        true,
    already_existed: alreadyExisted,
    email_sent:     emailSent,
    email:          normalizedEmail,
    temp_password:  tempPassword,
    login_url:      loginUrl,
    staff_user:     staffRow,
  });
});
