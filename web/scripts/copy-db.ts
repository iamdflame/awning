// Copies every Awning table from one Postgres to another (e.g. Neon → Supabase), idempotently.
// Usage (from web/): SOURCE_DATABASE_URL=… TARGET_DATABASE_URL=… npx tsx scripts/copy-db.ts
// The target must be migrated first (scripts/migrate.mjs). Existing rows are kept (on conflict do nothing).
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../lib/db/schema";
import { businessImages } from "../lib/db/images";

const source = process.env.SOURCE_DATABASE_URL;
const target = process.env.TARGET_DATABASE_URL;
if (!source || !target) throw new Error("set SOURCE_DATABASE_URL and TARGET_DATABASE_URL");

const from = drizzleNeon({ client: neon(source) });
const client = postgres(target, { prepare: false, max: 1 });
const to = drizzlePg({ client });

const tables = [
  ["plans", schema.plans],
  ["businesses", schema.businesses],
  ["offers", schema.offers],
  ["orders", schema.orders],
  ["events", schema.events],
  ["payments", schema.payments],
  ["business_images", businessImages],
] as const;

for (const [name, table] of tables) {
  const rows = await from.select().from(table as never);
  let copied = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const res = await to.insert(table as never).values(chunk as never).onConflictDoNothing().returning();
    copied += (res as unknown[]).length;
  }
  const [{ n }] = (await to.execute(sql.raw(`select count(*)::int as n from ${name}`))) as unknown as { n: number }[];
  console.log(`${name.padEnd(16)} source ${String(rows.length).padStart(4)}  copied ${String(copied).padStart(4)}  target now ${n}`);
}
await client.end();
