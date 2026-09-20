import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { CartProvider } from "@/lib/cart-context";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, localBusinessJsonLd } from "@/lib/site";

// metadataBase lets every page below use a relative path (e.g. "/order")
// for its Open Graph/canonical URLs instead of having to spell out the full
// domain every time. Title "template" means every page's own title (e.g.
// "Order Online") is automatically suffixed into "Order Online | Manhattan
// Market" — only the homepage uses the plain default title below.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Manhattan Market — Order Ahead, Skip the Line",
    template: "%s | Manhattan Market",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "Manhattan Market",
    "convenience store Washington DC",
    "corner store Woodley Park",
    "order ahead pickup delivery DC",
    "Connecticut Ave grocery",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: SITE_NAME,
    title: "Manhattan Market — Order Ahead, Skip the Line",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Manhattan Market — Order Ahead, Skip the Line",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700;9..144,900&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* LocalBusiness structured data — lets Google show our hours,
            address, and phone directly in search results. See lib/site.ts. */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd()) }}
        />
      </head>
      <body className="bg-paper-texture flex min-h-full flex-col font-body">
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
