#!/usr/bin/env node
// Apply drizzle migrations to DATABASE_URL (Neon/Postgres). Local PGlite
// databases migrate themselves on first use.
import { existsSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (local dev uses PGlite and migrates automatically).");
  process.exit(2);
}
const db = drizzle({ client: neon(url) });
await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
console.log("migrations applied");
