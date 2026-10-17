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

function migrationsFolder(): string {
  return path.join(process.cwd(), "drizzle");
}

async function init(): Promise<Db> {
  const url = env.databaseUrl();
  if (url && env.dbMode() !== "memory") {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    const client = neon(url);
    const db = drizzle({ client, schema });
    if (env.autoMigrate()) {
      const { migrate } = await import("drizzle-orm/neon-http/migrator");
      await migrate(db, { migrationsFolder: migrationsFolder() });
    }
    holder.kind = "postgres";
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
