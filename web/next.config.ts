import { existsSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Secrets live in the repo-root .env (one file for web/ and plugin/). Values
// already in process.env (shell, web/.env*, Vercel settings) always win.
const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A second local instance (e.g. with the mock facilitator) needs its own build dir.
  distDir: process.env.AWNING_NEXT_DIST || ".next",
  poweredByHeader: false,
  // PGlite ships WASM + data files resolved relative to its own module URL.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Migrations are read from disk at runtime (auto-migrate on first DB use).
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
  // Baseline browser hardening on every page and API response. No CSP yet: storefronts load
  // Google Fonts and generated images, and a strict policy needs its own review.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
