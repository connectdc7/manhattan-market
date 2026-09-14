import type { Metadata } from "next";

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
