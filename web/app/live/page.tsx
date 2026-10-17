import type { Metadata } from "next";
import { recentEvents } from "@/lib/services/events";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { LiveFeed } from "./feed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live", description: "Every business opened and every agent purchase on Awning, as it happens." };

export default async function LivePage() {
  const events = await recentEvents(50);
  return (
    <>
      <SiteHeader />
      <main className="wrap section">
        <h1>Live</h1>
        <p className="muted">Every business opened, every agent purchase and every call — with on-chain receipts. Updates every 3 seconds.</p>
        <LiveFeed initial={events} />
      </main>
      <SiteFooter />
    </>
  );
}
