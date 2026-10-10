"use client";

// Renders its children everywhere except the staff dashboard (/dashboard…),
// so customer-facing chrome — like the footer's site links — doesn't send
// staff off to the storefront with no easy way back.
import { ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function HideOnDashboard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/dashboard")) return null;
  return <>{children}</>;
}
