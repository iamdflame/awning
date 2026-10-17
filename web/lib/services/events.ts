import { desc, eq, max } from "drizzle-orm";
import { db, schema } from "../db/client";
import type { EventType } from "../db/schema";
import { newId } from "../ids";
import { eventView } from "./views";

export async function emitEvent(e: { type: EventType; slug: string; name: string; amountAtomic?: bigint | null; tx?: string | null; data?: Record<string, unknown> }) {
  const d = await db();
  await d.insert(schema.events).values({
    id: newId("evt"),
    type: e.type,
    slug: e.slug,
    name: e.name,
    amountAtomic: e.amountAtomic ?? null,
    tx: e.tx ?? null,
    data: e.data ?? null,
  });
}

export async function recentEvents(limit = 50) {
  const d = await db();
  const rows = await d.select().from(schema.events).orderBy(desc(schema.events.at), desc(schema.events.id)).limit(Math.min(Math.max(limit, 1), 200));
  return rows.map(eventView);
}

export async function lastEventAt(type: EventType): Promise<string | null> {
  const d = await db();
  const [row] = await d.select({ at: max(schema.events.at) }).from(schema.events).where(eq(schema.events.type, type));
  const at = row?.at;
  return at ? new Date(at).toISOString() : null;
}
