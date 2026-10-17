/**
 * The company documents served on awning.sh. Sources live in the repo's docs/ and
 * SECURITY.md; scripts/sync-content.mjs copies them into web/content/ (Vercel builds
 * only web/). Order here is the reading order on /docs.
 */
export type DocGroup = "builders" | "business";

export type Doc = {
  /** Route segment for /docs/[slug]; policies have their own top-level route. */
  slug: string;
  /** Repo-relative source path (also the path under web/content/). */
  source: string;
  route: string;
  title: string;
  /** One line for the /docs index and the page description. */
  blurb: string;
  group: DocGroup;
};

export const DOCS: Doc[] = [
  {
    slug: "spec",
    source: "docs/SPEC.md",
    route: "/docs/spec",
    title: "Product specification",
    blurb: "What Awning does and for whom: the journeys, the states, prices, limits, and what is live versus mocked.",
    group: "builders",
  },
  {
    slug: "architecture",
    source: "docs/ARCHITECTURE.md",
    route: "/docs/architecture",
    title: "Architecture",
    blurb: "How the plugin, the API, the x402 seller, the opening orchestrator and the reconciler fit together.",
    group: "builders",
  },
  {
    slug: "api",
    source: "docs/API.md",
    route: "/docs/api",
    title: "API reference",
    blurb: "Every endpoint with its request and response, and the x402 exchange header by header.",
    group: "builders",
  },
  {
    slug: "plugin",
    source: "docs/PLUGIN.md",
    route: "/docs/plugin",
    title: "The PayBox plugin",
    blurb: "The nine tools, their schemas, and a worked transcript of a shop opening and an agent buying from it.",
    group: "builders",
  },
  {
    slug: "threat-model",
    source: "docs/THREAT_MODEL.md",
    route: "/docs/threat-model",
    title: "Threat model",
    blurb: "Assets, trust boundaries, STRIDE by boundary, which mitigations are in code, and the known gaps.",
    group: "builders",
  },
  {
    slug: "security",
    source: "SECURITY.md",
    route: "/security",
    title: "Security policy",
    blurb: "How to report a vulnerability, what is in scope, and the rules for testing against Awning.",
    group: "builders",
  },
  {
    slug: "business",
    source: "docs/BUSINESS.md",
    route: "/docs/business",
    title: "The business",
    blurb: "The problem, the customer, pricing and unit economics, go-to-market, competition and risks.",
    group: "business",
  },
  {
    slug: "roadmap",
    source: "docs/ROADMAP.md",
    route: "/docs/roadmap",
    title: "Roadmap",
    blurb: "What exists today, what comes before selling widely, and where Awning goes after that.",
    group: "business",
  },
  {
    slug: "terms",
    source: "docs/legal/terms.md",
    route: "/terms",
    title: "Terms of service",
    blurb: "The agreement for owners, buyers and callers: non-custodial payments, acceptable use, suspension.",
    group: "business",
  },
  {
    slug: "privacy",
    source: "docs/legal/privacy.md",
    route: "/privacy",
    title: "Privacy policy",
    blurb: "What Awning collects, what is public on purpose, who else receives it and how long it is kept.",
    group: "business",
  },
];

/** The documents served under /docs/[slug] (the rest have top-level routes). */
export const DOC_ROUTE_SLUGS = DOCS.filter((d) => d.route === `/docs/${d.slug}`).map((d) => d.slug);

export function docBySlug(slug: string): Doc | undefined {
  return DOCS.find((d) => d.slug === slug);
}

export function docBySource(source: string): Doc | undefined {
  return DOCS.find((d) => d.source === source);
}
