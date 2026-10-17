import React from "react";
import { C, FONT } from "../brand/tokens";

/**
 * The buyer's beat starts with the contrast that makes it a test: the owner's chat opened Ridge
 * Roast; a fresh chat, which knows nothing about it, finds the shop on its own and buys.
 */
export const TwoChats: React.FC<{ p: number; style?: React.CSSProperties }> = ({ p, style }) => {
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
  const bubble = (filled: boolean) => (
    <svg width="24" height="22" viewBox="0 0 24 22">
      <path d="M3 2.5 H21 a2 2 0 0 1 2 2 V14 a2 2 0 0 1 -2 2 H10 L5 20 V16 H3 a2 2 0 0 1 -2 -2 V4.5 a2 2 0 0 1 2 -2 Z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: p, transform: `translateY(${(1 - p) * 12}px)`, ...style }}>
      <span style={pill(false)}>
        {bubble(false)}
        The owner's chat opened it
      </span>
      <svg width="34" height="14" viewBox="0 0 34 14" style={{ color: C.c500 }}>
        <path d="M1 7 H31 M25 1.5 L31 7 L25 12.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={pill(true)}>
        <span style={{ color: C.sun, display: "inline-flex" }}>{bubble(true)}</span>
        A fresh chat finds it on its own
      </span>
    </div>
  );
};
