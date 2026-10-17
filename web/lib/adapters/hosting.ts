import { env } from "../env";
import { log } from "../log";
import { ProviderError, excerpt, http, obj } from "./http";
import type { Hosting } from "./types";

const VERCEL = "https://api.vercel.com";

/**
 * Vercel Domains API: attach `domain` and `www.domain` (308 → apex) to the
 * Awning project so the multi-tenant app answers for it. Undo removes both.
 */
export class VercelHosting implements Hosting {
  readonly name = "vercel";
  readonly mock = false;
  constructor(
    private readonly token: string,
    private readonly projectId: string,
    private readonly teamId?: string,
  ) {}

  private url(path: string) {
    const q = this.teamId ? `?teamId=${encodeURIComponent(this.teamId)}` : "";
    return `${VERCEL}${path}${q}`;
  }

  private headers() {
    return { authorization: `Bearer ${this.token}`, "content-type": "application/json" };
  }

  async addDomain(domain: string, signal?: AbortSignal) {
    const names: string[] = [];
    const specs = [{ name: domain }, { name: `www.${domain}`, redirect: domain, redirectStatusCode: 308 }];
    for (const spec of specs) {
      const res = await http(this.url(`/v10/projects/${encodeURIComponent(this.projectId)}/domains`), {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(spec),
        signal,
        timeoutMs: 8000,
      });
      const body = obj(res.json);
      const err = obj(body.error);
      // Already attached to this project is success (idempotent retry).
      if (!res.ok && err.code !== "domain_already_in_use_by_project" && err.code !== "domain_already_exists") {
        if (names.length) await this.removeDomains(names, signal).catch(() => undefined);
        throw new ProviderError("vercel", `add ${spec.name} failed (${res.status}): ${excerpt(String(err.message ?? res.text))}`, res.status, String(err.code ?? ""));
      }
      names.push(spec.name);
    }
    return { names };
  }

  async removeDomains(names: string[], signal?: AbortSignal) {
    // Remove www first: it redirects to the apex.
    for (const name of [...names].reverse()) {
      const res = await http(this.url(`/v9/projects/${encodeURIComponent(this.projectId)}/domains/${encodeURIComponent(name)}`), {
        method: "DELETE",
        headers: this.headers(),
        signal,
        timeoutMs: 8000,
      });
      if (!res.ok && res.status !== 404) {
        throw new ProviderError("vercel", `remove ${name} failed (${res.status}): ${excerpt(res.text)}`, res.status);
      }
    }
  }
}

export class MockHosting implements Hosting {
  readonly name = "mock-hosting";
  readonly mock = true;
  readonly attached = new Set<string>();
  async addDomain(domain: string) {
    const names = [domain, `www.${domain}`];
    names.forEach((n) => this.attached.add(n));
    log.info("MOCK hosting attached domain", { domain });
    return { names };
  }
  async removeDomains(names: string[]) {
    names.forEach((n) => this.attached.delete(n));
  }
}

export function makeHosting(): Hosting {
  const token = env.vercelToken();
  const project = env.vercelProjectId();
  if (token && project) return new VercelHosting(token, project, env.vercelTeamId());
  return new MockHosting();
}
