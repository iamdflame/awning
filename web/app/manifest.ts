import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Awning",
    short_name: "Awning",
    description: "Open a real business in one sentence: domain, storefront, phone line and a checkout that pays your wallet.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6ed",
    theme_color: "#003b23",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
