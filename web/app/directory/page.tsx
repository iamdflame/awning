import type { Metadata } from "next";
import { listLiveBusinesses, offersForMany } from "@/lib/services/businesses";
import { directoryEntryView } from "@/lib/services/views";
import { SiteFooter, SiteHeader } from "../site-chrome";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Directory", description: "Every business on Awning. Any AI agent with PayBox can buy from them." };

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  const rows = await listLiveBusinesses({ q, category, limit: 60 });
  const offers = await offersForMany(rows.map((r) => r.id));
  const list = rows.map((b) => directoryEntryView(b, offers.get(b.id) ?? []));
  return (
    <>
      <SiteHeader />
      <main className="wrap section">
        <h1>Directory</h1>
        <p className="muted">Every live business on Awning. Each one is agent-payable: ask your agent to buy from it with PayBox.</p>
        <form className="search" action="/directory">
          <input name="q" defaultValue={q ?? ""} placeholder="Search coffee, braids, tutoring, Accra…" aria-label="Search businesses" />
          <button type="submit">Search</button>
        </form>
        {list.length === 0 ? (
          <p className="muted">{q ? `No businesses match “${q}”.` : "No businesses yet."}</p>
        ) : (
          <div className="grid">
            {list.map((b) => (
              <div key={b.slug} className="card">
                <span className="pill">
                  {b.category}
                  {b.city ? ` · ${b.city}` : ""}
                </span>
                <h3>
                  <a href={b.url}>{b.name}</a>
                </h3>
                <span className="muted">{b.tagline}</span>
                <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
                  {b.offers.slice(0, 4).map((o) => (
                    <li key={o.sku}>
                      {o.title} — <span className="mono">${o.priceUsd.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <span className="mono muted">
                  {b.phone ? `${b.phone} · ` : ""}
                  {b.salesCount} sales
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
