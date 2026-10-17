import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicDrafter, GatewayDrafter, TemplateDrafter, makeDrafter, parseGatewayDraft } from "@/lib/adapters/drafter";
import { ProviderError } from "@/lib/adapters/http";
import { createPlan, freshWorld } from "./helpers";

const DRAFT = {
  name: "Ridge Roast",
  tagline: "Small-batch coffee roasted above Accra",
  description: "Small-batch coffee from Accra, shipped by the bag. Book a tasting at the roastery.",
  category: "Coffee & Tea",
  city: "Accra",
  palette: { primary: "#6B1D14", accent: "#F4B335", ink: "#2A0D08", paper: "#FBE8CF" },
  offers: [
    { title: "Saturday tasting", description: "Three roasts, one hour.", priceUsd: 5, kind: "booking" },
    { title: "Volta Highlands, 250 g", description: "Washed, stone fruit.", priceUsd: 14, kind: "product" },
    { title: "The monthly box", description: "Two bags a month.", priceUsd: 30, kind: "subscription" },
  ],
};

const completion = (content: unknown) => ({ id: "chatcmpl-1", object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] });

const saved = { ...process.env };
afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ["ANTHROPIC_API_KEY", "AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN", "VERCEL", "AWNING_GATEWAY_LLM_MODEL"]) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("AI Gateway drafter: parsing", () => {
  it("parses strict JSON content into a validated draft", () => {
    const d = parseGatewayDraft(completion(JSON.stringify(DRAFT)));
    expect(d.name).toBe("Ridge Roast");
    expect(d.city).toBe("Accra");
    expect(d.offers.map((o) => o.priceUsd)).toEqual([5, 14, 30]);
  });

  it("treats an empty city as no city, and tolerates code fences and content parts", () => {
    expect(parseGatewayDraft(completion(JSON.stringify({ ...DRAFT, city: "" }))).city).toBeNull();
    expect(parseGatewayDraft(completion("```json\n" + JSON.stringify(DRAFT) + "\n```")).name).toBe("Ridge Roast");
    expect(parseGatewayDraft(completion([{ type: "text", text: JSON.stringify(DRAFT) }])).tagline).toBe(DRAFT.tagline);
  });

  it("rejects empty, non-JSON and invalid drafts (the plan then uses the template)", () => {
    expect(() => parseGatewayDraft(completion(""))).toThrow(ProviderError);
    expect(() => parseGatewayDraft({ choices: [] })).toThrow(ProviderError);
    expect(() => parseGatewayDraft(completion("Sure! Here is a coffee shop."))).toThrow(ProviderError);
    expect(() => parseGatewayDraft(completion(JSON.stringify({ ...DRAFT, offers: [] })))).toThrow(/validation/);
    expect(() => parseGatewayDraft(completion(JSON.stringify({ ...DRAFT, name: "" })))).toThrow(/validation/);
  });
});

describe("AI Gateway drafter: request", () => {
  it("posts the system prompt and a strict json_schema to the gateway with the bearer token, reasoning off", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(completion(JSON.stringify(DRAFT))), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const d = await new GatewayDrafter("google/gemini-2.5-flash", async () => "tok_test").draft({ sentence: "Ridge Roast, coffee from Accra" });
    expect(d.name).toBe("Ridge Roast");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ai-gateway.vercel.sh/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok_test");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("google/gemini-2.5-flash");
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("Use only facts the owner gave");
    expect(body.messages[1].content).toContain("Ridge Roast, coffee from Accra");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema.properties.category.enum).toContain("Coffee & Tea");
    expect(body.reasoning).toEqual({ effort: "none" });
  });

  it("surfaces gateway errors as provider errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "model not allowed" } }), { status: 403 })));
    await expect(new GatewayDrafter("anthropic/claude-sonnet-5-5", async () => "tok").draft({ sentence: "x" })).rejects.toThrow(/403/);
  });

  it("is chosen only when there is no Anthropic key and the gateway has credentials", () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.VERCEL;
    expect(makeDrafter()).toBeInstanceOf(TemplateDrafter);
    process.env.AI_GATEWAY_API_KEY = "gw_test";
    expect(makeDrafter()).toBeInstanceOf(GatewayDrafter);
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(makeDrafter()).toBeInstanceOf(AnthropicDrafter);
  });

  it("drives a real plan through the same validation and budget", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(completion(JSON.stringify({ ...DRAFT, name: "Ridge Roast" }))), { status: 200 })));
    await freshWorld({ drafter: new GatewayDrafter("google/gemini-2.5-flash", async () => "tok") });
    const p = await createPlan();
    expect(p.business.name).toBe("Ridge Roast");
    expect(p.business.tagline).toBe(DRAFT.tagline);
    expect(p.business.offers.map((o: { priceUsd: number }) => o.priceUsd)).toContain(5);
  });
});
