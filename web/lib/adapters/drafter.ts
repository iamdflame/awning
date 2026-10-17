import { z } from "zod";
import { env } from "../env";
import { log, errorMessage } from "../log";
import { CATEGORY_LABELS, categoryByLabel } from "../plan/catalog";
import { detectPricedOffers, templateDraft } from "../plan/template";
import { ProviderError, excerpt, http, obj } from "./http";
import type { BusinessDraft, DraftInput, Drafter } from "./types";

const KINDS = ["product", "service", "booking", "digital", "subscription"] as const;
const HEX = /^#[0-9a-fA-F]{6}$/;

const draftSchema = z.object({
  name: z.string().min(2).max(60),
  tagline: z.string().min(2).max(140),
  description: z.string().min(10).max(900),
  category: z.string().min(2).max(60),
  city: z.string().max(80).nullable().optional(),
  palette: z.object({ primary: z.string(), accent: z.string(), ink: z.string(), paper: z.string() }),
  offers: z
    .array(
      z.object({
        title: z.string().min(2).max(80),
        description: z.string().max(300).default(""),
        priceUsd: z.number().positive().max(10000),
        kind: z.enum(KINDS),
      }),
    )
    .min(1)
    .max(8),
});

const SYSTEM = `You draft storefronts for real small businesses from one sentence written by the owner.
Rules:
- Use only facts the owner gave. Never invent awards, reviews, years in business, certifications, addresses or claims you cannot know.
- name: the business name the owner gave; if none, a short, plausible, original name (2-3 words).
- tagline: under 70 characters, plain and specific.
- description: 2-4 short sentences in plain language describing what the business sells and how buying works.
- offers: 3-5 things a customer can buy today. Keep every price the owner stated exactly. Other prices must be realistic local prices in USD (whole dollars or .50). kind is one of product, service, booking, digital, subscription.
- city: only if the owner mentioned a place, else null.
- category: one of the provided categories.
- palette: four hex colours (primary, accent, ink, paper) that suit the business; ink on paper must be easy to read (dark ink, light paper).`;

const TOOL = {
  name: "draft_business",
  description: "Return the storefront draft for this business.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["name", "tagline", "description", "category", "city", "palette", "offers"],
    properties: {
      name: { type: "string" },
      tagline: { type: "string" },
      description: { type: "string" },
      category: { type: "string", enum: CATEGORY_LABELS },
      city: { type: ["string", "null"] },
      palette: {
        type: "object",
        additionalProperties: false,
        required: ["primary", "accent", "ink", "paper"],
        properties: {
          primary: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
          accent: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
          ink: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
          paper: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
        },
      },
      offers: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "description", "priceUsd", "kind"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            priceUsd: { type: "number" },
            kind: { type: "string", enum: KINDS },
          },
        },
      },
    },
  },
};

/** Anthropic Messages API with a forced tool call → strict JSON. */
export class AnthropicDrafter implements Drafter {
  readonly name = "anthropic";
  readonly mock = false;
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async draft(input: DraftInput, signal?: AbortSignal): Promise<BusinessDraft> {
    const user = [
      `Owner's sentence: ${JSON.stringify(input.sentence)}`,
      input.ownerName ? `Owner's name: ${JSON.stringify(input.ownerName)}` : null,
      input.country ? `Country: ${input.country}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const res = await http("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: "user", content: user }],
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
      }),
      signal,
      timeoutMs: 15000,
    });
    if (!res.ok) throw new ProviderError("anthropic", `messages failed (${res.status}): ${excerpt(res.text)}`, res.status);
    const content = obj(res.json).content;
    const block = Array.isArray(content) ? content.map(obj).find((b) => b.type === "tool_use" && b.name === TOOL.name) : undefined;
    if (!block) throw new ProviderError("anthropic", "no tool_use block in response");
    const parsed = draftSchema.safeParse(block.input);
    if (!parsed.success) throw new ProviderError("anthropic", `draft failed validation: ${parsed.error.issues[0]?.message ?? "invalid"}`);
    return { ...parsed.data, city: parsed.data.city ?? null, offers: parsed.data.offers.map((o) => ({ ...o, description: o.description ?? "" })) };
  }
}

export class TemplateDrafter implements Drafter {
  readonly name = "template";
  readonly mock = true;
  async draft(input: DraftInput): Promise<BusinessDraft> {
    return templateDraft(input);
  }
}

// ---------------------------------------------------------------------------
// Post-processing shared by both drafters: the LLM proposes, these rules decide.

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t;
}

function cleanPrice(p: number): number {
  const v = Math.round(p * 100) / 100;
  return Math.min(10000, Math.max(1, v));
}

/** Enforces the contract on any draft: lengths, 3–5 offers, sane prices, readable palette, owner-stated prices kept. */
export function finalizeDraft(raw: BusinessDraft, input: DraftInput): BusinessDraft {
  const fallback = templateDraft(input);
  const cat = categoryByLabel(raw.category);
  const paletteOk =
    [raw.palette.primary, raw.palette.accent, raw.palette.ink, raw.palette.paper].every((c) => HEX.test(c)) &&
    contrast(raw.palette.ink, raw.palette.paper) >= 7 &&
    contrast(raw.palette.paper, raw.palette.primary) >= 3;
  const palette = paletteOk
    ? { primary: raw.palette.primary.toUpperCase(), accent: raw.palette.accent.toUpperCase(), ink: raw.palette.ink.toUpperCase(), paper: raw.palette.paper.toUpperCase() }
    : fallback.palette;

  const seen = new Set<string>();
  let offers = raw.offers
    .map((o) => ({ title: clip(o.title, 60), description: clip(o.description || o.title, 200), priceUsd: cleanPrice(o.priceUsd), kind: o.kind }))
    .filter((o) => {
      const k = o.title.toLowerCase();
      if (!o.title || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  // Prices the owner stated are facts: make sure each one is on the menu.
  for (const stated of detectPricedOffers(input.sentence)) {
    if (!offers.some((o) => Math.abs(o.priceUsd - stated.priceUsd) < 0.005)) offers.unshift(stated);
  }
  for (const o of [...fallback.offers, ...cat.offers]) {
    if (offers.length >= 3) break;
    if (!offers.some((x) => x.title.toLowerCase() === o.title.toLowerCase())) offers.push({ ...o });
  }
  offers = offers.slice(0, 5);

  return {
    name: clip(raw.name, 40) || fallback.name,
    tagline: clip(raw.tagline, 90) || fallback.tagline,
    description: clip(raw.description, 600) || fallback.description,
    category: cat.label === "Local Business" && raw.category !== "Local Business" ? fallback.category : cat.label,
    city: raw.city ? clip(raw.city, 60) : null,
    palette,
    offers,
  };
}

/** Draft with the configured drafter; any failure falls back to the template. */
export async function draftBusiness(drafter: Drafter, input: DraftInput): Promise<{ draft: BusinessDraft; source: "llm" | "template" }> {
  if (!drafter.mock) {
    try {
      const raw = await drafter.draft(input);
      return { draft: finalizeDraft(raw, input), source: "llm" };
    } catch (err) {
      log.warn("LLM draft failed; using template", { error: errorMessage(err) });
    }
  }
  return { draft: finalizeDraft(templateDraft(input), input), source: "template" };
}

export function makeDrafter(): Drafter {
  const key = env.anthropicKey();
  if (key) return new AnthropicDrafter(key, env.anthropicModel());
  return new TemplateDrafter();
}
