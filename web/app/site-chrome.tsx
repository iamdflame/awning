import { fontVars } from "./fonts";
import "./brand.css";

type Current = "for-agents" | "directory" | "live" | "report" | "docs" | "status";

/**
 * The canopy that crowns every awning.sh page: the green rod with the logo and
 * nav, and the scalloped canopy under it (design/landing). On the landing the
 * nav jumps to sections; elsewhere it links back to them.
 */
export function SiteHeader({ home = false, current }: { home?: boolean; current?: Current } = {}) {
  const at = (anchor: string) => (home ? anchor : `/${anchor}`);
  const cur = (c: Current) => (current === c ? ({ "aria-current": "page" } as const) : {});
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: fontVars }} />
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="front">
        <div className="rod">
          <div className="in">
            <a className="logo" href="/" aria-label="Awning home">
              <img src="/brand/logo-reversed.svg" alt="Awning" width={146} height={30} />
            </a>
            <nav aria-label="Main">
              <a href={at("#how")}>How it works</a>
              <a href="/for-agents" {...cur("for-agents")}>
                For agents
              </a>
              <a href={at("#pricing")}>Pricing</a>
              <a href={home ? "#live" : "/live"} {...cur("live")}>
                Opened today
              </a>
              <a href="/directory" {...cur("directory")}>
                Directory
              </a>
              <a href="/docs" {...cur("docs")}>
                Docs
              </a>
              <a className="btn btn-primary" href={at("#open")}>
                Open yours
              </a>
            </nav>
          </div>
        </div>
        <div className="canopy" aria-hidden="true" />
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap in">
        <div className="brandcol">
          <img src="/brand/logo-reversed.svg" alt="Awning" width={156} height={32} />
          <p>Real businesses, opened in one sentence, buyable by people and agents. A PayBox plugin.</p>
        </div>
        <nav aria-label="Footer">
          <div className="col">
            <p>Product</p>
            <a href="/#how">How it works</a>
            <a href="/#pricing">Pricing</a>
            <a href="/live">Opened today</a>
            <a href="/directory">Directory</a>
          </div>
          <div className="col">
            <p>Developers</p>
            <a href="/for-agents">For agents</a>
            <a href="/docs">Docs</a>
            <a href="/docs/api">API reference</a>
            <a href="/status">Status</a>
          </div>
          <div className="col">
            <p>Company</p>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/security">Security</a>
            <a href="/report">Report a business</a>
          </div>
        </nav>
        <div className="base">
          <span>© 2026 Awning</span>
          <span>Every sale goes straight to the owner’s wallet. Awning never holds it.</span>
        </div>
      </div>
    </footer>
  );
}
