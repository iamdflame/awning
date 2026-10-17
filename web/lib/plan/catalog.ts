import type { OfferKind, Palette } from "../db/schema";

export type CategoryDef = {
  label: string;
  keywords: string[];
  /** "a small-batch coffee roaster" — used in generated descriptions. */
  descriptor: string;
  /** Default noun for a generated name: "Coffee Co." */
  nameNoun: string;
  /** Second sentence of the description; must stay truthful and generic. */
  craft: string;
  taglines: string[];
  palettes: Palette[];
  offers: { title: string; description: string; priceUsd: number; kind: OfferKind }[];
};

const P = (primary: string, accent: string, ink: string, paper: string): Palette => ({ primary, accent, ink, paper });

export const CATEGORIES: CategoryDef[] = [
  {
    label: "Coffee & Tea",
    keywords: ["coffee", "espresso", "roast", "roaster", "roastery", "tea", "cafe", "café", "matcha", "latte", "brew"],
    descriptor: "a small-batch coffee business",
    nameNoun: "Coffee Co.",
    craft: "Beans are roasted in small batches and sold fresh, by the bag or by the cup.",
    taglines: ["Small-batch coffee{in}.", "Fresh-roasted coffee, straight from the roaster.", "Good coffee, roasted with care{in}."],
    palettes: [P("#6B3E26", "#E2A04A", "#2A1A12", "#FBF5EE"), P("#2F4A3A", "#D98E48", "#17241C", "#F6F1E7"), P("#8A2E1F", "#F1B24A", "#2B120D", "#FFF8EF")],
    offers: [
      { title: "Signature bag (250 g)", description: "Whole-bean coffee from the current roast, packed the week it ships.", priceUsd: 16, kind: "product" },
      { title: "Tasting session", description: "A guided cupping of three coffees, about 30 minutes.", priceUsd: 12, kind: "booking" },
      { title: "Monthly coffee subscription", description: "One fresh bag every month; skip or cancel any time.", priceUsd: 28, kind: "subscription" },
      { title: "Home brew guide (PDF)", description: "Step-by-step recipes for pour-over, French press and moka pot.", priceUsd: 4, kind: "digital" },
    ],
  },
  {
    label: "Bakery & Sweets",
    keywords: ["bake", "bakery", "baker", "bread", "cake", "cakes", "pastry", "pastries", "cookie", "cookies", "donut", "sourdough", "dessert", "cupcake", "chocolate"],
    descriptor: "an independent bakery",
    nameNoun: "Bakehouse",
    craft: "Everything is baked to order in small batches, so it arrives fresh.",
    taglines: ["Baked fresh{in}, every morning.", "Small-batch bakes, made to order.", "Bread, cakes and treats{in}."],
    palettes: [P("#B5543A", "#F3C969", "#3A1D14", "#FFF7EC"), P("#7A4E8C", "#F2B5C4", "#2B1B33", "#FFF6F8")],
    offers: [
      { title: "Sourdough loaf", description: "A naturally leavened country loaf, baked the day you collect it.", priceUsd: 9, kind: "product" },
      { title: "Pastry box (6)", description: "A mixed box of six seasonal pastries.", priceUsd: 18, kind: "product" },
      { title: "Celebration cake (serves 12)", description: "A custom-decorated cake; tell us the occasion in your order note.", priceUsd: 45, kind: "product" },
      { title: "Baking class", description: "A two-hour hands-on class in a small group.", priceUsd: 35, kind: "booking" },
    ],
  },
  {
    label: "Food & Catering",
    keywords: ["food", "kitchen", "restaurant", "meal", "meals", "catering", "caterer", "grill", "jollof", "pizza", "taco", "tacos", "chef", "bbq", "barbecue", "soup", "lunch", "dinner", "street food", "food truck"],
    descriptor: "an independent kitchen",
    nameNoun: "Kitchen",
    craft: "Meals are cooked fresh from scratch and ready for pickup, delivery or your event.",
    taglines: ["Home-style cooking{in}.", "Fresh food, cooked to order.", "Real food, made by hand{in}."],
    palettes: [P("#C0392B", "#F4A62A", "#2C1410", "#FFF8F0"), P("#1F6F50", "#F2C14E", "#12261D", "#F7F5EC")],
    offers: [
      { title: "Family meal for 4", description: "A full meal with sides for four people.", priceUsd: 38, kind: "product" },
      { title: "Chef's table reservation", description: "A deposit that holds a table for your party; deducted from the bill.", priceUsd: 20, kind: "booking" },
      { title: "Weekly meal plan", description: "Five prepared lunches delivered each week.", priceUsd: 60, kind: "subscription" },
      { title: "Catering consultation", description: "A 30-minute call to plan the menu for your event.", priceUsd: 25, kind: "service" },
    ],
  },
  {
    label: "Beauty & Hair",
    keywords: ["salon", "hair", "braid", "braids", "braiding", "barber", "barbershop", "nails", "nail", "beauty", "makeup", "skincare", "spa", "lash", "lashes", "brows", "esthetician"],
    descriptor: "an independent beauty studio",
    nameNoun: "Studio",
    craft: "Every appointment is one-to-one, unhurried and booked in advance.",
    taglines: ["Look good, feel better{in}.", "Unhurried appointments, beautiful results.", "Your chair is ready{in}."],
    palettes: [P("#9C3D6B", "#F0B9A0", "#2D1220", "#FFF6F6"), P("#3D3A6B", "#E8B86D", "#16152B", "#FAF7F2")],
    offers: [
      { title: "Signature cut & style", description: "Consultation, wash, cut and finish.", priceUsd: 40, kind: "booking" },
      { title: "Braiding session", description: "Box braids or knotless braids; length and style in your note.", priceUsd: 85, kind: "booking" },
      { title: "Makeup consultation", description: "A 30-minute session to plan a look for your event.", priceUsd: 30, kind: "booking" },
      { title: "Gift card", description: "A gift card redeemable for any service.", priceUsd: 50, kind: "digital" },
    ],
  },
  {
    label: "Fitness & Wellness",
    keywords: ["fitness", "gym", "yoga", "pilates", "trainer", "training", "workout", "run", "running", "wellness", "massage", "meditation", "bootcamp", "crossfit", "dance", "boxing"],
    descriptor: "an independent fitness and wellness studio",
    nameNoun: "Studio",
    craft: "Classes stay small so every session gets real attention.",
    taglines: ["Move better{in}.", "Small classes, real progress.", "Strong body, calm mind{in}."],
    palettes: [P("#1E6091", "#F9C74F", "#0E2433", "#F4F8FB"), P("#2D6A4F", "#FF9F68", "#11261C", "#F3F8F4")],
    offers: [
      { title: "Drop-in class", description: "One group class of your choice.", priceUsd: 15, kind: "booking" },
      { title: "1:1 training session", description: "A 60-minute private session tailored to your goals.", priceUsd: 55, kind: "booking" },
      { title: "Monthly unlimited pass", description: "Unlimited group classes for 30 days.", priceUsd: 99, kind: "subscription" },
      { title: "4-week program (PDF)", description: "A structured four-week plan you can follow anywhere.", priceUsd: 19, kind: "digital" },
    ],
  },
  {
    label: "Design & Creative",
    keywords: ["design", "designer", "logo", "brand", "branding", "illustration", "illustrator", "art", "artist", "mural", "video", "animation", "music", "producer", "beats", "creative", "studio"],
    descriptor: "an independent creative studio",
    nameNoun: "Studio",
    craft: "Each project starts with a short brief and ends with files you own outright.",
    taglines: ["Design that does the work.", "Independent creative studio{in}.", "Ideas, made real."],
    palettes: [P("#E4572E", "#29335C", "#1B1B1E", "#FAF8F4"), P("#5B2A86", "#F7B32B", "#1C0F2B", "#FBF9FF")],
    offers: [
      { title: "Logo design", description: "Three concepts, two rounds of revisions, final files in every format.", priceUsd: 250, kind: "service" },
      { title: "Brand starter kit", description: "Logo, colour palette, type and a one-page brand guide.", priceUsd: 450, kind: "service" },
      { title: "Creative consultation", description: "A 30-minute call to scope your project.", priceUsd: 40, kind: "booking" },
      { title: "Social media templates", description: "A pack of editable post and story templates.", priceUsd: 29, kind: "digital" },
    ],
  },
  {
    label: "Photography",
    keywords: ["photo", "photos", "photography", "photographer", "portrait", "portraits", "wedding", "headshot", "headshots"],
    descriptor: "an independent photography studio",
    nameNoun: "Photography",
    craft: "Sessions are planned with you in advance and edited by hand.",
    taglines: ["Moments worth keeping{in}.", "Honest, beautiful photographs.", "Portraits and events{in}."],
    palettes: [P("#22223B", "#C9ADA7", "#111122", "#F7F4F2"), P("#3C6E71", "#D9A441", "#162A2B", "#F6F4EF")],
    offers: [
      { title: "Portrait session (1 hr)", description: "One hour on location with 15 edited images.", priceUsd: 150, kind: "booking" },
      { title: "Headshot session", description: "A 30-minute session with three retouched headshots.", priceUsd: 90, kind: "booking" },
      { title: "Event coverage (half day)", description: "Up to four hours of coverage with an online gallery.", priceUsd: 400, kind: "service" },
      { title: "Lightroom preset pack", description: "Ten presets used in our own edits.", priceUsd: 15, kind: "digital" },
    ],
  },
  {
    label: "Tutoring & Lessons",
    keywords: ["tutor", "tutoring", "lesson", "lessons", "teach", "teacher", "teaching", "class", "classes", "course", "math", "maths", "language", "french", "spanish", "coding", "piano", "guitar", "school", "exam", "sat"],
    descriptor: "an independent tutoring practice",
    nameNoun: "Tutoring",
    craft: "Lessons are one-to-one and paced to the student, online or in person.",
    taglines: ["Learn it properly{in}.", "One-to-one lessons that stick.", "Patient teaching, real progress."],
    palettes: [P("#264653", "#E9C46A", "#10222A", "#F8F6EF"), P("#3A5A40", "#F4A259", "#16231A", "#F7F6EE")],
    offers: [
      { title: "1-hour lesson", description: "A one-to-one lesson, online or in person.", priceUsd: 35, kind: "booking" },
      { title: "Monthly plan (4 lessons)", description: "Four weekly lessons at a reduced rate.", priceUsd: 120, kind: "subscription" },
      { title: "Placement assessment", description: "A short assessment and a written learning plan.", priceUsd: 15, kind: "service" },
      { title: "Practice pack (PDF)", description: "Worked examples and practice questions with answers.", priceUsd: 12, kind: "digital" },
    ],
  },
  {
    label: "Home Services",
    keywords: ["clean", "cleaning", "cleaner", "plumbing", "plumber", "repair", "repairs", "handyman", "garden", "gardening", "landscaping", "moving", "movers", "laundry", "pest", "painting", "painter", "electrician", "roofing"],
    descriptor: "a local home-services business",
    nameNoun: "Home Services",
    craft: "Jobs are quoted up front and done by the same small, insured team.",
    taglines: ["Done right the first time{in}.", "Reliable help around the house.", "Local, careful, on time."],
    palettes: [P("#0B6E4F", "#F2C14E", "#0A2219", "#F5F8F4"), P("#1D3557", "#E63946", "#0E1A2B", "#F7F9FB")],
    offers: [
      { title: "Standard home clean", description: "A full clean of a home up to two bedrooms.", priceUsd: 90, kind: "service" },
      { title: "Deep clean", description: "Inside appliances, cabinets and every surface.", priceUsd: 160, kind: "service" },
      { title: "Handyman hour", description: "One hour of small repairs; materials billed at cost.", priceUsd: 55, kind: "booking" },
      { title: "Monthly maintenance plan", description: "A scheduled visit every month for upkeep.", priceUsd: 140, kind: "subscription" },
    ],
  },
  {
    label: "Pets",
    keywords: ["dog", "dogs", "cat", "cats", "pet", "pets", "grooming", "groomer", "walker", "walking", "puppy", "kennel"],
    descriptor: "a local pet-care business",
    nameNoun: "Pet Care",
    craft: "Every pet gets the same carer each visit, with updates after every walk.",
    taglines: ["Happy pets{in}.", "Walks, grooming and care you can trust.", "Good boys and girls welcome."],
    palettes: [P("#C2570C", "#2A9D8F", "#2B1A0B", "#FFF8F1"), P("#5E548E", "#9BC53D", "#1D1A2E", "#F9F8FC")],
    offers: [
      { title: "Dog walk (30 min)", description: "A solo or small-group walk with photo updates.", priceUsd: 18, kind: "booking" },
      { title: "Full grooming", description: "Bath, trim, nails and ears.", priceUsd: 55, kind: "booking" },
      { title: "Weekly walks (5)", description: "Five walks a week on a regular schedule.", priceUsd: 80, kind: "subscription" },
      { title: "Treat box", description: "A box of small-batch natural treats.", priceUsd: 22, kind: "product" },
    ],
  },
  {
    label: "Tech & Digital",
    keywords: ["app", "apps", "software", "web", "website", "websites", "developer", "it", "saas", "tech", "computer", "phone repair", "seo", "automation"],
    descriptor: "an independent tech studio",
    nameNoun: "Labs",
    craft: "Work is scoped in writing up front, delivered in small milestones and handed over in full.",
    taglines: ["Technology that just works.", "Websites and software{in}.", "Small team, shipped work."],
    palettes: [P("#3A86FF", "#FFBE0B", "#0B1B33", "#F5F8FF"), P("#14213D", "#FCA311", "#0A0F1E", "#F7F7F5")],
    offers: [
      { title: "Website build", description: "A fast five-page website, live on your domain.", priceUsd: 600, kind: "service" },
      { title: "Tech support hour", description: "One hour of remote help with anything technical.", priceUsd: 60, kind: "booking" },
      { title: "Monthly care plan", description: "Updates, backups and small fixes every month.", priceUsd: 49, kind: "subscription" },
      { title: "Starter template", description: "A ready-to-use template with setup notes.", priceUsd: 29, kind: "digital" },
    ],
  },
  {
    label: "Consulting & Services",
    keywords: ["consult", "consulting", "consultant", "accounting", "accountant", "bookkeeping", "legal", "lawyer", "marketing", "strategy", "tax", "agency", "coaching", "career", "resume", "business coach"],
    descriptor: "an independent consultancy",
    nameNoun: "Advisory",
    craft: "Engagements start with a short call and end with a clear, written plan.",
    taglines: ["Clear advice, real results.", "Independent advice{in}.", "Get unstuck, fast."],
    palettes: [P("#283D3B", "#C44536", "#121C1B", "#F7F5F0"), P("#1B4965", "#F0A202", "#0C2230", "#F5F8FA")],
    offers: [
      { title: "Strategy call (45 min)", description: "A focused call with written notes afterwards.", priceUsd: 75, kind: "booking" },
      { title: "Audit & action plan", description: "A review of where you are and a prioritised plan.", priceUsd: 300, kind: "service" },
      { title: "Monthly retainer", description: "Ongoing support with a monthly check-in.", priceUsd: 500, kind: "subscription" },
      { title: "Template pack", description: "The worksheets and templates we use with clients.", priceUsd: 39, kind: "digital" },
    ],
  },
  {
    label: "Shop & Handmade",
    keywords: ["shop", "store", "handmade", "candle", "candles", "jewelry", "jewellery", "soap", "clothing", "fashion", "apparel", "tshirt", "t-shirt", "prints", "ceramics", "pottery", "boutique", "crafts", "craft", "knit", "sell", "bags", "shoes", "plants", "flowers", "florist"],
    descriptor: "an independent shop",
    nameNoun: "Goods",
    craft: "Every piece is made or chosen by hand and packed with care.",
    taglines: ["Made by hand{in}.", "Small shop, carefully made.", "Things worth keeping."],
    palettes: [P("#9B5DE5", "#F15BB5", "#22113A", "#FFF8FD"), P("#386641", "#BC4749", "#142417", "#F8F6EE"), P("#33658A", "#F6AE2D", "#10202C", "#F7F8F5")],
    offers: [
      { title: "Signature piece", description: "Our best-loved item, made in small batches.", priceUsd: 32, kind: "product" },
      { title: "Gift set", description: "A curated set, gift-wrapped with a handwritten note.", priceUsd: 48, kind: "product" },
      { title: "Custom order deposit", description: "Holds a custom order; describe what you want in your note.", priceUsd: 20, kind: "service" },
      { title: "Gift card", description: "A gift card for anything in the shop.", priceUsd: 25, kind: "digital" },
    ],
  },
];

export const GENERAL: CategoryDef = {
  label: "Local Business",
  keywords: [],
  descriptor: "an independent local business",
  nameNoun: "Co.",
  craft: "Orders are handled personally by the owner.",
  taglines: ["Independent and local{in}.", "Small business, big care.", "Open for business{in}."],
  palettes: [P("#2B59C3", "#F5B700", "#0F1D3D", "#F6F8FC"), P("#2E7D32", "#FFB300", "#10260F", "#F7F9F4")],
  offers: [
    { title: "Starter package", description: "Our most popular option for first-time customers.", priceUsd: 25, kind: "service" },
    { title: "Consultation", description: "A 30-minute conversation about what you need.", priceUsd: 40, kind: "booking" },
    { title: "Gift card", description: "A gift card redeemable for anything we offer.", priceUsd: 25, kind: "digital" },
  ],
};

export const CATEGORY_LABELS = [...CATEGORIES.map((c) => c.label), GENERAL.label];

export function categoryByLabel(label: string): CategoryDef {
  return CATEGORIES.find((c) => c.label.toLowerCase() === label.toLowerCase()) ?? GENERAL;
}
