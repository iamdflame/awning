import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, type CalculateMetadataFunction } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { C } from "./brand/tokens";
import { Captions } from "./components/Captions";
import { presentationFor } from "./components/transitions";
import { CAPTION_SUBS, resolveAssets, resolveTakes, type Assets } from "./data";
import { FPS, buildCaptions, layout, speechSpans, type Caption, type SceneSpec, type Take, type Timeline } from "./timeline";
import type { SceneProps } from "./scenes/common";
import { S1Open } from "./scenes/S1Open";
import { S2Problem } from "./scenes/S2Problem";
import { S3Draft } from "./scenes/S3Draft";
import { S4Approve } from "./scenes/S4Approve";
import { S5Buy } from "./scenes/S5Buy";
import { S6Run } from "./scenes/S6Run";
import { S7Hood } from "./scenes/S7Hood";
import { S8Street } from "./scenes/S8Street";
import { S9End } from "./scenes/S9End";

/** One scene per narration line; pre/post are the designed breathing room around the voice (s). */
export const MAIN_SCENES: SceneSpec[] = [
  { id: "s1-open", vo: "vo-01", pre: 0.9, post: 0.9 },
  { id: "s2-problem", vo: "vo-02", pre: 0.15, post: 1.5, next: { kind: "canopy", frames: 28 } },
  { id: "s3-draft", vo: "vo-03", pre: 0.7, post: 0.6, next: { kind: "slide-left", frames: 16 } },
  { id: "s4-approve", vo: "vo-04", pre: 0.35, post: 1.6, next: { kind: "slide-left", frames: 18 } },
  { id: "s5-buy", vo: "vo-05", pre: 0.5, post: 1.4, next: { kind: "slide-right", frames: 18 } },
  { id: "s6-run", vo: "vo-06", pre: 0.4, post: 1.7, next: { kind: "canopy", frames: 28 } },
  { id: "s7-hood", vo: "vo-07", pre: 0.8, post: 1.4, next: { kind: "canopy", frames: 28 } },
  { id: "s8-street", vo: "vo-08", pre: 0.7, post: 1.1, next: { kind: "fade", frames: 12 } },
  { id: "s9-end", vo: "vo-09", pre: 0.6, post: 3.4 },
];

export const SCENES: Record<string, React.FC<SceneProps>> = {
  "s1-open": S1Open,
  "s2-problem": S2Problem,
  "s3-draft": S3Draft,
  "s4-approve": S4Approve,
  "s5-buy": S5Buy,
  "s6-run": S6Run,
  "s7-hood": S7Hood,
  "s8-street": S8Street,
  "s9-end": S9End,
};

export type FilmProps = {
  takes?: Record<string, Take>;
  assets?: Assets;
  timeline?: Timeline;
  captions?: Caption[];
  spans?: [number, number][];
};

export const calcMain: CalculateMetadataFunction<FilmProps> = async ({ props }) => {
  const [takes, assets] = await Promise.all([resolveTakes(), resolveAssets()]);
  const timeline = layout(MAIN_SCENES, takes, FPS);
  const captions = buildCaptions(timeline, takes, CAPTION_SUBS);
  const spans = speechSpans(timeline, takes);
  if (timeline.total > 135 * FPS) console.warn(`Main is ${(timeline.total / FPS).toFixed(1)} s, over the 2:15 limit`);
  return { durationInFrames: timeline.total, props: { ...props, takes, assets, timeline, captions, spans } };
};

/** The music bed, ducked under every spoken phrase (sidechain-style volume automation). */
export const MusicBed: React.FC<{ src: string | null; spans: [number, number][]; total: number; gap?: number; under?: number; from?: number }> = ({ src, spans, total, gap = 0.78, under = 0.26, from = 0 }) => {
  if (!src) return null;
  const vol = (f: number) => {
    let duck = 0;
    for (const [a, b] of spans) {
      if (f < a - 12 || f > b + 18) continue;
      duck = Math.max(duck, interpolate(f, [a - 12, a - 2, b + 4, b + 18], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
    }
    // after the last word the music has the end card to itself: it lifts, then fades out
    const lastWord = spans.length ? spans[spans.length - 1]![1] : total;
    const swell = interpolate(f, [lastWord + 6, lastWord + 30], [1, 1.12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const level = (gap + (under - gap) * duck) * swell;
    const fadeIn = interpolate(f, [0, 10], [0.55, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const fadeOut = interpolate(f, [total - 60, total - 2], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return Math.min(1, level * fadeIn * fadeOut);
  };
  return <Audio src={staticFile(src)} volume={vol} trimBefore={Math.round(from * FPS)} name="music" />;
};

/** A soft canvas flap as each canopy comes down. */
const TransitionSounds: React.FC<{ timeline: Timeline; cloth: string | null }> = ({ timeline, cloth }) => {
  if (!cloth) return null;
  return (
    <>
      {timeline.scenes.map((s, i) =>
        s.next.kind === "canopy" && i < timeline.scenes.length - 1 ? (
          <Sequence key={s.id} from={s.from + s.frames - s.next.frames} durationInFrames={45} layout="none">
            <Audio src={staticFile(cloth)} volume={0.3} />
          </Sequence>
        ) : null,
      )}
    </>
  );
};

export const Film: React.FC<FilmProps & { scenes?: Record<string, React.FC<SceneProps>> }> = ({ takes, assets, timeline, captions, spans, scenes = SCENES }) => {
  if (!takes || !assets || !timeline) return <AbsoluteFill style={{ background: C.c50 }} />;
  const items: React.ReactNode[] = [];
  timeline.scenes.forEach((s, i) => {
    const Scene = scenes[s.id]!;
    items.push(
      <TransitionSeries.Sequence key={s.id} durationInFrames={s.frames} name={s.id}>
        <Scene timing={s} take={s.vo ? takes[s.vo] : undefined} assets={assets} />
      </TransitionSeries.Sequence>,
    );
    if (i < timeline.scenes.length - 1 && s.next.kind !== "cut" && s.next.frames > 0) {
      items.push(<TransitionSeries.Transition key={`${s.id}-next`} presentation={presentationFor(s.next.kind)} timing={linearTiming({ durationInFrames: s.next.frames })} />);
    }
  });
  return (
    <AbsoluteFill style={{ background: C.c50 }}>
      <TransitionSeries>{items}</TransitionSeries>
      <MusicBed src={assets.music} spans={spans ?? []} total={timeline.total} />
      <TransitionSounds timeline={timeline} cloth={assets.sfx.cloth ?? null} />
      <Captions captions={captions ?? []} />
    </AbsoluteFill>
  );
};
