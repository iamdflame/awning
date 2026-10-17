import React from "react";
import { Composition, Still } from "remotion";
import { loadFonts } from "./brand/fonts";
import { Cut30, calcCut30 } from "./Cut30";
import { Film, calcMain } from "./Main";
import { Thumbnail, calcThumb } from "./Thumbnail";
import { FPS } from "./timeline";

loadFonts();

export const Root: React.FC = () => (
  <>
    {/* the demo: one scene per narration line, each as long as its take plus breathing room */}
    <Composition id="Main" component={Film} width={1920} height={1080} fps={FPS} durationInFrames={115 * FPS} defaultProps={{}} calculateMetadata={calcMain} />
    {/* the 30 s cut for the feed */}
    <Composition id="Cut30" component={Cut30} width={1920} height={1080} fps={FPS} durationInFrames={30 * FPS} defaultProps={{}} calculateMetadata={calcCut30} />
    <Still id="Thumbnail" component={Thumbnail} width={1280} height={720} defaultProps={{}} calculateMetadata={calcThumb} />
  </>
);
