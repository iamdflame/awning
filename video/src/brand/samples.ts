// Copied from web/lib/design/samples.ts: the design's sample businesses (the landing's illustration).
import type { ArtKind } from "./art";
export type HeroKind = "sign" | "poster" | "arch";
export type Theme = { ground: string; ink: string; accent: string; accent2: string; stripeA: string; stripeB: string; deep: string; onAccent: string };

/**
 * The design's sample businesses (design/shared/businesses.js). They drive the
 * landing hero's animation and fill the "Opened today" street when there are
 * not yet enough real businesses; there they are always marked as examples and
 * never carry sales.
 */
export type SampleOffer = { id: string; title: string; price: string; featured?: boolean };
export type SampleBusiness = {
  slug: string;
  name: string;
  sentence: string;
  tagline: string;
  category: string;
  city: string;
  domain: string;
  phone: string;
  receptionist: string;
  offers: SampleOffer[];
  palette: Theme;
  fonts: { display: string; text: string };
  art: ArtKind;
  hero: HeroKind;
  wallet: string;
};

export const SAMPLES: SampleBusiness[] = [
  {
    slug: "ridge-roast",
    name: "Ridge Roast",
    sentence: "Start a business: Ridge Roast, small-batch coffee from Accra. Ship bags and sell a $5 tasting.",
    tagline: "Small-batch coffee, roasted on the ridge above Accra.",
    category: "Coffee roaster",
    city: "Accra",
    domain: "ridgeroast.co",
    phone: "+233 30 290 0143",
    receptionist: "Ama",
    offers: [
      { id: "tasting", title: "Saturday tasting", price: "5.00", featured: true },
      { id: "bag-250", title: "Volta Highlands, 250 g", price: "14.00" },
      { id: "monthly", title: "The monthly box", price: "30.00" },
    ],
    palette: { ground: "#6b1d14", ink: "#fbe8cf", accent: "#f4b335", accent2: "#e8552d", stripeA: "#f4b335", stripeB: "#fbe8cf", deep: "#3a0e09", onAccent: "#2a0d08" },
    fonts: { display: "Alfa Slab One", text: "Work Sans" },
    art: "coffee",
    hero: "sign",
    wallet: "0x7a3F…9c21",
  },
  {
    slug: "spoke-and-chain",
    name: "Spoke & Chain",
    sentence: "Open a bike repair shop in Austin called Spoke & Chain. $45 tune-ups, flats fixed while you wait.",
    tagline: "Bike repair on East Cesar Chavez. Flats fixed while you wait.",
    category: "Bike repair",
    city: "Austin",
    domain: "spokeandchain.bike",
    phone: "+1 (737) 555-0119",
    receptionist: "Rosa",
    offers: [
      { id: "tuneup", title: "Full tune-up", price: "45.00", featured: true },
      { id: "flat", title: "Flat fixed while you wait", price: "12.00" },
      { id: "mobile", title: "Sunday house call", price: "25.00" },
    ],
    palette: { ground: "#ffd84a", ink: "#141414", accent: "#2343d6", accent2: "#ff5a36", stripeA: "#2343d6", stripeB: "#fffaf0", deep: "#141414", onAccent: "#ffffff" },
    fonts: { display: "Big Shoulders Display", text: "Barlow" },
    art: "bike",
    hero: "poster",
    wallet: "0x19bE…44a0",
  },
  {
    slug: "barro-studio",
    name: "Barro",
    sentence: "Start Barro, a ceramics studio in Lisbon. Sell glazed bowls and a Saturday wheel class.",
    tagline: "Ceramics studio and wheel classes in Marvila, Lisbon.",
    category: "Ceramics studio",
    city: "Lisbon",
    domain: "barro.studio",
    phone: "+351 21 555 0172",
    receptionist: "Inês",
    offers: [
      { id: "class", title: "Saturday wheel class", price: "65.00", featured: true },
      { id: "bowl", title: "Tejo bowl", price: "38.00" },
      { id: "set", title: "Breakfast set for two", price: "120.00" },
    ],
    palette: { ground: "#e7edf5", ink: "#11295f", accent: "#1f5ad1", accent2: "#e3a43a", stripeA: "#1f5ad1", stripeB: "#ffffff", deep: "#0c1d45", onAccent: "#ffffff" },
    fonts: { display: "Young Serif", text: "Figtree" },
    art: "ceramics",
    hero: "arch",
    wallet: "0xC0de…7713",
  },
];

/** Neighbours on the street (landing.js EXTRA): drawn shopfronts only, never real. */
export type ExtraShop = { name: string; full?: string; slug: string; city: string; disp: string; fs: number; wall: string; trim: string; sA: string; sB: string; glass: string; art: ArtKind; kind: string; w: number; h: number };

export const EXTRA: ExtraShop[] = [
  { name: "Mama Efua’s", slug: "mama-efuas", city: "Kumasi", disp: "Shrikhand", fs: 28, wall: "#f6c8b8", trim: "#7a1f2b", sA: "#7a1f2b", sB: "#fff4ec", glass: "#2b1a1d", art: "coffee", kind: "a kitchen", w: 300, h: 320 },
  { name: "NIGHT OWL", full: "Night Owl Records", slug: "night-owl-records", city: "Leeds", disp: "Rubik Mono One", fs: 20, wall: "#262a4a", trim: "#f2c14e", sA: "#f2c14e", sB: "#262a4a", glass: "#11132a", art: "ceramics", kind: "a record shop", w: 260, h: 360 },
  { name: "Fold Press", slug: "fold-press", city: "Oaxaca", disp: "Gloock", fs: 30, wall: "#dfe8d5", trim: "#2f4a2a", sA: "#2f4a2a", sB: "#f4f7ee", glass: "#20301d", art: "ceramics", kind: "a bindery", w: 280, h: 300 },
  { name: "Little Fig", slug: "little-fig", city: "Melbourne", disp: "Bagel Fat One", fs: 30, wall: "#7c3a6d", trim: "#ffd1e8", sA: "#ffd1e8", sB: "#7c3a6d", glass: "#3b1834", art: "bike", kind: "a florist", w: 250, h: 340 },
];
