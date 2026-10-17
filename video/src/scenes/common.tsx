import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import type { Assets } from "../data";
import { wordFrame, type SceneTiming, type Take } from "../timeline";
import { C } from "../brand/tokens";

export type SceneProps = { timing: SceneTiming; take?: Take; assets: Assets };

/** Frame (in the scene) where a word of this scene's line starts; `nth` picks a repeat. */
export const wordsOf = (take: Take | undefined, timing: SceneTiming) => (match: string, nth = 0) => wordFrame(take, timing, match, nth);

/** The narration line of a scene, placed where the layout says it starts. */
export const Voice: React.FC<{ timing: SceneTiming; take?: Take }> = ({ timing, take }) =>
  take?.src ? (
    <Sequence from={timing.voAt} durationInFrames={Math.max(1, timing.voFrames + 6)} layout="none" name={`voice ${take.id}`}>
      <Audio src={staticFile(take.src)} volume={1} />
    </Sequence>
  ) : null;

/** A sound effect at a frame, quietly. Missing files are skipped. */
export const Sfx: React.FC<{ src: string | null | undefined; at: number; volume?: number; dur?: number; rate?: number }> = ({ src, at, volume = 0.25, dur = 75, rate }) =>
  src ? (
    <Sequence from={Math.max(0, Math.round(at))} durationInFrames={dur} layout="none" name="sfx">
      <Audio src={staticFile(src)} volume={volume} playbackRate={rate} />
    </Sequence>
  ) : null;

const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n" x="0" y="0"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0"/></filter><rect width="220" height="220" filter="url(#n)"/></svg>',
)}")`;

/** A ground color with a whisper of paper grain (static, so it costs nothing to encode). */
export const Ground: React.FC<{ color?: string; grain?: number; children?: React.ReactNode; style?: React.CSSProperties }> = ({ color = C.c50, grain = 0.05, children, style }) => (
  <AbsoluteFill style={{ background: color, ...style }}>
    {children}
    {grain > 0 ? <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: grain, mixBlendMode: "multiply", pointerEvents: "none" }} /> : null}
  </AbsoluteFill>
);
