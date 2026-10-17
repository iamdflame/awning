import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { Caption } from "../timeline";
import { C, FONT } from "../brand/tokens";

/**
 * Burned-in captions: the narration's own words, two lines at most, large enough for a phone,
 * on a dark band that reads over anything. The word being spoken is lit in sun yellow.
 */
export const Captions: React.FC<{ captions: Caption[]; bottom?: number; size?: number; maxWidth?: number }> = ({ captions, bottom = 44, size = 50, maxWidth = 1500 }) => {
  const frame = useCurrentFrame();
  const cap = captions.find((c) => frame >= c.from && frame <= c.to);
  if (!cap) return null;
  const fadeIn = interpolate(frame, [cap.from, cap.from + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [cap.to - 4, cap.to], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const o = Math.min(fadeIn, fadeOut);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 100 }}>
      <div
        style={{
          maxWidth,
          padding: `${size * 0.26}px ${size * 0.6}px ${size * 0.32}px`,
          borderRadius: size * 0.36,
          background: "rgba(0, 25, 15, 0.86)",
          color: C.c50,
          fontFamily: FONT.text,
          fontWeight: 600,
          fontStretch: "104%",
          fontSize: size,
          lineHeight: 1.24,
          letterSpacing: "-0.005em",
          textAlign: "center",
          textWrap: "balance",
          opacity: o,
          transform: `translateY(${(1 - fadeIn) * 8}px)`,
          boxShadow: "0 10px 30px rgba(0,25,15,.25)",
        }}
      >
        {cap.words.map((w, i) => {
          const spoken = frame >= w.from;
          const current = frame >= w.from && frame < (cap.words[i + 1]?.from ?? w.to + 6);
          return (
            <React.Fragment key={i}>
              <span style={{ color: current ? C.sun : spoken ? C.c50 : "rgba(247,246,237,.62)", transition: "none" }}>{w.w}</span>
              {i < cap.words.length - 1 ? " " : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
