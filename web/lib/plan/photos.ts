import type { Palette } from "../db/schema";

/**
 * Prompts for a business's two illustrative photographs (hero scene + detail
 * close-up). Written for an image model that garbles lettering, so nothing in a
 * scene may carry text (no packaging, signs, screens or book spines), and for
 * dignity: no faces, no city stereotypes (the city is never in the prompt), only
 * clean, modern, well-kept places shown at their best.
 */

type Scene = { re: RegExp; hero: string; detail: string };

// Most specific first: "bike repair" is a bike shop before it is a repair business.
const SCENES: Scene[] = [
  {
    re: /coffee|espresso|roast|caf[eé]|\btea\b|matcha|latte/i,
    hero: "the inside of a small specialty coffee roastery: a compact steel drum roaster, freshly roasted beans cooling in a round tray, burlap sacks of green coffee, a wooden counter, morning light from a side window",
    detail: "a close-up of glossy freshly roasted coffee beans beside a hand-poured filter coffee in a plain ceramic cup on a wooden counter",
  },
  {
    re: /\bbikes?\b|bicycle|cycling|cyclist/i,
    hero: "a tidy independent bicycle workshop: a road bike clamped in a repair stand, spare wheels hanging on a wall, hand tools on a pegboard, warm workshop light",
    detail: "a close-up of a clean bicycle chain, rear cassette and a steel wrench on a worn workbench",
  },
  {
    re: /ceramic|pottery|potter|\bclay\b|stoneware|porcelain|kiln/i,
    hero: "a bright ceramics studio: a potter's wheel with a freshly thrown bowl, wooden shelves of glazed stoneware, soft daylight from large windows",
    detail: "a close-up of handmade stoneware bowls and cups with flowing, drippy glaze on a linen cloth",
  },
  {
    re: /bake|bakery|baker|bread|sourdough|pastr|cake|cookie|croissant|donut|dessert/i,
    hero: "the counter of an artisan bakery at dawn: crusty sourdough loaves on wooden racks, a dusting of flour, a stone oven glowing softly in the background",
    detail: "a close-up of a torn sourdough loaf showing an open crumb next to flaky pastries on a floured wooden board",
  },
  {
    re: /braid|hair|barber|salon|nail|beauty|makeup|skincare|\bspa\b|lash|brow|esthetic/i,
    hero: "a calm, modern beauty studio with no one in it: a styling chair, a round mirror, green plants, neatly folded towels, warm natural light",
    detail: "a close-up of wooden combs, brushes and plain unlabeled glass bottles neatly arranged on a stone counter",
  },
  {
    re: /fitness|\bgym\b|yoga|pilates|trainer|training|workout|crossfit|boxing|dance|running|wellness|massage/i,
    hero: "an empty, light-filled training studio: wooden floor, rolled exercise mats, kettlebells lined up along a wall, large windows",
    detail: "a close-up of a cast-iron kettlebell, a jump rope and a rolled mat on a wooden floor in soft light",
  },
  {
    re: /photo|camera|portrait|wedding|headshot/i,
    hero: "a small photography studio with no one in it: a seamless paper backdrop, a softbox light on a stand, a wooden stool, daylight",
    detail: "a close-up of an unbranded vintage film camera and two lenses resting on a wooden table",
  },
  {
    re: /tutor|lesson|teach|course|\bmath|maths|language|french|spanish|coding|piano|guitar|exam|school/i,
    hero: "a quiet, sunlit study corner: a wooden desk by a window, a desk lamp, a mug of tea, pencils in a cup, a blank open notebook",
    detail: "a close-up of sharpened pencils, a blank notebook and a brass desk lamp on a wooden desk in warm light",
  },
  {
    re: /\bdogs?\b|\bcats?\b|\bpets?\b|groom|walker|puppy|kennel/i,
    hero: "a bright, spotless pet grooming room with no one in it: a grooming table, soft towels, brushes on a shelf, natural light",
    detail: "a close-up of a ceramic pet bowl, a leather leash and natural treats on a wooden floor",
  },
  {
    re: /clean|plumb|handyman|repair|garden|landscap|painting|painter|electric|roofing|moving|laundry/i,
    hero: "a well-organised workshop van interior: hand tools in neat rows, coiled cables, folded drop cloths, morning light",
    detail: "a close-up of well-kept hand tools (a hammer, pliers, a level) laid out on a canvas cloth",
  },
  {
    re: /candle|jewel|soap|clothing|fashion|apparel|t-?shirt|boutique|knit|\bbags?\b|shoes|plants?\b|flower|florist|handmade|craft|goods/i,
    hero: "a small, beautifully arranged independent shop with no one in it: wooden shelves of handmade goods, plants, woven baskets, warm daylight",
    detail: "a close-up of handmade goods wrapped in plain kraft paper and twine on a wooden table",
  },
  {
    re: /design|brand|logo|illustrat|\bart\b|artist|mural|creative|studio|animation|music|producer/i,
    hero: "an independent creative studio with no one in it: a large worktable with paper swatches, brushes, colour samples and plants, daylight",
    detail: "a close-up of paint swatches, brushes and coloured pencils arranged on a large sheet of blank paper",
  },
  {
    re: /\bapps?\b|software|website|developer|\btech\b|computer|\bit\b|seo|automation|digital/i,
    hero: "a calm, minimal workspace with no one in it: a closed laptop, a keyboard, a plant and a ceramic mug on a wooden desk by a window",
    detail: "a close-up of a small electronics circuit board, neatly coiled cables and a screwdriver on a wooden desk",
  },
  {
    re: /consult|account|bookkeep|legal|lawyer|marketing|strategy|\btax\b|agency|coach|advis/i,
    hero: "a calm, modern meeting room with no one in it: a wooden table, two chairs, a closed notebook, a ceramic coffee cup, plants, soft daylight",
    detail: "a close-up of a fountain pen resting on a closed leather notebook beside a cup of coffee",
  },
  {
    re: /food|kitchen|restaurant|meal|cater|grill|jollof|pizza|taco|chef|bbq|barbecue|soup|lunch|dinner|street food/i,
    hero: "a clean, modern open kitchen with no one in it: copper pans, fresh vegetables and herbs on a wooden counter, steam rising from a pot, warm light",
    detail: "a close-up of a freshly plated home-style dish in a handmade ceramic bowl on a wooden table",
  },
];

const FALLBACK: Scene = {
  re: /./,
  hero: "a small, welcoming independent shop interior with no one in it: wooden shelves, plants and warm daylight",
  detail: "a close-up of a few carefully made products arranged on a wooden counter in soft light",
};

function hsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

/** "#6B3E26" → "warm brown": plain words an image model understands. */
export function colorWords(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "warm neutral";
  const [h, s, l] = hsl(hex);
  if (s < 0.12) return l < 0.22 ? "charcoal" : l > 0.86 ? "off-white" : "warm grey";
  if (h >= 8 && h < 48 && l < 0.42) return l < 0.24 ? "dark espresso brown" : "warm brown";
  const depth = l < 0.28 ? "deep " : l > 0.78 ? "pale " : l > 0.62 ? "soft " : "";
  const name =
    h < 10 || h >= 345 ? "red" : h < 30 ? "terracotta" : h < 48 ? "amber" : h < 64 ? "golden yellow" : h < 90 ? "olive" : h < 165 ? "green" : h < 195 ? "teal" : h < 250 ? "blue" : h < 290 ? "indigo" : h < 330 ? "plum" : "rose";
  return depth + name;
}

const STYLE =
  "Documentary photograph, well lit with natural light, clean, modern and well kept, premium editorial style, shallow depth of field, 35mm lens. " +
  "There is no text anywhere: no letters, numbers, words, signage, logos, labels or printed packaging. No people's faces.";

export type PhotoSubject = { name: string; category: string; tagline?: string | null; description?: string | null; offers?: { title: string }[]; palette: Palette };

/** The scene for a business: its category label, name, tagline and offers decide it. */
export function sceneFor(b: PhotoSubject): Scene {
  const text = [b.category, b.name, b.tagline ?? "", ...(b.offers ?? []).map((o) => o.title), b.description ?? ""].join(" · ");
  return SCENES.find((s) => s.re.test(text)) ?? FALLBACK;
}

export function photoPrompts(b: PhotoSubject): { hero: string; detail: string } {
  const scene = sceneFor(b);
  const tones = `Colour palette of ${colorWords(b.palette.primary)} and ${colorWords(b.palette.accent)} tones with ${colorWords(b.palette.paper)} highlights.`;
  return {
    hero: `${cap(scene.hero)}. ${tones} ${STYLE}`,
    detail: `${cap(scene.detail)}. ${tones} ${STYLE}`,
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
