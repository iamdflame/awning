/** fetch with a hard timeout, optional outer abort signal and JSON decoding. */
export type HttpResult = { status: number; ok: boolean; json: unknown; text: string; headers: Headers };

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(`${provider}: ${message}`);
    this.name = "ProviderError";
  }
}

export async function http(
  url: string,
  init: RequestInit & { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<HttpResult> {
  const { timeoutMs = 10000, signal, ...rest } = init;
  const ctl = new AbortController();
  const onAbort = () => ctl.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) ctl.abort(signal.reason);
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  const timer = setTimeout(() => ctl.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: ctl.signal, cache: "no-store" });
    const text = await res.text();
    let json: unknown = undefined;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
    }
    return { status: res.status, ok: res.ok, json, text, headers: res.headers };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function excerpt(s: string, n = 300): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/** Small async delay that respects an abort signal. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason instanceof Error ? signal.reason : new Error("aborted"));
      },
      { once: true },
    );
  });
}
