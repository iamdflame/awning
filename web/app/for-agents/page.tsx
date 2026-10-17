import type { Metadata } from "next";
import { env } from "@/lib/env";
import { errorMessage, log } from "@/lib/log";
import { atomicToUsdString, usdToAtomic } from "@/lib/money";
import { listLiveBusinesses, offersFor } from "@/lib/services/businesses";
import { USDC_BASE } from "@/lib/x402/constants";
import { CopyLine } from "../copy-line";
import { SiteFooter, SiteHeader } from "../site-chrome";
import "./for-agents.css";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "For agents",
  description:
    "Every Awning business is agent-payable: nine PayBox plugin tools, two x402 endpoints (USDC on Base, exact scheme) and a public JSON API. Copyable use_plugin and curl examples.",
  alternates: { canonical: "/for-agents" },
  openGraph: { title: "Awning for agents: nine tools, two x402 endpoints, one public API", url: "/for-agents" },
};

type Tool = { name: string; kind: "read" | "free" | "pays" | "owner"; does: string; input: string; output: string; api: string };

/** The plugin's nine tools, as documented in plugin/README.md. */
const TOOLS: Tool[] = [
  { name: "awning_about", kind: "read", does: "What Awning is, what it costs and how to use the tools. The conformance sample call.", input: "{}", output: "{name, version, summary, apiHost, payments: {chain, asset, symbol}, tools: [{name, use, cost}], flows: {open[], buy[], manage[]}}", api: "none" },
  { name: "awning_plan", kind: "free", does: "Turns one sentence into a draft business, domain options and a price. Creates a private draft; no money.", input: "{sentence (8-600 chars), ownerWallet (0x + 40 hex), ownerName?, ownerEmail?, country?}", output: "{planId, expiresAt, previewUrl, business: {slug, name, tagline, description, category, city, palette, offers[]}, domains: [{domain, available, domainPriceUsd, openPriceUsd}], packages: [{id, label, includes[], priceUsd}]}", api: "POST /v1/plan" },
  { name: "awning_open_free", kind: "free", does: "Opens the plan on name.awning.sh at no cost.", input: "{planId}", output: "{business: {slug, name, url, status}, ownerToken}", api: "POST /v1/open-free" },
  { name: "awning_open", kind: "pays", does: "Registers the domain, buys the line and goes live. Returns an x402 proposal for PayBox; never pays by itself.", input: "{planId, domain, priceUsd}", output: '{"io.paybox/transactionProposal": {kind: "x402", chain: "eip155:8453", request: {url: ".../x402/open/<planId>", method: "POST", body: {domain, package: "pro"}}, payment: {asset, maxAmount}}}', api: "GET /v1/plans/:planId, unpaid POST /x402/open/:planId (quote)" },
  { name: "awning_find", kind: "read", does: "Searches every open business and offer.", input: "{query?, category?, limit? (1-25, default 10)}", output: "{count, businesses: [{slug, name, tagline, description, category, city, url, phone, domain, status, openedAt, salesCount, offers: [{sku, title, description, priceUsd, priceAtomicUsdc, kind}]}]}", api: "GET /v1/businesses?q=&category=&limit=" },
  { name: "awning_business", kind: "read", does: "One business: offers, prices, phone.", input: "{slug}", output: "{business: {...same shape as one awning_find entry}}", api: "GET /v1/businesses/:slug" },
  { name: "awning_buy", kind: "pays", does: "Buys an offer. The proposal pays the owner's wallet directly, price x qty.", input: "{slug, sku, qty? (1-100, default 1), buyerNote?, buyerContact?}", output: "x402 proposal: POST .../x402/b/<slug>/<sku> with {qty, buyerNote?, buyerContact?}, maxAmount = price x qty (atomic USDC)", api: "GET /v1/businesses/:slug, unpaid POST /x402/b/:slug/:sku (quote)" },
  { name: "awning_add_offer", kind: "owner", does: "Adds an offer to a live site; buyable at once.", input: "{slug, ownerToken, title, description, priceUsd, kind: product|service|booking|digital|subscription}", output: "{slug, added, offers[]}", api: "POST /v1/businesses/:slug/offers" },
  { name: "awning_orders", kind: "owner", does: "The owner's orders, with receipts.", input: "{slug, ownerToken}", output: "{slug, count, totalUsd, orders: [{id, sku, qty, totalUsd, status, createdAt, tx, payer, buyerNote, buyerContact}]}", api: "GET /v1/orders?slug=" },
];

const PILL: Record<Tool["kind"], string> = { read: "read", free: "free", pays: "pays", owner: "owner" };

async function example(): Promise<{ slug: string; sku: string; name: string; title: string; priceUsd: string; real: boolean }> {
  if (process.env.NEXT_PHASE !== "phase-production-build") {
    try {
      for (const b of await listLiveBusinesses({ limit: 5 })) {
        const [o] = await offersFor(b.id);
        if (o) return { slug: b.slug, sku: o.sku, name: b.name, title: o.title, priceUsd: atomicToUsdString(o.priceAtomic), real: true };
      }
    } catch (err) {
      log.warn("for-agents: no live example", { error: errorMessage(err) });
    }
  }
  return { slug: "ridge-roast", sku: "saturday-tasting", name: "Ridge Roast", title: "Saturday tasting", priceUsd: "5.00", real: false };
}

function Code({ children, label }: { children: string; label: string }) {
  return (
    <div className="fa-code">
      <CopyLine text={children} label="Copy" className="fa-copy" />
      <span className="fa-code-label">{label}</span>
    </div>
  );
}

export default async function ForAgents() {
  const api = env.apiUrl();
  const ex = await example();
  const buyUrl = `${api}/x402/b/${ex.slug}/${ex.sku}`;
  const atomic = usdToAtomic(ex.priceUsd).toString();

  const usePlugin = JSON.stringify(
    {
      plugin_id: "<your Awning installation id>",
      tool_id: "awning_buy",
      input: { slug: ex.slug, sku: ex.sku, qty: 1, buyerNote: "Saturday, 10:00" },
      wallet_id: "<only if you have more than one wallet>",
    },
    null,
    2,
  );
  const curls = [
    { label: "Find businesses and offers", cmd: `curl -s "${api}/v1/businesses?q=coffee&limit=5"` },
    { label: "One business, with buy links and payTo", cmd: `curl -s ${api}/v1/businesses/${ex.slug}` },
    { label: "Get the quote (402, no side effects)", cmd: `curl -si -X POST ${buyUrl} -H 'content-type: application/json' -d '{"qty":1}'` },
    { label: "Every opening and sale, newest first", cmd: `curl -s "${api}/v1/live?limit=20"` },
  ];

  return (
    <>
      <SiteHeader current="for-agents" />
      <main id="main" className="fa">
        {/* ============ HERO: a purchase, as the wire sees it ============ */}
        <section className="fa-hero">
          <div className="wrap fa-hero-grid">
            <div>
              <p className="fa-eyebrow">For agent developers</p>
              <h1 className="display fa-h1">Every shop here is an API.</h1>
              <p className="lede">
                Every Awning business is born agent-payable: listed the minute it opens, offers as JSON, and an x402 checkout that pays the owner’s wallet in
                USDC on Base. Use the PayBox plugin, or call the API and pay the 402 yourself.
              </p>
              <nav className="fa-toc" aria-label="On this page">
                <a href="#tools">Nine plugin tools</a>
                <a href="#use-plugin">use_plugin</a>
                <a href="#x402">x402 endpoints</a>
                <a href="#api">Public API</a>
                <a href="#rules">Guarantees</a>
              </nav>
            </div>
            <figure className="fa-wire" aria-label="A purchase over x402, step by step">
              <figcaption>
                <span>{ex.real ? ex.name.toUpperCase() : "EXAMPLE EXCHANGE"}</span>
                <span>x402 v2</span>
              </figcaption>
              <ol>
                <li>
                  <b>POST</b> /x402/b/{ex.slug}/{ex.sku}
                </li>
                <li className="res">
                  402 Payment Required<span>PAYMENT-REQUIRED: base64 terms</span>
                </li>
                <li>
                  amount <i>{atomic}</i> ({ex.priceUsd} USDC)
                </li>
                <li>payTo the owner’s wallet</li>
                <li>network eip155:8453, scheme exact</li>
                <li className="tap">PayBox: one approval by a person</li>
                <li>
                  <b>POST</b> same URL + PAYMENT-SIGNATURE
                </li>
                <li className="res ok">
                  200 OK<span>{"{order, receipt: {tx, payer, payTo}, fulfillment}"}</span>
                </li>
              </ol>
              <div className="fa-total">
                <small>
                  TO THE OWNER
                  <br />
                  AWNING’S CUT 0.00
                </small>
                <b>{ex.priceUsd}</b>
              </div>
            </figure>
          </div>
        </section>

        {/* ============ PLUGIN TOOLS ============ */}
        <section className="fa-tools" id="tools" aria-labelledby="tools-h">
          <div className="wrap">
            <div className="fa-head">
              <h2 id="tools-h" className="display h2">
                Nine tools in the PayBox plugin.
              </h2>
              <p>
                A standard MCP server (protocol 2026-07-28) running in PayBox’s sandbox. Strict schemas in and out, 4 s timeouts, money as decimal strings
                plus atomic USDC. The two paying tools only return proposals; PayBox asks a person to approve.
              </p>
            </div>
            <ul className="fa-board">
              {TOOLS.map((t) => (
                <li key={t.name}>
                  <div className="fa-tool-top">
                    <code>{t.name}</code>
                    <em className={t.kind === "pays" ? "pays" : undefined}>{PILL[t.kind]}</em>
                  </div>
                  <p>{t.does}</p>
                  <dl>
                    <dt>in</dt>
                    <dd>
                      <code>{t.input}</code>
                    </dd>
                    <dt>out</dt>
                    <dd>
                      <code>{t.output}</code>
                    </dd>
                    <dt>calls</dt>
                    <dd>
                      <code>{t.api}</code>
                    </dd>
                  </dl>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ============ use_plugin ============ */}
        <section className="fa-section" id="use-plugin" aria-labelledby="use-h">
          <div className="wrap fa-split">
            <div>
              <h2 id="use-h" className="display h2">
                Buy from an agent, in one call.
              </h2>
              <ol className="fa-steps">
                <li>
                  <code>discover_plugins</code> finds Awning for “coffee in Accra”, “bike repair”, “book a class”.
                </li>
                <li>
                  <code>get_contract</code> returns the tool schemas above.
                </li>
                <li>
                  <code>use_plugin</code> calls <code>awning_buy</code>. The result is a PayBox request: a person approves it with one tap.
                </li>
                <li>Poll the request. The paid response carries the order, the receipt and the transaction on Base. Do not call the tool again: a second approval is a second order.</li>
              </ol>
            </div>
            <div>
              <div className="fa-json">
                <div className="fa-json-top">
                  <span>use_plugin</span>
                  <CopyLine text={usePlugin} label="Copy JSON" className="fa-copy-inline" hideText />
                </div>
                <pre>{usePlugin}</pre>
              </div>
              <p className="fa-note">
                {ex.real ? `${ex.name} is a real Awning business: this call buys “${ex.title}” for ${ex.priceUsd} USDC.` : "Example slug and sku; use awning_find for real ones."} PayBox picks
                the wallet; Awning never sees its id.
              </p>
            </div>
          </div>
        </section>

        {/* ============ x402 ============ */}
        <section className="fa-section fa-sunk" id="x402" aria-labelledby="x402-h">
          <div className="wrap">
            <div className="fa-head">
              <h2 id="x402-h" className="display h2">
                Two x402 endpoints.
              </h2>
              <p>
                USDC on Base (<code>eip155:8453</code>, asset <code>{USDC_BASE}</code>), scheme <code>exact</code>. Both also answer GET with the same 402
                quote.
              </p>
            </div>
            <div className="fa-endpoints">
              <article className="fa-ticket">
                <h3>
                  <span>POST</span> /x402/b/:slug/:sku
                </h3>
                <p className="fa-what">Buy an offer. Pays the business owner’s own wallet.</p>
                <dl>
                  <dt>Body</dt>
                  <dd>
                    <code>{"{qty? (1-100), buyerNote?, buyerContact?}"}</code> (or <code>?qty=</code>)
                  </dd>
                  <dt>Price</dt>
                  <dd>offer price x qty</dd>
                  <dt>payTo</dt>
                  <dd>the owner’s wallet (non-custodial)</dd>
                  <dt>Paid, 200</dt>
                  <dd>
                    <code>{'{order: {id, slug, sku, qty, totalUsd, status: "paid"}, receipt: {tx, payer, payTo, network, settlement}, fulfillment: {kind, message, code?, url?}}'}</code>
                  </dd>
                  <dt>Refused</dt>
                  <dd>
                    <code>409 business_not_open</code>, <code>403 business_suspended</code> (before any 402)
                  </dd>
                </dl>
              </article>
              <article className="fa-ticket">
                <h3>
                  <span>POST</span> /x402/open/:planId
                </h3>
                <p className="fa-what">Open a plan on its own domain with a phone line (Pro).</p>
                <dl>
                  <dt>Body</dt>
                  <dd>
                    <code>{'{domain?, package?: "pro"}'}</code> (domain defaults to the plan’s recommendation)
                  </dd>
                  <dt>Price</dt>
                  <dd>the plan’s quoted total for that domain (domain + first month)</dd>
                  <dt>payTo</dt>
                  <dd>Awning’s treasury</dd>
                  <dt>Paid, 200</dt>
                  <dd>
                    <code>{'{business: {slug, name, url, domain, phone, status: "live"}, ownerToken, receipts: {paidUsd, tx, payer}, steps: [{name, status, ms}]}'}</code>
                  </dd>
                  <dt>Refused</dt>
                  <dd>
                    <code>409 already_open</code>, <code>410 quote_expired</code>, <code>503 pro_unavailable</code>
                  </dd>
                </dl>
              </article>
            </div>
            <ul className="fa-protocol">
              <li>
                <b>Unpaid request</b> → <code>402</code> with <code>PAYMENT-REQUIRED</code> (base64 JSON, <code>x402Version: 2</code>,{" "}
                <code>accepts[{"{"}scheme, network, amount, asset, payTo, maxTimeoutSeconds: 300{"}"}]</code>). The body repeats the terms in the v1 form plus a
                readable <code>awning</code> quote.
              </li>
              <li>
                <b>Paid retry</b>: <code>PAYMENT-SIGNATURE</code> (v2) or <code>X-PAYMENT</code> (v1), an EIP-3009 <code>transferWithAuthorization</code> for
                exactly the quoted amount and payTo. The answer carries <code>PAYMENT-RESPONSE</code>.
              </li>
              <li>
                <b>Idempotent</b>: the authorization is the key. The same signed payment twice returns the same order, byte for byte; a concurrent duplicate gets{" "}
                <code>409 payment_in_progress</code>.
              </li>
            </ul>
          </div>
        </section>

        {/* ============ PUBLIC API ============ */}
        <section className="fa-section" id="api" aria-labelledby="api-h">
          <div className="wrap">
            <div className="fa-head">
              <h2 id="api-h" className="display h2">
                The public API.
              </h2>
              <p>
                JSON, CORS-open, no key. Base URL <code>{api}</code>. Plan, open and owner endpoints need the brokered <code>x-awning-plugin-key</code> header
                that PayBox adds, so use them through the plugin.
              </p>
            </div>
            <div className="fa-curls">
              {curls.map((c) => (
                <Code key={c.label} label={c.label}>
                  {c.cmd}
                </Code>
              ))}
            </div>
            <table className="fa-table">
              <thead>
                <tr>
                  <th scope="col">Endpoint</th>
                  <th scope="col">Returns</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>GET /v1/businesses?q=&amp;category=&amp;limit=</code>
                  </td>
                  <td>
                    <code>{"{businesses: [{slug, name, tagline, category, city, url, phone?, offers: [{sku, title, priceUsd, kind}], openedAt, salesCount}]}"}</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>GET /v1/businesses/:slug</code>
                  </td>
                  <td>
                    <code>{"{business: {..., palette, offers: [{..., buyUrl}], payTo, status, package}}"}</code> (410 while under review)
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>GET /v1/businesses/:slug/offers</code>
                  </td>
                  <td>
                    <code>{"{offers}"}</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>GET /v1/live</code>
                  </td>
                  <td>
                    <code>{'{events: [{type: "opened"|"order"|"call", at, slug, name, amountUsd?, tx?}]}'}</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>GET /v1/health</code>
                  </td>
                  <td>
                    <code>{"{ok, version, lastOpenAt, lastOrderAt, checks, facilitator, adapters}"}</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ============ GUARANTEES ============ */}
        <section className="fa-section fa-rules" id="rules" aria-labelledby="rules-h">
          <div className="wrap fa-split">
            <h2 id="rules-h" className="display h2">
              What the API promises.
            </h2>
            <ul className="fa-vows">
              <li>
                <b>A quote is only a quote.</b> Unpaid requests never write, provision or call a provider.
              </li>
              <li>
                <b>Pay only on success.</b> Work happens first, settlement after. If the work fails, the authorization is never settled; a failure found after
                settlement is refunded from the treasury in the same response, with the refund transaction.
              </li>
              <li>
                <b>Owners are paid directly.</b> Sales settle to the business’s own wallet. Awning takes no cut and never holds customer money.
              </li>
              <li>
                <b>One approval per payment.</b> No standing permissions: every open and every purchase waits for a person in PayBox.
              </li>
              <li>
                <b>Reports pause checkout.</b> A business under review answers 410 and refuses to quote. <a href="/report">Report a business</a>.
              </li>
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
