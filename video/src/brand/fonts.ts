// Fonts load from public/fonts (OFL, downloaded by scripts/fetch-assets.mjs) before any frame renders.
import { continueRender, delayRender, staticFile } from "remotion";

type FontSpec = { family: string; file: string; weight?: string; stretch?: string };

const FONTS: FontSpec[] = [
  { family: "Archivo", file: "fonts/Archivo-VF.ttf", weight: "100 900", stretch: "62% 125%" },
  { family: "Martian Mono", file: "fonts/MartianMono-VF.ttf", weight: "100 800", stretch: "75% 112.5%" },
  // the storefronts' own faces, for the shopfronts on the street
  { family: "Alfa Slab One", file: "fonts/AlfaSlabOne-Regular.ttf" },
  { family: "Big Shoulders Display", file: "fonts/BigShouldersDisplay-VF.ttf", weight: "100 900" },
  { family: "Young Serif", file: "fonts/YoungSerif-Regular.ttf" },
  { family: "Shrikhand", file: "fonts/Shrikhand-Regular.ttf" },
  { family: "Rubik Mono One", file: "fonts/RubikMonoOne-Regular.ttf" },
  { family: "Gloock", file: "fonts/Gloock-Regular.ttf" },
  { family: "Bagel Fat One", file: "fonts/BagelFatOne-Regular.ttf" },
  { family: "Work Sans", file: "fonts/WorkSans-VF.ttf", weight: "100 900" },
];

let started = false;

export function loadFonts() {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("Loading fonts");
  Promise.all(
    FONTS.map(async (f) => {
      try {
        const face = new FontFace(f.family, `url("${staticFile(f.file)}") format("truetype")`, {
          weight: f.weight ?? "400",
          stretch: f.stretch ?? "100%",
          display: "block",
        });
        document.fonts.add(await face.load());
      } catch (e) {
        console.warn(`font ${f.family} did not load (run npm run assets):`, e);
      }
    }),
  ).finally(() => continueRender(handle));
}
