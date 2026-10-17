"use client";

import { useEffect, useState } from "react";

export type LiveEvent = { type: "opened" | "order" | "call"; at: string; slug: string; name: string; amountUsd?: number; tx?: string };

const LABEL: Record<LiveEvent["type"], string> = { opened: "opened", order: "sold", call: "took a call" };

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Polls /v1/live every 3 s. */
export function LiveFeed({ initial }: { initial: LiveEvent[] }) {
  const [events, setEvents] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/v1/live", { cache: "no-store" });
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

  if (!events.length) return <p className="muted">Nothing yet. The first business that opens will appear here within 3 seconds.</p>;
  return (
    <>
      {stale ? <p className="muted">Reconnecting…</p> : null}
      <ul className="feed">
        {events.map((e, i) => (
          <li key={`${e.at}-${e.slug}-${i}`}>
            <span className="pill">{e.type}</span>
            <strong>{e.name}</strong>
            <span>{LABEL[e.type]}</span>
            {e.amountUsd != null && e.amountUsd > 0 ? <span className="mono">{e.amountUsd.toFixed(2)} USDC</span> : null}
            {e.tx && /^0x[0-9a-f]{64}$/i.test(e.tx) ? (
              <a className="mono" href={`https://basescan.org/tx/${e.tx}`} target="_blank" rel="noreferrer">
                tx {e.tx.slice(0, 10)}…
              </a>
            ) : null}
            <span className="muted" style={{ marginLeft: "auto" }}>
              {ago(e.at, now)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
