#!/usr/bin/env node
// Apply drizzle migrations to AWNING_DATABASE_URL or DATABASE_URL (Neon over HTTP, any other
// Postgres such as Supabase over postgres.js). Prefer a direct (non-pooled) URL for migrations:
//   MIGRATE_DATABASE_URL=postgres://… node scripts/migrate.mjs
// Local PGlite databases migrate themselves on first use.
import { existsSync } from "node:fs";
import path from "node:path";

const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const url = process.env.MIGRATE_DATABASE_URL || process.env.AWNING_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("No database URL set (local dev uses PGlite and migrates automatically).");
  process.exit(2);
}
const migrationsFolder = path.join(process.cwd(), "drizzle");
if (new URL(url).hostname.endsWith(".neon.tech")) {
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { migrate } = await import("drizzle-orm/neon-http/migrator");
  await migrate(drizzle({ client: neon(url) }), { migrationsFolder });
} else {
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const client = postgres(url, { prepare: false, max: 1 });
  await migrate(drizzle({ client }), { migrationsFolder });
  await client.end();
}
console.log("migrations applied");
