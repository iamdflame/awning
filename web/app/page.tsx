import type { Metadata } from "next";
import { businessUrl } from "@/lib/env";
import { errorMessage, log } from "@/lib/log";
import { atomicToUsd } from "@/lib/money";
import type { RealShop } from "@/lib/design/street";
import { listLiveBusinesses, offersForMany } from "@/lib/services/businesses";
import { recentEvents } from "@/lib/services/events";
import { HeroStreet } from "./hero-street";
import { SiteFooter, SiteHeader } from "./site-chrome";
import { OpenedToday } from "./street";
import { CopyLine } from "./copy-line";
import "./landing.css";
import "./landing-live.css";

/** Server-rendered with revalidation; the street then refreshes itself from the public API. */
export const revalidate = 30;

export const metadata: Metadata = {
  title: { absolute: "Awning: open a real business in one sentence" },
  alternates: { canonical: "/" },
};

const SIGNBOARD_FAMILIES = ["Alfa+Slab+One", "Big+Shoulders+Display:wght@800;900", "Young+Serif", "Shrikhand", "Rubik+Mono+One", "Gloock", "Bagel+Fat+One"];
const BASE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&'’.,:-! ";

/** The street's signboard faces, subset to the names on it (DIRECTION.md: landing integration notes). */
function signboardFonts(real: RealShop[]): string {
  const chars = new Set([...BASE_CHARS, ..."Mama Efua’s NIGHT OWL Fold Press Little Fig Ridge Roast Spoke & Chain Barro 250g VOLTA WASHED 15 MM", ...real.flatMap((r) => [...r.name.toUpperCase(), ...r.name])]);
  return `https://fonts.googleapis.com/css2?${SIGNBOARD_FAMILIES.map((f) => `family=${f}`).join("&")}&text=${encodeURIComponent([...chars].join(""))}&display=swap`;
}
const TEXT_FONTS = "https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;600&family=Barlow:wght@400;600;700&family=Figtree:wght@400;600&display=swap";

async function realShops(): Promise<RealShop[]> {
  // The build has no business to show; the first request after deploy renders the real street.
  if (process.env.NEXT_PHASE === "phase-production-build") return [];
  try {
    const rows = await listLiveBusinesses({ limit: 12 });
    const [offers, events] = await Promise.all([offersForMany(rows.map((r) => r.id)), recentEvents(100)]);
    const lastSale = new Map<string, number>();
    for (const e of events) if (e.type === "order" && e.amountUsd != null && !lastSale.has(e.slug)) lastSale.set(e.slug, e.amountUsd);
    return rows.map((b) => ({
      slug: b.slug,
      name: b.name,
      category: b.category,
      city: b.city,
      url: businessUrl(b),
      tagline: b.tagline,
      palette: b.palette,
      offers: (offers.get(b.id) ?? []).map((o) => ({ title: o.title, priceUsd: atomicToUsd(o.priceAtomic) })),
      openedAt: b.openedAt ? b.openedAt.toISOString() : null,
      lastSaleUsd: lastSale.get(b.slug) ?? null,
    }));
  } catch (err) {
    log.warn("landing: live businesses unavailable", { error: errorMessage(err) });
    return [];
  }
}

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export default async function Landing() {
  const real = await realShops();
  const now = new Date().toISOString();
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={signboardFonts(real)} precedence="default" />
      <link rel="stylesheet" href={TEXT_FONTS} precedence="default" />
      <SiteHeader home />

      <main id="main">
        {/* ============ HERO: the product working ============ */}
        <section className="hero" aria-labelledby="h1">
          <div className="hero-top">
            <h1 id="h1" className="display">
              <span>Open for business</span> <span>in one sentence.</span>
            </h1>
            <div className="hero-copy">
              <p className="lede">
                Tell your AI agent what you sell. Awning opens it for real: a domain, a storefront, a phone that answers and a checkout that pays your
                wallet. Other agents can shop there too.
              </p>
              <div className="ctas">
                <a className="btn btn-primary" href="#open">
                  Open yours
                </a>
                <a className="btn btn-ghost" href="#live">
                  See what opened today
                </a>
              </div>
            </div>
          </div>
          <HeroStreet />
          <p className="works wrap">
            A PayBox plugin. Works in <b>Claude</b>, <b>ChatGPT</b> and any agent with PayBox.
          </p>
        </section>

        {/* ============ HOW IT WORKS: three beats ============ */}
        <section className="how" id="how" aria-labelledby="how-h">
          <div className="wrap">
            <div className="head">
              <h2 id="how-h" className="display h2">
                Say it. Tap once. You’re open.
              </h2>
              <p>No builder, no forms, no merchant account. The whole opening happens inside the chat you already use, and your money never passes through us.</p>
            </div>
            <ol className="beats">
              <li className="beat">
                <div className="vis" aria-hidden="true">
                  <div className="say">
                    <div className="bub">Start a business: Ridge Roast, small-batch coffee from Accra. Ship bags and sell a $5 tasting.</div>
                    <div className="plan">
                      <div className="t">awning_plan</div>
                      <dl>
                        <dt>ridgeroast.co</dt>
                        <dd>free, 11.98/yr</dd>
                        <dt>Storefront + 3 offers</dt>
                        <dd>drafted</dd>
                        <dt>Phone + receptionist</dt>
                        <dd>Ama</dd>
                        <dt className="sum">To open</dt>
                        <dd className="sum">19.00 USDC</dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <span className="n">1</span>
                <h3>Say what you sell</h3>
                <p>One sentence. Your agent comes back with a name, a domain that’s free to register, three offers, a phone line and one price.</p>
              </li>
              <li className="beat">
                <div className="vis" aria-hidden="true">
                  <div className="sheet">
                    <div className="grab" />
                    <small>PayBox approval</small>
                    <div className="amt">19.00 USDC</div>
                    <div className="to">to Awning, for ridgeroast.co + phone line</div>
                    <div className="pk">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M12 11c0 3.5-1 6.5-2.5 8.5M15.5 13c0 2.5-.5 4.5-1.5 6.5M8 12a4 4 0 0 1 8-1M5 15.5a8 8 0 0 1-.5-4 7.5 7.5 0 0 1 14.5-2.5M19.5 13a17 17 0 0 1-1 5" />
                      </svg>
                      Approve with passkey
                    </div>
                  </div>
                </div>
                <span className="n">2</span>
                <h3>Approve once</h3>
                <p>One PayBox tap pays for the domain and the line. If any step fails, you get the money back in the same response.</p>
              </li>
              <li className="beat">
                <div className="vis" aria-hidden="true">
                  <div className="ticket">
                    <div className="k">
                      <span>ORDER #0001</span>
                      <span>RIDGE ROAST</span>
                    </div>
                    <h4>Saturday tasting</h4>
                    <p className="by">Booked by ChatGPT, for someone in Accra</p>
                    <div className="amt">
                      <b>+5.00</b>
                      <span>
                        USDC to
                        <br />
                        0x7a3F…9c21
                      </span>
                    </div>
                  </div>
                </div>
                <span className="n">3</span>
                <h3>Meet your first customer</h3>
                <p>People call or click. Agents find you in the Awning directory and pay your wallet directly. Often, the first one is an AI.</p>
              </li>
            </ol>
          </div>
        </section>

        {/* ============ OPENED TODAY: the street (real businesses first, examples marked) ============ */}
        <OpenedToday initial={real} now={now} />

        {/* ============ FOR AGENTS: in the shop owner's words; the developer detail lives on /for-agents ============ */}
        <section className="agents" id="agents" aria-labelledby="agents-h">
          <div className="wrap grid">
            <div className="intro">
              <h2 id="agents-h" className="display h2">
                The first customer was an AI.
              </h2>
              <p className="lede">
                Every Awning business is born ready for AI shoppers. It’s listed the minute it opens, every price is readable by any agent, and checkout pays
                your wallet directly. An agent with PayBox can find you and buy, with one tap from the person it works for.
              </p>
              <p className="pull">Agents already have wallets. Now they have somewhere to spend them.</p>
            </div>
            <div className="board">
              <h3>What it looks like from the customer’s side</h3>
              <div className="convo" aria-label="Example: ChatGPT buys from Ridge Roast">
                <div className="u">Find a coffee tasting in Accra and book one for Saturday.</div>
                <div className="a">
                  Found one at Ridge Roast: the Saturday tasting, <b>$5</b>. I’ll ask you to approve it.
                </div>
                <div className="u">Approved.</div>
                <div className="a">
                  Paid. Order <b>#0001</b> is booked, and Ridge Roast will confirm the time with you. The $5 went straight to the roaster’s wallet.
                </div>
              </div>
              <a className="devnote" href="/for-agents">
                <span>
                  <b>Building an agent?</b> Nine plugin tools, two pay endpoints and a public API, on one page.
                </span>
                <span className="go" aria-hidden="true">
                  For agents
                </span>
              </a>
            </div>
          </div>
        </section>

        {/* ============ PRICING: price tags ============ */}
        <section className="pricing" id="pricing" aria-labelledby="pricing-h">
          <div className="wrap">
            <div className="head">
              <h2 id="pricing-h" className="display h2">
                Two price tags. No cut of your sales.
              </h2>
              <p className="lede">Customers pay your wallet directly, so there’s nothing for us to skim. You pay Awning for the domain and the line, with one tap in PayBox.</p>
            </div>
            <div className="tags">
              <div className="tagwrap">
                <span className="string" aria-hidden="true" />
                <article className="tag">
                  <h3>Free</h3>
                  <div className="price">$0</div>
                  <p className="note">Open in one sentence, right now.</p>
                  <ul>
                    <li>
                      {CHECK}A storefront at <b>yourname.awning.sh</b>
                    </li>
                    <li>{CHECK}Checkout that pays your own wallet</li>
                    <li>{CHECK}Listed for every agent to find</li>
                    <li>{CHECK}Add offers any time, by asking</li>
                  </ul>
                  <a className="btn btn-ghost" href="#open">
                    Open free
                  </a>
                </article>
              </div>
              <div className="tagwrap">
                <span className="string" aria-hidden="true" />
                <article className="tag pro">
                  <h3>Pro</h3>
                  <div className="price">
                    $9<small>/month</small>
                  </div>
                  <p className="note">plus your domain at cost, from about $12 a year</p>
                  <ul>
                    <li>{CHECK}Your own domain, registered and connected</li>
                    <li>{CHECK}A phone number for the business</li>
                    <li>{CHECK}An AI receptionist who answers any hour and takes messages</li>
                    <li>{CHECK}Everything in Free</li>
                  </ul>
                  <a className="btn btn-canvas" href="#open">
                    Open with a domain
                  </a>
                </article>
              </div>
            </div>
            <p className="fine">Prices in US dollars. If a domain or a number can’t be set up, the whole payment comes back in the same response.</p>
          </div>
        </section>

        {/* ============ TRUST ============ */}
        <section className="trust" id="trust" aria-labelledby="trust-h">
          <div className="wrap grid">
            <div className="copy">
              <h2 id="trust-h" className="display h2">
                Your money never passes through us.
              </h2>
              <ul className="vows">
                <li>
                  <span className="ic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 7h15a3 3 0 0 1 3 3v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 0 2.5-3H17v3M16.5 14h.01" />
                    </svg>
                  </span>
                  <div>
                    <h3>Sales land in your wallet</h3>
                    <p>Every checkout pays the owner’s own address. Awning never holds a customer’s money, not even for a second.</p>
                  </div>
                </li>
                <li>
                  <span className="ic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 11V6.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V12m0-1a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7l-2.6-4.2a1.5 1.5 0 0 1 2.4-1.8L9 15" />
                    </svg>
                  </span>
                  <div>
                    <h3>One tap per payment</h3>
                    <p>Opening, buying, upgrading: each one waits for a PayBox approval from a person. No standing permissions.</p>
                  </div>
                </li>
                <li>
                  <span className="ic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" />
                    </svg>
                  </span>
                  <div>
                    <h3>Pay only if it opens</h3>
                    <p>If the domain, the line or anything else fails after you pay, you’re refunded in the same response, with the transaction to prove it.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="ledger" aria-label="An example receipt">
              <h4>Receipt for order #0001</h4>
              <p className="sub">Saturday tasting at ridgeroast.co (example)</p>
              <dl>
                <dt>Paid by</dt>
                <dd>agent wallet 0x52c1…e0b4</dd>
                <dt>Paid to</dt>
                <dd>
                  <span className="hl">Ridge Roast 0x7a3F…9c21</span>
                </dd>
                <dt>Awning’s cut</dt>
                <dd>0.00</dd>
                <dt>Network</dt>
                <dd>USDC on Base</dd>
                <dt>Approved</dt>
                <dd>1 tap, passkey</dd>
              </dl>
              <hr />
              <div className="big">
                <span>Total</span>
                <b>5.00</b>
              </div>
              <hr />
              <a href="/live">Every real sale is on the live feed, with its transaction</a>
            </div>
          </div>
        </section>

        {/* ============ FINAL ============ */}
        <section className="final" id="open" aria-labelledby="open-h">
          <div className="canopy" aria-hidden="true" />
          <div className="wrap in">
            <h2 id="open-h" className="display">
              Open yours in one sentence.
            </h2>
            <div className="side">
              <p>Add Awning to PayBox, then tell your agent what you sell.</p>
              <CopyLine text="Start a business: [name], [what you sell] in [city]." />
              <a className="btn btn-primary" href="https://app.paybox.sh">
                Add Awning to PayBox
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
