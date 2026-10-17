import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DOCS, docBySlug, type Doc } from "@/lib/docs/catalog";
import { renderDoc, renderMarkdown } from "@/lib/docs/render";

const web = path.resolve(import.meta.dirname, "..");
const fullCheckout = existsSync(path.join(web, "..", "docs"));

describe("web/content mirrors docs/", () => {
  // Vercel builds web/ alone; CI has the whole repository and catches drift here.
  it.skipIf(!fullCheckout)("matches the repo's docs/ and SECURITY.md byte for byte (line endings aside)", () => {
    let output = "";
    try {
      output = execFileSync(process.execPath, [path.join(web, "scripts", "sync-content.mjs"), "--check"], { cwd: web, encoding: "utf8", stdio: "pipe" });
    } catch (err) {
      const e = err as { stderr?: string; stdout?: string };
      throw new Error(`${e.stderr ?? ""}${e.stdout ?? ""}`.trim() || String(err));
    }
    expect(output).toContain("matches");
  });
});

const ROUTES = new Set([...DOCS.map((d) => d.route), "/docs", "/status", "/report", "/live", "/directory", "/for-agents", "/"]);

function ids(html: string): string[] {
  return [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
}
function hrefs(html: string): string[] {
  return [...html.matchAll(/\shref="([^"]*)"/g)].map((m) => m[1]!.replace(/&#x26;/g, "&"));
}

describe("document rendering", () => {
  const terms = renderDoc(docBySlug("terms")!);

  it("lands /terms#acceptable-use on the Acceptable use heading, and keeps GitHub's id working", () => {
    expect(terms.body).toMatch(/<h2 id="acceptable-use"><span id="6-acceptable-use" class="md-alias"><\/span>6\. Acceptable use/);
    expect(terms.toc.map((t) => t.id)).toContain("acceptable-use");
    expect(terms.updated).toBe("2026-10-17");
    expect(terms.preface).not.toMatch(/Last updated/);
  });

  for (const doc of DOCS) {
    it(`${doc.slug}: links go to site routes, real anchors or the open web, never to repo files`, () => {
      const r = renderDoc(doc);
      const all = `${r.preface}${r.body}`;
      const own = new Set(ids(all));
      expect(new Set(ids(all)).size, "ids are unique").toBe(ids(all).length);
      for (const t of r.toc) expect(own.has(t.id), `toc ${t.id}`).toBe(true);
      for (const href of hrefs(all)) {
        expect(href, "no links into the private repo").not.toMatch(/github\.com\/iamdflame/i);
        if (!/^https?:/.test(href)) expect(href, "no relative file links").not.toMatch(/\.(md|ts|mjs|json|ya?ml)(#|$)/);
        if (href.startsWith("#")) expect(own.has(decodeURIComponent(href.slice(1))), `${doc.slug} ${href}`).toBe(true);
        else if (href.startsWith("/")) {
          const [route, hash] = href.split("#");
          expect(ROUTES.has(route!), `${doc.slug} ${href}`).toBe(true);
          if (hash) {
            const target = DOCS.find((d) => d.route === route);
            if (target) expect(ids(renderDoc(target).body), `${doc.slug} → ${href}`).toContain(hash);
          }
        } else expect(href, `${doc.slug} ${href}`).toMatch(/^(https?:|mailto:)/);
      }
    });
  }

  it("rewrites doc-to-doc links and renders source files as code", () => {
    const api = renderDoc(docBySlug("api")!);
    expect(api.body).toContain('href="/terms#6-acceptable-use"');
    const arch = renderDoc(docBySlug("architecture")!);
    expect(arch.body).toContain("<code>web/vercel.json</code>");
    expect(arch.body).not.toContain('href="../');
    expect(arch.body).toContain('href="/docs/plugin">The PayBox plugin</a>');
    const security = renderDoc(docBySlug("security")!);
    expect(security.body).toContain('href="/docs/threat-model"');
  });

  it("renders Mermaid as a labelled, readable figure (no client-side library)", () => {
    const arch = renderDoc(docBySlug("architecture")!);
    expect(arch.diagrams).toBe(4);
    expect(arch.body).toContain('<figure class="md-diagram">');
    expect(arch.body).not.toContain("language-mermaid");
    expect(arch.body).toContain("sequenceDiagram");
  });

  it("wraps tables in their own scroll container", () => {
    const tm = renderDoc(docBySlug("threat-model")!);
    expect(tm.body).toMatch(/<div class="md-table" role="region" tabindex="0" aria-label="Table: [^"]+"><table>/);
    expect(tm.body).not.toMatch(/<table>(?![\s\S]*?<\/table>)/);
  });

  it("sanitizes raw HTML and dangerous links", () => {
    const doc: Doc = { ...docBySlug("spec")!, source: "docs/SPEC.md" };
    const r = renderMarkdown(
      '# T\n\n## A\n\n<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n[click](javascript:alert(1)) <a href="#a" onclick="x()">a</a>\n\n<iframe src="https://evil"></iframe>',
      doc,
    );
    expect(r.body).not.toMatch(/<script|onerror|onclick|javascript:|<iframe/i);
  });
});
