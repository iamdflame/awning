import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export type ImageRole = "hero" | "detail";

/**
 * Generated storefront photography (illustrative, never claimed as the owner's own).
 * The encoded WebP is stored as base64 text so every driver (PGlite, neon-http)
 * round-trips it identically. Served by `/img/:id` with immutable caching.
 */
export const businessImages = pgTable(
  "business_images",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    role: text("role").$type<ImageRole>().notNull(),
    prompt: text("prompt").notNull(),
    model: text("model").notNull(),
    mime: text("mime").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull(),
    dataB64: text("data_b64").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("business_images_business_role_uq").on(t.businessId, t.role), index("business_images_created_idx").on(t.createdAt)],
);

export type BusinessImageRow = typeof businessImages.$inferSelect;
