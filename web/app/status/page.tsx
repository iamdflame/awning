import type { Metadata } from "next";
import { CopyLine } from "../copy-line";
import { env } from "@/lib/env";
import { healthReport } from "@/lib/health";
import { describeHealth, type StatusRow, type Tone } from "@/lib/status";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { AutoRefresh } from "./refresh";
import "./status.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function generateMetadata(): Metadata {
  return {
    title: "Status",
    description: "Is Awning open? The database, payments, refunds, Pro and every provider, from the same health check as GET /v1/health, in plain words.",
    alternates: { canonical: "/status" },
    openGraph: { title: "Awning status", url: "/status", images: [{ url: "/og.png", width: 1200, height: 630 }] },
  };
}

const TONE_WORD: Record<Tone, string> = { ok: "Working", warn: "Working, with a caveat", down: "Not working", off: "Not configured" };

/** "06:21:04 UTC" */
function clock(d: Date): string {
  return `${[d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()].map((n) => String(n).padStart(2, "0")).join(":")} UTC`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function when(iso: string | null, now: number): { ago: string; at: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
  const ago =
    s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`;
  const at = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
  return { ago, at };
}

function Row({ r }: { r: StatusRow }) {
  return (
    <li className={`st-row is-${r.tone}`}>
      <span className="st-dot" aria-hidden="true" />
      <h3>{r.label}</h3>
      <span className="st-state">
        <span className="sr-only">{TONE_WORD[r.tone]}: </span>
        {r.state}
      </span>
      <p>{r.detail}</p>
    </li>
  );
}

export default async function StatusPage() {
  const report = await healthReport();
  const v = describeHealth(report);
  const now = new Date();
  const lastOpen = when(v.lastOpenAt, now.getTime());
  const lastSale = when(v.lastOrderAt, now.getTime());
  const healthUrl = `${env.apiUrl()}/v1/health`;

  return (
    <>
      <SiteHeader current="status" />
      <main id="main" className={`st st-${v.tone}`}>
        <section className="st-hero">
          <div className="wrap st-hero-grid">
            <div className="st-hero-text">
              <p className="st-eyebrow">
                <span className="st-pulse" aria-hidden="true" />
                <span>
                  Checked at <time dateTime={now.toISOString()}>{clock(now)}</time>. Refreshes every 30 s.
                </span>
              </p>
              <h1 className="display st-h1">{v.headline}</h1>
              <p className="lede">{v.summary}</p>
            </div>
            <div className="st-signpost" role="img" aria-label={`The sign on the door reads ${v.sign}${v.note ? `, with a note: ${v.note}` : ""}`}>
              <span className="st-bracket" aria-hidden="true" />
              <div className="st-sign" aria-hidden="true">
                <svg className="st-chain" viewBox="0 0 120 64">
                  <path d="M18 64 60 6l42 58" fill="none" stroke="currentColor" strokeWidth="3" />
                  <circle cx="60" cy="6" r="5" fill="currentColor" />
                </svg>
                <div className={`st-board is-${v.sign === "TEST" ? "test" : v.tone}`}>{v.sign}</div>
                {v.note && (
                  <div className="st-note">
                    <span>{v.note}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="st-checks" aria-labelledby="checks-h">
          <div className="wrap st-grid">
            <div className="st-col">
              <h2 id="checks-h" className="st-h2">
                Money and data
              </h2>
              <ul className="st-ledger">
                {v.core.map((r) => (
                  <Row key={r.key} r={r} />
                ))}
              </ul>
            </div>
            <div className="st-col">
              <h2 className="st-h2">Pro</h2>
              <div className={`st-pro is-${v.pro.tone}`}>
                <div className="st-pro-top">
                  <span className="st-dot" aria-hidden="true" />
                  <b>{v.pro.state}</b>
                </div>
                <p>{v.pro.detail}</p>
                {v.pro.tone !== "down" && (
                  <>
                    <p className="st-pro-k">What Pro includes right now</p>
                    <ul>
                      {v.pro.includes.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <h2 className="st-h2">Last activity</h2>
              <div className="st-receipt">
                <p className="st-receipt-h">
                  <span>AWNING</span>
                  <span>{clock(now)}</span>
                </p>
                <dl>
                  <dt>Last opening</dt>
                  <dd>{lastOpen ? <>{lastOpen.ago}<small>{lastOpen.at}</small></> : <>none yet</>}</dd>
                  <dt>Last sale</dt>
                  <dd>{lastSale ? <>{lastSale.ago}<small>{lastSale.at}</small></> : <>none yet</>}</dd>
                </dl>
                <a href="/live">Every opening and sale, live</a>
              </div>
            </div>
          </div>
        </section>

        <section className="st-providers" aria-labelledby="prov-h">
          <div className="wrap">
            <div className="st-head">
              <h2 id="prov-h" className="display h2">
                Who does the work.
              </h2>
              <p>
                Every provider sits behind an adapter. With its keys set, the real provider runs. Without them a stand-in runs and nothing real happens, so it
                shows here as not configured.
              </p>
            </div>
            <ul className="st-ledger st-ledger-2">
              {v.providers.map((r) => (
                <Row key={r.key} r={r} />
              ))}
            </ul>
          </div>
        </section>

        <section className="st-machine" aria-labelledby="mach-h">
          <div className="wrap st-machine-grid">
            <div>
              <h2 id="mach-h">Monitoring Awning from a script?</h2>
              <p>
                This page is <code>GET /v1/health</code> in plain words. The endpoint answers 200 when everything essential works and 503 when it doesn’t, with
                the same checks as JSON. Fields are in the <a href="/docs/api#get-v1health">API reference</a>.
              </p>
            </div>
            <CopyLine text={`curl -s ${healthUrl}`} label="Copy" className="st-copy" />
          </div>
        </section>
      </main>
      <SiteFooter />
      <AutoRefresh seconds={30} />
    </>
  );
}
