"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

// Cart lines snapshot the name/price at add-time, so the cart doesn't care
// whether products came from the local sample data or Supabase.
type CartLine = { id: string; name: string; price: number; qty: number };
type AddInput = { id: string; name: string; price: number };

type CartContextValue = {
  lines: CartLine[];
  add: (product: AddInput) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mm-cart");
      if (saved) setLines(JSON.parse(saved));
    } catch {
      // ignore — starts with an empty cart
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("mm-cart", JSON.stringify(lines));
    } catch {
      // ignore
    }
  }, [lines]);

  const add = (product: AddInput) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.id === product.id);
      if (existing) {
        return prev.map((l) => (l.id === product.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { ...product, qty: 1 }];
    });
    setDrawerOpen(true);
  };

  const remove = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));

  const setQty = (id: string, qty: number) => {
    if (qty <= 0) return remove(id);
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, qty } : l)));
  };

  const clear = () => setLines([]);

  const { count, subtotal } = useMemo(() => {
    let count = 0;
    let subtotal = 0;
    for (const line of lines) {
      count += line.qty;
      subtotal += line.price * line.qty;
    }
    return { count, subtotal };
  }, [lines]);

  return (
    <CartContext.Provider
      value={{
        lines,
        add,
        remove,
        setQty,
        clear,
        count,
        subtotal,
        drawerOpen,
        openDrawer: () => setDrawerOpen(true),
        closeDrawer: () => setDrawerOpen(false),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
