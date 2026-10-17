import React from "react";
import { C, FONT, SHADOW, receipt } from "../brand/tokens";

export const BAR = 62;

/**
 * A quiet, designed browser window: a paper bar with the address in a pill (host in ink, path
 * muted), no tabs, no clutter. `width` × `height` is the content area; the bar sits on top.
 */
export const BrowserFrame: React.FC<{
  width: number;
  height: number;
  url: string;
  children: React.ReactNode;
  tag?: string | null; // e.g. RE-CAPTURE for footage from the local mock build
  dark?: boolean;
  style?: React.CSSProperties;
  urlHighlight?: number; // 0..1 underline sweep under the host
}> = ({ width, height, url, children, tag, dark, style, urlHighlight = 0 }) => {
  const [host, ...rest] = url.replace(/^https?:\/\//, "").split("/");
  const path = rest.length ? "/" + rest.join("/") : "";
  return (
    <div style={{ width, height: height + BAR, borderRadius: 20, overflow: "hidden", boxShadow: SHADOW.s4, background: dark ? C.g950 : C.c0, position: "relative", ...style }}>
      <div style={{ height: BAR, display: "flex", alignItems: "center", padding: "0 22px", gap: 10, background: dark ? C.g900 : C.c0, borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(8,29,19,.08)"}` }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 13, height: 13, borderRadius: 7, background: dark ? "rgba(255,255,255,.18)" : C.c200 }} />
        ))}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div
            style={{
              height: 40,
              minWidth: Math.min(640, width * 0.42),
              maxWidth: width * 0.62,
              padding: "0 24px",
              borderRadius: 999,
              background: dark ? "rgba(255,255,255,.07)" : C.c100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontFamily: FONT.text,
              fontSize: 21,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            <svg width="15" height="18" viewBox="0 0 15 18" style={{ flex: "none" }}>
              <rect x="1" y="7.5" width="13" height="9.5" rx="2.4" fill={dark ? C.g300 : C.g600} />
              <path d="M4 7.5V5.2a3.5 3.5 0 0 1 7 0v2.3" fill="none" stroke={dark ? C.g300 : C.g600} strokeWidth="2" />
            </svg>
            <span style={{ position: "relative", fontWeight: 600, color: dark ? C.c50 : C.c900 }}>
              {host}
              <span style={{ position: "absolute", left: 0, bottom: -4, height: 3, borderRadius: 2, background: C.tomato, width: `${urlHighlight * 100}%` }} />
            </span>
            <span style={{ color: dark ? "rgba(247,246,237,.55)" : C.c700, fontWeight: 400 }}>{path}</span>
          </div>
        </div>
        <span style={{ width: 13 * 3 + 20 }} />
      </div>
      <div style={{ position: "relative", width, height, overflow: "hidden", background: dark ? C.g950 : C.c50 }}>
        {children}
        {tag ? (
          <div style={{ position: "absolute", right: 16, top: 16, padding: "8px 14px", borderRadius: 10, background: C.tomato, color: "#fff", ...receipt(15, { fontWeight: 700, letterSpacing: "0.04em" }), boxShadow: "0 6px 16px rgba(0,0,0,.25)", zIndex: 20 }}>
            {tag}
          </div>
        ) : null}
      </div>
    </div>
  );
};
