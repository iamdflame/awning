import { existsSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Secrets live in the repo-root .env (one file for web/ and plugin/). Values
// already in process.env (shell, web/.env*, Vercel settings) always win.
const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // PGlite ships WASM + data files resolved relative to its own module URL.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Migrations are read from disk at runtime (auto-migrate on first DB use).
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
};

export default nextConfig;
