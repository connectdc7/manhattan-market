// Change one staff member (role / password) or remove them. Owner-only.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaff } from "@/lib/require-staff";

async function ownerCount(): Promise<number> {
  const { count } = await supabaseAdmin!
    .from("staff")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "owner");
  return count ?? 0;
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const check = await requireStaff(request, { owner: true });
  if (!check.ok) return check.response;
  const { id } = await ctx.params;

  let body: { role?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const admin = supabaseAdmin!;

  if (body.role === "owner" || body.role === "staff") {
    if (body.role === "staff") {
      const { data: target } = await admin.from("staff").select("role").eq("user_id", id).maybeSingle();
      if (target?.role === "owner" && (await ownerCount()) <= 1) {
        return NextResponse.json({ error: "There has to be at least one owner." }, { status: 400 });
      }
    }
    const { error } = await admin.from("staff").update({ role: body.role }).eq("user_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (typeof body.password === "string") {
    if (body.password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    const { error } = await admin.auth.admin.updateUserById(id, { password: body.password });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Deletes the login entirely (the staff row goes with it via ON DELETE
// CASCADE), so a removed staffer can't sign back in.
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const check = await requireStaff(request, { owner: true });
  if (!check.ok) return check.response;
  const { id } = await ctx.params;

  if (id === check.userId) {
    return NextResponse.json({ error: "You can't remove yourself." }, { status: 400 });
  }

  const admin = supabaseAdmin!;
  const { data: target } = await admin.from("staff").select("role").eq("user_id", id).maybeSingle();
  if (target?.role === "owner" && (await ownerCount()) <= 1) {
    return NextResponse.json({ error: "There has to be at least one owner." }, { status: 400 });
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
