import type { Metadata } from "next";

// This route's page.tsx is a Client Component (it has a live signup form),
// and Next.js only allows the `metadata` export from Server Components —
// so the title/description live here instead, in a plain server layout
// that otherwise just passes children through untouched.
export const metadata: Metadata = {
  title: "Rewards Program",
  description:
    "Join Manhattan Market Rewards — earn 1 point per dollar spent and redeem 100 points for a free item. No app or card required.",
  alternates: {
    canonical: "/rewards",
  },
};

export default function RewardsLayout({ children }: LayoutProps<"/rewards">) {
  return <>{children}</>;
}
