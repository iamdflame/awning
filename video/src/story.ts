// The story's facts in one place. Everything the film prints about the demo business comes from
// here or from the live API (public/capture/manifest.json, filled by `npm run capture`).
// After the founder's recording session, check the FROM THE TAKE values against the recording.

export const BUSINESS = {
  name: "Ridge Roast",
  slug: "ridge-roast",
  city: "Accra",
  what: "small-batch coffee",
  // FROM THE TAKE: the domain opened in P2 and the total PayBox showed for it (docs/SPEC.md: a .shop
  // opening was 11.06 USDC at Porkbun's 2026-10-17 list price). Update both to the recording.
  domain: "ridgeroast.shop",
  openTotalUsdc: "11.06",
  tasting: { title: "Saturday tasting", priceUsdc: "5.00" },
};

/** The prompts, exactly as typed (launch/DEMO-SCRIPT.md). */
export const PROMPTS = {
  P1: "Start a business: Ridge Roast, small-batch coffee from Accra. Sell 250 g bags and a $5 tasting session. Sales go to my PayBox wallet.",
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
