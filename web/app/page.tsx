import Link from "next/link";
import { atomicToUsdString } from "@/lib/money";
import { listLiveBusinesses, offersForMany, stats } from "@/lib/services/businesses";
import { directoryEntryView } from "@/lib/services/views";
import { SiteFooter, SiteHeader } from "./site-chrome";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const [s, rows] = await Promise.all([stats(), listLiveBusinesses({ limit: 6 })]);
  const offers = await offersForMany(rows.map((r) => r.id));
  const latest = rows.map((b) => directoryEntryView(b, offers.get(b.id) ?? []));
  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <section className="hero">
          <h1>One sentence. A real business.</h1>
          <p>
            Awning is a PayBox plugin that turns one sentence into a business you can buy from — a real domain, a storefront, a phone line with an
            AI receptionist, and a checkout that pays the owner&apos;s own wallet. Every business is listed so any PayBox agent can buy from it.
          </p>
          <div className="stats">
            <div className="stat">
              <b>{s.businesses}</b>
              <span className="muted">businesses open</span>
            </div>
            <div className="stat">
              <b>{s.orders}</b>
              <span className="muted">agent purchases</span>
            </div>
            <div className="stat">
              <b>{atomicToUsdString(s.toOwnersAtomic)}</b>
              <span className="muted">USDC to owners</span>
            </div>
          </div>
          <p className="muted">
            <Link href="/live">Watch businesses open live →</Link>
          </p>
        </section>
        <section className="section">
          <h2>Recently opened</h2>
          {latest.length === 0 ? (
            <p className="muted">No businesses yet. Open the first one from your agent: “Start a business: …”.</p>
          ) : (
            <div className="grid">
              {latest.map((b) => (
                <a key={b.slug} className="card" href={b.url} style={{ textDecoration: "none" }}>
                  <span className="pill">{b.category}</span>
                  <h3>{b.name}</h3>
                  <span className="muted">{b.tagline}</span>
                  <span className="mono">{b.offers.length} offers · {b.salesCount} sales</span>
                </a>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
