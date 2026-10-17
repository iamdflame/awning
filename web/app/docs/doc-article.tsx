import type { Metadata } from "next";
import { DOCS, docBySlug, type Doc } from "@/lib/docs/catalog";
import { renderDoc } from "@/lib/docs/render";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { DocEnhance } from "./doc-enhance";
import "./docs.css";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10-17" → "17 October 2026" (no locale dependence between build and browser). */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

const GROUP_LABEL: Record<Doc["group"], string> = { builders: "For builders", business: "For the business" };

export function docMetadata(slug: string): Metadata {
  const doc = docBySlug(slug);
  if (!doc) return {};
  return {
    title: doc.title,
    description: doc.blurb,
    alternates: { canonical: doc.route },
    openGraph: { title: `${doc.title} · Awning`, description: doc.blurb, url: doc.route, images: [{ url: "/og.png", width: 1200, height: 630 }] },
  };
}

function Chevron({ down = false }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {down ? <path d="m5 8 5 5 5-5" /> : <path d="m8 5 5 5-5 5" />}
    </svg>
  );
}

/** A company document as a page: canopy, hero with its hanging tag, sticky contents, the text, prev/next. */
export function DocArticle({ slug }: { slug: string }) {
  const doc = docBySlug(slug);
  if (!doc) throw new Error(`unknown document ${slug}`);
  const r = renderDoc(doc);
  const i = DOCS.indexOf(doc);
  const prev = DOCS[i - 1];
  const next = DOCS[i + 1];
  const legal = doc.slug === "terms" || doc.slug === "privacy";

  const tocList = (
    <ol>
      {r.toc.map((t) => (
        <li key={t.id}>
          <a href={`#${t.id}`}>
            {t.method && <span className="dc-m">{t.method}</span>}
            {t.code ? <code>{t.text}</code> : t.text}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      <SiteHeader current="docs" />
      <main id="main" className="dc-main">
        <header className="dc-hero">
          <div className="wrap dc-hero-grid">
            <div>
              <nav className="dc-crumbs" aria-label="Breadcrumb">
                <a href="/docs">Docs</a>
                <i aria-hidden="true" />
                <span>{GROUP_LABEL[doc.group]}</span>
              </nav>
              <h1 className="display dc-h1">{doc.title}</h1>
              {r.preface.trim() ? <div className="dc-preface" dangerouslySetInnerHTML={{ __html: r.preface }} /> : <p className="dc-preface">{doc.blurb}</p>}
            </div>
            <aside className="dc-tag" aria-label="About this document">
              <div className="dc-tag-paper">
                {r.updated ? (
                  <>
                    <p className="dc-tag-k">{legal ? "Last updated" : "Current as of"}</p>
                    <p className="dc-tag-date">
                      <time dateTime={r.updated}>{longDate(r.updated)}</time>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="dc-tag-k">Reading time</p>
                    <p className="dc-tag-date">{r.minutes} min</p>
                  </>
                )}
                <dl>
                  {r.updated && (
                    <>
                      <dt>Reading time</dt>
                      <dd>{r.minutes} min</dd>
                    </>
                  )}
                  <dt>Sections</dt>
                  <dd>{r.toc.length}</dd>
                  {r.diagrams > 0 && (
                    <>
                      <dt>Diagrams</dt>
                      <dd>{r.diagrams}</dd>
                    </>
                  )}
                  <dt className="src">Source</dt>
                  <dd className="src">
                    <code>{doc.source}</code>
                  </dd>
                </dl>
              </div>
            </aside>
          </div>
        </header>

        <div className="wrap dc-layout">
          {r.toc.length > 1 && (
            <nav className="dc-toc" aria-label="On this page">
              <p className="dc-toc-k">On this page</p>
              {tocList}
            </nav>
          )}
          <div className="dc-article">
            {r.toc.length > 1 && (
              <details className="dc-toc-m">
                <summary>
                  On this page ({r.toc.length} sections)
                  <Chevron down />
                </summary>
                <nav aria-label="On this page">{tocList}</nav>
              </details>
            )}
            <article className="md" dangerouslySetInnerHTML={{ __html: r.body }} />
            <nav className="dc-pager" aria-label="More documents">
              {prev && (
                <a href={prev.route} rel="prev">
                  <small>Previous</small>
                  <b>{prev.title}</b>
                </a>
              )}
              {next && (
                <a className="next" href={next.route} rel="next">
                  <small>Next</small>
                  <b>{next.title}</b>
                </a>
              )}
            </nav>
          </div>
        </div>
      </main>
      <SiteFooter />
      <DocEnhance />
    </>
  );
}
