// Forgets the saved Clover connection. Doesn't touch any products already
// synced from Clover — it only stops future syncs/webhook updates.
import { NextResponse } from "next/server";
import { deleteCloverConnection } from "@/lib/clover";

export async function POST() {
  const ok = await deleteCloverConnection();
  if (!ok) {
    return NextResponse.json({ error: "Couldn't disconnect — try again." }, { status: 500 });
  }
  return NextResponse.json({ disconnected: true });
}
