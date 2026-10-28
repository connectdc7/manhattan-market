// Owner-only: "Open dashboard as…" on the Staff tab. Returns a one-time
// sign-in token for that staff member (no email is sent), which the
// owner's browser exchanges for that person's session. Only regular staff
// can be opened this way — never another owner, never yourself.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaff } from "@/lib/require-staff";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const check = await requireStaff(request, { owner: true });
  if (!check.ok) return check.response;
  const { id } = await ctx.params;
  if (id === check.userId) return NextResponse.json({ error: "That's you." }, { status: 400 });

  const admin = supabaseAdmin!;
  const { data: target } = await admin.from("staff").select("user_id, email, name, role").eq("user_id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
  if (target.role !== "staff") return NextResponse.json({ error: "Owners' dashboards can't be opened this way." }, { status: 403 });

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: target.email as string });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    console.error("[view-as] generateLink failed", error?.message);
    return NextResponse.json({ error: "Couldn't open that dashboard — try again." }, { status: 502 });
  }
  console.log("[view-as] owner opened staff dashboard", { owner: check.userId, staff: id });
  return NextResponse.json({ tokenHash, email: target.email, name: target.name });
}
