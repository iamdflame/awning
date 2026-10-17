// The story's facts in one place. Everything the film prints about the demo business comes from
// here, from the founder's recordings (edl.json) or from the live API (public/capture/manifest.json,
// filled by `npm run capture`). These values are the real ones: the founder opened Ridge Roast on
// Pro on 2026-10-17 (rec/owner1.mp4; GET https://api.awning.sh/v1/businesses/ridge-roast).

export const BUSINESS = {
  name: "Ridge Roast",
  slug: "ridge-roast",
  city: "Accra",
  what: "small-batch coffee",
  // the Pro opening the founder approved in PayBox: ridgeroast.shop for 11.06 USDC on Base
  domain: "ridgeroast.shop",
  subdomain: "ridge-roast.awning.sh",
  openTotalUsdc: "11.06",
  openTx: "0x285a4ec62c3b18def3688289d31d5bf0853e9006aa81c58fa80e297bf1881c4c",
  // the owner's sales wallet (from the prompt; public)
  wallet: "0x1CD2B147EfE092c3BdE0B474bCE3Bd33ae3dbB37",
  // the plan's three real domain quotes (awning_plan, 2026-10-17)
  domains: [
    { domain: "ridgeroast.co", usdc: "24.76" },
    { domain: "ridgeroast.shop", usdc: "11.06" },
    { domain: "ridgeroast.store", usdc: "11.57" },
  ],
  bag: { title: "250 g Coffee Bag", priceUsd: 14 },
  tasting: { title: "Tasting Session", priceUsdc: "5.00" },
};

export const short = (addr: string, a = 6, b = 5) => `${addr.slice(0, a)}…${addr.slice(-b)}`;

/**
 * The prompts. P1 is what the founder sent in rec/owner1.mp4, word for word (the wallet address is
 * shortened for display only). P3-P6 are launch/DEMO-SCRIPT.md's, for the takes still to come.
 */
export const PROMPTS = {
  P1: `Open a business on Awning through PayBox: Ridge Roast, small-batch coffee from Accra. Sell 250 g bags at $14 and a $5 tasting session. Sales go to my wallet ${short(BUSINESS.wallet)}, open it with Pro at ridgeroast.shop, not the free version.`,
  P2: "Open it on ridgeroast.shop.",
  P3: "Find a coffee tasting in Accra and book one for Saturday morning.",
  P4: "Yes, book it.",
  P5: "Add a monthly subscription box to Ridge Roast for $30.",
  P6: "How are Ridge Roast's sales?",
} as const;

/** The opening saga's steps, in the order the paid open response lists them (web/README.md). */
export const OPEN_STEPS = ["preflight", "hosting", "register_domain", "dns", "go_live"] as const;

/** Blend Commerce audit (docs/BUSINESS.md, launch/SUBMISSION.md). */
export const AUDIT = {
  total: 200,
  could: 38,
  source: "Blend Commerce, AI shopping audit of 200 UK and US retailers, September 2026",
};

export const URL_HOME = "awning.sh";
export const ONE_LINER = "One sentence opens a real business that people and AI agents can buy from.";
