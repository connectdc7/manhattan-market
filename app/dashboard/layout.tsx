import type { Metadata } from "next";

// Lets staff add the dashboard to their phone's Home Screen as its own app
// ("MM Staff") — on iPhone that's required for new-order alerts to work.
export const metadata: Metadata = {
  title: "Staff Dashboard",
  manifest: "/dashboard.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "MM Staff", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon-staff.png" },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
