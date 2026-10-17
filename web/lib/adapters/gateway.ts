import { getVercelOidcToken } from "@vercel/oidc";

/**
 * Vercel AI Gateway (OpenAI-compatible): business drafts when there is no
 * Anthropic key, and storefront photography. Auth is `AI_GATEWAY_API_KEY` when
 * set, else the Vercel OIDC token (per request on Vercel; `VERCEL_OIDC_TOKEN`
 * from `web/.env.local` locally). Tokens are never logged.
 */
export const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1";

function str(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const gatewayEnv = {
  llmModel: () => str("AWNING_GATEWAY_LLM_MODEL") ?? "google/gemini-2.5-flash",
  imageModel: () => str("AWNING_IMAGE_MODEL") ?? "bfl/flux-2-klein-4b",
  /** Generated images allowed per rolling hour across the whole deployment (each business uses two). */
  imageMaxPerHour: () => {
    const n = Number(str("AWNING_IMAGE_MAX_PER_HOUR") ?? 30);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 30;
  },
};

/** True when a gateway credential can exist: an API key, a local OIDC token, or a Vercel runtime (OIDC per request). */
export function gatewayConfigured(): boolean {
  return !!(str("AI_GATEWAY_API_KEY") || str("VERCEL_OIDC_TOKEN") || str("VERCEL_OIDC_TOKEN_FILE") || process.env.VERCEL === "1");
}

/** Bearer token for the gateway. Throws when no credential is available. */
export async function gatewayToken(): Promise<string> {
  const key = str("AI_GATEWAY_API_KEY");
  if (key) return key;
  return getVercelOidcToken();
}
