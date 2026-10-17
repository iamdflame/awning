"use client";

import { useEffect, type CSSProperties } from "react";
import { ART } from "@/lib/design/art";
import { EXTRA, SAMPLES, type SampleBusiness } from "@/lib/design/samples";
import { shopFromExtra } from "@/lib/design/street";
import { Shop } from "./shop";

/**
 * The hero street (design/landing/landing.js): a sentence is lettered on the
 * hoarding in the gap, the hoarding lifts, the shop opens with its website in
 * the window, its phone rings and an agent's first purchase prints on the
 * receipt. Then the next business. It is an illustration of the product with
 * the design's sample businesses, not live data.
 */
const B = SAMPLES;
const artFor = (b: SampleBusiness) => ART[b.art]({ ...b.palette, displayFont: b.fonts.display, textFont: b.fonts.text }, b.name, `hm-${b.slug}`);
const usd = (p: string) => p.replace(/\.00$/, "");
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function miniHTML(b: SampleBusiness): string {
  const up = b.hero === "poster";
  return `
      <div class="mini-rod"><span class="nm">${escape(b.name)}</span><span>${b.domain}</span></div>
      <div class="mini-body">
        <div>
          <h3 class="mini-name${up ? " up" : ""}">${up ? escape(b.name).replace(" &amp; ", "<br>&amp; ") : escape(b.name)}</h3>
          <p class="mini-tag">${escape(b.tagline)}</p>
          <ul class="mini-menu">${b.offers.map((o) => `<li data-id="${o.id}"><b>${escape(o.title)}</b><span>$${usd(o.price)}</span></li>`).join("")}</ul>
        </div>
        <div class="mini-art${b.hero === "arch" ? " arch" : ""}">${artFor(b)}</div>
      </div>`;
}

function lotVars(b: SampleBusiness): CSSProperties {
  const v: Record<string, string> = {};
  for (const [k, val] of Object.entries(b.palette)) v["--b-" + (k === "onAccent" ? "on-accent" : k)] = val;
  v["--b-display"] = `"${b.fonts.display}"`;
  v["--b-text"] = `"${b.fonts.text}"`;
  return v as CSSProperties;
}

const LEFT = [EXTRA[3]!, EXTRA[0]!].map((e) => shopFromExtra(e, "hn"));
const RIGHT = [EXTRA[1]!, EXTRA[2]!].map((e) => shopFromExtra(e, "hn"));

export function HeroStreet() {
  useEffect(() => {
    let dead = false;
    const $ = (id: string) => document.getElementById(id) as HTMLElement;
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) =>
        setTimeout(() => {
          if (dead) reject(new Error("unmounted"));
          else resolve();
        }, ms),
      );
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    function paint(b: SampleBusiness) {
      const lot = $("lot");
      for (const [k, v] of Object.entries(lotVars(b))) lot.style.setProperty(k, String(v));
      const up = b.hero === "poster";
      $("fName").textContent = b.name;
      $("fName").parentElement!.className = "signboard" + (up ? " up" : "");
      $("mini").innerHTML = miniHTML(b);
      return b.offers.find((o) => o.featured) ?? b.offers[0]!;
    }
    function line(l: string, r: string, cls = "") {
      const li = document.createElement("li");
      li.className = cls;
      li.innerHTML = `<span>${escape(l)}</span><span class="dots"></span><span>${escape(r)}</span>`;
      $("rcLines").append(li);
      requestAnimationFrame(() => requestAnimationFrame(() => li.classList.add("in")));
    }
    async function run(b: SampleBusiness, first: boolean) {
      const lot = $("lot");
      lot.classList.remove("built");
      $("sign").classList.remove("is-open");
      $("ring").className = "ring";
      $("receipt").className = "receipt";
      await wait(first ? 0 : 900); // the hoarding comes back down before the next shop
      const featured = paint(b);
      $("rcLines").innerHTML = "";
      $("rcTotal").className = "total";
      $("rcName").textContent = b.name.toUpperCase();
      const t = $("typed");
      t.textContent = "";
      if (reduce) t.textContent = b.sentence;
      else
        for (const ch of b.sentence) {
          t.textContent += ch;
          await wait(ch === " " ? 30 : 24);
        }
      await wait(600);
      $("receipt").classList.add("show");
      line("awning_plan", "ready");
      await wait(420);
      line(b.domain, "registered");
      await wait(420);
      line("PayBox", "1 tap");
      await wait(500);
      lot.classList.add("built");
      await wait(1500);
      line("storefront", "live");
      $("sign").classList.add("is-open");
      await wait(800);
      $("ringNum").textContent = b.phone;
      $("ringLabel").textContent = `${b.receptionist} answers the new line`;
      $("ring").classList.add("show", "ringing");
      line("phone line", "ringing");
      await wait(1400);
      line("an agent buys", featured.title.toLowerCase().split(" ").slice(0, 2).join(" "), "agent");
      document.querySelector(`.mini-menu li[data-id="${featured.id}"]`)?.classList.add("sold");
      await wait(450);
      $("rcAmt").textContent = "+" + featured.price;
      $("rcAgent").innerHTML = `USDC FROM AN AGENT<br>TO ${b.wallet}`;
      $("rcTotal").classList.add("in", "pop");
      await wait(reduce ? 0 : 4800);
    }

    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
    });
    io.observe($("lot"));
    (async () => {
      try {
        if (reduce) {
          await run(B[0]!, true);
          return;
        }
        await wait(400);
        for (let i = 0; ; i++) {
          while (!visible) await wait(400);
          await run(B[i % B.length]!, i === 0);
        }
      } catch {
        /* unmounted */
      }
    })();
    return () => {
      dead = true;
      io.disconnect();
    };
  }, []);

  const first = B[0]!;
  return (
    <div
      className="hstreet"
      role="img"
      aria-label="A street of small shops. In the gap, a sentence typed to an AI agent becomes a new shop: Ridge Roast, with its own domain, website, phone line and a first order paid by another AI agent."
    >
      <div className="hstage">
        <div className="hrow hrow-l" id="rowL" aria-hidden="true">
          {LEFT.map((s) => (
            <Shop key={s.key} s={s} tag={false} />
          ))}
        </div>
        <div className="lot" id="lot" aria-hidden="true" style={lotVars(first)}>
          <div className="facade" id="facade">
            <span className="cornice" />
            <div className="signboard">
              <span id="fName">{first.name}</span>
            </div>
            <div className="f-awning" />
            <div className="f-front">
              <div className="f-win">
                <div className="f-glass" id="glass">
                  <div className="mini" id="mini" dangerouslySetInnerHTML={{ __html: miniHTML(first) }} />
                </div>
              </div>
              <div className="f-door">
                <div className="sign" id="sign">
                  <svg className="chain" viewBox="0 0 62 40">
                    <path d="M10 40 31 4l21 36" fill="none" stroke="currentColor" strokeWidth="2" />
                    <circle cx="31" cy="4" r="3.5" fill="currentColor" />
                  </svg>
                  <div className="board">
                    <div className="face closed">CLOSED</div>
                    <div className="face open">OPEN</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="hoarding" id="hoarding">
            <p>
              <span className="who">You, to your agent</span>
              <span id="typed" />
              <span className="caret" />
            </p>
          </div>
        </div>
        <div className="hrow hrow-r" id="rowR" aria-hidden="true">
          {RIGHT.map((s) => (
            <Shop key={s.key} s={s} tag={false} />
          ))}
        </div>
        <div className="ring" id="ring" aria-hidden="true">
          <span className="ic">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
            </svg>
          </span>
          <span>
            <small id="ringLabel">Phone line</small>
            <strong id="ringNum">&nbsp;</strong>
          </span>
        </div>
        <div className="receipt" id="receipt" aria-hidden="true">
          <h4>
            <span id="rcName">OPENING</span>
            <span id="rcTime">10:02</span>
          </h4>
          <ul id="rcLines" />
          <div className="total" id="rcTotal">
            <small id="rcAgent">
              PAID BY AN AGENT
              <br />
              TO YOUR WALLET
            </small>
            <b id="rcAmt">+5.00</b>
          </div>
        </div>
      </div>
      <div className="curb" />
    </div>
  );
}
