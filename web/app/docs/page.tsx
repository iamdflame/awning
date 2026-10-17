import type { Metadata } from "next";
import { DOCS, type DocGroup } from "@/lib/docs/catalog";
import { renderDoc } from "@/lib/docs/render";
import { SiteFooter, SiteHeader } from "../site-chrome";
import "./docs.css";

export const dynamic = "force-static";

export function generateMetadata(): Metadata {
  return {
    title: "Docs",
    description: "Awning's documentation: the product spec, architecture, API reference, PayBox plugin, threat model, security policy, business plan, roadmap, terms and privacy.",
    alternates: { canonical: "/docs" },
    openGraph: { title: "Awning docs", url: "/docs", images: [{ url: "/og.png", width: 1200, height: 630 }] },
  };
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10h11M11 5.5 15.5 10 11 14.5" />
    </svg>
  );
}

const GROUPS: { id: DocGroup; title: string; lede: string }[] = [
  {
    id: "builders",
    title: "For builders.",
    lede: "For agent developers, PayBox reviewers and anyone checking our work: what the system does, how it is put together, every endpoint and tool, and where it could break.",
  },
  {
    id: "business",
    title: "For the business.",
    lede: "How Awning makes money and where it goes next, and the terms owners, buyers and callers agree to.",
  },
];

const START = [
  { href: "/docs/spec", q: "New to Awning?", a: "Start with the product specification." },
  { href: "/docs/plugin", q: "Building an agent that buys?", a: "Read the plugin tools, then the API reference." },
  { href: "/docs/threat-model", q: "Reviewing how money is kept safe?", a: "The threat model names every mitigation and gap." },
];

export default function DocsHome() {
  const stats = new Map(DOCS.map((d) => [d.slug, renderDoc(d)]));
  return (
    <>
      <SiteHeader current="docs" />
      <main id="main">
        <section className="dx-hero">
          <div className="wrap dx-hero-grid">
            <div>
              <p className="dx-eyebrow">Documentation</p>
              <h1 className="display dx-h1">How Awning works, written down.</h1>
              <p className="lede">
                Ten documents, kept next to the code they describe: what Awning does, how a sentence becomes a shop, how an agent pays for one, how the money
                stays safe, and the terms everyone agrees to.
              </p>
            </div>
            <nav className="dx-route" aria-label="Where to start">
              <p className="dx-route-k">Where to start</p>
              <ol>
                {START.map((s) => (
                  <li key={s.href}>
                    <a href={s.href}>
                      <span>
                        <b>{s.q}</b>
                        <small>{s.a}</small>
                      </span>
                      <Arrow />
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </section>

        {GROUPS.map((g) => (
          <section key={g.id} className={`dx-group dx-${g.id}`} aria-labelledby={`${g.id}-h`}>
            <div className="wrap">
              <div className="dx-head">
                <h2 id={`${g.id}-h`} className="display h2">
                  {g.title}
                </h2>
                <p>{g.lede}</p>
              </div>
              <ul className="dx-shelf">
                {DOCS.filter((d) => d.group === g.id).map((d, i) => {
                  const r = stats.get(d.slug)!;
                  return (
                    <li key={d.slug}>
                      <a href={d.route}>
                        <span className="dx-n">{String(i + 1).padStart(2, "0")}</span>
                        <span>
                          <span className="dx-t">{d.title}</span>
                          <span className="dx-b">{d.blurb}</span>
                          <span className="dx-meta">
                            {r.minutes} min read, {r.toc.length} sections
                          </span>
                        </span>
                        <span className="dx-go">
                          <Arrow />
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ))}

        <section className="dx-live" aria-labelledby="live-h">
          <div className="wrap dx-live-grid">
            <div>
              <h2 id="live-h">Rather see it running?</h2>
              <p>The status page shows the same health check as <code>GET /v1/health</code>, in plain words. The live feed shows every opening and sale, with its transaction on Base.</p>
            </div>
            <p className="dx-live-links">
              <a className="btn btn-ghost" href="/status">
                System status
              </a>
              <a className="btn btn-ghost" href="/live">
                Live feed
              </a>
              <a className="btn btn-primary" href="/#open">
                Open yours
              </a>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
