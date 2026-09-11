"use client";

import { useEffect, useRef, useState } from "react";

// A segmented-control-style category filter: an indicator that slides to
// the active pill instead of pills just snapping between two colors.
export default function CategoryPills<T extends string>({
  options,
  active,
  onChange,
}: {
  options: readonly T[];
  active: T;
  onChange: (value: T) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Partial<Record<string, HTMLButtonElement>>>({});
  const [indicator, setIndicator] = useState<{ left: number; top: number; width: number; height: number } | null>(
    null
  );

  useEffect(() => {
    const measure = () => {
      const btn = btnRefs.current[active];
      if (btn) {
        setIndicator({ left: btn.offsetLeft, top: btn.offsetTop, width: btn.offsetWidth, height: btn.offsetHeight });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, options]);

  return (
    <div ref={containerRef} className="relative flex flex-wrap gap-2">
      {indicator && (
        <span
          className="pointer-events-none absolute rounded-full bg-green transition-all duration-300 ease-out"
          style={{ left: indicator.left, top: indicator.top, width: indicator.width, height: indicator.height }}
        />
      )}
      {options.map((opt) => (
        <button
          key={opt}
          ref={(el) => {
            btnRefs.current[opt] = el ?? undefined;
          }}
          onClick={() => onChange(opt)}
          className={`relative z-10 rounded-full border px-4 py-1.5 font-mono text-xs font-semibold transition-colors duration-300 ${
            active === opt ? "border-green text-white" : "border-line text-ink-soft hover:border-green hover:text-green"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
