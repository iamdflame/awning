/**
 * Host → tenant resolution (pure; runs in middleware on the edge).
 *
 *   awning.sh, www., api., localhost, *.vercel.app  → root (landing, /live, /directory, API)
 *   <slug>.awning.sh, <slug>.localhost              → that business's storefront
 *   anything else                                   → a custom domain (looked up by the page)
 */
export type HostKind = { kind: "root" } | { kind: "subdomain"; slug: string } | { kind: "custom"; domain: string };

const ROOT_LABELS = new Set(["www", "api", "app"]);
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function resolveHost(rawHost: string | null | undefined, rootDomain: string, extraRoots: string[] = []): HostKind {
  const host = (rawHost ?? "").toLowerCase().trim().replace(/\.$/, "").replace(/:\d+$/, "");
  if (!host) return { kind: "root" };
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "0.0.0.0") return { kind: "root" };
  if (host === rootDomain || extraRoots.includes(host)) return { kind: "root" };
  if (host.endsWith(".vercel.app")) return { kind: "root" };

  for (const suffix of [`.${rootDomain}`, ".localhost"]) {
    if (host.endsWith(suffix)) {
      const label = host.slice(0, -suffix.length);
      if (ROOT_LABELS.has(label)) return { kind: "root" };
      if (LABEL.test(label)) return { kind: "subdomain", slug: label };
      return { kind: "root" };
    }
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return { kind: "root" };
  return { kind: "custom", domain: host.replace(/^www\./, "") };
}

/** Paths every host serves as-is (API, x402, Next assets). */
export function isPassthroughPath(pathname: string): boolean {
  return (
    pathname.startsWith("/v1/") ||
    pathname === "/v1" ||
    pathname.startsWith("/x402/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/s/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/icon.svg"
  );
}

/** The internal path a request should be rewritten to, or null to serve it unchanged. */
export function rewriteTarget(host: HostKind, pathname: string, search: URLSearchParams): string | null {
  if (isPassthroughPath(pathname)) return null;
  if (host.kind === "root") {
    const b = search.get("b");
    if (pathname === "/" && b && LABEL.test(b.toLowerCase())) return `/s/${b.toLowerCase()}`;
    return null;
  }
  if (pathname !== "/") return null;
  return host.kind === "subdomain" ? `/s/${host.slug}` : `/s/${encodeURIComponent(host.domain)}`;
}
