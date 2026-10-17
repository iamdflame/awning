import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

import { x402OutputSchema } from "./paybox.js";
import {
  AwningError, CHAIN, PLAN_TIMEOUT_MS, USDC_BASE, apiBase, apiRequest, buyBody, buyPath, expectOk, fetchQuote, formatUsdc,
  openBody, openPath, parseApi, proposalExpiry, proposeBuy, proposeOpen, totalAtomic, usdToAtomic,
} from "./awning.js";
import {
  aboutOutput, addOfferOutput, businessOutput, decimalUsd, findOutput, offerKind, offerOut, openFreeOutput,
  ordersOutput, ownerToken, planId, planOutput, sku, slug, upBusiness, upBusinesses, upOffer, upOffers,
  upOneBusiness, upOpenFree, upOrders, upPlan,
} from "./schemas.js";

const PROTOCOL_VERSION = "2026-07-28";
const VERSION = "1.0.0";

type Text = { type: "text"; text: string };
type Result = { content: Text[]; structuredContent?: Record<string, unknown>; isError?: boolean };

const text = (value: string): Text[] => [{ type: "text", text: value }];

/** Runs a tool body; known failures become short, actionable `isError` results and nothing internal leaks. */
async function guard(run: () => Promise<Result>): Promise<Result> {
  try {
    return await run();
  } catch (error) {
    const message = error instanceof AwningError
      ? error.message
      : "The Awning plugin hit an unexpected error. Nothing was paid or changed; try again, and report it if it repeats.";
    return { isError: true, content: text(message) };
  }
}

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

// ---------------------------------------------------------------- mapping helpers

type UpOffer = z.infer<typeof upOffer>;
type UpBusiness = z.infer<typeof upBusiness>;

function offer(o: UpOffer): z.infer<typeof offerOut> {
  const atomic = usdToAtomic(o.priceUsd);
  return { sku: o.sku, title: o.title, description: o.description ?? null, priceUsd: formatUsdc(atomic), priceAtomicUsdc: atomic, kind: o.kind };
}

function business(b: UpBusiness) {
  return {
    slug: b.slug, name: b.name, tagline: b.tagline ?? null, description: b.description ?? null,
    category: b.category ?? null, city: b.city ?? null, url: b.url, phone: b.phone ?? null,
    domain: b.domain ?? null, status: b.status ?? null, openedAt: b.openedAt ?? null,
    salesCount: b.salesCount ?? null, offers: b.offers.map(offer),
  };
}

function offerLine(o: z.infer<typeof offerOut>): string {
  return `  - ${o.title}: ${o.priceUsd} USDC (${o.kind}, sku ${o.sku})`;
}

/** Total to open a plan on `domain` with the Pro package: the domain's own total if Awning gives one, else Pro + domain. */
function openPriceAtomic(plan: z.infer<typeof upPlan>, domain: string): string | null {
  const entry = plan.domains.find((d) => d.domain.toLowerCase() === domain.toLowerCase());
  const pro = plan.packages.find((p) => p.id === "pro");
  if (!entry || !entry.available) return null;
  if (entry.totalUsd !== undefined && entry.totalUsd !== null) return usdToAtomic(entry.totalUsd);
  if (!pro) return null;
  return (BigInt(usdToAtomic(pro.priceUsd)) + BigInt(usdToAtomic(entry.priceUsd))).toString();
}

// ---------------------------------------------------------------- server

function createServer() {
  const server = new McpServer(
    { name: "awning", version: VERSION },
    { supportedProtocolVersions: [PROTOCOL_VERSION] },
  );

  // ------------------------------------------------------------ awning_about
  server.registerTool("awning_about", {
    title: "About Awning",
    description: "Explains what Awning does and which Awning tool to use for each step. Call it when unsure how to start a business for the user or how to buy from an Awning business. Free, instant, no network access, no side effects.",
    inputSchema: z.object({}).strict(),
    outputSchema: aboutOutput,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => {
    const structured: z.infer<typeof aboutOutput> = {
      name: "Awning",
      version: VERSION,
      summary: "Awning turns one sentence into a real small business: a generated storefront, priced offers, optionally a custom domain and a phone line with an AI receptionist, and checkout that any AI agent can pay in USDC on Base, straight to the owner's wallet. It also lets agents find and buy from every Awning business.",
      apiHost: "api.awning.sh",
      payments: { chain: CHAIN, asset: USDC_BASE, symbol: "USDC" },
      tools: [
        { name: "awning_plan", use: "Draft a business from the user's sentence; returns a private preview, offers, domain options and prices.", cost: "Free" },
        { name: "awning_open_free", use: "Open a planned business on its free awning.sh subdomain.", cost: "Free" },
        { name: "awning_open", use: "Open a planned business with a custom domain, phone line and AI receptionist.", cost: "Paid: openPriceUsd from the plan, as an x402 proposal the user approves in PayBox" },
        { name: "awning_find", use: "Search live Awning businesses and offers.", cost: "Free" },
        { name: "awning_business", use: "Read one business and its exact offer prices.", cost: "Free" },
        { name: "awning_buy", use: "Buy an offer (price x quantity), paid directly to the owner's wallet.", cost: "Paid: an x402 proposal the user approves in PayBox" },
        { name: "awning_add_offer", use: "Add an offer to a business the user owns (needs ownerToken).", cost: "Free" },
        { name: "awning_orders", use: "List orders of a business the user owns (needs ownerToken).", cost: "Free" },
      ],
      flows: {
        open: [
          "awning_plan with the user's sentence and their Base wallet address",
          "show the preview link, offers and the domain prices; ask how to open",
          "awning_open_free, or awning_open with the chosen domain and its exact openPriceUsd",
          "for awning_open: the user approves the USDC payment in PayBox; poll the PayBox request for the live URL, phone and ownerToken",
        ],
        buy: [
          "awning_find with what the user wants",
          "awning_business to confirm the offer, price and quantity with the user",
          "awning_buy; the user approves in PayBox; poll the PayBox request for the order and fulfillment",
        ],
        manage: ["awning_add_offer to sell something new", "awning_orders to see sales"],
      },
    };
    return {
      content: text([
        "Awning: one sentence becomes a real business that AI agents can buy from (USDC on Base, paid to the owner's wallet).",
        "Start a business: awning_plan, then awning_open_free (free subdomain) or awning_open (paid: custom domain, phone line, AI receptionist).",
        "Buy: awning_find, awning_business, then awning_buy (the user approves the payment in PayBox).",
        "Owners: awning_add_offer and awning_orders with the ownerToken from opening.",
      ].join("\n")),
      structuredContent: structured,
    };
  });

  // ------------------------------------------------------------ awning_plan
  server.registerTool("awning_plan", {
    title: "Plan a business from one sentence",
    description: "Drafts a business from one sentence the user wrote (e.g. \"small-batch coffee roaster in Accra selling bags and tasting sessions\"). Awning names it, writes the copy, prices 3-5 offers, checks real domain availability and prices, and serves a private draft preview at previewUrl. Free: no money moves, nothing is registered, and the draft is neither listed nor buyable. Show the user the name, offers and preview link, then ask how to open: awning_open_free (free awning.sh subdomain) or awning_open (custom domain, phone line and AI receptionist, paid in USDC at the openPriceUsd shown for the chosen domain). Each call creates a new draft; the plan expires at expiresAt.",
    inputSchema: z.object({
      sentence: z.string().trim().min(8).max(600).describe("The user's own description of the business, in one or two sentences: what it sells, to whom, and where."),
      ownerWallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "a 0x-prefixed 20-byte EVM address")
        .describe("The user's Base (EVM) wallet address that will receive every sale, e.g. their PayBox wallet's public address. Never a private key."),
      ownerName: z.string().trim().min(1).max(100).optional().describe("Owner's name for the storefront's About section."),
      ownerEmail: z.email().max(254).optional().describe("Where Awning sends order notifications. Optional."),
      country: z.string().trim().min(2).max(56).optional().describe("Country where the business operates, e.g. \"GH\" or \"Ghana\". Helps pick domains and phone numbers."),
    }).strict(),
    outputSchema: planOutput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (input) => guard(async () => {
    const plan = parseApi(upPlan, expectOk(await apiRequest("/v1/plan", { method: "POST", body: input, timeoutMs: PLAN_TIMEOUT_MS })));
    const structured: z.infer<typeof planOutput> = {
      planId: plan.planId,
      expiresAt: plan.expiresAt,
      previewUrl: plan.previewUrl,
      business: {
        slug: plan.business.slug, name: plan.business.name, tagline: plan.business.tagline,
        description: plan.business.description, category: plan.business.category, city: plan.business.city ?? null,
        palette: plan.business.palette ?? null, offers: plan.business.offers.map(offer),
      },
      domains: plan.domains.map((d) => {
        const total = openPriceAtomic(plan, d.domain);
        return { domain: d.domain, available: d.available, domainPriceUsd: formatUsdc(usdToAtomic(d.priceUsd)), openPriceUsd: total === null ? null : formatUsdc(total) };
      }),
      packages: plan.packages.map((p) => ({ id: p.id, label: p.label, includes: p.includes, priceUsd: formatUsdc(usdToAtomic(p.priceUsd)) })),
    };
    const available = structured.domains.filter((d) => d.openPriceUsd !== null);
    return {
      content: text([
        `Drafted "${structured.business.name}": ${structured.business.tagline}`,
        `Preview (draft, not live): ${structured.previewUrl}`,
        "Offers:",
        ...structured.business.offers.map(offerLine),
        available.length
          ? `Open with a custom domain, phone line and AI receptionist (awning_open, planId ${structured.planId}):\n${available.map((d) => `  - ${d.domain}: ${d.openPriceUsd} USDC`).join("\n")}`
          : "No custom domain is available for this plan; awning_open_free still works.",
        `Or open free on the subdomain with awning_open_free (planId ${structured.planId}).`,
        `Ask the user which option they want before opening. Plan expires at ${structured.expiresAt}.`,
      ].join("\n")),
      structuredContent: structured,
    };
  }));

  // ------------------------------------------------------------ awning_open_free
  server.registerTool("awning_open_free", {
    title: "Open a planned business for free",
    description: "Opens a planned business on its free awning.sh subdomain: the storefront goes live, is listed in the Awning directory, and any agent can buy from it with USDC paid straight to the owner's wallet. No custom domain or phone line. Free; call only after the user agreed to open. Returns the live URL and an ownerToken: hand the token to the user to keep, because awning_add_offer and awning_orders require it.",
    inputSchema: z.object({ planId }).strict(),
    outputSchema: openFreeOutput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async ({ planId: id }) => guard(async () => {
    const opened = parseApi(upOpenFree, expectOk(await apiRequest("/v1/open-free", { method: "POST", body: { planId: id } }), {
      notFound: "No Awning plan with that planId. Call awning_plan first.",
    }));
    const structured: z.infer<typeof openFreeOutput> = {
      business: { slug: opened.business.slug, name: opened.business.name ?? null, url: opened.business.url, status: opened.business.status ?? "live" },
      ownerToken: opened.ownerToken,
    };
    return {
      content: text([
        `${structured.business.name ?? structured.business.slug} is live at ${structured.business.url} and listed in the Awning directory.`,
        `Owner token: ${structured.ownerToken}`,
        "Give this token to the user and tell them to keep it private: it is needed for awning_add_offer and awning_orders.",
      ].join("\n")),
      structuredContent: structured,
    };
  }));

  // ------------------------------------------------------------ awning_open
  server.registerTool("awning_open", {
    title: "Open a business with a custom domain (paid)",
    description: "Prepares the paid opening of a planned business: custom domain registered and connected, a phone line, and an AI receptionist that answers it. Pass the planId, the domain the user chose and the exact openPriceUsd awning_plan showed for it; the tool re-reads the plan and Awning's live quote and refuses on any mismatch. It does not pay: it returns a PayBox x402 payment proposal (USDC on Base, maximum = the quoted price) for the user to approve in PayBox. After approval PayBox sends the paid request; the response (live URL, phone number, ownerToken, receipt) arrives through the PayBox request, so poll that request and do not call awning_open again. If provisioning fails after payment, Awning refunds the USDC and the response says refunded: true.",
    inputSchema: z.object({
      planId,
      domain: z.string().trim().toLowerCase().min(3).max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "a domain from the plan, e.g. ridgeroast.co")
        .describe("The domain the user chose, exactly as listed in the plan's domains with available: true."),
      priceUsd: decimalUsd.describe("The openPriceUsd awning_plan showed for this domain and the user agreed to, e.g. \"20.98\". The payment proposal uses exactly this amount after it is checked against Awning's quote."),
    }).strict(),
    outputSchema: x402OutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async ({ planId: id, domain, priceUsd }) => guard(async () => {
    const [planResponse, quote] = await Promise.all([
      apiRequest(`/v1/plans/${encodeURIComponent(id)}`),
      fetchQuote(openPath(id), openBody(domain)),
    ]);
    const plan = parseApi(upPlan, expectOk(planResponse, { notFound: "No Awning plan with that planId. Call awning_plan first." }));
    if (plan.business.status && plan.business.status !== "draft") {
      throw new AwningError(`${plan.business.name} is already ${plan.business.status}. Use awning_business with slug "${plan.business.slug}" to see it; do not pay again.`);
    }
    const listed = plan.domains.find((d) => d.domain.toLowerCase() === domain);
    if (!listed) {
      const options = plan.domains.filter((d) => d.available).map((d) => d.domain).join(", ") || "none";
      throw new AwningError(`${domain} is not one of this plan's domains. Available: ${options}.`);
    }
    if (!listed.available) throw new AwningError(`${domain} is no longer available. Pick another domain from awning_plan, or use awning_open_free.`);
    const planned = openPriceAtomic(plan, domain);
    if (planned === null) throw new AwningError("This plan has no Pro package. Use awning_open_free instead.");
    if (quote.state === "incompatible") {
      throw new AwningError("Awning's payment endpoint did not offer USDC on Base for this plan, so no proposal was made. Try again later.");
    }
    const quoted = quote.state === "verified" ? quote.amount : planned;
    const requested = usdToAtomic(priceUsd);
    if (requested !== quoted) {
      throw new AwningError(`Price check failed: you passed ${formatUsdc(requested)} USDC but Awning's current price to open on ${domain} is ${formatUsdc(quoted)} USDC. Confirm ${formatUsdc(quoted)} USDC with the user, then call awning_open again with priceUsd "${formatUsdc(quoted)}".`);
    }
    const expiresAt = proposalExpiry(plan.expiresAt);
    const proposal = proposeOpen({ planId: id, domain, maxAmount: quoted, expiresAt });
    return {
      ...proposal,
      content: text([
        `Payment proposal ready: ${formatUsdc(quoted)} USDC on Base to open ${plan.business.name} at ${domain} (custom domain, phone line, AI receptionist).`,
        `PayBox will ask the user to approve ${formatUsdc(quoted)} USDC. Nothing has been paid yet; the proposal expires at ${expiresAt}.`,
        `After approval PayBox sends POST ${apiBase()}${openPath(id)} with the payment. Poll the returned PayBox request until it is terminal; do not call awning_open again.`,
        "The paid response contains the live URL, phone number and ownerToken (the user must keep it for awning_add_offer and awning_orders). If it says refunded: true, provisioning failed and the USDC was returned (refundTx).",
        quote.state === "verified" ? "Amount checked against Awning's live x402 quote." : "Amount checked against the stored plan quote; PayBox will verify it against Awning's live 402 before payment.",
      ].join("\n")),
    };
  }));

  // ------------------------------------------------------------ awning_find
  server.registerTool("awning_find", {
    title: "Find Awning businesses",
    description: "Searches live Awning businesses and their offers (products, services, bookings, digital goods, subscriptions) that the user can buy with USDC through PayBox. Use it when the user wants to buy something, e.g. \"coffee tasting in Accra\", or to browse what is open. Free and read-only. Follow with awning_business for full details or awning_buy to purchase.",
    inputSchema: z.object({
      query: z.string().trim().max(120).optional().describe("What the user is looking for: product, service, business name or city. Omit to list recently opened businesses."),
      category: z.string().trim().min(1).max(40).optional().describe("Optional category filter, e.g. \"food\" or \"design\"."),
      limit: z.number().int().min(1).max(25).default(10).describe("Maximum businesses to return (1-25, default 10)."),
    }).strict(),
    outputSchema: findOutput,
    annotations: readOnly,
  }, async ({ query, category, limit }) => guard(async () => {
    const found = parseApi(upBusinesses, expectOk(await apiRequest("/v1/businesses", { query: { q: query, category, limit } })));
    const businesses = found.businesses.slice(0, limit).map(business);
    const lines = businesses.map((b) => [
      `${b.name} (slug ${b.slug})${b.city ? `, ${b.city}` : ""}: ${b.tagline ?? ""} ${b.url}`.trim(),
      ...b.offers.map(offerLine),
    ].join("\n"));
    return {
      content: text(businesses.length
        ? `${businesses.length} Awning business${businesses.length === 1 ? "" : "es"}:\n${lines.join("\n")}\nTo buy, confirm the item, quantity and total with the user, then call awning_buy with the slug and sku.`
        : "No Awning businesses matched. Try a broader query, or omit it to list recent businesses."),
      structuredContent: { count: businesses.length, businesses },
    };
  }));

  // ------------------------------------------------------------ awning_business
  server.registerTool("awning_business", {
    title: "Read an Awning business",
    description: "Reads one live Awning business by slug: description, location, phone line, and every offer with its exact USDC price and sku. Free and read-only. Use it to confirm what the user is buying before awning_buy.",
    inputSchema: z.object({ slug }).strict(),
    outputSchema: businessOutput,
    annotations: readOnly,
  }, async ({ slug: s }) => guard(async () => {
    const raw = parseApi(upOneBusiness, expectOk(await apiRequest(`/v1/businesses/${encodeURIComponent(s)}`), {
      notFound: `No Awning business with slug "${s}". Use awning_find to search.`,
    }));
    const b = business("business" in raw ? raw.business : raw);
    return {
      content: text([
        `${b.name}${b.city ? ` (${b.city})` : ""}: ${b.tagline ?? ""}`.trim(),
        b.description ?? "",
        `Storefront: ${b.url}${b.phone ? ` · Phone (AI receptionist): ${b.phone}` : ""}`,
        "Offers:",
        ...b.offers.map(offerLine),
        `To buy, call awning_buy with slug "${b.slug}" and the sku.`,
      ].filter(Boolean).join("\n")),
      structuredContent: { business: b },
    };
  }));

  // ------------------------------------------------------------ awning_buy
  server.registerTool("awning_buy", {
    title: "Buy from an Awning business (paid)",
    description: "Prepares a purchase of one offer from an Awning business. The tool reads the offer's current price, computes the total (price x qty) and returns a PayBox x402 payment proposal for exactly that amount in USDC on Base; the payment goes directly to the business owner's wallet. It does not pay by itself: the user approves in PayBox, PayBox sends the paid request, and the order confirmation and fulfillment (message, code or link) arrive through the PayBox request. Poll that request; do not call awning_buy again to check on it, because a second approved proposal is a second order. Confirm the item, quantity and total with the user first.",
    inputSchema: z.object({
      slug,
      sku,
      qty: z.number().int().min(1).max(100).default(1).describe("How many units to buy (1-100, default 1)."),
      buyerNote: z.string().trim().min(1).max(500).optional().describe("Optional note for the owner, e.g. a preferred time for a booking or a shipping instruction. Shared with the business owner."),
      buyerContact: z.string().trim().min(3).max(200).optional().describe("Optional email or phone the owner can use to fulfil the order. Only include it if the user agreed to share it."),
    }).strict(),
    outputSchema: x402OutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async ({ slug: s, sku: item, qty, buyerNote, buyerContact }) => guard(async () => {
    const body = buyBody({ qty, buyerNote, buyerContact });
    const [businessResponse, quote] = await Promise.all([
      apiRequest(`/v1/businesses/${encodeURIComponent(s)}`),
      fetchQuote(buyPath(s, item), body),
    ]);
    const raw = parseApi(upOneBusiness, expectOk(businessResponse, { notFound: `No Awning business with slug "${s}". Use awning_find to search.` }));
    const b = business("business" in raw ? raw.business : raw);
    if (b.status && b.status !== "live") throw new AwningError(`${b.name} is not open for orders yet (status ${b.status}).`);
    const chosen = b.offers.find((o) => o.sku === item);
    if (!chosen) {
      throw new AwningError(`${b.name} has no offer with sku "${item}". Offers: ${b.offers.map((o) => `${o.sku} (${o.title})`).join(", ") || "none"}.`);
    }
    if (BigInt(chosen.priceAtomicUsdc) === 0n) throw new AwningError(`${chosen.title} is free; there is nothing to pay.`);
    const total = totalAtomic(chosen.priceAtomicUsdc, qty);
    if (quote.state === "incompatible") {
      throw new AwningError("This business's payment endpoint did not offer USDC on Base, so no proposal was made. Try again later.");
    }
    if (quote.state === "verified" && quote.amount !== total) {
      throw new AwningError(`The price changed: the storefront lists ${formatUsdc(total)} USDC for ${qty} x ${chosen.title} but Awning's checkout now asks ${formatUsdc(quote.amount)} USDC. Re-read the business with awning_business and confirm the new total with the user.`);
    }
    const expiresAt = proposalExpiry();
    const proposal = proposeBuy({ slug: s, sku: item, body, maxAmount: total, expiresAt });
    const payTo = quote.state === "verified" ? quote.payTo : null;
    return {
      ...proposal,
      content: text([
        `Payment proposal ready: ${formatUsdc(total)} USDC on Base for ${qty} x ${chosen.title} (${chosen.priceUsd} USDC each) from ${b.name}.`,
        `PayBox will ask the user to approve ${formatUsdc(total)} USDC${payTo ? `, paid directly to the owner's wallet ${payTo}` : ", paid directly to the owner's wallet"}. Nothing has been paid yet; the proposal expires at ${expiresAt}.`,
        `After approval PayBox sends POST ${apiBase()}${buyPath(s, item)} with the payment. Poll the returned PayBox request until it is terminal; do not call awning_buy again (that would be a second order).`,
        `The paid response contains the order id, receipt (Base transaction) and fulfillment for this ${chosen.kind}.`,
        quote.state === "verified" ? "Amount checked against the live x402 checkout quote." : "Amount computed from the listed price; PayBox will verify it against Awning's live 402 before payment.",
      ].filter(Boolean).join("\n")),
    };
  }));

  // ------------------------------------------------------------ awning_add_offer
  server.registerTool("awning_add_offer", {
    title: "Add an offer to your business",
    description: "Adds a new offer to a business the user owns. It appears on the storefront and in awning_find immediately, and any agent can buy it with awning_buy. Requires the ownerToken returned when the business opened. Free. Each call adds another offer, so do not repeat a successful call.",
    inputSchema: z.object({
      slug,
      ownerToken,
      title: z.string().trim().min(2).max(80).describe("Short offer name shown to buyers, e.g. \"Monthly coffee subscription box\"."),
      description: z.string().trim().min(2).max(500).describe("One or two sentences: what the buyer gets and how it is delivered."),
      priceUsd: decimalUsd.describe("Price per unit in USDC, e.g. \"30.00\" (at most 6 decimals, above 0)."),
      kind: offerKind,
    }).strict(),
    outputSchema: addOfferOutput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async ({ slug: s, ownerToken: token, title, description, priceUsd, kind }) => guard(async () => {
    const atomic = usdToAtomic(priceUsd);
    if (BigInt(atomic) === 0n) throw new AwningError("Price must be above 0 USDC.");
    const response = await apiRequest(`/v1/businesses/${encodeURIComponent(s)}/offers`, {
      method: "POST",
      ownerToken: token,
      body: { title, description, priceUsd: Number(formatUsdc(atomic)), kind },
    });
    const updated = parseApi(upOffers, expectOk(response, { ownerAuth: true, notFound: `No Awning business with slug "${s}".` }));
    const offers = (updated.offers ?? updated.business?.offers ?? (updated.offer ? [updated.offer] : [])).map(offer);
    const added = updated.offer ? offer(updated.offer) : offers.find((o) => o.title === title && o.priceAtomicUsdc === atomic) ?? null;
    return {
      content: text([
        `Added "${title}" at ${formatUsdc(atomic)} USDC to ${s}. It is live on the storefront and buyable with awning_buy${added ? ` (sku ${added.sku})` : ""}.`,
        offers.length ? `Offers now:\n${offers.map(offerLine).join("\n")}` : "",
      ].filter(Boolean).join("\n")),
      structuredContent: { slug: s, added, offers },
    };
  }));

  // ------------------------------------------------------------ awning_orders
  server.registerTool("awning_orders", {
    title: "List your business's orders",
    description: "Lists orders for a business the user owns: item, quantity, total in USDC, status, buyer note and the Base payment transaction. Requires the ownerToken returned when the business opened. Free and read-only.",
    inputSchema: z.object({ slug, ownerToken }).strict(),
    outputSchema: ordersOutput,
    annotations: readOnly,
  }, async ({ slug: s, ownerToken: token }) => guard(async () => {
    const response = await apiRequest("/v1/orders", { query: { slug: s }, ownerToken: token });
    const data = parseApi(upOrders, expectOk(response, { ownerAuth: true, notFound: `No Awning business with slug "${s}".` }));
    let sum = 0n;
    const orders = data.orders.map((o) => {
      const atomic = usdToAtomic(o.totalUsd);
      sum += BigInt(atomic);
      return {
        id: String(o.id), sku: o.sku, qty: o.qty ?? 1, totalUsd: formatUsdc(atomic), status: o.status,
        createdAt: o.createdAt ?? o.at ?? null, tx: o.tx ?? null, payer: o.payer ?? null,
        buyerNote: o.buyerNote ?? null, buyerContact: o.buyerContact ?? null,
      };
    });
    const totalUsd = formatUsdc(sum);
    return {
      content: text(orders.length
        ? `${orders.length} order${orders.length === 1 ? "" : "s"} for ${s}, ${totalUsd} USDC in total:\n${orders.slice(0, 50).map((o) => `  - ${o.createdAt ?? ""} ${o.qty} x ${o.sku}: ${o.totalUsd} USDC, ${o.status}${o.tx ? `, tx ${o.tx}` : ""}${o.buyerNote ? `, note: ${o.buyerNote}` : ""}`.replace("-  ", "- ")).join("\n")}`
        : `No orders yet for ${s}. Share the storefront link: any agent with PayBox can buy with awning_buy.`),
      structuredContent: { slug: s, count: orders.length, totalUsd, orders },
    };
  }));

  return server;
}

serveStdio(createServer, { legacy: "reject" });
