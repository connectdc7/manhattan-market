// Staff list + "add a staff member" for the dashboard's Staff tab.
// Owner-only. Uses the service role key (lib/supabase-admin.ts) because
// creating Supabase Auth accounts can't be done with the public key.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaff } from "@/lib/require-staff";

export async function GET(request: Request) {
  const check = await requireStaff(request, { owner: true });
  if (!check.ok) return check.response;

  const { data, error } = await supabaseAdmin!
    .from("staff")
    .select("user_id, email, name, role, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data ?? [] });
}

// Creates the login with a temporary password the owner picks and hands to
// the new staffer in person — works even before email sending is set up.
// The staffer can change it later with "Forgot password?" on the sign-in
// screen (once email is set up), or the owner can set a new one here.
export async function POST(request: Request) {
  const check = await requireStaff(request, { owner: true });
  if (!check.ok) return check.response;

  let body: { email?: string; name?: string; password?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim() || null;
  const password = body.password ?? "";
  const role = body.role === "owner" ? "owner" : "staff";

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Temporary password must be at least 8 characters." }, { status: 400 });
  }

  const admin = supabaseAdmin!;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: name ? { name } : undefined,
  });

  if (createError || !created.user) {
    const msg = createError?.message ?? "Couldn't create the account.";
    const friendly = /already.*registered|already exists/i.test(msg)
      ? "An account with that email already exists."
      : msg;
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  const { error: staffError } = await admin
    .from("staff")
    .insert({ user_id: created.user.id, email, name, role });

  if (staffError) {
    // Don't leave a login behind that isn't on the staff list.
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: staffError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
