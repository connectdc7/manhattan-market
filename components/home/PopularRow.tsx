"use client";

import { useRef } from "react";
import type { Product } from "@/lib/products";
import ProductCard from "@/components/ProductCard";

// Homepage "Popular right now" — a swipeable row of real product cards
// with Add buttons, so people can fill the cart without leaving the page.
export default function PopularRow({ products }: { products: Product[] }) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className="relative">
      <div className="absolute -top-14 right-0 hidden gap-2 sm:flex">
        {([-1, 1] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => scroll(d)}
            aria-label={d < 0 ? "Scroll back" : "Scroll forward"}
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-paper font-mono text-sm font-bold text-ink shadow-[3px_3px_0_var(--ink)] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
          >
            {d < 0 ? "←" : "→"}
          </button>
        ))}
      </div>
      <div
        ref={track}
        className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p) => (
          <div key={p.id} className="w-[11.5rem] shrink-0 snap-start sm:w-[13.5rem]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
