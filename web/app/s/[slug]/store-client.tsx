"use client";

import { useEffect } from "react";

/**
 * The storefront's only script (storefront.js's click handler): copy buttons, and
 * each offer's button points the "Buy with your AI agent" slip at that offer.
 */
export function StoreClient() {
  useEffect(() => {
    const onClick = async (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const pick = target?.closest<HTMLElement>("[data-sku]");
      if (pick) {
        const { prompt = "", link = "" } = pick.dataset;
        const p = document.getElementById("p1");
        const l = document.getElementById("l1");
        if (p) p.textContent = `“${prompt}”`;
        if (l) l.textContent = link;
        document.querySelector<HTMLElement>('[data-copy-role="prompt"]')?.setAttribute("data-copy", prompt);
        document.querySelector<HTMLElement>('[data-copy-role="link"]')?.setAttribute("data-copy", link);
        return; // the link itself scrolls to #agent
      }
      const btn = target?.closest<HTMLElement>("[data-copy]");
      if (!btn) return;
      try {
        await navigator.clipboard.writeText(btn.dataset.copy ?? "");
      } catch {
        /* clipboard blocked: the text stays selectable */
      }
      const was = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = was), 1400);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
