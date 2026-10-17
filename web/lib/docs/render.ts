import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import GithubSlugger from "github-slugger";
import type { Element, ElementContent, Root } from "hast";
import { toString } from "hast-util-to-string";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { docBySource, type Doc } from "./catalog";

/**
 * Markdown → sanitized HTML for the company documents, server-side only.
 *
 * remark (GFM) → rehype → raw HTML parsed → sanitized with GitHub's schema (ids kept as
 * written, so `/terms#acceptable-use` works) → our transforms: GitHub-compatible heading
 * ids and an in-page TOC, links between docs rewritten to their routes, links to source
 * files rendered as code (the repository is private), tables in their own scroll
 * container, code blocks and Mermaid diagrams as labelled figures.
 */

export type TocEntry = { id: string; text: string; code: boolean; method?: string };

export type RenderedDoc = {
  doc: Doc;
  /** The document's own H1. */
  heading: string;
  /** HTML of everything between the H1 and the first H2 (minus a "Last updated" line). */
  preface: string;
  body: string;
  toc: TocEntry[];
  /** ISO date the document says it was updated or checked against the code. */
  updated: string | null;
  minutes: number;
  diagrams: number;
};

const SCHEMA = { ...defaultSchema, clobber: [], clobberPrefix: "" };

const toHast = unified().use(remarkParse).use(remarkGfm).use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw).use(rehypeSanitize, SCHEMA);
const toHtml = unified().use(rehypeStringify, { allowDangerousHtml: true }); // raw nodes: only our own diagram SVGs

const CODE_LABEL: Record<string, string> = { bash: "Shell", sh: "Shell", json: "JSON", ts: "TypeScript", js: "JavaScript", http: "HTTP" };
const DIAGRAM_KIND: Record<string, string> = {
  flowchart: "Flow",
  graph: "Flow",
  sequenceDiagram: "Sequence",
  stateDiagram: "States",
  "stateDiagram-v2": "States",
  erDiagram: "Data model",
};

const el = (tagName: string, properties: Element["properties"], children: ElementContent[]): Element => ({ type: "element", tagName, properties, children });
const text = (value: string): ElementContent => ({ type: "text", value });
const isEl = (n: ElementContent | undefined, tag?: string): n is Element => !!n && n.type === "element" && (!tag || n.tagName === tag);
const blank = (n: ElementContent) => n.type === "text" && n.value.trim() === "";

type Link =
  | { kind: "keep"; href: string }
  | { kind: "external"; href: string }
  | { kind: "route"; href: string; doc: Doc }
  | { kind: "code"; path: string }
  | { kind: "text" };

/** Where a link in `from` (a repo path) should point on the site. */
export function resolveLink(href: string, from: string): Link {
  if (href.startsWith("#")) return { kind: "keep", href };
  if (/^mailto:/i.test(href)) return { kind: "keep", href };
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      return { kind: "text" };
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return { kind: "text" };
    // The repository is private: a link into it would be dead for every reader.
    if (url.hostname === "github.com" && /^\/iamdflame\/awning(\/|$)/i.test(url.pathname)) return { kind: "text" };
    if (url.hostname === "awning.sh" || url.hostname === "www.awning.sh") return { kind: "keep", href: `${url.pathname}${url.search}${url.hash}` };
    return { kind: "external", href: url.toString() };
  }
  const [rel = "", hash] = href.split("#");
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(from), rel));
  const doc = docBySource(target);
  if (doc) return { kind: "route", href: `${doc.route}${hash ? `#${hash}` : ""}`, doc };
  return { kind: "code", path: target.replace(/\/$/, "") + (rel.endsWith("/") ? "/" : "") };
}

/** `<a id="x"></a>` (alone or alone in a paragraph): an explicit anchor for the next heading. */
function explicitAnchor(n: ElementContent): string | null {
  const a = isEl(n, "p") ? n.children.filter((c) => !blank(c)) : [n];
  const only = a.length === 1 ? a[0] : undefined;
  if (!isEl(only, "a") || only.properties?.href !== undefined) return null;
  const id = only.properties?.id;
  return typeof id === "string" && toString(only).trim() === "" ? id : null;
}

function codeOnly(n: Element): boolean {
  const kids = n.children.filter((c) => !blank(c));
  return kids.length > 0 && kids.every((c) => isEl(c, "code"));
}

function langOf(code: Element | undefined): string | undefined {
  const cls = code?.properties?.className;
  const list = Array.isArray(cls) ? cls.map(String) : [];
  return list.find((c) => c.startsWith("language-"))?.slice("language-".length);
}

/** "6. Acceptable use" → a numbered badge; "`GET /v1/health`" → a method pill + the path. */
function decorateHeading(children: ElementContent[]): ElementContent[] {
  const [first, ...rest] = children;
  if (first?.type === "text") {
    const m = /^(\d+)\.\s+/.exec(first.value);
    if (m) return [el("span", { className: ["md-num"], ariaHidden: "true" }, [text(m[1]!)]), el("span", { className: ["sr-only"] }, [text(`${m[1]}. `)]), text(first.value.slice(m[0].length)), ...rest];
  }
  const kids = children.filter((c) => !blank(c));
  if (kids.length === 1 && isEl(kids[0], "code")) {
    const m = /^(GET|POST|PUT|PATCH|DELETE)\s+(\S.*)$/.exec(toString(kids[0]));
    if (m) return [el("span", { className: ["md-method", m[1]!.toLowerCase()] }, [text(m[1]!)]), el("code", {}, [text(m[2]!)])];
  }
  return children;
}

type Ctx = { doc: Doc; slugger: GithubSlugger; toc: TocEntry[]; anchor: string | null; diagrams: number };

function transform(nodes: ElementContent[], ctx: Ctx): ElementContent[] {
  const out: ElementContent[] = [];
  for (const node of nodes) {
    if (!isEl(node)) {
      out.push(node);
      continue;
    }
    const tag = node.tagName;

    const anchor = explicitAnchor(node);
    if (anchor) {
      ctx.anchor = anchor;
      continue;
    }

    if (tag === "hr") {
      const after = nodes.slice(nodes.indexOf(node) + 1).find((n) => !blank(n));
      if (!after || isEl(after, "h2") || explicitAnchor(after)) continue;
    }

    if (tag === "h2" || tag === "h3" || tag === "h4") {
      const label = toString(node).trim();
      const github = ctx.slugger.slug(label);
      const id = ctx.anchor ?? github;
      const alias: ElementContent[] = id !== github ? [el("span", { id: github, className: ["md-alias"] }, [])] : [];
      ctx.anchor = null;
      if (tag === "h2") {
        const m = codeOnly(node) ? /^(GET|POST|PUT|PATCH|DELETE)\s+(\S.*)$/.exec(label) : null;
        ctx.toc.push(m ? { id, text: m[2]!, code: true, method: m[1]! } : { id, text: label, code: codeOnly(node) });
      }
      out.push(
        el(tag, { id }, [
          ...alias,
          ...decorateHeading(transform(node.children, ctx)),
          el("a", { href: `#${id}`, className: ["md-anchor"], ariaLabel: `Link to this section: ${label}` }, [text("#")]),
        ]),
      );
      continue;
    }
    ctx.anchor = null;

    if (tag === "a" && typeof node.properties?.href === "string") {
      const link = resolveLink(node.properties.href, ctx.doc.source);
      const kids = transform(node.children, ctx);
      if (link.kind === "keep") out.push({ ...node, properties: { ...node.properties, href: link.href }, children: kids });
      else if (link.kind === "external") out.push({ ...node, properties: { ...node.properties, href: link.href, rel: ["noopener"], className: ["ext"] }, children: kids });
      else if (link.kind === "route") {
        const label = toString(node).trim();
        const fileName = label === link.doc.source || label === path.posix.basename(link.doc.source);
        out.push({ ...node, properties: { ...node.properties, href: link.href }, children: fileName ? [text(link.doc.title)] : kids });
      } else if (link.kind === "code") {
        // A source file in a private repository: name it, don't link it.
        out.push(...(kids.every((k) => isEl(k, "code") || blank(k)) ? kids : [el("code", { title: link.path }, [text(toString(node))])]));
      } else out.push(...kids);
      continue;
    }

    if (tag === "table") {
      const thead = node.children.find((c): c is Element => isEl(c, "thead"));
      const row = thead?.children.find((c): c is Element => isEl(c, "tr"));
      const cells = (row?.children ?? []).filter((c): c is Element => isEl(c, "th")).map((th) => toString(th).trim());
      const cols = Math.min(Math.max(cells.length, 2), 5);
      out.push(
        el("div", { className: ["md-table", `cols-${cols}`], role: "region", tabIndex: 0, ariaLabel: `Table: ${cells.join(", ").slice(0, 80)}` }, [
          { ...node, children: transform(node.children, ctx) },
        ]),
      );
      continue;
    }

    if (tag === "pre") {
      const code = node.children.find((c): c is Element => isEl(c, "code"));
      const lang = langOf(code);
      if (lang === "mermaid") {
        ctx.diagrams += 1;
        const source = toString(node).replace(/\n$/, "");
        const first = source.trim().split(/\s+/)[0] ?? "";
        const kind = DIAGRAM_KIND[first] ?? "Mermaid";
        const caption = el("figcaption", {}, [el("span", {}, [text("Diagram")]), el("span", {}, [text(kind)])]);
        const pre = el("pre", { tabIndex: 0 }, [el("code", {}, [text(source)])]);
        const svg = diagramSvg(source);
        if (!svg) {
          // Not rendered yet (or changed since): the source itself, readable.
          out.push(el("figure", { className: ["md-diagram"] }, [caption, pre]));
          continue;
        }
        out.push(
          el("figure", { className: ["md-diagram", "has-svg"] }, [
            caption,
            el("div", { className: ["md-svg"], style: `--w:${Math.round(svg.width)}px`, role: "img", tabIndex: 0, ariaLabel: `${kind} diagram. Its Mermaid source follows.` }, [
              { type: "raw", value: svg.markup } as unknown as ElementContent,
            ]),
            el("div", { className: ["md-diagram-foot"] }, [
              el("details", {}, [el("summary", {}, [text("Mermaid source")]), pre]),
              el("span", { className: ["md-diagram-tools"] }, [
                el("a", { href: `/diagrams/${svg.key}.svg`, target: "_blank", rel: ["noopener"] }, [text("Open full size")]),
              ]),
            ]),
          ]),
        );
        continue;
      }
      const label = lang ? (CODE_LABEL[lang] ?? lang) : null;
      out.push(el("figure", { className: ["md-code"] }, [...(label ? [el("figcaption", {}, [text(label)])] : []), { ...node, properties: { ...node.properties, tabIndex: 0 } }]));
      continue;
    }

    out.push({ ...node, children: transform(node.children, ctx) });
  }
  return out;
}

const html = (children: ElementContent[]) => toHtml.stringify({ type: "root", children } as Root);

/** Must match key() in design/tools/diagrams.mjs. */
export function diagramKey(source: string): string {
  return createHash("sha256").update(source.replace(/\r\n/g, "\n").replace(/\s+$/, "")).digest("hex").slice(0, 12);
}

/**
 * The static SVG design/tools/diagrams.mjs rendered for this exact Mermaid source
 * (web/public/diagrams/<key>.svg), or null. The SVG is our own build output (Mermaid with
 * securityLevel strict, from our own docs), inlined so it uses the page's fonts; CSS sizes it.
 */
function diagramSvg(source: string): { key: string; markup: string; width: number } | null {
  const key = diagramKey(source);
  const file = path.join(process.cwd(), "public", "diagrams", `${key}.svg`);
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, "utf8").trimStart();
  const width = Number(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/.exec(raw)?.[1] ?? 0);
  if (!width || !/^<svg[\s>]/.test(raw)) return null;
  const markup = raw.replace(/^<svg([^>]*)>/, (_, attrs: string) => `<svg${attrs.replace(/\s(width|style)="[^"]*"/g, "")} aria-hidden="true" focusable="false">`);
  return { key, markup, width };
}

/** Render Markdown that lives at `doc.source` (repo path). Pure; used by tests directly. */
export function renderMarkdown(markdown: string, doc: Doc): RenderedDoc {
  const tree = toHast.runSync(toHast.parse(markdown)) as Root;
  const nodes = tree.children.filter((n): n is ElementContent => n.type !== "doctype");

  const h1 = nodes.findIndex((n) => isEl(n, "h1"));
  const heading = h1 >= 0 ? toString(nodes[h1]!).trim() : doc.title;
  const rest = h1 >= 0 ? nodes.slice(h1 + 1) : nodes;
  const firstH2 = rest.findIndex((n) => isEl(n, "h2") || explicitAnchor(n) !== null);
  const prefaceNodes = firstH2 >= 0 ? rest.slice(0, firstH2) : [];
  const bodyNodes = firstH2 >= 0 ? rest.slice(firstH2) : rest;

  // "**Last updated: 2026-10-17**" becomes page metadata instead of a paragraph.
  let updated: string | null = null;
  const preface = prefaceNodes.filter((n) => {
    const m = isEl(n, "p") ? /^last updated:?\s*(\d{4}-\d{2}-\d{2})\.?$/i.exec(toString(n).trim()) : null;
    if (m) updated = m[1] ?? null;
    return !m;
  });
  updated ??= /(\d{4}-\d{2}-\d{2})/.exec(preface.map((n) => toString(n)).join(" "))?.[1] ?? null;

  const ctx: Ctx = { doc, slugger: new GithubSlugger(), toc: [], anchor: null, diagrams: 0 };
  const prefaceOut = transform(preface, ctx);
  const bodyOut = transform(bodyNodes, ctx);
  const words = toString({ type: "root", children: bodyNodes } as Root).split(/\s+/).filter(Boolean).length;

  return {
    doc,
    heading,
    preface: html(prefaceOut),
    body: html(bodyOut),
    toc: ctx.toc,
    updated,
    minutes: Math.max(1, Math.round(words / 230)),
    diagrams: ctx.diagrams,
  };
}

const cache = new Map<string, RenderedDoc>();

/** Reads web/content/<doc.source> (synced from the repo's docs/ by scripts/sync-content.mjs). */
export function renderDoc(doc: Doc): RenderedDoc {
  const hit = cache.get(doc.slug);
  if (hit) return hit;
  const markdown = readFileSync(path.join(process.cwd(), "content", doc.source), "utf8");
  const rendered = renderMarkdown(markdown, doc);
  cache.set(doc.slug, rendered);
  return rendered;
}
