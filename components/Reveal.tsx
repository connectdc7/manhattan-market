"use client";

import { useEffect, useRef, useState, ReactNode } from "react";

// Fades + rises a section into place the first time it scrolls into view,
// instead of everything just being there on load. Plays once per element,
// respects prefers-reduced-motion (see the .reveal rule in globals.css).
export default function Reveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // A generous rootMargin so content reveals well before it's actually
    // on screen (no blank flash on a fast scroll), plus a hard fallback
    // timer — content must never stay invisible just because a browser
    // quirk kept the observer from firing. Real commerce content (stock,
    // prices) can't depend entirely on JS timing to be visible at all.
    const fallback = setTimeout(() => setVisible(true), 1500);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            clearTimeout(fallback);
          }
        }
      },
      { threshold: 0.01, rootMargin: "400px 0px 0px 0px" }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
