// Forgets the saved Clover connection. Doesn't touch any products already
// synced from Clover — it only stops future syncs/webhook updates.
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { deleteCloverConnection } from "@/lib/clover";

export async function POST(request: Request) {
  // Dashboard-only: must come from a signed-in staffer (lib/require-staff.ts).
  const staffCheck = await requireStaff(request);
  if (!staffCheck.ok) return staffCheck.response;

  const ok = await deleteCloverConnection();
  if (!ok) {
    return NextResponse.json({ error: "Couldn't disconnect — try again." }, { status: 500 });
  }
  return NextResponse.json({ disconnected: true });
}
