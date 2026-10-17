// Zod schemas. `up*` schemas read Awning API responses leniently (unknown keys are
// stripped, prices may be JSON numbers or strings); the strict output schemas below
// describe exactly what each tool returns to the agent.
import * as z from "zod/v4";

// ---------------------------------------------------------------- shared inputs

export const slug = z.string().min(1).max(63).regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "lowercase letters, digits and hyphens")
  .describe("The business slug, e.g. \"ridge-roast\", as returned by awning_find, awning_business or awning_plan.");
export const sku = z.string().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "letters, digits, dot, underscore or hyphen")
  .describe("The offer's sku exactly as returned by awning_business or awning_find.");
export const planId = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, "letters, digits, underscore or hyphen")
  .describe("The planId returned by awning_plan.");
export const ownerToken = z.string().min(8).max(512).regex(/^[\x21-\x7e]+$/, "printable characters without spaces")
  .describe("The owner token returned when this business opened (awning_open_free, or the paid awning_open response). Sent only to Awning in a request header; never echoed in output.");
export const decimalUsd = z.union([
  z.string().regex(/^(0|[1-9][0-9]{0,5})(\.[0-9]{1,6})?$/, "a decimal amount like \"19.00\""),
  z.number().nonnegative().max(999_999),
]);
export const offerKind = z.enum(["product", "service", "booking", "digital", "subscription"])
  .describe("product = shipped goods, service = work done for the buyer, booking = a time slot, digital = delivered as a code or link, subscription = recurring.");

// ---------------------------------------------------------------- upstream (lenient)

const money = z.union([z.number(), z.string()]);
const text = z.string();
const optionalText = z.string().nullish();

export const upOffer = z.object({
  sku: text, title: text, description: optionalText, priceUsd: money, kind: offerKind,
});
export const upPalette = z.object({ primary: text, accent: text, ink: text, paper: text });
export const upPlan = z.object({
  planId: text,
  expiresAt: text,
  previewUrl: text,
  business: z.object({
    slug: text, name: text, tagline: text, description: text, category: text,
    city: optionalText, palette: upPalette.nullish(), status: optionalText, offers: z.array(upOffer),
  }),
  domains: z.array(z.object({ domain: text, available: z.boolean(), priceUsd: money, totalUsd: money.nullish() })),
  packages: z.array(z.object({ id: text, label: text, includes: z.array(text), priceUsd: money })),
});
export const upOpenFree = z.object({
  business: z.object({ slug: text, name: optionalText, url: text, status: optionalText }),
  ownerToken: text,
});
export const upBusiness = z.object({
  slug: text, name: text, tagline: optionalText, description: optionalText, category: optionalText, city: optionalText,
  url: text, phone: optionalText, domain: optionalText, status: optionalText,
  openedAt: optionalText, salesCount: z.number().int().nonnegative().nullish(), offers: z.array(upOffer),
});
export const upBusinesses = z.object({ businesses: z.array(upBusiness) });
export const upOneBusiness = z.union([z.object({ business: upBusiness }), upBusiness]);
export const upOffers = z.object({
  offers: z.array(upOffer).optional(),
  business: z.object({ offers: z.array(upOffer) }).optional(),
  offer: upOffer.optional(),
});
export const upOrders = z.object({
  orders: z.array(z.object({
    id: z.union([z.string(), z.number()]), sku: text, qty: z.number().int().positive().nullish(),
    totalUsd: money, status: text, createdAt: optionalText, at: optionalText,
    tx: optionalText, payer: optionalText, buyerNote: optionalText, buyerContact: optionalText,
  })),
});

// ---------------------------------------------------------------- outputs (strict)

const usd = z.string().describe("Decimal USDC amount, e.g. \"19.00\". 1 USDC = 1 USD.");
const atomicUsdc = z.string().regex(/^[0-9]+$/).describe("The same amount in atomic USDC units (6 decimals): \"19000000\" = 19.00 USDC.");

export const offerOut = z.strictObject({
  sku: z.string().describe("Pass this to awning_buy."),
  title: z.string(),
  description: z.string().nullable(),
  priceUsd: usd,
  priceAtomicUsdc: atomicUsdc,
  kind: offerKind,
});

export const businessOut = z.strictObject({
  slug: z.string(),
  name: z.string(),
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  city: z.string().nullable(),
  url: z.string().describe("The live storefront."),
  phone: z.string().nullable().describe("Phone line answered by the business's AI receptionist, when it has one."),
  domain: z.string().nullable(),
  status: z.string().nullable(),
  openedAt: z.string().nullable(),
  salesCount: z.number().int().nonnegative().nullable(),
  offers: z.array(offerOut),
});

export const aboutOutput = z.strictObject({
  name: z.literal("Awning"),
  version: z.string(),
  summary: z.string(),
  apiHost: z.string(),
  payments: z.strictObject({ chain: z.literal("eip155:8453"), asset: z.string(), symbol: z.literal("USDC") }),
  tools: z.array(z.strictObject({ name: z.string(), use: z.string(), cost: z.string() })),
  flows: z.strictObject({ open: z.array(z.string()), buy: z.array(z.string()), manage: z.array(z.string()) }),
});

export const planOutput = z.strictObject({
  planId: z.string(),
  expiresAt: z.string().describe("After this time the plan and its prices are void; call awning_plan again."),
  previewUrl: z.string().describe("Draft storefront preview to show the user. Not listed and not buyable until opened."),
  business: z.strictObject({
    slug: z.string(),
    name: z.string(),
    tagline: z.string(),
    description: z.string(),
    category: z.string(),
    city: z.string().nullable(),
    palette: z.strictObject({ primary: z.string(), accent: z.string(), ink: z.string(), paper: z.string() }).nullable(),
    offers: z.array(offerOut),
  }),
  domains: z.array(z.strictObject({
    domain: z.string(),
    available: z.boolean(),
    domainPriceUsd: usd.describe("Registrar price of the domain alone."),
    openPriceUsd: usd.nullable().describe("Total USDC to open on this domain with awning_open (Pro package included). Pass exactly this as priceUsd. Null when the domain is unavailable."),
  })),
  packages: z.array(z.strictObject({ id: z.string(), label: z.string(), includes: z.array(z.string()), priceUsd: usd })),
});

export const openFreeOutput = z.strictObject({
  business: z.strictObject({ slug: z.string(), name: z.string().nullable(), url: z.string(), status: z.string() }),
  ownerToken: z.string().describe("Secret that proves ownership. The user must keep it; awning_add_offer and awning_orders require it."),
});

export const findOutput = z.strictObject({
  count: z.number().int().nonnegative(),
  businesses: z.array(businessOut),
});

export const businessOutput = z.strictObject({ business: businessOut });

export const addOfferOutput = z.strictObject({
  slug: z.string(),
  added: offerOut.nullable().describe("The new offer, when Awning returned it."),
  offers: z.array(offerOut).describe("All offers now on the storefront."),
});

export const ordersOutput = z.strictObject({
  slug: z.string(),
  count: z.number().int().nonnegative(),
  totalUsd: usd.describe("Sum of the listed orders."),
  orders: z.array(z.strictObject({
    id: z.string(),
    sku: z.string(),
    qty: z.number().int().positive(),
    totalUsd: usd,
    status: z.string(),
    createdAt: z.string().nullable(),
    tx: z.string().nullable().describe("Base transaction hash of the payment, when settled."),
    payer: z.string().nullable(),
    buyerNote: z.string().nullable(),
    buyerContact: z.string().nullable(),
  })),
});
