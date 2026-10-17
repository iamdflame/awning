import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const atomic = (name: string) => bigint(name, { mode: "bigint" });

export type Palette = { primary: string; accent: string; ink: string; paper: string };
export type OfferKind = "product" | "service" | "booking" | "digital" | "subscription";

export type PlanStatus = "quoted" | "opening" | "opened";
export type BusinessStatus = "draft" | "live";
export type PackageId = "free" | "pro";

export type PlanDomain = {
  domain: string;
  available: boolean;
  /** Registrar first-year price, atomic USDC (string for JSON). */
  priceAtomic: string;
  /** Registrar price in integer cents (what the registrar's create call must match). */
  registrarCents: number;
  /** Pro opening total for this domain, atomic USDC. */
  totalAtomic: string;
  premium?: boolean;
};

export type PreparedPlan = {
  receptionist: { agentName: string; firstMessage: string; systemPrompt: string };
  dns: { type: "A" | "CNAME"; name: string; content: string }[];
  phone: { country: string; candidates: string[] };
  draftSource: "llm" | "template";
};

export type StepRecord = {
  name: string;
  status: "ok" | "failed" | "skipped" | "compensated" | "compensation_failed";
  ms: number;
  detail?: string;
};

export type Provisioning = {
  phoneSid?: string;
  phoneNumber?: string;
  phoneMock?: boolean;
  receptionistAgentId?: string;
  receptionistPhoneId?: string;
  hostingDomains?: string[];
  registrarOrderId?: string;
  dnsRecordIds?: string[];
  mocks?: string[];
};

export const plans = pgTable(
  "plans",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    sentence: text("sentence").notNull(),
    ownerWallet: text("owner_wallet").notNull(),
    ownerName: text("owner_name"),
    ownerEmail: text("owner_email"),
    ownerPhone: text("owner_phone"),
    country: text("country"),
    status: text("status").$type<PlanStatus>().notNull().default("quoted"),
    domains: jsonb("domains").$type<PlanDomain[]>().notNull(),
    recommendedDomain: text("recommended_domain"),
    prepared: jsonb("prepared").$type<PreparedPlan>().notNull(),
    openPackage: text("open_package").$type<PackageId>(),
    openPaymentKey: text("open_payment_key"),
    openDomain: text("open_domain"),
    openSteps: jsonb("open_steps").$type<StepRecord[]>(),
    lastError: text("last_error"),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("plans_business_idx").on(t.businessId)],
);

export const businesses = pgTable(
  "businesses",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    planId: text("plan_id").notNull(),
    name: text("name").notNull(),
    tagline: text("tagline").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    city: text("city"),
    palette: jsonb("palette").$type<Palette>().notNull(),
    ownerWallet: text("owner_wallet").notNull(),
    ownerName: text("owner_name"),
    ownerPhone: text("owner_phone"),
    status: text("status").$type<BusinessStatus>().notNull().default("draft"),
    package: text("package").$type<PackageId>(),
    domain: text("domain"),
    phone: text("phone"),
    receptionistName: text("receptionist_name"),
    ownerTokenVersion: integer("owner_token_version").notNull().default(1),
    provisioning: jsonb("provisioning").$type<Provisioning>().notNull().default(sql`'{}'::jsonb`),
    salesCount: integer("sales_count").notNull().default(0),
    openedAt: ts("opened_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("businesses_slug_uq").on(t.slug),
    uniqueIndex("businesses_domain_uq").on(t.domain),
    index("businesses_status_idx").on(t.status),
  ],
);

export const offers = pgTable(
  "offers",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    sku: text("sku").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    kind: text("kind").$type<OfferKind>().notNull(),
    priceAtomic: atomic("price_atomic").notNull(),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("offers_business_sku_uq").on(t.businessId, t.sku)],
);

export type OrderStatus = "pending" | "paid" | "failed" | "refunded";

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    offerId: text("offer_id").notNull(),
    slug: text("slug").notNull(),
    sku: text("sku").notNull(),
    qty: integer("qty").notNull(),
    unitAtomic: atomic("unit_atomic").notNull(),
    totalAtomic: atomic("total_atomic").notNull(),
    payer: text("payer").notNull(),
    payTo: text("pay_to").notNull(),
    network: text("network").notNull(),
    paymentKey: text("payment_key").notNull(),
    status: text("status").$type<OrderStatus>().notNull().default("pending"),
    tx: text("tx"),
    buyerNote: text("buyer_note"),
    buyerContact: text("buyer_contact"),
    fulfillment: jsonb("fulfillment").$type<Fulfillment>(),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
    paidAt: ts("paid_at"),
  },
  (t) => [
    uniqueIndex("orders_payment_key_uq").on(t.paymentKey),
    index("orders_business_idx").on(t.businessId, t.createdAt),
  ],
);

export type Fulfillment = { kind: OfferKind; message: string; code?: string; url?: string };

export type EventType = "opened" | "order" | "call";

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    type: text("type").$type<EventType>().notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    amountAtomic: atomic("amount_atomic"),
    tx: text("tx"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("events_at_idx").on(t.at)],
);

/**
 * One row per x402 payment we ever accepted for work (idempotency keys).
 * key = `<network>:<asset>:<payer>:<nonce>` (lowercase) — the identity of a
 * signed EIP-3009 authorization, which can be settled at most once on chain.
 */
export type PaymentStatus =
  | "working" // verified, work in progress, not settled
  | "settled" // work done, money moved
  | "unconfirmed" // work done; facilitator answer unclear and the chain could not be read — reconcile
  | "failed" // work or settlement failed, money did NOT move
  | "superseded" // a valid payment arrived for something already done; not settled
  | "refunded"; // money moved, then a failure was discovered and the payer was refunded

export const payments = pgTable(
  "payments",
  {
    key: text("key").primaryKey(),
    purpose: text("purpose").$type<"open" | "order">().notNull(),
    refId: text("ref_id").notNull(),
    status: text("status").$type<PaymentStatus>().notNull(),
    x402Version: integer("x402_version").notNull(),
    network: text("network").notNull(),
    asset: text("asset").notNull(),
    payer: text("payer").notNull(),
    payTo: text("pay_to").notNull(),
    amountAtomic: atomic("amount_atomic").notNull(),
    tx: text("tx"),
    refundTx: text("refund_tx"),
    error: text("error"),
    response: jsonb("response").$type<StoredResponse>(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("payments_ref_idx").on(t.refId)],
);

export type StoredResponse = { status: number; body: unknown; headers?: Record<string, string> };

export type PlanRow = typeof plans.$inferSelect;
export type BusinessRow = typeof businesses.$inferSelect;
export type OfferRow = typeof offers.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
