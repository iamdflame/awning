/**
 * Acceptable-use screening for everything that becomes public: the owner's
 * sentence, the drafted name/tagline/description/offers, and offers added later.
 *
 * Deterministic on purpose: the same text always gets the same answer, the
 * reason is explainable to the owner, and nothing depends on a model that a
 * crafted sentence could talk round. Awning registers real domains and real
 * phone lines, so the two failure modes that matter most are prohibited
 * businesses and businesses that impersonate a brand to phish people.
 */

export type PolicyCategory =
  | "weapons"
  | "drugs"
  | "adult"
  | "gambling"
  | "financial_scheme"
  | "counterfeit"
  | "hacking"
  | "phishing"
  | "impersonation"
  | "tobacco";

export type PolicyResult = { ok: true } | { ok: false; category: PolicyCategory; reason: string; match: string };

const LABELS: Record<PolicyCategory, string> = {
  weapons: "weapons, ammunition and explosives",
  drugs: "drugs, controlled substances and prescription medicine",
  adult: "adult content and sexual services",
  gambling: "gambling and betting",
  financial_scheme: "investment, trading, lending and money-transfer services",
  counterfeit: "counterfeit goods and forged documents",
  hacking: "hacking, malware and account-takeover services",
  phishing: "collecting passwords, wallet keys or recovery phrases",
  impersonation: "impersonating another company or a government body",
  tobacco: "tobacco, nicotine and vaping products",
};

export function policyLabel(c: PolicyCategory): string {
  return LABELS[c];
}

// Each rule is a whole-word pattern on normalised text. Harmless lookalikes
// (glue gun, method, pineapple, alphabet) are excluded by construction or by `unless`.
const RULES: { category: PolicyCategory; pattern: RegExp; unless?: RegExp }[] = [
  {
    category: "weapons",
    pattern:
      /\b(fire ?arms?|hand ?guns?|ammunition|ammo (shop|store|sales?)|silencers?|suppressors?|ar-?15s?|ak-?47s?|ghost guns?|(gun|weapons?|arms) (shop|store|dealer|sales?)|arms dealer|(guns|rifles|pistols|shotguns|weapons) for sale|sell(ing)? (guns|rifles|pistols|shotguns|weapons)|explosives?|grenades?|detonators?|bomb[- ]making)\b/,
  },
  {
    category: "drugs",
    pattern:
      /\b(cocaine|crack rocks?|heroin|meth|methamphetamine|crystal meth|fentanyl|mdma|ecstasy pills?|lsd|ketamine|magic mushrooms|psilocybin|shrooms|opioids?|oxycontin|oxycodone|xanax|adderall|tramadol|codeine|steroids|anabolics?|cannabis|marijuana|weed (delivery|plug|dispensary)|thc (gummies|vapes?|carts?)|dispensary|no prescription( needed)?|without (a )?prescription|prescription (drugs|meds|pills))\b/,
    unless: /\b(steroid-free|drug-free)\b/,
  },
  {
    category: "adult",
    pattern:
      /\b(escorts?|escort service|porn|porno|pornography|xxx|onlyfans|nude (photos|pics|videos|content)|camgirls?|cam shows?|sex (work|worker|services?|shop|toys?|chat)|erotic (massage|services?)|adult (content|entertainment|services?|videos?|massage))\b/,
  },
  {
    category: "gambling",
    pattern: /\b(casinos?|gambling|betting|sports ?book|bookmakers?|bookie|lottery tickets?|slot machines?|online slots|poker (room|site|games? for money)|place (your )?bets?)\b/,
  },
  {
    category: "financial_scheme",
    pattern:
      /\b(invest(ment)? (fund|plan|scheme|opportunit(y|ies)|returns?|club|pool)|investors? wanted|forex|fx trading|trading signals?|signals group|binary options|crypto (trading|investment|exchange|signals|mining pool|arbitrage|recovery)|token (sale|presale)|ico|pump and dump|high[- ]yield|guaranteed (returns?|profits?|income)|double your (money|crypto|bitcoin|investment)|passive income (scheme|plan)|ponzi|pyramid scheme|mlm|payday loans?|quick loans?|instant loans?|loan shark|money (transfer|remittance|laundering|flipping|doubling)|cash ?app flip|fund recovery|recover (lost|stolen|scammed) (funds|crypto|money|bitcoin)|currency exchange|bureau de change)\b/,
  },
  {
    category: "counterfeit",
    pattern:
      /\b(counterfeit|replica (watches|bags|handbags|sneakers|jerseys|designer)|designer (replicas|knock[- ]?offs|dupes)|fake (ids?|passports?|documents?|diplomas?|degrees?|certificates?|reviews?|followers|bank statements?)|forged|forgery|cloned cards?|carding|cvv shop|card dumps|unlocked stolen)\b/,
  },
  {
    category: "hacking",
    pattern:
      /\b(hacking services?|hacker for hire|hire (a )?hacker|hack (accounts?|instagram|facebook|whatsapp|snapchat|emails?|phones?|wallets?)|ddos (attacks?|for hire|services?)|booters?|stressers?|malware (for sale|builders?|development)|(sell|selling|custom) malware|ransomware (for sale|kits?|as a service)|spyware|stalkerware|phishing (kits?|pages?)|botnets?|account takeovers?|sim swap(ping)?)\b/,
  },
  {
    category: "phishing",
    pattern:
      /\b(seed phrases?|recovery phrases?|secret phrases?|mnemonic phrases?|wallet private keys?|(enter|share|send|import) (your )?private keys?|wallet (recovery|validation|verification|sync|rectification|unlock)|verify your (wallet|account|identity)|unlock your (account|wallet)|account (suspended|locked|verification)|claim (your )?(airdrop|tokens|reward)|airdrop claim|one[- ]time (passcodes?|codes?)|otp codes?|login (details|credentials))\b/,
  },
  {
    category: "impersonation",
    pattern:
      /\b(official (government|irs|dmv|passport|visa|immigration|tax|customs) (office|service|portal|agency|website)|government (grants?|refunds?) (office|service|claims?)|tax refund (service|claims?)|(irs|hmrc|uscis|fbi|interpol|social security) (agent|office|service|department|support))\b/,
  },
  {
    category: "tobacco",
    pattern: /\b(vapes?|vaping|e-?cig(arette)?s?|nicotine|cigarettes?|cigars?|tobacco|hookah|shisha|juul)\b/,
  },
];

/**
 * Brands that no independent small business would carry in its name. A whole
 * token match blocks. Short or dictionary-word brands (apple, amazon, chase,
 * square, stripe, ledger, visa…) are only blocked when the name also carries a
 * support/login/wallet word, so "Apple Tree Bakery" and "Striped Socks" pass.
 */
const STRONG_BRANDS = [
  "paypal", "moonpay", "paybox", "coinbase", "binance", "metamask", "trezor", "uniswap", "opensea", "kucoin", "bybit", "okx",
  "venmo", "cashapp", "zelle", "revolut", "wellsfargo", "bankofamerica", "citibank", "hsbc", "barclays", "natwest",
  "americanexpress", "amex", "mastercard", "icloud", "gmail", "microsoft", "netflix", "facebook", "instagram",
  "whatsapp", "tiktok", "snapchat", "spotify", "youtube", "walmart", "costco", "fedex", "usps", "dhl", "irs", "hmrc", "uscis", "fbi",
  "interpol", "openai", "chatgpt", "anthropic", "nvidia", "tesla", "louisvuitton", "rolex", "gucci", "samsung", "airbnb", "shopify",
  "mpesa", "safaricom", "vodafone", "airtel", "ecobank", "gtbank", "google", "ebay", "linkedin", "dropbox", "docusign",
  "trustwallet", "solflare",
];
/** Dictionary words and place names that are also brands: blocked only next to a lure word. */
const SOFT_BRANDS = [
  "apple", "amazon", "chase", "square", "stripe", "ledger", "visa", "wise", "meta", "circle", "uber", "target", "delta",
  "shell", "sony", "nike", "outlook", "santander", "kraken", "phantom", "exodus", "tether", "robinhood", "robin", "blockchain",
];
/** Words that turn a brand in a name into a lure (support desks, wallet recovery, giveaways). */
const LURES = [
  "support", "helpdesk", "helpline", "login", "signin", "secure", "security", "verify", "verification", "wallet", "wallets",
  "account", "accounts", "official", "recovery", "recover", "refund", "refunds", "claim", "claims", "airdrop", "rewards",
  "unlock", "billing", "giveaway", "bonus", "customercare", "customerservice",
];
/** Glued onto a strong brand inside one token (paypalhelp, moonpayteam), these also count. */
const GLUE = new Set([...LURES, "help", "care", "team", "desk", "service", "services", "pay", "payments", "app", "online", "hq", "us", "io", "official", "pro", "plus", "web", "live", ""]);

const HOMOGLYPHS: Record<string, string> = { "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "|": "l" };

/** Lowercase, fold accents, collapse whitespace; keeps word boundaries. */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  const folded = normalize(text).replace(/[0134578@$|]/g, (c) => HOMOGLYPHS[c] ?? c);
  return folded.split(/[^a-z]+/).filter(Boolean);
}

function brandHit(text: string): string | null {
  const toks = tokens(text);
  if (!toks.length) return null;
  const lure = toks.some((t) => LURES.includes(t)) || toks.some((t, i) => LURES.includes(t + (toks[i + 1] ?? "")));
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    const pair = t + (toks[i + 1] ?? "");
    const triple = pair + (toks[i + 2] ?? "");
    for (const b of STRONG_BRANDS) {
      if (t === b || pair === b || triple === b) return b;
      // Brand glued to a lure or filler in one token: paypalsupport, securemoonpay, coinbasepro.
      if (b.length >= 4 && t.length > b.length) {
        if (t.startsWith(b) && GLUE.has(t.slice(b.length))) return b;
        if (t.endsWith(b) && GLUE.has(t.slice(0, t.length - b.length))) return b;
        // Long brands are distinctive anywhere in a token (paypall, xmoonpayx).
        if (b.length >= 6 && t.includes(b)) return b;
      }
    }
    if (lure && (SOFT_BRANDS.includes(t) || SOFT_BRANDS.includes(pair))) return SOFT_BRANDS.includes(t) ? t : pair;
  }
  return null;
}

/** Screen free text (sentence, description, offer copy). */
export function screenText(text: string): PolicyResult {
  const n = normalize(text);
  for (const rule of RULES) {
    const m = n.match(rule.pattern);
    if (m && !(rule.unless && rule.unless.test(n))) {
      return { ok: false, category: rule.category, reason: blockReason(rule.category), match: m[0] };
    }
  }
  return { ok: true };
}

/** Screen a business name (or domain label) for brand impersonation, then as text. */
export function screenName(name: string): PolicyResult {
  const b = brandHit(name);
  if (b) return { ok: false, category: "impersonation", reason: blockReason("impersonation"), match: b };
  return screenText(name);
}

/** Screen everything that will be published for one business. */
export function screenBusiness(d: {
  name: string;
  tagline?: string;
  description?: string;
  offers?: { title: string; description?: string }[];
}): PolicyResult {
  const name = screenName(d.name);
  if (!name.ok) return name;
  const parts = [d.tagline ?? "", d.description ?? "", ...(d.offers ?? []).flatMap((o) => [o.title, o.description ?? ""])];
  return screenText(parts.join(" \n "));
}

export function blockReason(c: PolicyCategory): string {
  return `Awning can't open this: ${LABELS[c]} aren't allowed on Awning (see the acceptable use policy at https://awning.sh/terms#acceptable-use). Nothing was created or charged.`;
}
