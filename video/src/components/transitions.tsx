import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";
import { Canopy } from "../brand/Canopy";
import { C, EASE } from "../brand/tokens";
import type { TransitionKind } from "../timeline";

type CanopyProps = { a: string; b: string; rod: string };

/**
 * The act break: Awning's canopy rolls down over the outgoing scene (with a little bounce, like
 * canvas settling), then rolls back up to reveal the next act.
 */
const CanopyPresentation: React.FC<TransitionPresentationComponentProps<CanopyProps>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const exiting = presentationDirection === "exiting";
  if (exiting) return <AbsoluteFill style={{ opacity: p < 0.5 ? 1 : 0 }}>{children}</AbsoluteFill>;
  const down = interpolate(p, [0, 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });
  const up = interpolate(p, [0.56, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut });
  const cover = p < 0.5 ? down : 1 - up;
  const sw = 120;
  const height = 1080 + sw; // tall enough that its scallops clear the frame when it is down
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: p < 0.5 ? 0 : 1 }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 44, background: passedProps.rod, zIndex: 2, transform: `translateY(${(cover > 0.001 ? 0 : -1) * 44}px)` }} />
        <Canopy sw={sw} height={height} a={passedProps.a} b={passedProps.b} progress={Math.max(0.0001, cover)} style={{ position: "absolute", left: 0, right: 0, top: 30 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const canopy = (props: Partial<CanopyProps> = {}): TransitionPresentation<CanopyProps> => ({
  component: CanopyPresentation,
  props: { a: C.g600, b: C.c0, rod: C.g800, ...props },
});

export function presentationFor(kind: TransitionKind): TransitionPresentation<Record<string, unknown>> {
  switch (kind) {
    case "canopy":
      return canopy() as unknown as TransitionPresentation<Record<string, unknown>>;
    case "slide-left":
      return slide({ direction: "from-right" }) as unknown as TransitionPresentation<Record<string, unknown>>;
    case "slide-right":
      return slide({ direction: "from-left" }) as unknown as TransitionPresentation<Record<string, unknown>>;
    case "slide-up":
      return slide({ direction: "from-bottom" }) as unknown as TransitionPresentation<Record<string, unknown>>;
    default:
      return fade() as unknown as TransitionPresentation<Record<string, unknown>>;
  }
}
