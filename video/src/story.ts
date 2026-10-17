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
  // added later from the owner's chat (rec/owner2.mp4)
  subscription: { title: "Monthly Subscription Box", priceUsd: 30 },
  // the first sale, bought by a fresh chat (rec/buyer.mp4) and listed on awning.sh/live
  sale: {
    amountUsdc: "5.00",
    tx: "0x893b3fa685c61b25aa863309b4ff3f0a01d9b8e37be89890573cd23f4f9e7651",
    at: "2026-10-17T18:33:03.218Z",
    bookingCode: "RID-7R4G4U",
  },
};

export const short = (addr: string, a = 6, b = 5) => `${addr.slice(0, a)}…${addr.slice(-b)}`;

/**
 * The prompts, word for word as sent in the founder's takes (the wallet address in P1 is shortened
 * for display only). P2 and P4 were not needed: P1 asked for Pro on ridgeroast.shop, and the buyer's
 * chat proposed the payment after P3.
 */
export const PROMPTS = {
  P1: `Open a business on Awning through PayBox: Ridge Roast, small-batch coffee from Accra. Sell 250 g bags at $14 and a $5 tasting session. Sales go to my wallet ${short(BUSINESS.wallet)}, open it with Pro at ridgeroast.shop, not the free version.`,
  P2: "Open it on ridgeroast.shop.",
  P3: "Using PayBox, find a coffee tasting in Accra on Awning and book one for Saturday morning.",
  P4: "Yes, book it.",
  P5: "Add a monthly subscription box to Ridge Roast on Awning for $30.",
  P6: "How are Ridge Roast's sales on Awning?",
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
