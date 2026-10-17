"use client";

import { useEffect, useState } from "react";

export type LiveEvent = { type: "opened" | "order" | "call"; at: string; slug: string; name: string; amountUsd?: number; tx?: string };

const LABEL: Record<LiveEvent["type"], string> = { opened: "OPENED", order: "SOLD", call: "CALL" };

/** "10:02" in UTC, identical on the server and in the browser. */
function clock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "--:--" : `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const TX = /^0x[0-9a-f]{64}$/i;

/** The feed is a receipt that keeps printing: polls GET /v1/live every 3 s. */
export function LiveFeed({ initial, storeUrl }: { initial: LiveEvent[]; storeUrl: Record<string, string> }) {
  const [events, setEvents] = useState(initial);
  const [now, setNow] = useState<number | null>(null); // relative times only after mount (no hydration mismatch)
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    setNow(Date.now());
    const tick = async () => {
      try {
        const res = await fetch("/v1/live?limit=50", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { events: LiveEvent[] };
        if (alive) {
          setEvents(body.events);
          setStale(false);
        }
      } catch {
        if (alive) setStale(true);
      }
      if (alive) setNow(Date.now());
    };
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="lv-roll">
      <div className="lv-paper" role="log" aria-live="polite" aria-label="Openings and sales, newest first">
        <div className="lv-head">
          <span>AWNING · LIVE</span>
          <span>{stale ? "RECONNECTING…" : "EVERY 3 S · UTC"}</span>
        </div>
        {events.length === 0 ? (
          <p className="lv-empty">
            Nothing yet. The first business that opens prints here within 3 seconds.
            <a href="/#open">Open yours</a>
          </p>
        ) : (
          <ol className="lv-lines">
            {events.map((e, i) => {
              const href = storeUrl[e.slug];
              return (
                <li key={`${e.at}-${e.slug}-${e.type}-${i}`} className={`lv-${e.type}`}>
                  <time dateTime={e.at} title={now ? ago(e.at, now) : undefined}>
                    {clock(e.at)}
                  </time>
                  <span className="lv-type">{LABEL[e.type] ?? e.type.toUpperCase()}</span>
                  <span className="lv-name">{href ? <a href={href}>{e.name}</a> : e.name}</span>
                  <span className="lv-amt">{e.type === "order" && e.amountUsd != null ? `+${e.amountUsd.toFixed(2)}` : e.type === "opened" ? "open" : ""}</span>
                  <span className="lv-tx">
                    {e.tx && TX.test(e.tx) ? (
                      <a href={`https://basescan.org/tx/${e.tx}`} target="_blank" rel="noreferrer">
                        {e.tx.slice(0, 6)}…{e.tx.slice(-4)} on BaseScan
                      </a>
                    ) : now ? (
                      <span className="lv-ago">{ago(e.at, now)}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
