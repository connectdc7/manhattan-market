"use client";

// Owner-only "Staff" tab: see who can sign in to the dashboard, add someone
// (with a temporary password you hand them), reset a password, change
// someone's role, or remove them. All changes go through app/api/staff/**.
import { useCallback, useEffect, useState } from "react";
import { staffFetch, StaffMember, StaffRole } from "@/lib/staff-auth";
import { inputClass, labelClass } from "./StaffGate";

type Row = { user_id: string; email: string; name: string | null; role: StaffRole; created_at: string };

const smallButton =
  "rounded-full border border-line px-3 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-ink-soft transition hover:border-green hover:text-green";

export default function StaffPanel({ me }: { me: StaffMember }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [adding, setAdding] = useState(false);

  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await staffFetch("/api/staff");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Couldn't load staff.");
      setRows(body.staff);
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (!confirmRemove) return;
    const t = setTimeout(() => setConfirmRemove(null), 4000);
    return () => clearTimeout(t);
  }, [confirmRemove]);

  const call = async (url: string, init: RequestInit, success: string) => {
    setError(null);
    setNotice(null);
    const res = await staffFetch(url, {
      ...init,
      headers: { "Content-Type": "application/json" },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return false;
    }
    setNotice(success);
    await load();
    return true;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    const ok = await call(
      "/api/staff",
      { method: "POST", body: JSON.stringify({ email, name, password, role }) },
      `Added ${email}. Give them their temporary password — they sign in at this same /dashboard page.`
    );
    setAdding(false);
    if (ok) {
      setEmail("");
      setName("");
      setPassword("");
      setRole("staff");
    }
  };

  const handleReset = async (row: Row) => {
    const ok = await call(
      `/api/staff/${row.user_id}`,
      { method: "PATCH", body: JSON.stringify({ password: resetPassword }) },
      `New password set for ${row.email}.`
    );
    if (ok) {
      setResetFor(null);
      setResetPassword("");
    }
  };

  const handleRole = (row: Row) =>
    call(
      `/api/staff/${row.user_id}`,
      { method: "PATCH", body: JSON.stringify({ role: row.role === "owner" ? "staff" : "owner" }) },
      `${row.email} is now ${row.role === "owner" ? "staff" : "an owner"}.`
    );

  const handleRemove = async (row: Row) => {
    if (confirmRemove !== row.user_id) {
      setConfirmRemove(row.user_id);
      return;
    }
    setConfirmRemove(null);
    await call(`/api/staff/${row.user_id}`, { method: "DELETE" }, `Removed ${row.email}.`);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <p className={labelClass}>Who can sign in</p>
        {error && <p className="mt-3 font-body text-sm text-[#a8461a]">{error}</p>}
        {notice && <p className="mt-3 font-body text-sm text-green">{notice}</p>}

        {rows === null ? (
          <p className="mt-4 font-mono text-xs uppercase tracking-wide text-ink-soft">Loading…</p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line">
            {rows.map((row) => {
              const isMe = row.user_id === me.userId;
              return (
                <li key={row.user_id} className="bg-paper p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-body text-sm font-semibold text-ink">
                        {row.name || row.email}
                        {isMe && <span className="ml-2 font-mono text-[0.6rem] uppercase text-ink-soft">(you)</span>}
                      </p>
                      {row.name && <p className="truncate font-body text-xs text-ink-soft">{row.email}</p>}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide ${
                        row.role === "owner" ? "bg-green text-white" : "border border-line text-ink-soft"
                      }`}
                    >
                      {row.role}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className={smallButton}
                      onClick={() => {
                        setResetFor(resetFor === row.user_id ? null : row.user_id);
                        setResetPassword("");
                      }}
                    >
                      Set password
                    </button>
                    {!isMe && (
                      <>
                        <button className={smallButton} onClick={() => handleRole(row)}>
                          {row.role === "owner" ? "Make staff" : "Make owner"}
                        </button>
                        <button
                          className={`${smallButton} hover:border-[#a8461a] hover:text-[#a8461a]`}
                          onClick={() => handleRemove(row)}
                        >
                          {confirmRemove === row.user_id ? "Click again to remove" : "Remove"}
                        </button>
                      </>
                    )}
                  </div>

                  {resetFor === row.user_id && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder="New password (8+ characters)"
                        className={`${inputClass} flex-1`}
                      />
                      <button
                        className="rounded-full bg-green px-3.5 py-1.5 font-mono text-xs font-semibold text-white transition hover:bg-green-deep disabled:opacity-60"
                        disabled={resetPassword.length < 8}
                        onClick={() => handleReset(row)}
                      >
                        Save
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form onSubmit={handleAdd} className="flex flex-col gap-3 self-start rounded-lg border border-line bg-panel p-4">
        <p className={labelClass}>Add a staff member</p>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Name (optional)</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Temporary password</span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="8+ characters"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={inputClass}>
            <option value="staff">Staff — orders, inventory, homepage</option>
            <option value="owner">Owner — everything, plus this Staff tab</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={adding}
          className="mt-1 rounded-full bg-green px-4 py-2 font-mono text-xs font-semibold text-white transition hover:bg-green-deep disabled:opacity-60"
        >
          {adding ? "Adding…" : "Add staff member"}
        </button>
      </form>
    </div>
  );
}
