import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="brand">
          Awning
        </Link>
        <nav>
          <Link href="/live">Live</Link>
          <Link href="/directory">Directory</Link>
          <a href="/v1/health">Status</a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap muted">Awning — every business born agent-payable. Payments in USDC on Base, straight to the owner.</div>
    </footer>
  );
}
