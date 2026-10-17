import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE, FONT, receipt } from "../brand/tokens";
import { Stamp } from "../components/Kinetic";
import { BUSINESS, OPEN_STEPS } from "../story";
import { Ground, Sfx, Voice, wordsOf, type SceneProps } from "./common";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const useAppear = (at: number) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - at, fps, config: { damping: 16, mass: 0.7, stiffness: 140 } });
};

const Card: React.FC<{ x: number; y: number; w: number; h: number; at: number; dark?: boolean; glow?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ x, y, w, h, at, dark, glow = 0, children, style }) => {
  const p = useAppear(at);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 26,
        padding: "26px 30px",
        background: dark ? C.g800 : C.c0,
        color: dark ? C.c50 : C.c900,
        boxShadow: `0 0 0 ${3 * glow}px ${C.sun}, 0 ${20 * glow}px ${60 * glow}px rgba(250,202,75,${0.25 * glow}), 0 30px 60px -20px rgba(0,0,0,.45)`,
        opacity: p,
        transform: `translateY(${(1 - p) * 30}px) scale(${0.96 + 0.04 * p})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const Title: React.FC<{ children: React.ReactNode; size?: number; color?: string }> = ({ children, size = 42, color }) => (
  <div style={{ fontFamily: FONT.display, fontWeight: 800, fontStretch: "112%", fontSize: size, letterSpacing: "-0.02em", lineHeight: 1.05, color }}>{children}</div>
);
const Sub: React.FC<{ children: React.ReactNode; color?: string; size?: number }> = ({ children, color, size = 24 }) => <div style={{ fontFamily: FONT.text, fontSize: size, lineHeight: 1.35, marginTop: 8, color: color ?? "inherit", opacity: color ? 1 : 0.72 }}>{children}</div>;

/** A connector that draws itself from `at`; `dash` for links that never carry money. */
const Arrow: React.FC<{ d: string; at: number; dur?: number; color?: string; dash?: boolean; width?: number; label?: React.ReactNode; lx?: number; ly?: number }> = ({ d, at, dur = 14, color = C.g300, dash, width = 4, label, lx = 0, ly = 0 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + dur], [0, 1], { ...clamp, easing: EASE.inOut });
  return (
    <>
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
        <defs>
          <marker id={`arrow-${color.replace("#", "")}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={color} />
          </marker>
        </defs>
        <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" pathLength={1} strokeDasharray={dash ? "0.012 0.018" : "1 1"} strokeDashoffset={dash ? 0 : 1 - p} opacity={dash ? p : 1} markerEnd={p > 0.95 ? `url(#arrow-${color.replace("#", "")})` : undefined} />
      </svg>
      {label ? <div style={{ position: "absolute", left: lx, top: ly, opacity: interpolate(f, [at + dur * 0.6, at + dur], [0, 1], clamp), ...receipt(19, { color, fontWeight: 600, whiteSpace: "nowrap" }) }}>{label}</div> : null}
    </>
  );
};

/** A USDC coin moving along a quadratic curve. */
const Coin: React.FC<{ from: [number, number]; via: [number, number]; to: [number, number]; at: number; dur?: number; label: string }> = ({ from, via, to, at, dur = 26, label }) => {
  const f = useCurrentFrame();
  const t = interpolate(f, [at, at + dur], [0, 1], { ...clamp, easing: EASE.inOut });
  if (f < at - 2) return null;
  const x = (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * via[0] + t * t * to[0];
  const y = (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * via[1] + t * t * to[1];
  const land = interpolate(f, [at + dur, at + dur + 8], [1, 1.25], clamp);
  return (
    <div style={{ position: "absolute", left: x - 70, top: y - 34, width: 140, height: 68, borderRadius: 34, background: C.sun, color: C.g900, display: "grid", placeItems: "center", fontFamily: FONT.display, fontWeight: 800, fontStretch: "112%", fontSize: 30, letterSpacing: "-0.02em", boxShadow: "0 12px 30px rgba(0,0,0,.35)", transform: `scale(${t >= 1 ? 2 - land : 1})`, opacity: t >= 1 ? interpolate(f, [at + dur, at + dur + 10], [1, 0], clamp) : 1 }}>
      {label}
    </div>
  );
};

type StepState = "wait" | "ok" | "fail" | "skip";
const StepRow: React.FC<{ name: string; state: StepState; money?: boolean; hl?: number }> = ({ name, state, money, hl = 0 }) => {
  const color = state === "ok" ? C.g600 : state === "fail" ? C.tomatoDeep : C.c500;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, height: 56, padding: "0 14px", margin: "0 -14px", borderRadius: 12, background: `rgba(250,202,75,${0.32 * hl})` }}>
      <span style={{ width: 30, height: 30, borderRadius: 15, flex: "none", display: "grid", placeItems: "center", background: state === "wait" || state === "skip" ? "transparent" : color, border: state === "wait" || state === "skip" ? `3px solid ${C.c300}` : "none", color: "#fff", fontSize: 18, fontWeight: 800, fontFamily: FONT.text }}>
        {state === "ok" ? "✓" : state === "fail" ? "✕" : ""}
      </span>
      <span style={{ ...receipt(27, { fontWeight: money ? 700 : 500, color: state === "skip" ? C.c500 : C.c900, textDecoration: state === "skip" ? "line-through" : "none" }) }}>{name}</span>
      {money ? <span style={{ marginLeft: "auto", fontFamily: FONT.text, fontWeight: 700, fontSize: 21, color: state === "ok" ? C.g600 : state === "skip" ? C.tomatoDeep : C.c700 }}>{state === "ok" ? "USDC moves now" : state === "skip" ? "nothing moves" : "money moves last"}</span> : null}
    </div>
  );
};

/**
 * vo-07 "Under the hood, the plugin never moves money. It proposes, and PayBox asks you. Awning only
 * takes the payment after the shop is live, so if anything fails, you're not charged. Sales go
 * straight to the owner's wallet. Awning never holds them."
 * The mechanism, drawn: agent → plugin (proposes) → PayBox asks you → the signed x402 payment →
 * Awning verifies, provisions, and settles last; the same run with a failure moves nothing; then a
 * sale goes from the buyer's PayBox straight to the owner's wallet while Awning only checks it.
 */
export const S7Hood: React.FC<SceneProps> = ({ timing, take, assets }) => {
  const f = useCurrentFrame();
  const w = wordsOf(take, timing);
  const tUnder = w("Under");
  const tPlugin = w("plugin");
  const tNever = w("never");
  const tProposes = w("proposes,");
  const tAsks = w("asks");
  const tYou = w("you.");
  const tOnly = w("only");
  const tPayment = w("payment");
  const tLive = w("live,");
  const tIf = w("if");
  const tFails = w("fails,");
  const tNot = w("not");
  const tSales = w("Sales");
  const tOwners = w("owner's");
  const tNever2 = w("never", 1);
  const tHolds = w("holds");

  // phase 1 → phase 2
  const ph2 = interpolate(f, [tSales - 10, tSales + 6], [0, 1], { ...clamp, easing: EASE.inOut });
  const glowPlugin = interpolate(f, [tPlugin - 4, tPlugin + 6, tAsks, tAsks + 8], [0, 1, 1, 0], clamp);
  const approved = f >= tYou + 6;
  const pressed = interpolate(f, [tYou, tYou + 6], [0, 1], clamp);

  // the run: verify, then the saga, then settle, paced to "after the shop is live"
  const names = ["verify", ...OPEN_STEPS, "settle"];
  const runStart = tPayment - 4;
  const runEnd = tLive + 2;
  const stepAt = (i: number) => runStart + ((runEnd - runStart) * i) / (names.length - 1);
  const failRun = f >= tIf - 4;
  const failAt = tFails;
  const states: StepState[] = names.map((n, i) => {
    if (!failRun) return f >= stepAt(i) ? "ok" : "wait";
    // the failure replay: preflight and hosting pass, the registrar fails, nothing after runs
    const reAt = tIf - 2 + i * 3;
    if (n === "register_domain") return f >= failAt ? "fail" : f >= reAt ? "wait" : "wait";
    if (i < names.indexOf("register_domain")) return f >= reAt ? "ok" : "wait";
    return f >= failAt + 4 ? "skip" : "wait";
  });
  const settleHl = !failRun ? interpolate(f, [runEnd - 2, runEnd + 6], [0, 1], clamp) : 0;

  return (
    <Ground color={C.g900} grain={0.06}>
      <Voice timing={timing} take={take} />
      <Sfx src={assets.sfx.chime} at={tYou + 6} volume={0.26} />
      <Sfx src={assets.sfx.pop} at={runEnd} volume={0.24} />
      <Sfx src={assets.sfx.pop} at={tOwners} volume={0.26} />
      {/* faint dot grid: a drawing board, not a dashboard */}
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(247,246,237,.09) 1.6px, transparent 1.6px)", backgroundSize: "36px 36px", opacity: 0.8 }} />
      <div style={{ position: "absolute", left: 80, top: 56, fontFamily: FONT.text, fontWeight: 600, fontSize: 30, color: C.g300, opacity: interpolate(f, [tUnder - 8, tUnder + 4], [0, 1], clamp) }}>Under the hood</div>

      {/* ---------- phase 1: opening a shop ---------- */}
      <AbsoluteFill style={{ opacity: 1 - ph2, transform: `translateY(${ph2 * -30}px)` }}>
        <Card x={60} y={300} w={290} h={220} at={tUnder}>
          <Title>Your agent</Title>
          <Sub>Claude, in a browser or a terminal, with PayBox</Sub>
        </Card>
        {/* PayBox */}
        <div style={{ position: "absolute", left: 470, top: 150, width: 700, height: 580, borderRadius: 34, background: "rgba(0,59,35,.65)", boxShadow: "inset 0 0 0 2px rgba(247,246,237,.1)", opacity: interpolate(f, [tUnder + 2, tUnder + 12], [0, 1], clamp) }}>
          <div style={{ position: "absolute", left: 34, top: 26 }}>
            <Title size={40} color={C.c50}>PayBox</Title>
            <Sub color="rgba(205,243,219,.75)">your wallet, your approval</Sub>
          </div>
        </div>
        <Card x={500} y={290} w={325} h={270} at={tUnder + 4} glow={glowPlugin}>
          <Title>Awning plugin</Title>
          <Sub>runs in PayBox's sandbox</Sub>
          <div style={{ marginTop: 22, display: "inline-flex", padding: "8px 16px", borderRadius: 999, border: `3px solid ${C.tomato}`, color: C.tomatoDeep, fontFamily: FONT.text, fontWeight: 700, fontSize: 22, opacity: interpolate(f, [tNever - 2, tNever + 8], [0, 1], clamp) }}>
            no wallet, no keys
          </div>
        </Card>
        <Card x={845} y={290} w={300} h={270} at={tUnder + 8}>
          <Title>You</Title>
          {f >= tAsks - 4 ? (
            <div style={{ marginTop: 14, opacity: interpolate(f, [tAsks - 4, tAsks + 6], [0, 1], clamp) }}>
              <div style={{ fontFamily: FONT.text, fontSize: 21, color: C.c700 }}>Approve</div>
              <div style={{ fontFamily: FONT.display, fontWeight: 800, fontStretch: "112%", fontSize: 40, letterSpacing: "-0.03em" }}>{BUSINESS.openTotalUsdc} USDC?</div>
              <div style={{ marginTop: 12, height: 50, borderRadius: 14, background: approved ? C.g600 : C.c900, color: C.c50, display: "grid", placeItems: "center", fontFamily: FONT.text, fontWeight: 600, fontSize: 21, transform: `scale(${1 - 0.06 * Math.sin(Math.PI * pressed)})` }}>
                {approved ? "Approved ✓" : "Approve with passkey"}
              </div>
            </div>
          ) : (
            <Sub>the only one who can approve a payment</Sub>
          )}
        </Card>
        {/* the API, where money moves last */}
        <Card x={1270} y={150} w={590} h={660} at={tUnder + 12}>
          <Title>Awning</Title>
          <div style={{ ...receipt(20, { color: C.c700, marginTop: 6 }) }}>api.awning.sh</div>
          <div style={{ marginTop: 20 }}>
            {names.map((n, i) => (
              <StepRow key={n} name={n} state={states[i]!} money={n === "settle"} hl={n === "settle" ? settleHl : 0} />
            ))}
          </div>
        </Card>
        <Arrow d="M352 410 C 420 410, 440 410, 496 410" at={tUnder + 10} label="awning_open" lx={358} ly={364} />
        {/* the proposal: plugin → you */}
        {f >= tProposes - 6 ? (
          <div
            style={{
              position: "absolute",
              left: interpolate(f, [tProposes - 2, tProposes + 14], [540, 870], { ...clamp, easing: EASE.inOut }),
              top: interpolate(f, [tProposes - 2, tProposes + 8, tProposes + 14], [590, 570, 595], { ...clamp, easing: EASE.inOut }),
              width: 250,
              padding: "12px 16px",
              borderRadius: 14,
              background: C.sun,
              color: C.g900,
              transform: "rotate(-2deg)",
              boxShadow: "0 14px 30px rgba(0,0,0,.35)",
              opacity: interpolate(f, [tProposes - 6, tProposes], [0, 1], clamp),
            }}
          >
            <div style={{ ...receipt(16, { fontWeight: 700 }) }}>PROPOSAL</div>
            <div style={{ fontFamily: FONT.display, fontWeight: 800, fontStretch: "112%", fontSize: 30, letterSpacing: "-0.02em" }}>{BUSINESS.openTotalUsdc} USDC</div>
            <div style={{ fontFamily: FONT.text, fontSize: 18 }}>to open {BUSINESS.name}</div>
          </div>
        ) : null}
        {/* PayBox pays the 402, signed, settled only later */}
        <Arrow d="M1172 470 C 1200 470, 1220 470, 1266 470" at={tOnly - 6} color={C.sun} label={<>x402<br />signed</>} lx={1182} ly={402} />
        {failRun ? (
          <div style={{ position: "absolute", left: 1290, top: 690 }}>
            <Stamp at={tNot} size={40} rotate={-6} color={C.tomato}>
              Not charged
            </Stamp>
          </div>
        ) : null}
      </AbsoluteFill>

      {/* ---------- phase 2: a sale ---------- */}
      <AbsoluteFill style={{ opacity: ph2 }}>
        {ph2 > 0 ? (
          <>
            <Card x={90} y={180} w={420} h={240} at={tSales - 8} dark>
              <Title color={C.c50}>A buyer's agent</Title>
              <Sub color="rgba(205,243,219,.8)">Claude Code, paying with PayBox</Sub>
            </Card>
            <Card x={1330} y={180} w={500} h={240} at={tSales - 4} glow={interpolate(f, [tOwners + 20, tOwners + 30], [0, 1], clamp)}>
              <Title>The owner's wallet</Title>
              <Sub>USDC on Base</Sub>
            </Card>
            <Card x={710} y={560} w={500} h={230} at={tSales}>
              <Title>Awning</Title>
              <Sub>checks the payment, records the order</Sub>
              {f >= tNever2 - 4 ? (
                <div style={{ position: "absolute", right: 26, top: 22 }}>
                  <Stamp at={tHolds - 4} size={30} rotate={-8} color={C.tomatoDeep}>
                    Holds 0.00
                  </Stamp>
                </div>
              ) : null}
            </Card>
            <Arrow d="M520 300 C 820 150, 1030 150, 1326 300" at={tSales} dur={18} color={C.sun} width={5} />
            <Arrow d="M960 556 C 960 470, 960 420, 960 300" at={tOwners - 6} dur={14} color={C.g300} dash label="verifies, never touches it" lx={986} ly={430} />
            <Coin from={[520, 300]} via={[920, 150]} to={[1326, 300]} at={tOwners - 10} dur={30} label={`+${BUSINESS.tasting.priceUsdc}`} />
          </>
        ) : null}
      </AbsoluteFill>
    </Ground>
  );
};
