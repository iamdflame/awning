"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Palette } from "@/lib/db/schema";
import { buildStreet, copyForLoop, openedToday, type RealShop } from "@/lib/design/street";
import { Shop } from "./shop";

type DirEntry = { slug: string; name: string; tagline: string; category: string; city: string | null; url: string; offers: { title: string; priceUsd: number }[]; openedAt: string | null };
type LiveEvent = { type: string; slug: string; amountUsd?: number };

/** Real shops from the public API: GET /v1/businesses (+ /v1/businesses/:slug for a new shop's palette) and GET /v1/live for last sales. */
async function poll(palettes: Map<string, Palette>): Promise<RealShop[]> {
  const [dir, live] = await Promise.all([
    fetch("/v1/businesses?limit=12", { cache: "no-store" }).then((r) => (r.ok ? (r.json() as Promise<{ businesses: DirEntry[] }>) : Promise.reject(r.status))),
    fetch("/v1/live?limit=100", { cache: "no-store" }).then((r) => (r.ok ? (r.json() as Promise<{ events: LiveEvent[] }>) : { events: [] })),
  ]);
  const lastSale = new Map<string, number>();
  for (const e of live.events) if (e.type === "order" && typeof e.amountUsd === "number" && !lastSale.has(e.slug)) lastSale.set(e.slug, e.amountUsd);
  const missing = dir.businesses.filter((b) => !palettes.has(b.slug));
  await Promise.all(
    missing.map(async (b) => {
      const r = await fetch(`/v1/businesses/${encodeURIComponent(b.slug)}`, { cache: "no-store" }).catch(() => null);
      if (!r?.ok) return;
      const body = (await r.json()) as { business?: { palette?: Palette } };
      if (body.business?.palette) palettes.set(b.slug, body.business.palette);
    }),
  );
  return dir.businesses
    .filter((b) => palettes.has(b.slug))
    .map((b) => ({ slug: b.slug, name: b.name, category: b.category, city: b.city, url: b.url, tagline: b.tagline, palette: palettes.get(b.slug)!, offers: b.offers, openedAt: b.openedAt, lastSaleUsd: lastSale.get(b.slug) ?? null }));
}

/**
 * "Opened today": server-rendered from the database (revalidated every 30 s),
 * then refreshed from the public API every 30 s. Real shops first; when there
 * are fewer than the street needs, the design's sample shops fill it, each
 * marked "Example". No counters or sales that did not happen.
 */
export function OpenedToday({ initial, now: nowIso }: { initial: RealShop[]; now: string }) {
  const [real, setReal] = useState(initial);
  const [now, setNow] = useState(() => new Date(nowIso));
  const palettes = useRef(new Map(initial.map((r) => [r.slug, r.palette])));

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const next = await poll(palettes.current);
        if (alive) {
          setReal(next);
          setNow(new Date());
        }
      } catch {
        /* keep the last good street */
      }
    };
    const first = setTimeout(tick, 1200);
    const id = setInterval(tick, 30000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const shops = useMemo(() => buildStreet(real, now), [real, now]);
  const today = real.filter((r) => openedToday(r.openedAt, now)).length;
  const examples = shops.some((s) => s.example);
  const label = today > 0 ? "Opened today" : real.length > 0 ? "Recently opened" : "Nothing opened yet today";
  const foot =
    today > 0
      ? `${today} opened today${examples ? ". Shops marked Example show what each kind of business gets." : ", every sale with its receipt."}`
      : real.length > 0
        ? `Real shops first${examples ? "; shops marked Example show what each kind of business gets." : ", every sale with its receipt."}`
        : "Be the first shop on the street. Until then, shops marked Example show what each kind of business gets.";

  return (
    <section className="street-sec" id="live" aria-labelledby="live-h">
      <div className="wrap">
        <div className="head">
          <div>
            <span className={today > 0 || real.length > 0 ? "live-dot" : "live-dot is-quiet"}>
              <i />
              {label}
            </span>
            <h2 id="live-h" className="display h2">
              Every shop on this street started as one sentence.
            </h2>
          </div>
          <p className="lede">Each one gets a real domain, a phone line and a receipt for every sale. Walk into any of them.</p>
        </div>
      </div>
      <div className="street">
        <div className="row" id="row">
          {today === 0 ? <EmptyLot /> : null}
          {shops.map((s) => (
            <Shop key={s.key} s={s} />
          ))}
          {today === 0 ? <EmptyLot hidden /> : null}
          {shops.map((s) => {
            const c = copyForLoop(s);
            return <Shop key={c.key} s={c} hidden />;
          })}
        </div>
        <div className="curb" />
      </div>
      <div className="street-foot">
        <div className="wrap">
          <span id="streetCount">{foot}</span>
          <a href="/directory">Walk the whole street</a>
        </div>
      </div>
    </section>
  );
}

/** The design's empty state: one empty lot, a dashed scaffold waiting for a shop. */
function EmptyLot({ hidden = false }: { hidden?: boolean }) {
  return (
    <a className="shop lot-empty" href="#open" {...(hidden ? { tabIndex: -1, "aria-hidden": true } : {})} style={{ "--w": "270px", "--h": "330px" } as React.CSSProperties}>
      <span className="scaffold" />
      <span className="board-sign">
        <small>This lot is free</small>Your shop here
      </span>
    </a>
  );
}
