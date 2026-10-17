import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { businessUrl } from "@/lib/env";
import { atomicToUsdString } from "@/lib/money";
import { displayDomain, usd } from "@/lib/design/storefront";
import { structureFor, themeFrom } from "@/lib/design/theme";
import { listLiveBusinesses, offersForMany } from "@/lib/services/businesses";
import { SiteFooter, SiteHeader } from "../site-chrome";
import "./directory.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Directory",
  description: "Every business open on Awning, with its prices. Any AI agent with PayBox can buy from them.",
  alternates: { canonical: "/directory" },
};

const FONTS =
  "https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Big+Shoulders+Display:wght@800;900&family=Young+Serif&display=swap";

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: rawQ } = await searchParams;
  const q = (rawQ ?? "").slice(0, 120);
  const rows = await listLiveBusinesses({ q, limit: 60 });
  const offers = await offersForMany(rows.map((r) => r.id));
  const shops = rows.map((b) => {
    const list = offers.get(b.id) ?? [];
    const s = structureFor({ category: b.category, name: b.name, tagline: b.tagline, offers: list });
    const t = themeFrom(b.palette, s.hero);
    return { b, list, s, t };
  });

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={FONTS} precedence="default" />
      <SiteHeader current="directory" />
      <main id="main" className="dir">
        <section className="dir-top">
          <div className="wrap dir-top-grid">
            <div>
              <h1 className="display dir-h1">The whole street.</h1>
              <p className="lede">
                Every business open on Awning, with its prices. Walk into any of them, or ask your agent to buy: each one takes payment straight to its owner.
              </p>
            </div>
            <form className="dir-search" action="/directory" role="search">
              <label htmlFor="dir-q">Search shops and offers</label>
              <div>
                <input id="dir-q" name="q" defaultValue={q} placeholder="coffee, bike repair, Lisbon…" autoComplete="off" />
                <button type="submit" className="btn btn-primary">
                  Search
                </button>
              </div>
              {q ? (
                <a className="dir-clear" href="/directory">
                  Show every shop
                </a>
              ) : null}
            </form>
          </div>
        </section>

        <section className="dir-list" aria-label={q ? `Shops matching ${q}` : "Every shop"}>
          <div className="wrap">
            {shops.length === 0 ? (
              <div className="dir-empty">
                <div className="dir-lot" aria-hidden="true">
                  <span>{q ? "No match" : "This lot is free"}</span>
                </div>
                <div>
                  <h2>{q ? `Nothing on the street matches “${q}”.` : "Nothing opened yet today."}</h2>
                  <p className="lede">{q ? "Try a shorter word, a city, or what you want to buy." : "Be the first shop on the street: tell your agent what you sell."}</p>
                  <a className="btn btn-primary" href={q ? "/directory" : "/#open"}>
                    {q ? "Show every shop" : "Open yours"}
                  </a>
                </div>
              </div>
            ) : (
              <>
                <p className="dir-count">
                  {shops.length} {shops.length === 1 ? "shop" : "shops"}
                  {q ? ` matching “${q}”` : " open"}
                </p>
                <ul className="dir-grid">
                  {shops.map(({ b, list, s, t }) => (
                    <li key={b.slug}>
                      <a
                        className={`dir-card c-${s.canopy}`}
                        href={businessUrl(b)}
                        style={{ "--ground": t.ground, "--ink": t.ink, "--stripeA": t.stripeA, "--stripeB": t.stripeB, "--accent": t.accent, "--deep": t.deep, "--disp": `"${s.display}"`, "--dw": s.hero === "poster" ? 900 : 400 } as CSSProperties}
                      >
                        <span className="dir-canopy" aria-hidden="true" />
                        <span className="dir-body">
                          <span className="dir-meta">
                            {b.category}
                            {b.city ? `, ${b.city}` : ""}
                          </span>
                          <span className={s.hero === "poster" ? "dir-name up" : "dir-name"}>{b.name}</span>
                          <span className="dir-tag">{b.tagline}</span>
                          <span className="dir-offers">
                            {list.slice(0, 3).map((o) => (
                              <span key={o.sku} className="dir-offer">
                                <span>{o.title}</span>
                                <b>{usd(atomicToUsdString(o.priceAtomic))}</b>
                              </span>
                            ))}
                          </span>
                          <span className="dir-foot">
                            <span>{displayDomain(b)}</span>
                            {b.salesCount > 0 ? <span>{b.salesCount === 1 ? "1 sale" : `${b.salesCount} sales`}</span> : <span>Agent-payable</span>}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
