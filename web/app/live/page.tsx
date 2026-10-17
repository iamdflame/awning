import type { Metadata } from "next";
import { businessUrl } from "@/lib/env";
import { listLiveBusinesses } from "@/lib/services/businesses";
import { recentEvents } from "@/lib/services/events";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { LiveFeed, type LiveEvent } from "./feed";
import "./live.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Live",
  description: "Every business opened and every agent purchase on Awning, as it happens, with its transaction on Base.",
  alternates: { canonical: "/live" },
};

export default async function LivePage() {
  const [events, live] = await Promise.all([recentEvents(50), listLiveBusinesses({ limit: 100 })]);
  const storeUrl = Object.fromEntries(live.map((b) => [b.slug, businessUrl(b)]));
  return (
    <>
      <SiteHeader current="live" />
      <main id="main" className="lv">
        <section className="lv-top">
          <div className="wrap lv-grid">
            <div className="lv-intro">
              <span className="live-dot">
                <i />
                Live
              </span>
              <h1 className="display lv-h1">Every opening and every sale, as it happens.</h1>
              <p className="lede">
                Each line is a real event on Awning: a shop opening, an agent’s purchase paid to the owner’s wallet, a call answered. Sales link their
                transaction on Base. It updates every 3 seconds.
              </p>
              <p className="lv-links">
                <a className="btn btn-ghost" href="/directory">
                  Walk the whole street
                </a>
                <a className="btn btn-primary" href="/#open">
                  Open yours
                </a>
              </p>
            </div>
            <LiveFeed initial={events as LiveEvent[]} storeUrl={storeUrl} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
