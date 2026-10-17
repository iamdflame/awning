// Remotion CLI settings (npx remotion studio / still / render). scripts/render.mjs sets the same
// values through the Node API for the delivery renders.
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("src/index.ts");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setAudioBitrate("192k");
// the GPU path renders CSS masks, filters and blur faster on Windows
Config.setChromiumOpenGlRenderer("angle");
Config.setConcurrency(null);
