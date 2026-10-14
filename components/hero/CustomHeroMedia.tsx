"use client";

import { useEffect, useState } from "react";
import type { HeroMedia } from "@/lib/hero";

// The "Your Photo / Video" hero background — whatever the client put in
// rotation from the dashboard's Homepage tab. One video plays on a loop;
// several photos cross-fade every few seconds (a slow zoom keeps it
// lively). A dark gradient overlay keeps the white hero text readable over
// any photo.
const SLIDE_MS = 6000;

export default function CustomHeroMedia({ items }: { items: HeroMedia[] }) {
  const [index, setIndex] = useState(0);
  const photos = items.filter((m) => m.kind === "photo");
  const video = items.find((m) => m.kind === "video");

  useEffect(() => {
    if (video || photos.length < 2) return;
    // Respect "reduce motion" — show the first photo only.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % photos.length), SLIDE_MS);
    return () => clearInterval(t);
  }, [video, photos.length]);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {video ? (
        <video className="h-full w-full object-cover" src={video.url} autoPlay muted loop playsInline />
      ) : (
        photos.map((m, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={m.id}
            src={m.url}
            alt=""
            loading={i === 0 ? "eager" : "lazy"}
            className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] ease-in-out ${
              i === index ? "scale-105 opacity-100" : "scale-100 opacity-0"
            }`}
            style={{ transitionDuration: `1200ms, ${SLIDE_MS + 1200}ms` }}
          />
        ))
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
    </div>
  );
}
