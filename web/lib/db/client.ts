import path from "node:path";
import { mkdirSync } from "node:fs";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { env } from "../env";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export { schema };

type Holder = { promise?: Promise<Db>; kind?: string; close?: () => Promise<void> };
const g = globalThis as unknown as { __awningDb?: Holder };
const holder: Holder = (g.__awningDb ??= {});

function host(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}
const isNeon = (url: string) => host(url).endsWith(".neon.tech");
const isSupabase = (url: string) => /.supabase.(co|com)$/.test(host(url));

/**
 * postgres.js forwards unknown query parameters to the server as settings. Marketplace URLs
 * carry hints such as `supa=base-pooler.x` or `pgbouncer=true`: keep only what Postgres knows.
 */
export function pgUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) {
      if (!["sslmode", "application_name", "options"].includes(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return url;
  }
}

function migrationsFolder(): string {
  return path.join(process.cwd(), "drizzle");
}

async function init(): Promise<Db> {
  const url = env.databaseUrl();
  if (url && env.dbMode() !== "memory") {
    if (isNeon(url)) {
      // Neon over HTTP: one request per query, nothing to pool in a serverless function.
      const { neon } = await import("@neondatabase/serverless");
      const { drizzle } = await import("drizzle-orm/neon-http");
      const db = drizzle({ client: neon(url), schema });
      if (env.autoMigrate()) {
        const { migrate } = await import("drizzle-orm/neon-http/migrator");
        await migrate(db, { migrationsFolder: migrationsFolder() });
      }
      holder.kind = "postgres (neon)";
      return db as unknown as Db;
    }
    // Any other Postgres (Supabase): postgres.js through the provider's transaction pooler.
    // prepare: false because transaction-mode poolers do not keep prepared statements.
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = postgres(pgUrl(url), { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10 });
    const db = drizzle({ client, schema });
    if (env.autoMigrate()) {
      const { migrate } = await import("drizzle-orm/postgres-js/migrator");
      await migrate(db, { migrationsFolder: migrationsFolder() });
    }
    holder.kind = isSupabase(url) ? "postgres (supabase)" : "postgres";
    holder.close = () => client.end({ timeout: 5 });
    return db as unknown as Db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  let client: InstanceType<typeof PGlite>;
  if (env.dbMode() === "memory") {
    client = new PGlite();
    holder.kind = "pglite-memory";
  } else {
    const dir = env.pgliteDir() ?? path.join(process.cwd(), ".data", "pglite");
    mkdirSync(dir, { recursive: true });
    client = new PGlite(dir);
    holder.kind = "pglite";
  }
  const db = drizzle({ client, schema });
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(db, { migrationsFolder: migrationsFolder() });
  holder.close = () => client.close();
  return db as unknown as Db;
}

/** Shared DB handle (one per process; survives Next dev HMR). */
export function db(): Promise<Db> {
  if (!holder.promise) {
    holder.promise = init().catch((err: unknown) => {
      holder.promise = undefined;
      throw err;
    });
  }
  return holder.promise;
}

export function dbKind(): string {
  return holder.kind ?? "uninitialised";
}

/** Tests: drop the handle so the next db() call gets a fresh in-memory database. */
export async function resetDbForTests(): Promise<void> {
  const close = holder.close;
  holder.promise = undefined;
  holder.close = undefined;
  if (close) await close().catch(() => undefined);
}
