// A dashboard number. When given onClick it becomes a button that opens a
// drop-down with the details behind the number (see app/dashboard/page.tsx).
export default function StatTile({
  label,
  value,
  tone = "default",
  onClick,
  active = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
    <>
      <p className="flex items-center justify-between gap-2 font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">
        {label}
        {onClick && (
          <span aria-hidden className={`text-[0.7rem] transition-transform ${active ? "rotate-180" : ""}`}>
            ▾
          </span>
        )}
      </p>
      <p
        className={`mt-1.5 font-display text-2xl font-bold sm:text-3xl ${
          tone === "warning" ? "text-[#a8461a]" : "text-ink"
        }`}
      >
        {value}
      </p>
    </>
  );

  if (!onClick) return <div className="rounded-lg border border-line bg-paper p-4">{body}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`rounded-lg border bg-paper p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
        active ? "border-green ring-2 ring-green/20" : "border-line hover:border-green/50"
      }`}
    >
      {body}
    </button>
  );
}
