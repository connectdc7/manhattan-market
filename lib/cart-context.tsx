"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { products } from "./products";

type CartLine = { id: string; qty: number };

type CartContextValue = {
  lines: CartLine[];
  add: (id: string) => void;
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

  const add = (id: string) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.id === id);
      if (existing) {
        return prev.map((l) => (l.id === id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { id, qty: 1 }];
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
      const product = products.find((p) => p.id === line.id);
      if (!product) continue;
      count += line.qty;
      subtotal += product.price * line.qty;
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
