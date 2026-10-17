import React from "react";
import { C, FONT, SHADOW, receipt } from "../brand/tokens";

export const TBAR = 58;

/**
 * A terminal window for the buying agent (Claude Code in Windows Terminal): a dark tab bar with
 * the session's name, a prompt glyph, and the recording below. It sits beside the owner's browser
 * frame on purpose: one agent in a browser opened the shop, a different one in a terminal buys.
 */
export const TerminalFrame: React.FC<{ width: number; height: number; title: string; children: React.ReactNode; tag?: string | null; style?: React.CSSProperties }> = ({ width, height, title, children, tag, style }) => (
  <div style={{ width, height: height + TBAR, borderRadius: 18, overflow: "hidden", boxShadow: SHADOW.s4, background: "#0c0c0c", position: "relative", ...style }}>
    <div style={{ height: TBAR, display: "flex", alignItems: "center", gap: 14, padding: "0 20px", background: "#1b1f1d", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, height: 40, padding: "0 18px", borderRadius: "10px 10px 0 0", background: "#0c0c0c", marginTop: 18, color: "rgba(247,246,237,.88)", fontFamily: FONT.text, fontWeight: 600, fontSize: 20 }}>
        <svg width="20" height="16" viewBox="0 0 20 16" style={{ flex: "none" }}>
          <rect x="0.5" y="0.5" width="19" height="15" rx="3" fill="none" stroke={C.g300} strokeWidth="1.4" />
          <path d="M4.5 5 L8 8 L4.5 11" fill="none" stroke={C.g300} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 11.2 H15" stroke={C.g300} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {title}
      </div>
      <span style={{ marginLeft: "auto", display: "flex", gap: 22, alignItems: "center", opacity: 0.5 }}>
        <span style={{ width: 14, height: 2, background: "#c8ccc8" }} />
        <span style={{ width: 13, height: 13, border: "2px solid #c8ccc8" }} />
        <span style={{ ...receipt(20, { color: "#c8ccc8" }) }}>✕</span>
      </span>
    </div>
    <div style={{ position: "relative", width, height, overflow: "hidden", background: "#0c0c0c" }}>
      {children}
      {tag ? (
        <div style={{ position: "absolute", right: 16, top: 16, padding: "8px 14px", borderRadius: 10, background: C.tomato, color: "#fff", ...receipt(15, { fontWeight: 700, letterSpacing: "0.04em" }), zIndex: 20 }}>{tag}</div>
      ) : null}
    </div>
  </div>
);

/** The two agents of the story, side by side: the browser one opened the shop, the terminal one buys. */
export const TwoAgents: React.FC<{ p: number; style?: React.CSSProperties }> = ({ p, style }) => {
  const pill = (active: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 12,
    height: 52,
    padding: "0 22px 0 16px",
    borderRadius: 999,
    background: active ? C.g800 : "transparent",
    boxShadow: active ? "none" : `inset 0 0 0 2px ${C.c300}`,
    color: active ? C.c50 : C.c700,
    fontFamily: FONT.text,
    fontWeight: 600,
    fontStretch: "104%",
    fontSize: 24,
    whiteSpace: "nowrap",
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: p, transform: `translateY(${(1 - p) * 12}px)`, ...style }}>
      <span style={pill(false)}>
        <svg width="24" height="20" viewBox="0 0 24 20">
          <rect x="1" y="1" width="22" height="18" rx="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M1 6.5 H23" stroke="currentColor" strokeWidth="2" />
        </svg>
        Claude in a browser opened it
      </span>
      <svg width="34" height="14" viewBox="0 0 34 14" style={{ color: C.c500 }}>
        <path d="M1 7 H31 M25 1.5 L31 7 L25 12.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={pill(true)}>
        <span style={{ width: 11, height: 11, borderRadius: 6, background: C.tomato, boxShadow: "0 0 0 5px rgba(235,75,53,.25)" }} />
        A different agent buys: Claude Code in a terminal
      </span>
    </div>
  );
};
