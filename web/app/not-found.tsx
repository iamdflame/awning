import { SiteFooter, SiteHeader } from "./site-chrome";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="nf">
        <div className="wrap nf-grid">
          <div className="nf-lot" aria-hidden="true">
            <span>
              <small>404</small>This lot is empty
            </span>
          </div>
          <div>
            <h1 className="display nf-h1">Nothing open here.</h1>
            <p className="lede">This shop hasn’t opened yet, has moved, or the link is wrong.</p>
            <p className="nf-links">
              <a className="btn btn-primary" href="/directory">
                Walk the whole street
              </a>
              <a className="btn btn-ghost" href="/">
                Awning home
              </a>
            </p>
          </div>
        </div>
      </main>
      <style>{`.nf{padding:clamp(40px,7vw,112px) 0 var(--section)}.nf-grid{display:grid;grid-template-columns:320px 1fr;gap:clamp(24px,5vw,72px);align-items:center}.nf-h1{font-size:var(--step-h1);margin-bottom:20px}.nf-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}.nf-lot{height:340px;display:grid;place-items:center;border:3px dashed var(--c-500);border-bottom:0;border-radius:6px 6px 0 0;background:repeating-linear-gradient(135deg,oklch(0.31 0.075 160/.06) 0 10px,transparent 10px 22px)}.nf-lot span{padding:18px 20px;border-radius:6px;background:var(--g-800);box-shadow:inset 0 0 0 4px var(--g-900);color:var(--sun);font:700 24px/1.1 var(--font-display);font-stretch:112%;text-align:center}.nf-lot small{display:block;margin-bottom:8px;font:600 12px/1 var(--font-text);color:oklch(0.86 0.15 88/.7)}@media (max-width:980px){.nf-grid{grid-template-columns:1fr}.nf-lot{height:200px}}`}</style>
      <SiteFooter />
    </>
  );
}
