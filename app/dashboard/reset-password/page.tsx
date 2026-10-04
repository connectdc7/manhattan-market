"use client";

// Where the "reset your password" email link lands. Supabase puts a
// one-time recovery session in the URL; the shared client picks it up
// automatically, and this page lets the staffer choose a new password.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { setNewPassword } from "@/lib/staff-auth";
import { inputClass, labelClass } from "@/components/dashboard/StaffGate";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReady("invalid");
      return;
    }
    const client = supabase;
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) setReady("ok");
    });
    // Give the client a moment to read the link's token from the URL.
    const t = setTimeout(async () => {
      const { data } = await client.auth.getSession();
      setReady((prev) => (prev === "ok" || data.session ? "ok" : "invalid"));
    }, 1200);
    return () => {
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Those passwords don't match.");
    setBusy(true);
    setError(null);
    const err = await setNewPassword(password);
    setBusy(false);
    if (err) return setError(err);
    router.replace("/dashboard");
  };

  return (
    <div className="mx-auto max-w-sm px-5 py-16">
      <p className="eyebrow text-green">Staff Only</p>
      <div className="mt-3 rounded-lg border border-line bg-panel p-6">
        <h1 className="font-display text-2xl font-bold text-ink">Choose a new password</h1>

        {ready === "checking" && (
          <p className="mt-4 font-mono text-xs uppercase tracking-wide text-ink-soft">Checking your link…</p>
        )}

        {ready === "invalid" && (
          <>
            <p className="mt-4 font-body text-sm text-ink-soft">
              This reset link is invalid or has expired. Go back to the sign-in screen and use
              &quot;Forgot password?&quot; to get a fresh one.
            </p>
            <button
              onClick={() => router.replace("/dashboard")}
              className="mt-6 w-full rounded-full bg-green px-4 py-2.5 font-mono text-xs font-semibold text-white transition hover:bg-green-deep"
            >
              Back to sign in
            </button>
          </>
        )}

        {ready === "ok" && (
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className={labelClass}>New password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className={inputClass}
              />
            </label>
            {error && <p className="font-body text-sm text-[#a8461a]">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-green px-4 py-2.5 font-mono text-xs font-semibold text-white transition hover:bg-green-deep disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save and go to dashboard"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
