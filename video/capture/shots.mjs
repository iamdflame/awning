// The film's product shots. Viewport 1536×864 CSS px (a 1920×1080 window at 125%, like the founder's
// recordings); stepped captures are 3072×1728 so the film can push in without going soft.
// Times are seconds from the first frame. Cursor keys are [t, x, y, ease]; scroll keys are [t, y | anchor, ease].
//
// "where": live = always from https://awning.sh; shop = a storefront (a real one when it exists on
// awning.sh, otherwise the local mock build); local = needs data only the local mock build has today.

/** awning.sh: the hero street. Starts frozen at page load so the canopy unroll and the whole opening
 *  play from frame 0: the sentence is lettered on the hoarding, the receipt prints, the hoarding lifts,
 *  the awning unrolls, the OPEN sign flips. */
export const landingHero = {
  id: "landing-hero",
  where: "live",
  path: "/",
  startFrozen: true,
  duration: 13,
  scroll: [[0, 0], [1.6, 0], [3.4, { sel: ".hstreet", align: "bottom", offset: 6 }, "glide"]],
  stills: [{ at: 0.2, name: "landing-top" }, { at: 7.6, name: "landing-open" }, { at: 12.5, name: "landing-sold" }],
};

/** awning.sh/for-agents: "Every shop here is an API." and the x402 receipt, then down to the tool board. */
export const forAgents = {
  id: "for-agents",
  where: "live",
  path: "/for-agents",
  duration: 8,
  settle: 2200,
  cursor: [[0, 1560, 760], [1.2, 1180, 600, "out"], [3.0, 1210, 640, "inOut"]],
  scroll: [[0, 0], [3.4, 0], [7.2, 760, "glide"]],
  stills: [{ at: 0.5, name: "for-agents-top" }, { at: 7.9, name: "for-agents-tools" }],
};

/** awning.sh/directory: the street of every shop, then a search for "coffee". */
export const directory = {
  id: "directory",
  where: "local",
  path: "/directory",
  duration: 7,
  settle: 1800,
  cursor: [[0, 1450, 820], [1.4, 1010, 452, "out"], [1.55, 1010, 452], [5.2, 1010, 452], [6.2, 1226, 452, "inOut"]],
  actions: [
    { at: 1.5, press: true },
    { at: 1.62, press: false },
    { at: 1.6, type: { selector: "#dir-q", text: "coffee", cps: 9 } },
    { at: 6.3, press: true },
    { at: 6.42, press: false },
  ],
  scroll: [[0, 0], [7, 0]],
  stills: [{ at: 1.0, name: "directory-top" }, { at: 6.0, name: "directory-typed" }],
};

/** awning.sh/directory?q=coffee: the result, then a glide down over the shop's card. */
export const directoryResults = {
  id: "directory-results",
  where: "local",
  path: "/directory?q=coffee",
  duration: 5,
  settle: 1600,
  cursor: [[0, 1226, 452], [2.0, 700, 760, "inOut"]],
  scroll: [[0, 0], [0.6, 0], [3.6, { sel: ".dir-list", offset: -40 }, "glide"]],
  stills: [{ at: 4.8, name: "directory-results" }],
};

/** awning.sh/live: the receipt that keeps printing. Local: a sale lands while we film, so the new
 *  SOLD line prints at the top on the next 3 s poll. Live: the page load prints every line. */
export const live = {
  id: "live",
  where: "local",
  path: "/live",
  startFrozen: true,
  duration: 9,
  cursor: [[0, 1520, 840], [5.4, 1520, 840], [6.8, 1090, 512, "out"], [9, 1100, 516]],
  actions: [{ at: 1.0, sale: true }],
  scroll: [[0, 0], [9, 0]],
  stills: [{ at: 8.8, name: "live-feed" }],
};

/** A live storefront from the hero to the "Buy with your AI agent" slip. The cursor picks the
 *  tasting (the page points the slip at it), then the page glides down to the slip. */
export const storefront = {
  id: "storefront",
  where: "shop",
  shop: "ridge-roast",
  duration: 10,
  settle: 2000,
  // the offer button of the tasting (else the last offer), measured on the page before filming
  points: (page) =>
    page.evaluate(() => {
      const picks = [...document.querySelectorAll("[data-sku]")];
      const row = (el) => el.closest("li,tr,article,div") ?? el;
      const pick = picks.find((el) => /tast/i.test(row(el).textContent || "")) ?? picks[picks.length - 1];
      if (!pick) return {};
      const r = pick.getBoundingClientRect();
      return { book: { x: Math.round(r.left + r.width * 0.55), y: Math.round(r.top + r.height * 0.55) } };
    }),
  cursor: [[0, 1480, 820], [2.2, "book", "inOut"], [3.0, "book"], [8.6, 1180, 560, "inOut"]],
  actions: [{ at: 2.4, press: true }, { at: 2.55, press: false }, { at: 2.5, clickPoint: "book" }],
  scroll: [[0, 0], [3.0, 0], [6.4, { sel: "#agent", offset: -40 }, "glide"]],
  stills: [{ at: 0.6, name: "storefront-hero" }, { at: 9.6, name: "storefront-slip" }],
};

/** A draft storefront: the caution-tape ribbon, the kraft paper and "Opening soon". */
export const draft = {
  id: "draft",
  where: "shop",
  shop: "ridge-roast-2",
  draft: true,
  duration: 5,
  settle: 2000,
  scroll: [[0, 0], [1.0, 0], [5, 220, "glide"]],
  stills: [{ at: 0.5, name: "draft-top" }],
};

export const SHOTS = [landingHero, forAgents, directory, directoryResults, live, storefront, draft];
