/**
 * Runtime configuration. Read lazily (every call) so tests and long-lived dev
 * servers always see the current process.env. Secrets are never logged.
 */

export const VERSION = "0.1.0";

function str(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export function isProduction(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.AWNING_ENV === "production";
}

/** When set, every adapter uses its mock implementation even if keys exist (tests, demos). */
export function forceMocks(): boolean {
  return str("AWNING_FORCE_MOCKS") === "1";
}

export const env = {
  apiUrl: () => (str("AWNING_API_URL") ?? "https://api.awning.sh").replace(/\/+$/, ""),
  rootDomain: () => (str("AWNING_ROOT_DOMAIN") ?? "awning.sh").toLowerCase(),
  treasuryAddress: () => str("AWNING_TREASURY_ADDRESS"),
  treasuryPrivateKey: () => str("AWNING_TREASURY_PRIVATE_KEY"),
  pluginKey: () => str("AWNING_PLUGIN_KEY"),
  ownerTokenSecret: () => str("AWNING_OWNER_TOKEN_SECRET"),
  databaseUrl: () => str("DATABASE_URL"),
  dbMode: () => str("AWNING_DB"), // "memory" → in-memory PGlite (tests)
  pgliteDir: () => str("AWNING_PGLITE_DIR"),
  autoMigrate: () => str("AWNING_AUTO_MIGRATE") !== "0",
  facilitatorUrl: () => str("AWNING_FACILITATOR_URL") ?? "https://facilitator.payai.network",
  baseRpcUrl: () => str("BASE_RPC_URL") ?? "https://mainnet.base.org",
  anthropicKey: () => str("ANTHROPIC_API_KEY"),
  anthropicModel: () => str("AWNING_LLM_MODEL") ?? "claude-sonnet-5-5",
  porkbunKey: () => str("PORKBUN_API_KEY"),
  porkbunSecret: () => str("PORKBUN_SECRET_KEY"),
  porkbunPayWith: () => (str("PORKBUN_PAY_WITH") === "usdc" ? "usdc" : "credit") as "usdc" | "credit",
  vercelToken: () => str("VERCEL_TOKEN"),
  vercelProjectId: () => str("VERCEL_PROJECT_ID"),
  vercelTeamId: () => str("VERCEL_TEAM_ID"),
  vercelTarget: () => str("AWNING_DNS_TARGET_A") ?? "76.76.21.21",
  vercelCname: () => str("AWNING_DNS_TARGET_CNAME") ?? "cname.vercel-dns.com",
  twilioSid: () => str("TWILIO_ACCOUNT_SID"),
  twilioToken: () => str("TWILIO_AUTH_TOKEN"),
  twilioFrom: () => str("TWILIO_FROM_NUMBER"),
  elevenLabsKey: () => str("ELEVENLABS_API_KEY"),
  elevenLabsVoiceId: () => str("ELEVENLABS_VOICE_ID"),
  planTtlSeconds: () => Number(str("AWNING_PLAN_TTL_SECONDS") ?? 1800),
  openDeadlineMs: () => Number(str("AWNING_OPEN_DEADLINE_MS") ?? 20000),
};

/** Public URL of a business: custom domain when it has one, else the free subdomain. */
export function businessUrl(b: { slug: string; domain?: string | null; package?: string | null; status?: string }): string {
  if (b.domain && b.package === "pro" && b.status === "live") return `https://${b.domain}`;
  return `https://${b.slug}.${env.rootDomain()}`;
}

export function subdomainUrl(slug: string): string {
  return `https://${slug}.${env.rootDomain()}`;
}
