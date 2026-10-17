// Virtual time for frame-exact captures. Injected before any page script (page.addInitScript).
//
// The page's clock (setTimeout, setInterval, requestAnimationFrame, Date, performance.now) runs on a
// virtual clock. In "follow" mode it tracks real time, so pages load and hydrate normally. In
// "manual" mode it stops and only moves when the capture calls __vt.step(ms): due timers fire in
// order, animation frames run once, and every CSS animation/transition and SVG animation is paused
// and seeked to the virtual time. A capture then takes one screenshot per step, so the footage plays
// at exactly 30 fps with every page animation at its real speed, however long a screenshot takes.
(() => {
  if (window.__vt) return;
  const cfg = window.__VT_CFG || {};
  const realRAF = window.requestAnimationFrame.bind(window);
  const realSetInterval = window.setInterval.bind(window);
  const realPerfNow = performance.now.bind(performance);
  const RealDate = window.Date;
  const epoch0 = RealDate.now() - realPerfNow();

  let mode = cfg.frozen ? "frozen" : "follow";
  let v = cfg.frozen ? 0 : realPerfNow(); // virtual ms on the performance timeline
  let followOffset = 0; // in follow mode: v = realPerfNow() - followOffset

  // ---- timers ----
  let nextId = 1;
  const timers = new Map(); // id -> { at, fn, args, every }
  const toFn = (fn) => (typeof fn === "function" ? fn : () => (0, eval)(String(fn)));
  const vSetTimeout = (fn, ms = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { at: v + Math.max(0, Number(ms) || 0), fn: toFn(fn), args, every: 0, seq: id });
    return id;
  };
  const vSetInterval = (fn, ms = 0, ...args) => {
    const id = nextId++;
    const every = Math.max(4, Number(ms) || 0);
    timers.set(id, { at: v + every, fn: toFn(fn), args, every, seq: id });
    return id;
  };
  const vClear = (id) => {
    timers.delete(id);
  };
  window.setTimeout = vSetTimeout;
  window.setInterval = vSetInterval;
  window.clearTimeout = vClear;
  window.clearInterval = vClear;

  // ---- animation frames ----
  let rafs = new Map();
  window.requestAnimationFrame = (cb) => {
    const id = nextId++;
    rafs.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    rafs.delete(id);
  };

  // ---- clocks ----
  performance.now = () => v;
  function VDate(...args) {
    if (!new.target) return new RealDate(epoch0 + v).toString();
    return args.length ? new RealDate(...args) : new RealDate(epoch0 + v);
  }
  VDate.prototype = RealDate.prototype;
  VDate.now = () => Math.floor(epoch0 + v);
  VDate.parse = RealDate.parse;
  VDate.UTC = RealDate.UTC;
  window.Date = VDate;

  function runTimersUntil(target) {
    let guard = 0;
    for (;;) {
      let due = null;
      for (const [id, t] of timers) if (t.at <= target && (!due || t.at < due[1].at || (t.at === due[1].at && t.seq < due[1].seq))) due = [id, t];
      if (!due || ++guard > 10000) break;
      const [id, t] = due;
      if (t.at > v) v = t.at;
      if (t.every) {
        t.at += t.every;
        t.seq = nextId++;
      } else timers.delete(id);
      try {
        t.fn(...t.args);
      } catch (e) {
        console.error(e);
      }
    }
    v = Math.max(v, target);
  }
  function runFrames() {
    const list = rafs;
    rafs = new Map();
    for (const cb of list.values()) {
      try {
        cb(v);
      } catch (e) {
        console.error(e);
      }
    }
  }

  // ---- page animations (CSS, Web Animations, SVG SMIL) ----
  const tracked = new WeakMap();
  const svgStart = new WeakMap();
  function syncAnimations(pauseOnly) {
    let list = [];
    try {
      list = document.getAnimations();
    } catch {}
    for (const a of list) {
      let s = tracked.get(a);
      if (!s) {
        const ct = typeof a.currentTime === "number" ? a.currentTime : 0;
        s = { start: v - ct / (a.playbackRate || 1) };
        tracked.set(a, s);
      }
      try {
        if (a.playState !== "paused") a.pause();
        if (!pauseOnly) a.currentTime = Math.max(0, (v - s.start) * (a.playbackRate || 1));
      } catch {}
    }
    for (const svg of document.querySelectorAll("svg")) {
      if (svg.ownerSVGElement || typeof svg.pauseAnimations !== "function") continue;
      if (!svgStart.has(svg)) {
        svgStart.set(svg, v - svg.getCurrentTime() * 1000);
        svg.pauseAnimations();
      }
      if (!pauseOnly) svg.setCurrentTime(Math.max(0, (v - svgStart.get(svg)) / 1000));
    }
  }

  // ---- the pump: follow real time until a capture takes over ----
  const pump = () => {
    if (mode === "follow") {
      runTimersUntil(realPerfNow() - followOffset);
      runFrames();
    } else if (mode === "frozen") {
      syncAnimations(true); // hold every animation at its first frame
    }
    realRAF(pump);
  };
  realRAF(pump);
  // rAF stops in background tabs; timers must still fire while following
  realSetInterval(() => {
    if (mode === "follow") runTimersUntil(realPerfNow() - followOffset);
  }, 8);

  // ---- the cursor a viewer sees (headless pages have none) ----
  let cursorEl = null;
  function cursor(x, y, pressed, visible = true) {
    if (!cursorEl) {
      cursorEl = document.createElement("div");
      cursorEl.setAttribute("data-vt-cursor", "");
      cursorEl.style.cssText = "position:fixed;left:0;top:0;width:30px;height:30px;z-index:2147483647;pointer-events:none;transform-origin:6px 4px;will-change:transform";
      cursorEl.innerHTML =
        '<svg width="30" height="30" viewBox="0 0 30 30" style="overflow:visible;filter:drop-shadow(0 2px 3px rgba(0,25,15,.35))"><path d="M6 4 L6 25 L11.2 20.2 L14.6 27.6 L18.4 25.9 L15 18.6 L22 18.4 Z" fill="#081d13" stroke="#fcfcf7" stroke-width="2" stroke-linejoin="round"/></svg>';
      (document.body || document.documentElement).appendChild(cursorEl);
    }
    cursorEl.style.display = visible ? "block" : "none";
    cursorEl.style.transform = `translate(${x - 6}px, ${y - 4}px) scale(${pressed ? 0.86 : 1})`;
  }

  window.__vt = {
    get mode() {
      return mode;
    },
    now: () => v,
    /** stop the clock where it is; from now on only step() moves it */
    manual() {
      if (mode === "follow") runTimersUntil(realPerfNow() - followOffset);
      mode = "manual";
      syncAnimations(false);
    },
    /** resume following real time from the current virtual time */
    follow() {
      followOffset = realPerfNow() - v;
      mode = "follow";
      let list = [];
      try {
        list = document.getAnimations();
      } catch {}
      for (const a of list) {
        try {
          a.play();
        } catch {}
      }
    },
    step(ms) {
      if (mode !== "manual") this.manual();
      runTimersUntil(v + ms);
      runFrames();
      syncAnimations(false);
      return v;
    },
    cursor,
    pending: () => timers.size,
  };
})();
