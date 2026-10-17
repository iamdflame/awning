import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { cache, type CSSProperties, type ReactNode } from "react";
import { businessUrl } from "@/lib/env";
import { buildStoreView, usd, type StoreOffer, type StoreView } from "@/lib/design/storefront";
import { getBusinessByDomain, getBusinessBySlug, offersFor } from "@/lib/services/businesses";
import { imagesFor } from "@/lib/services/images";
import { StoreClient } from "./store-client";
import "./storefront.css";
import "./storefront-live.css";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** `slug` is a business slug, or (for custom-domain hosts, via middleware) a domain name. */
const load = cache(async (param: string) => {
  const key = decodeURIComponent(param).toLowerCase();
  const business = key.includes(".") ? await getBusinessByDomain(key) : await getBusinessBySlug(key);
  if (!business) return null;
  const [offers, photos] = await Promise.all([offersFor(business.id), imagesFor(business.id).catch(() => ({}))]);
  return { business, view: buildStoreView(business, offers, photos) };
});

function favicon(v: StoreView): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${v.theme.accent}"/><text x="32" y="45" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="38" fill="${v.theme.onAccent}">${(v.name.trim()[0] ?? "A").toUpperCase().replace(/[<&>"]/g, "")}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return { title: { absolute: "Shop not found" }, robots: { index: false } };
  const { business: b, view: v } = data;
  const where = v.city ? ` in ${v.city}` : "";
  const title = v.status === "draft" ? `${v.name} (preview)` : v.status === "suspended" ? `${v.name} (closed for review)` : `${v.name}, ${v.category.toLowerCase()}${where}`;
  const description = v.status === "suspended" ? `${v.name} is closed while Awning reviews a report.` : `${v.tagline} ${v.about}`.slice(0, 200);
  const url = businessUrl(b);
  return {
    title: { absolute: title },
    description,
    robots: v.status === "live" ? undefined : { index: false, follow: false },
    alternates: v.status === "live" ? { canonical: url } : undefined,
    applicationName: v.name,
    manifest: null,
    icons: { icon: [{ url: favicon(v), type: "image/svg+xml" }], apple: [] },
    openGraph: { type: "website", title, description, url, siteName: v.name },
    twitter: { card: "summary_large_image", title, description },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const data = await load((await params).slug);
  return { width: "device-width", initialScale: 1, themeColor: data ? data.view.theme.ink : "#003b23" };
}

const PHONE_ICO = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
  </svg>
);

const MARK = (
  <svg viewBox="4 10 56 36" aria-hidden="true">
    <path d="M9 11.5h46a2.5 2.5 0 0 1 0 5H9a2.5 2.5 0 0 1 0-5Z" fill="currentColor" />
    <path d="M15 18 4 34a5.6 5.6 0 0 0 11.2 0l7.6-16Zm15.6 0-4.2 16a5.6 5.6 0 0 0 11.2 0l-4.2-16Zm15.6 0 7.6 16a5.6 5.6 0 0 0 11.2 0L49 18Z" fill="currentColor" />
  </svg>
);

/** The business's theme as :root variables (storefront.css reads everything from them). */
function rootStyle(v: StoreView): string {
  const t = v.theme;
  const vars: [string, string][] = [
    ["--ground", t.ground],
    ["--ink", t.ink],
    ["--accent", t.accent],
    ["--accent2", t.accent2],
    ["--stripeA", t.stripeA],
    ["--stripeB", t.stripeB],
    ["--deep", t.deep],
    ["--on-accent", t.onAccent],
    ["--display", `"${v.structure.display}"`],
    ["--text", `"${v.structure.text}"`],
  ];
  if (v.tile) vars.push(["--tile", v.tile]);
  return `:root{${vars.map(([k, val]) => `${k}:${val}`).join(";")}}`;
}

/** Longest word, for fitting the name to its column. */
function chars(name: string): number {
  return Math.max(4, ...name.split(/\s+/).map((w) => [...w].length));
}

function Name({ v }: { v: StoreView }) {
  if (v.structure.hero === "poster" && v.name.includes(" & ")) {
    const [a, ...rest] = v.name.split(" & ");
    return (
      <>
        {a}
        <br />
        &amp;&nbsp;{rest.join(" & ")}
      </>
    );
  }
  return <>{v.name}</>;
}

function Action({ o, draft }: { o: StoreOffer; draft: boolean }) {
  if (draft)
    return (
      <span className="b b-row" data-notify aria-disabled="true">
        Opens soon
      </span>
    );
  return (
    <a className="b b-row" href="#agent" data-sku={o.sku} data-prompt={o.prompt} data-link={o.buyUrl}>
      {o.verb}
    </a>
  );
}

function Offers({ v, draft }: { v: StoreView; draft: boolean }) {
  if (v.structure.hero === "sign") {
    const heading = v.artKind === "coffee" ? "On the bar" : /food|bakery|kitchen|cater/i.test(v.category) ? "On the menu" : "Prices";
    return (
      <div className="board" id="offers">
        <p className="board-h">{heading}</p>
        <ul>
          {v.offers.map((o) => (
            <li key={o.sku}>
              <div>
                <h3>{o.title}</h3>
                <p>{o.desc}</p>
              </div>
              <div className="pr">
                <b>{usd(o.price)}</b>
                <small>{o.unit}</small>
              </div>
              <Action o={o} draft={draft} />
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (v.structure.hero === "poster") {
    return (
      <div className="peg" id="offers">
        {v.offers.map((o, i) => (
          <div key={o.sku} className="ptag" style={{ "--r": `${[-3, 2, -1.5][i % 3]}deg` } as CSSProperties}>
            <span className="hole" />
            <h3>{o.title}</h3>
            <p>{o.desc}</p>
            <div className="pr">
              <b>{usd(o.price)}</b>
              <small>{o.unit}</small>
            </div>
            <Action o={o} draft={draft} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="labels" id="offers">
      {v.offers.map((o) => (
        <div key={o.sku} className="lab">
          <h3>{o.title}</h3>
          <p>{o.desc}</p>
          <div className="pr">
            <b>{usd(o.price)}</b>
            <small>
              {o.price.replace(/\.00$/, "")} USDC {o.unit}
            </small>
          </div>
          <Action o={o} draft={draft} />
        </div>
      ))}
    </div>
  );
}

function Art({ v }: { v: StoreView }) {
  const hero = v.photos.hero;
  if (hero)
    return (
      <div className="art has-photo">
        <figure className="photo">
          <img src={hero.url} alt="" width={hero.width} height={hero.height} fetchPriority="high" />
          <figcaption className="ill">Illustrative photo</figcaption>
        </figure>
        <div className="stamp">
          <b>
            Opening
            <br />
            soon
          </b>
        </div>
      </div>
    );
  return (
    <div className="art">
      <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: v.art }} />
      <div className="stamp">
        <b>
          Opening
          <br />
          soon
        </b>
      </div>
    </div>
  );
}

function Shell({ v, children, mode }: { v: StoreView; children: ReactNode; mode: "draft" | "live" | "closed" }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={v.fontsHref} precedence="default" />
      <style dangerouslySetInnerHTML={{ __html: rootStyle(v) }} />
      <div className={mode === "draft" ? "is-draft" : mode === "closed" ? "is-closed" : undefined}>{children}</div>
    </>
  );
}

function Footer({ v }: { v: StoreView }) {
  return (
    <footer>
      <div className="foot">
        <div className="wrap">
          <span className="name">{v.name}</span>
          <span>
            {v.domain}
            {v.city ? `, ${v.city}` : ""}
          </span>
          <a className="report" href={`/report?b=${encodeURIComponent(v.slug)}`}>
            Report this business
          </a>
        </div>
      </div>
      <a className="ribbon" href={`https://awning.sh/?ref=${encodeURIComponent(v.slug)}`}>
        {MARK}Opened with Awning <span>Open yours in one sentence</span>
      </a>
    </footer>
  );
}

function Closed({ v }: { v: StoreView }) {
  return (
    <Shell v={v} mode="closed">
      <div className="closedbar" role="status">
        <span>This shop is closed while Awning reviews a report.</span>
      </div>
      <header>
        <div className="rod">
          <div className="wrap">
            <span className="brand">{v.name}</span>
            <span className="rod-status">{v.statusLine}</span>
          </div>
        </div>
        <div className="canopy c-flat" aria-hidden="true" />
      </header>
      <main id="top">
        <section className="hero h-closed">
          <div className="wrap">
            <div className="copy">
              <h1 style={{ "--chars": chars(v.name) } as CSSProperties}>{v.name}</h1>
              <p className="closed-note">This shop is closed while Awning reviews a report.</p>
              <p className="closed-fine">
                Its checkout is paused, so nothing can be bought here right now. Payments made before go straight to the owner&apos;s wallet; Awning never
                holds them.
              </p>
            </div>
            <div className="shutter" aria-hidden="true">
              <div className="closed-sign">
                <svg viewBox="0 0 62 40">
                  <path d="M10 40 31 4l21 36" fill="none" stroke="currentColor" strokeWidth="2" />
                  <circle cx="31" cy="4" r="3.5" fill="currentColor" />
                </svg>
                <b>CLOSED</b>
              </div>
              <span className="grip" />
            </div>
          </div>
        </section>
      </main>
      <Footer v={v} />
    </Shell>
  );
}

export default async function Storefront({ params }: Props) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const v = data.view;
  if (v.status === "suspended") return <Closed v={v} />;
  const draft = v.status === "draft";
  const f = v.featured;
  const detail = v.photos.detail;

  return (
    <Shell v={v} mode={draft ? "draft" : "live"}>
      <div className="draftbar" role="status">
        <span>Preview, not open yet. Only people with this link can see it. Tell your agent “open it” to go live.</span>
      </div>
      <header>
        <div className="rod">
          <div className="wrap">
            <a className="brand" href="#top">
              {v.name}
            </a>
            <span className="rod-status">{v.statusLine}</span>
            <nav aria-label={v.name}>
              <a href="#offers">{v.navOffers}</a>
              <a href="#agent">Buy with an agent</a>
              <a href="#visit">Visit</a>
              {v.phone && v.tel ? (
                <a className="callbtn" href={`tel:${v.tel}`}>
                  {PHONE_ICO}Call {v.receptionist}
                </a>
              ) : null}
            </nav>
          </div>
        </div>
        <div className={`canopy c-${v.structure.canopy}`} aria-hidden="true" />
      </header>
      <main id="top">
        <section className={`hero h-${v.structure.hero}`}>
          <div className="wrap">
            <div className="copy">
              <h1 style={{ "--chars": chars(v.structure.hero === "poster" ? v.name.replace(" & ", " ") : v.name) } as CSSProperties}>
                <Name v={v} />
              </h1>
              <p className="tagline">{v.tagline}</p>
              {v.structure.hero === "poster" ? null : <Offers v={v} draft={draft} />}
            </div>
            <Art v={v} />
            {v.structure.hero === "poster" ? <Offers v={v} draft={draft} /> : null}
          </div>
        </section>

        <section className="agent" id="agent">
          <div className="wrap">
            <div>
              <h2>Buy with your AI agent.</h2>
              <p className="lede">
                Ask Claude, ChatGPT or any agent with PayBox. It finds {v.name}, reads the offer and asks you for one tap. Prices are in US dollars,
                paid as USDC straight to {v.name}’s own wallet.
              </p>
            </div>
            {f ? (
              <div className="slip">
                <label>Say this to your agent</label>
                <p className="prompt" id="p1">
                  “{f.prompt}”
                </p>
                <div className="row">
                  <button type="button" className="copy-btn" data-copy={f.prompt} data-copy-role="prompt">
                    Copy prompt
                  </button>
                </div>
                <hr />
                <label>Or give it the pay link (x402)</label>
                <div className="row">
                  <code className="link" id="l1">
                    {f.buyUrl}
                  </code>
                  <button type="button" className="copy-btn" data-copy={f.buyUrl} data-copy-role="link">
                    Copy link
                  </button>
                </div>
                <p className="fine">
                  {draft ? `Works once ${v.name} opens. ` : ""}Pays{" "}
                  <a href={`https://basescan.org/address/${v.wallet}`} target="_blank" rel="noreferrer" title={v.wallet}>
                    {v.walletShort}
                  </a>{" "}
                  directly, in USDC on Base. One approval per payment.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="visit" id="visit">
          <div className="wrap">
            {detail ? (
              <figure className="photo shot">
                <img src={detail.url} alt="" width={detail.width} height={detail.height} loading="lazy" />
                <figcaption className="ill">Illustrative photo</figcaption>
              </figure>
            ) : null}
            <div className="about">
              <h2>About {v.name}</h2>
              <p>{v.about}</p>
              {v.city ? <p className="addr">Based in {v.city}</p> : null}
            </div>
            <div className="hours">
              <h2>Hours</h2>
              <dl>
                <dt>Orders</dt>
                <dd>{draft ? "From opening day" : "Open 24 hours, online"}</dd>
                <dt>Agents</dt>
                <dd>Any time, one approval each</dd>
                {v.phone ? (
                  <>
                    <dt>Phone</dt>
                    <dd>Any hour</dd>
                  </>
                ) : null}
              </dl>
            </div>
            {v.phone && v.tel ? (
              <div className="phone">
                <h2>Call us</h2>
                <a href={`tel:${v.tel}`}>{v.phone}</a>
                <p>{v.receptionist}, our AI receptionist, picks up any hour, answers questions about prices and takes a message for the owner.</p>
              </div>
            ) : null}
          </div>
        </section>
      </main>
      <Footer v={v} />
      <StoreClient />
    </Shell>
  );
}
