import React from "react";
import { Video, type VideoObjectFit } from "@remotion/media";

/**
 * Every piece of footage in the film plays through this: @remotion/media's <Video>, which decodes
 * in the render tab with WebCodecs. (<OffthreadVideo> dropped frames under memory pressure with
 * several 3K captures and 1080p recordings open at once: "No frame found at position".)
 * Footage is always muted: the film's sound is the narration, the music and its own effects.
 */
export const Clip: React.FC<{ src: string; trimBefore?: number; style?: React.CSSProperties; objectFit?: VideoObjectFit }> = ({ src, trimBefore, style, objectFit = "fill" }) => (
  <Video src={src} trimBefore={trimBefore} muted objectFit={objectFit} style={style} showInTimeline={false} />
);
