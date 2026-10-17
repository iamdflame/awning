import path from "node:path";
import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";

// Secrets live in the repo-root .env (one file for web/ and plugin/). Load it
// before Next reads web/.env*; values already in process.env always win.
loadEnvConfig(path.resolve(process.cwd(), ".."), process.env.NODE_ENV !== "production");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // PGlite ships WASM + data files resolved relative to its own module URL.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Migrations are read from disk at runtime (auto-migrate on first DB use).
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
};

export default nextConfig;
