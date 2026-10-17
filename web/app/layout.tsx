import type { Metadata, Viewport } from "next";
import { env } from "@/lib/env";

const TITLE = "Awning: open a real business in one sentence";
const DESCRIPTION =
  "Tell your AI agent what you sell. Awning gives it a real domain, a storefront, a phone that answers and a checkout that pays your own wallet. Other agents can buy from it too.";

/**
 * One root layout for every host. It stays neutral (no CSS, no fonts): awning.sh
 * pages bring the brand through SiteHeader, and storefronts bring their own
 * palette, fonts, icon and social image.
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.AWNING_SITE_URL || `https://${env.rootDomain()}`),
  title: { default: TITLE, template: "%s · Awning" },
  description: DESCRIPTION,
  applicationName: "Awning",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "Awning",
    title: TITLE,
    description: "A PayBox plugin. Domain, storefront, phone line and checkout, from one sentence to your agent. Its first customer can be an AI.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Open for business in one sentence: a street of small shops where a new one opens." }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og.png"] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#003b23" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
