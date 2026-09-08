const HOURS = [
  ["Monday", "6:00am – 11:00pm"],
  ["Tuesday", "6:00am – 11:00pm"],
  ["Wednesday", "6:00am – 11:00pm"],
  ["Thursday", "6:00am – 11:00pm"],
  ["Friday", "6:00am – 11:00pm"],
  ["Saturday", "6:00am – 11:00pm"],
  ["Sunday", "7:00am – 10:00pm"],
];

export default function LocationPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <p className="eyebrow text-green">Hours &amp; Location</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
        Find us
      </h1>
      <p className="mt-2 font-body text-sm text-ink-soft">
        Placeholder address and hours — swap in the real ones before launch.
      </p>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <div className="flex h-48 items-center justify-center rounded-lg border border-line bg-panel font-mono text-xs uppercase tracking-widest text-ink-soft">
            map placeholder
          </div>
          <p className="mt-4 font-body text-sm text-ink">123 Main Street</p>
          <p className="font-body text-sm text-ink-soft">New York, NY 10001</p>
          <p className="mt-1 font-body text-sm text-ink-soft">(555) 555-0123</p>
        </div>

        <div>
          <table className="w-full border-collapse font-body text-sm">
            <tbody>
              {HOURS.map(([day, time]) => (
                <tr key={day} className="border-b border-line last:border-none">
                  <td className="py-2.5 text-ink">{day}</td>
                  <td className="py-2.5 text-right font-mono text-ink-soft">{time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
