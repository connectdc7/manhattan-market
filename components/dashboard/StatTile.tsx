export default function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <p className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">{label}</p>
      <p
        className={`mt-1.5 font-display text-2xl font-bold sm:text-3xl ${
          tone === "warning" ? "text-[#a8461a]" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
