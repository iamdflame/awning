import { ImageResponse } from "next/og";
import { buildStoreView, usd, type StoreView } from "@/lib/design/storefront";
import { getBusinessByDomain, getBusinessBySlug, offersFor } from "@/lib/services/businesses";
import { imageData, imagesFor } from "@/lib/services/images";

export const runtime = "nodejs";
export const alt = "A storefront opened with Awning";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type FontSpec = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700 | 800 | 900; style: "normal" };

/** One Google font, subset to `text` (TTF, which next/og can read). Null when unreachable. */
async function googleFont(family: string, text: string, weight?: number): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}${weight ? `:wght@${weight}` : ""}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url, { signal: AbortSignal.timeout(4000) })).text();
    const src = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1];
    if (!src) return null;
    const res = await fetch(src, { signal: AbortSignal.timeout(4000) });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function load(param: string): Promise<{ v: StoreView; photo: string | null } | null> {
  const key = decodeURIComponent(param).toLowerCase();
  const b = key.includes(".") ? await getBusinessByDomain(key) : await getBusinessBySlug(key);
  if (!b) return null;
  const [offers, imgs] = await Promise.all([offersFor(b.id), imagesFor(b.id).catch(() => ({}) as Awaited<ReturnType<typeof imagesFor>>)]);
  const v = buildStoreView(b, offers, imgs);
  let photo: string | null = null;
  if (imgs.hero && v.status !== "suspended") {
    const data = await imageData(imgs.hero.id).catch(() => null);
    if (data) {
      const { default: sharp } = await import("sharp");
      const jpg = await sharp(data.bytes).resize(520, 560, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
      photo = `data:image/jpeg;base64,${jpg.toString("base64")}`;
    }
  }
  return { v, photo };
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const data = await load((await params).slug);
  if (!data) {
    return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", background: "#00683b" }} />, size);
  }
  const { v, photo } = data;
  const t = v.theme;
  const closed = v.status === "suspended";
  const poster = v.structure.hero === "poster";
  const offers = closed ? [] : v.offers.slice(0, 3);
  const name = poster ? v.name.toUpperCase() : v.name;
  const longest = Math.max(4, ...name.split(/\s+/).map((w) => w.length));
  const nameSize = Math.min(poster ? 132 : 112, Math.floor(600 / (longest * (poster ? 0.47 : 0.66))));
  const text = [name, v.name, v.tagline, ...offers.flatMap((o) => [o.title, usd(o.price)]), "Opening soon Closed for review", "0123456789$.,"].join(" ");
  const [display, body, ribbon] = await Promise.all([
    googleFont(v.structure.display, text, poster ? 900 : undefined),
    googleFont(v.structure.text, text, 600),
    googleFont("Archivo", `Opened with Awning ${v.domain} Open yours in one sentence`, 700),
  ]);
  const fonts: FontSpec[] = [];
  if (display) fonts.push({ name: "Display", data: display, weight: poster ? 900 : 400, style: "normal" });
  if (body) fonts.push({ name: "Text", data: body, weight: 600, style: "normal" });
  if (ribbon) fonts.push({ name: "Ribbon", data: ribbon, weight: 700, style: "normal" });
  const art = photo ?? `data:image/svg+xml;base64,${Buffer.from(v.art).toString("base64")}`;
  const stripes = Array.from({ length: 24 }, (_, i) => i);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: t.ground, color: t.ink, fontFamily: "Text" }}>
        <div style={{ display: "flex", height: 66 }}>
          {stripes.map((i) => (
            <div
              key={i}
              style={{
                width: 50,
                height: closed ? 22 : 66,
                background: i % 2 ? t.stripeB : t.stripeA,
                borderBottomLeftRadius: closed || v.structure.canopy !== "scallop" ? 0 : 25,
                borderBottomRightRadius: closed || v.structure.canopy !== "scallop" ? 0 : 25,
              }}
            />
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", padding: "26px 56px 0 64px", gap: 44 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
            <div style={{ fontFamily: "Display", fontSize: nameSize, lineHeight: 0.92, letterSpacing: -1, display: "flex", flexWrap: "wrap" }}>{name}</div>
            <div style={{ fontSize: 28, lineHeight: 1.3, marginTop: 28, opacity: 0.9, display: "flex" }}>{closed ? "Closed while Awning reviews a report." : v.tagline}</div>
            {offers.length ? (
              <div style={{ display: "flex", flexDirection: "column", marginTop: 26, padding: "8px 22px", borderRadius: 18, background: v.structure.hero === "sign" ? t.deep : "transparent", border: v.structure.hero === "sign" ? "none" : `3px solid ${t.ink}` }}>
                {offers.map((o, i) => (
                  <div key={o.sku} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0", borderTop: i ? `2px dashed ${t.ink}44` : "none", fontSize: 24 }}>
                    <span style={{ display: "flex" }}>{o.title}</span>
                    <span style={{ fontFamily: "Display", fontSize: 34, marginLeft: 20, display: "flex" }}>{usd(o.price)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div style={{ width: 420, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {photo ? (
              <img src={art} width={400} height={430} style={{ borderRadius: 22, border: `10px solid ${t.ink}`, objectFit: "cover", transform: "rotate(2deg)" }} />
            ) : (
              <img src={art} width={420} height={420} />
            )}
          </div>
        </div>
        <div style={{ height: 52, marginTop: 22, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", background: "#00683b", color: "#f7f6ed", fontFamily: "Ribbon", fontSize: 20 }}>
          <span style={{ display: "flex" }}>{v.status === "draft" ? "Opening soon · " : ""}Opened with Awning</span>
          <span style={{ display: "flex", opacity: 0.8 }}>{v.domain}</span>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
