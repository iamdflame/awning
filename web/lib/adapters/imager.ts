import { gatewayConfigured, gatewayEnv, gatewayToken, GATEWAY_URL } from "./gateway";
import { ProviderError, excerpt, http, obj } from "./http";

/** One generated image, as the provider returned it (encoded later). */
export type GeneratedImage = { bytes: Buffer; model: string };

export interface Imager {
  readonly name: string;
  readonly mock: boolean;
  /**
   * Generates one 1024×768 image for `prompt`. The mock returns null (no image),
   * and the storefront falls back to its drawn poster art.
   */
  generate(prompt: string, signal?: AbortSignal): Promise<GeneratedImage | null>;
}

/** No images: storefronts show the design's SVG poster objects. */
export class MockImager implements Imager {
  readonly name = "none";
  readonly mock = true;
  async generate(): Promise<GeneratedImage | null> {
    return null;
  }
}

/** Pulls the base64 image out of an OpenAI-style images response (`data[0].b64_json`). */
export function parseImageResponse(body: unknown): Buffer {
  const data = obj(body).data;
  const first = Array.isArray(data) ? obj(data[0]) : {};
  const b64 = first.b64_json;
  if (typeof b64 !== "string" || b64.length < 100) throw new ProviderError("ai-gateway", "image response had no b64_json");
  const clean = b64.replace(/^data:image\/[a-z]+;base64,/, "");
  const bytes = Buffer.from(clean, "base64");
  if (bytes.length < 100) throw new ProviderError("ai-gateway", "image response was empty");
  return bytes;
}

/** Vercel AI Gateway image generation (`POST /v1/images/generations`). */
export class GatewayImager implements Imager {
  readonly name = "ai-gateway";
  readonly mock = false;
  constructor(
    private readonly model: string,
    private readonly token: () => Promise<string> = gatewayToken,
  ) {}

  async generate(prompt: string, signal?: AbortSignal): Promise<GeneratedImage> {
    const token = await this.token();
    const res = await http(`${GATEWAY_URL}/images/generations`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, prompt, n: 1, size: "1024x768" }),
      signal,
      timeoutMs: 60000,
    });
    if (!res.ok) throw new ProviderError("ai-gateway", `image generation failed (${res.status}): ${excerpt(res.text)}`, res.status);
    return { bytes: parseImageResponse(res.json), model: this.model };
  }
}

export function makeImager(): Imager {
  return gatewayConfigured() ? new GatewayImager(gatewayEnv.imageModel()) : new MockImager();
}
