"use client";

import { useEffect } from "react";

/**
 * Progressive enhancement for a rendered document (the page reads fine without it):
 * highlights the section you're in, closes the phone contents after a jump, and
 * gives each code block a Copy button.
 */
export function DocEnhance() {
  useEffect(() => {
    const article = document.querySelector<HTMLElement>(".dc-article .md");
    if (!article) return;
    const cleanups: (() => void)[] = [];

    // --- table of contents: the section in view ---
    const links = new Map<string, HTMLAnchorElement>();
    document.querySelectorAll<HTMLAnchorElement>(".dc-toc a[href^='#']").forEach((a) => links.set(decodeURIComponent(a.hash.slice(1)), a));
    const heads = [...article.querySelectorAll<HTMLElement>("h2[id]")].filter((h) => links.has(h.id));
    if (heads.length) {
      let current = "";
      const update = () => {
        const line = window.innerHeight * 0.3;
        let id = heads[0]!.id;
        for (const h of heads) {
          if (h.getBoundingClientRect().top - line <= 0) id = h.id;
          else break;
        }
        if (id === current) return;
        links.get(current)?.removeAttribute("aria-current");
        current = id;
        const a = links.get(id);
        if (a) {
          a.setAttribute("aria-current", "true");
          const toc = a.closest<HTMLElement>(".dc-toc");
          if (toc && toc.scrollHeight > toc.clientHeight) {
            const top = a.offsetTop - toc.clientHeight / 2;
            toc.scrollTo({ top, behavior: "auto" });
          }
        }
      };
      let raf = 0;
      const onScroll = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(update);
      };
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      cleanups.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        cancelAnimationFrame(raf);
      });
    }

    // --- phone contents: close after a jump ---
    const mobile = document.querySelector<HTMLDetailsElement>(".dc-toc-m");
    const close = (e: Event) => {
      if ((e.target as HTMLElement).closest("a") && mobile) mobile.open = false;
    };
    mobile?.addEventListener("click", close);
    cleanups.push(() => mobile?.removeEventListener("click", close));

    // --- copy buttons on code blocks ---
    if (navigator.clipboard) {
      article.querySelectorAll<HTMLElement>("figure.md-code").forEach((fig) => {
        if (fig.querySelector(".md-copy")) return;
        const pre = fig.querySelector("pre");
        if (!pre) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "md-copy";
        btn.textContent = "Copy";
        btn.setAttribute("aria-label", "Copy this code");
        let timer = 0;
        btn.addEventListener("click", () => {
          navigator.clipboard.writeText(pre.innerText.replace(/\n$/, "")).then(
            () => {
              btn.textContent = "Copied";
              window.clearTimeout(timer);
              timer = window.setTimeout(() => (btn.textContent = "Copy"), 1600);
            },
            () => (btn.textContent = "Select and copy"),
          );
        });
        (fig.querySelector("figcaption") ?? fig).appendChild(btn);
      });
    }

    // --- diagrams wider than the column: a zoom toggle between the overview and the drawn size ---
    article.querySelectorAll<HTMLElement>(".md-svg").forEach((box) => {
      const tools = box.parentElement?.querySelector(".md-diagram-tools");
      const svg = box.querySelector("svg");
      const natural = parseFloat(box.style.getPropertyValue("--w"));
      if (!tools || !svg || tools.querySelector(".md-zoom") || !(natural > svg.getBoundingClientRect().width + 24)) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "md-zoom";
      btn.textContent = "Zoom in";
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", () => {
        const on = box.classList.toggle("is-zoomed");
        btn.textContent = on ? "Fit to width" : "Zoom in";
        btn.setAttribute("aria-pressed", String(on));
      });
      tools.prepend(btn);
    });

    return () => cleanups.forEach((c) => c());
  }, []);
  return null;
}
