import { interpolate } from "remotion";
import { EASE } from "../brand/tokens";

/** A camera key: the point (x, y) of the source (0..1) at the center of the view, at zoom z. */
export type CamKey = { at: number; x: number; y: number; z: number; ease?: keyof typeof EASE | "linear" };

export function camAt(keys: CamKey[] | undefined, f: number): { x: number; y: number; z: number } {
  if (!keys || !keys.length) return { x: 0.5, y: 0.5, z: 1 };
  if (f <= keys[0]!.at) return keys[0]!;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!;
    const b = keys[i]!;
    if (f <= b.at) {
      const ease = b.ease === "linear" ? (t: number) => t : EASE[b.ease ?? "inOut"];
      const p = interpolate(f, [a.at, b.at], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
      // zoom moves in log space so push-ins feel even
      const z = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * p);
      return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, z };
    }
  }
  return keys[keys.length - 1]!;
}

/** Transform for a layer the size of the view showing the whole source at z = 1. */
export function camTransform(c: { x: number; y: number; z: number }, w: number, h: number): string {
  const z = Math.max(1, c.z);
  const half = 0.5 / z;
  const x = Math.min(1 - half, Math.max(half, c.x));
  const y = Math.min(1 - half, Math.max(half, c.y));
  const tx = w / 2 - x * w * z;
  const ty = h / 2 - y * h * z;
  return `translate(${tx}px, ${ty}px) scale(${z})`;
}

/** A rect [x, y, w, h] (fractions of the source) → the camera key that frames it in a view of aspect `aspect`. */
export function frameRect(at: number, r: [number, number, number, number], aspect = 16 / 9, pad = 1.12, ease?: CamKey["ease"]): CamKey {
  const [x, y, w, h] = r;
  // the source is 16:9 too: zoom so the rect (padded) fits both ways
  const z = Math.max(1, Math.min(1 / (w * pad), 1 / (h * pad * (aspect / (16 / 9)))));
  return { at, x: x + w / 2, y: y + h / 2, z, ease };
}
