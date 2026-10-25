// Dashboard → "Turn on order alerts" saves this phone (POST) and turning
// them off / signing out forgets it (DELETE). Staff-only. See lib/push.ts.
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { isPushConfigured, removeSubscription, saveSubscription } from "@/lib/push";

export const runtime = "nodejs";

type Body = { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; endpoint?: string };

async function readBody(request: Request): Promise<Body | null> {
  try {
    return (await request.json()) as Body;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const staffCheck = await requireStaff(request);
  if (!staffCheck.ok) return staffCheck.response;
  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Alerts aren't set up yet — add the VAPID keys in Vercel." }, { status: 503 });
  }
  const body = await readBody(request);
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth || !/^https:\/\//.test(sub.endpoint)) {
    return NextResponse.json({ error: "Bad subscription." }, { status: 400 });
  }
  const error = await saveSubscription(
    staffCheck.userId,
    { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
    request.headers.get("user-agent") ?? ""
  );
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const staffCheck = await requireStaff(request);
  if (!staffCheck.ok) return staffCheck.response;
  const body = await readBody(request);
  if (!body?.endpoint) return NextResponse.json({ error: "Missing endpoint." }, { status: 400 });
  await removeSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
