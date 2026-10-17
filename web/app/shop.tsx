import type { CSSProperties } from "react";
import type { ShopView } from "@/lib/design/street";

/**
 * One drawn shopfront on the street (landing.js shopHTML). Real shops link to
 * their storefront and show a tag on hover; examples are not links and carry a
 * visible "Example" notice in the window.
 */
export function Shop({ s, hidden = false, tag = true }: { s: ShopView; hidden?: boolean; tag?: boolean }) {
  const style = {
    "--w": `${s.w}px`,
    "--h": `${s.h}px`,
    "--wall": s.wall,
    "--trim": s.trim,
    "--sA": s.sA,
    "--sB": s.sB,
    "--glass": s.glass,
    "--disp": `'${s.disp}'`,
    "--dw": s.dw,
    "--fs": `${s.fs}px`,
  } as CSSProperties;
  const inner = (
    <>
      {tag ? (
        <span className="tag">
          <b>{s.tagTitle}</b>
          {s.tagLine}
        </span>
      ) : null}
      <span className="cornice" />
      <span className="signboard">{s.name}</span>
      <span className="aw" />
      <span className="front">
        <span className="win">
          <span className="art-slot" dangerouslySetInnerHTML={{ __html: s.art }} />
          {s.example && tag ? <span className="ex">Example</span> : null}
        </span>
        <span className="door" />
      </span>
    </>
  );
  if (s.href)
    return (
      <a className="shop" href={s.href} style={style} {...(hidden ? { tabIndex: -1, "aria-hidden": true } : {})}>
        {inner}
      </a>
    );
  return (
    <span className={s.example && tag ? "shop is-example" : "shop"} style={style} aria-hidden={hidden || !tag ? true : undefined}>
      {inner}
    </span>
  );
}
