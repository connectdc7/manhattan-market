// Server-side check for the dashboard's API routes: "is this request from a
// signed-in staffer (or owner)?". Only import from app/api/**/route.ts.
//
// The browser sends its Supabase access token as `Authorization: Bearer …`
// (see lib/staff-auth.ts's staffFetch). We ask Supabase who that token
// belongs to, then look them up in the `staff` table.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "./supabase-admin";

export type StaffCheck =
  | { ok: true; userId: string; role: "owner" | "staff" }
  | { ok: false; response: NextResponse };

export async function requireStaff(request: Request, opts: { owner?: boolean } = {}): Promise<StaffCheck> {
  if (!supabaseAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Server isn't configured — SUPABASE_SERVICE_ROLE_KEY is missing." },
        { status: 503 }
      ),
    };
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Please sign in." }, { status: 401 }) };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Your session has expired — please sign in again." }, { status: 401 }),
    };
  }

  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("role")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!staffRow) {
    return { ok: false, response: NextResponse.json({ error: "Not on the staff list." }, { status: 403 }) };
  }
  if (opts.owner && staffRow.role !== "owner") {
    return { ok: false, response: NextResponse.json({ error: "Only the owner can do that." }, { status: 403 }) };
  }

  return { ok: true, userId: userData.user.id, role: staffRow.role as "owner" | "staff" };
}
