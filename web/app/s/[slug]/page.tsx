import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { businessUrl, env } from "@/lib/env";
import { atomicToUsdString } from "@/lib/money";
import { getBusinessByDomain, getBusinessBySlug, offersFor } from "@/lib/services/businesses";
import { offerBuyUrl } from "@/lib/services/views";
import { CopyButton } from "./copy";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** `slug` is a business slug, or (for custom-domain hosts, via middleware) a domain name. */
async function load(param: string) {
  const key = decodeURIComponent(param).toLowerCase();
  const business = key.includes(".") ? await getBusinessByDomain(key) : await getBusinessBySlug(key);
  if (!business) return null;
  return { business, offers: await offersFor(business.id) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return { title: "Not found" };
  const { business: b } = data;
  return {
    title: { absolute: `${b.name} — ${b.tagline}` },
    description: b.description,
    robots: b.status === "live" ? undefined : { index: false },
  };
}

const KIND_LABEL: Record<string, string> = { product: "Product", service: "Service", booking: "Booking", digital: "Digital", subscription: "Subscription" };

export default async function Storefront({ params }: Props) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const { business: b, offers } = data;
  const live = b.status === "live";
  const style = {
    "--primary": b.palette.primary,
    "--accent": b.palette.accent,
    "--ink": b.palette.ink,
    "--paper": b.palette.paper,
  } as CSSProperties;
  const year = new Date().getFullYear();

  return (
    <div className="store" style={style}>
      {!live ? <div className="store-ribbon">Preview — not open yet</div> : null}
      <header className="store-hero">
        <div className="wrap">
          <span className="pill" style={{ color: "inherit", borderColor: "currentColor" }}>
            {b.category}
          </span>
          <h1>{b.name}</h1>
          <p className="tagline">{b.tagline}</p>
          <div className="meta">
            {b.city ? <span>{b.city}</span> : null}
            {b.phone ? (
              <a href={`tel:${b.phone}`} style={{ color: "inherit" }}>
                Call {b.phone}
                {b.receptionistName ? ` — ${b.receptionistName} answers` : ""}
              </a>
            ) : null}
            <span>Pay with USDC or any AI agent</span>
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="store-about">
          <p>{b.description}</p>
        </section>

        <section className="offers" aria-label="Offers">
          {offers.map((o) => {
            const price = atomicToUsdString(o.priceAtomic);
            const x402 = offerBuyUrl(b.slug, o.sku);
            const prompt = `Use Awning on PayBox to buy "${o.title}" from ${b.name} (${b.slug}).`;
            return (
              <article key={o.id} className="offer">
                <span className="pill">{KIND_LABEL[o.kind] ?? o.kind}</span>
                <h3>{o.title}</h3>
                <p style={{ margin: 0 }}>{o.description}</p>
                <div className="price">${price}</div>
                <div className="buybox">
                  <strong>Buy with your AI agent</strong>
                  {live ? (
                    <>
                      <span>Ask any agent connected to PayBox:</span>
                      <code>{prompt}</code>
                      <CopyButton text={prompt} />
                      <span className="muted">
                        x402: <span className="mono">POST {x402}</span> · {price} USDC on Base, paid to the owner&apos;s wallet.
                      </span>
                    </>
                  ) : (
                    <span className="muted">Available once {b.name} opens.</span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </main>

      <footer className="store-footer">
        <div className="wrap" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span>
            © {year} {b.name}
            {live ? ` · ${businessUrl(b).replace("https://", "")}` : ""}
          </span>
          <a href={`https://${env.rootDomain()}`}>Opened with Awning</a>
        </div>
      </footer>
    </div>
  );
}
