import type { Metadata } from "next";

// Same reason as app/rewards/layout.tsx: page.tsx here is a Client
// Component, so metadata lives in this server layout instead. Checkout is
// also explicitly kept out of search results — it's tied to whatever's
// currently in one visitor's cart, so there's nothing here worth indexing.
export const metadata: Metadata = {
  title: "Checkout",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutLayout({ children }: LayoutProps<"/checkout">) {
  return <>{children}</>;
}
