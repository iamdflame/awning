import type { Metadata } from "next";
import { getBusinessBySlug } from "@/lib/services/businesses";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { ReportForm } from "./report-form";
import "./report.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Report a business",
  description: "Tell Awning about a business that is phishing, impersonating someone, scamming or selling something prohibited.",
  robots: { index: false },
};

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  const slug = (b ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
  const business = slug ? await getBusinessBySlug(slug) : null;
  return (
    <>
      <SiteHeader />
      <main className="wrap section report">
        <h1>Report a business</h1>
        <p className="muted">
          Every Awning business is a real site with a real checkout, so we act on reports quickly. A person reads each one. When three different people
          report the same business within a day, its checkout pauses automatically until we have looked at it.
        </p>
        <ReportForm slug={business?.slug ?? slug} name={business?.name ?? null} />
        <p className="muted small">
          For anything urgent, or if you lost money, email <a href="mailto:abuse@awning.sh">abuse@awning.sh</a>. Payments on Awning go straight to the
          business owner&apos;s wallet; Awning never holds them.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
