"use client";

// Wraps /dashboard: shows the staff sign-in screen until someone signs in,
// then checks they're actually on the staff list before rendering the
// dashboard itself. The real protection is the database's Row Level
// Security (supabase/staff-login.sql) — this is the front door.
import { ReactNode, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  getMyStaffRecord,
  sendPasswordReset,
  signInStaff,
  signOutStaff,
  StaffMember,
} from "@/lib/staff-auth";

type GateState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "not-staff"; email: string }
  | { kind: "staff"; staff: StaffMember };

export const inputClass =
  "rounded border border-line bg-paper px-3 py-2 font-body text-sm text-ink outline-none focus:border-green";
export const labelClass = "font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft";
const primaryButton =
  "w-full rounded-full bg-green px-4 py-2.5 font-mono text-xs font-semibold text-white transition hover:bg-green-deep disabled:opacity-60";

export default function StaffGate({ children }: { children: (staff: StaffMember) => ReactNode }) {
  const [state, setState] = useState<GateState>({ kind: "loading" });

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;

    const resolve = async (userId: string | undefined, email: string | undefined) => {
      if (!userId) {
        if (!cancelled) setState({ kind: "signed-out" });
        return;
      }
      const staff = await getMyStaffRecord(userId);
      if (cancelled) return;
      setState(staff ? { kind: "staff", staff } : { kind: "not-staff", email: email ?? "" });
    };

    client.auth.getSession().then(({ data }) => resolve(data.session?.user.id, data.session?.user.email));

    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        // Deferred: Supabase recommends not awaiting other Supabase calls
        // directly inside this callback.
        setTimeout(() => resolve(session?.user.id, session?.user.email), 0);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <Shell>
        <p className="font-display text-lg font-bold text-ink">Connect Supabase to use this page</p>
        <p className="mt-2 font-body text-sm text-ink-soft">
          The dashboard needs Supabase configured. Follow the setup steps in the README, then reload.
        </p>
      </Shell>
    );
  }

  if (state.kind === "loading") {
    return (
      <div className="mx-auto max-w-5xl px-5 py-12">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Loading…</p>
      </div>
    );
  }

  if (state.kind === "signed-out") return <SignInForm />;

  if (state.kind === "not-staff") {
    return (
      <Shell>
        <p className="font-display text-lg font-bold text-ink">No dashboard access</p>
        <p className="mt-2 font-body text-sm text-ink-soft">
          {state.email ? <>You&apos;re signed in as {state.email}, but that</> : <>That</>} account isn&apos;t on
          the staff list. Ask the owner to add you.
        </p>
        <button onClick={() => signOutStaff()} className={`mt-6 ${primaryButton}`}>
          Sign out
        </button>
      </Shell>
    );
  }

  return <>{children(state.staff)}</>;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm px-5 py-16">
      <p className="eyebrow text-green">Staff Only</p>
      <div className="mt-3 rounded-lg border border-line bg-panel p-6">{children}</div>
    </div>
  );
}

function SignInForm() {
  const [mode, setMode] = useState<"sign-in" | "forgot">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await signInStaff(email, password);
    setBusy(false);
    if (err) setError(err);
    // On success, StaffGate's auth listener swaps this form out.
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await sendPasswordReset(email);
    setBusy(false);
    if (err) {
      setError(err);
    } else {
      // Same message whether or not the email exists, on purpose.
      setNotice("If that email belongs to a staff account, a reset link is on its way. Check your inbox (and spam).");
    }
  };

  return (
    <Shell>
      <h1 className="font-display text-2xl font-bold text-ink">
        {mode === "sign-in" ? "Staff sign in" : "Reset your password"}
      </h1>

      {mode === "sign-in" ? (
        <form onSubmit={handleSignIn} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
            />
          </label>
          {error && <p className="font-body text-sm text-[#a8461a]">{error}</p>}
          <button type="submit" disabled={busy} className={primaryButton}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("forgot");
              setError(null);
            }}
            className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft hover:text-green"
          >
            Forgot password?
          </button>
        </form>
      ) : (
        <form onSubmit={handleForgot} className="mt-5 flex flex-col gap-4">
          <p className="font-body text-sm text-ink-soft">
            Enter your email and we&apos;ll send you a link to choose a new password.
          </p>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
          </label>
          {error && <p className="font-body text-sm text-[#a8461a]">{error}</p>}
          {notice && <p className="font-body text-sm text-green">{notice}</p>}
          <button type="submit" disabled={busy || Boolean(notice)} className={primaryButton}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("sign-in");
              setError(null);
              setNotice(null);
            }}
            className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft hover:text-green"
          >
            Back to sign in
          </button>
        </form>
      )}
    </Shell>
  );
}
