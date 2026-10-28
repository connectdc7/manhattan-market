import type { ReactNode } from "react";

// The green tiled header band used at the top of every storefront page,
// matching the homepage hero (see .bg-bodega-tiles / .font-poster in globals.css).
export default function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b-2 border-ink bg-bodega-tiles text-white">
      <div className="mx-auto max-w-6xl px-5 pb-10 pt-9 sm:pb-12 sm:pt-12">
        <p className="inline-block rounded-full border-2 border-ink bg-gold px-3 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-widest text-gold-ink shadow-[3px_3px_0_var(--ink)]">
          {eyebrow}
        </p>
        <h1 className="font-poster mt-4 max-w-4xl break-words text-[2.6rem] uppercase leading-[0.95] sm:text-6xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl font-body text-base text-white/85 sm:text-lg">{subtitle}</p>}
        {children && <div className="mt-5">{children}</div>}
      </div>
    </section>
  );
}
