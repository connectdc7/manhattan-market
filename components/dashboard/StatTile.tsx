// A dashboard number. When given onClick it becomes a button that opens a
// drop-down with the details behind it (see TodayPanel).
const TONES = {
  default: "bg-paper text-ink",
  green: "bg-green text-white",
  gold: "bg-gold text-gold-ink",
  warning: "bg-pink-tint text-ink",
} as const;

export default function StatTile({
  label,
  value,
  sub,
  tone = "default",
  onClick,
  active = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: keyof typeof TONES;
  onClick?: () => void;
  active?: boolean;
}) {
  const soft = tone === "green" ? "text-white/75" : tone === "gold" ? "text-gold-ink/75" : "text-ink-soft";
  const body = (
    <>
      <p className={`flex items-center justify-between gap-2 font-mono text-[0.62rem] font-bold uppercase tracking-widest ${soft}`}>
        {label}
        {onClick && (
          <span aria-hidden className={`text-[0.75rem] transition-transform ${active ? "rotate-180" : ""}`}>
            ▾
          </span>
        )}
      </p>
      <p className="font-poster mt-2 text-[2.1rem] leading-none sm:text-[2.5rem]">{value}</p>
      {sub && <p className={`mt-1.5 truncate font-body text-xs ${soft}`}>{sub}</p>}
    </>
  );

  const base = `rounded-2xl border-2 border-ink p-4 text-left ${TONES[tone]}`;
  if (!onClick) return <div className={base}>{body}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`${base} transition hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--ink)] active:translate-y-0 active:shadow-none ${
        active ? "-translate-y-0.5 shadow-[4px_4px_0_var(--ink)]" : ""
      }`}
    >
      {body}
    </button>
  );
}
