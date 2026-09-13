import type { Metadata } from "next";

// Same reason as app/rewards/layout.tsx: page.tsx here is a Client
// Component, so metadata lives in this server layout instead. This is the
// unlisted, no-login staff panel (see the note at the top of
// app/dashboard/page.tsx) — it should never appear in search results, and
// app/robots.ts also tells crawlers not to bother visiting it at all.
export const metadata: Metadata = {
  title: "Employee Dashboard",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <>{children}</>;
}
