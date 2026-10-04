// Browser-side helpers for the staff login on /dashboard.
//
// Sign-in uses Supabase Auth (email + password). The session is kept by the
// same `supabase` client the rest of the app uses, so once a staffer signs
// in, every dashboard read/write automatically goes out as them — and the
// Row Level Security policies in supabase/staff-login.sql are what decide
// what they're allowed to touch. Hiding the dashboard behind a login form is
// just the UI; the database is the real lock.
import { supabase } from "./supabase";

export type StaffRole = "owner" | "staff";

export type StaffMember = {
  userId: string;
  email: string;
  name: string | null;
  role: StaffRole;
};

export async function signInStaff(email: string, password: string): Promise<string | null> {
  if (!supabase) return "Supabase isn't configured.";
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (!error) return null;
  if (/invalid login credentials/i.test(error.message)) return "That email and password don't match.";
  if (/email not confirmed/i.test(error.message)) return "This account hasn't been confirmed yet — ask the owner.";
  return error.message;
}

export async function signOutStaff() {
  await supabase?.auth.signOut();
}

// Emails a "reset your password" link that lands on /dashboard/reset-password.
// That URL has to be in Supabase > Authentication > URL Configuration >
// Redirect URLs, or Supabase will send people to the Site URL instead.
export async function sendPasswordReset(email: string): Promise<string | null> {
  if (!supabase) return "Supabase isn't configured.";
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/dashboard/reset-password`,
  });
  return error ? error.message : null;
}

export async function setNewPassword(password: string): Promise<string | null> {
  if (!supabase) return "Supabase isn't configured.";
  const { error } = await supabase.auth.updateUser({ password });
  return error ? error.message : null;
}

// The signed-in user's row in the `staff` table, or null if they're signed
// in but not on the staff list (e.g. removed by the owner).
export async function getMyStaffRecord(userId: string): Promise<StaffMember | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("staff")
    .select("user_id, email, name, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("getMyStaffRecord:", error.message);
    return null;
  }
  return { userId: data.user_id, email: data.email, name: data.name, role: data.role as StaffRole };
}

// fetch() for the dashboard's own API routes (Clover sync, photo
// generation, SMS, staff management…). Adds the signed-in staffer's access
// token so the route can check who's asking — see lib/require-staff.ts.
export async function staffFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const headers = new Headers(init.headers);
  if (session) headers.set("Authorization", `Bearer ${session.access_token}`);
  return fetch(input, { ...init, headers });
}
