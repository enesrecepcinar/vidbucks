// Card library: tiered motion-graphic cards in named styles (registry: core/styles/cards.json).
// Tier 1 takes over the frame (stat, thesis, section, quote); tier 2 keeps the footage visible and lives in a panel
// zone (right third on 16:9, top band on 9:16): label, list, lower, versus. Every card enters with its style's motion
// (several properties at once, staggered children) and leaves faster than it came; list items can land on words.
import React from "react";
import REG from "../../../styles/cards.json";
import { FONT, fw, type FontKey } from "../shots/prims";

export type CardStyle = (typeof REG.styles)[number];
export type CardId = "stat" | "thesis" | "section" | "quote" | "label" | "list" | "lower" | "versus";
export const CARD_STYLES = REG.styles;
export const CARD_DEFS = REG.cards;
const MOT = REG.motions as Record<string, { enter: number; ease: string; overshoot?: number; stagger: number; exit: number }>;

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x: number, kind: string, o = 1.4) => {
  x = clamp(x);
  if (kind === "back") { const c = o + 1; return 1 + c * Math.pow(x - 1, 3) + o * Math.pow(x - 1, 2); }
  if (kind === "sine") return 0.5 - Math.cos(Math.PI * x) / 2;
  return 1 - Math.pow(1 - x, 3);
};
const font = (k: string) => FONT[(k in FONT ? k : "inter") as FontKey];

/** count a number inside a string from 0 ("2,400 L" -> "1,200 L" halfway) */
function countUp(v: string, k: number) {
  const m = v.match(/-?[\d,]*\.?\d+/);
  if (!m) return v;
  const raw = m[0], num = parseFloat(raw.replace(/,/g, "")), dec = (raw.split(".")[1] ?? "").length;
  const cur = num * clamp(k), txt = cur.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return v.replace(raw, raw.includes(",") || num >= 10000 ? txt : txt.replace(/,/g, ""));
}

export type CardProps = { card: CardId; style: string; t: number; at: number; dur: number; data: Record<string, any>; W: number; H: number; itemTimes?: number[] };

export const Card: React.FC<CardProps> = ({ card, style, t, at, dur, data, W, H, itemTimes }) => {
  const S = CARD_STYLES.find((s) => s.id === style) ?? CARD_STYLES[0], P = S.palette as Record<string, string>, M = MOT[S.motion] ?? MOT.confident;
  const u = Math.min(W, H) / 1080, vertical = W / H < 1.2, since = t - at, left = at + dur - t;
  if (since < 0 || left < 0) return null;
  const inK = (d = 0) => ease((since - d) / M.enter, M.ease, M.overshoot), outK = 1 - ease((M.exit - left) / M.exit, "out");
  const D = font(S.fonts.display), T = font(S.fonts.text), dw = fw(S.fonts.display as FontKey, 800);
  const enter = (d = 0, dy = 40): React.CSSProperties => { const k = inK(d); return { opacity: clamp(k * 1.4) * outK, transform: `translateY(${(1 - k) * dy * u}px) scale(${0.96 + 0.04 * k})`, filter: k < 1 ? `blur(${(1 - clamp(k)) * 6 * u}px)` : undefined }; };
  const tier1 = ["stat", "thesis", "section", "quote"].includes(card);
  const texture = S.texture === "grid" ? { backgroundImage: `linear-gradient(${P.dim}22 1px, transparent 1px), linear-gradient(90deg, ${P.dim}22 1px, transparent 1px)`, backgroundSize: `${60 * u}px ${60 * u}px` }
    : S.texture === "halftone" ? { backgroundImage: `radial-gradient(${P.accent}33 1.5px, transparent 1.8px)`, backgroundSize: `${14 * u}px ${14 * u}px` } : {};
  const glow = S.texture === "glow" ? { textShadow: `0 0 ${24 * u}px ${P.accent}88` } : {};

  if (tier1) {
    const bgK = ease(since / (M.enter * 0.8), "out") * outK;
    return (
      <div style={{ position: "absolute", inset: 0, background: P.bg, opacity: bgK, ...texture, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: `0 ${110 * u}px`, textAlign: "center" }}>
        {S.texture === "grain" && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,.45) 100%)" }} />}
        {card === "stat" && <>
          <div style={{ ...enter(0, 60), fontFamily: D, fontWeight: dw, fontSize: (vertical ? 210 : 240) * u, lineHeight: 1, color: P.accent, ...glow }}>{countUp(String(data.value ?? ""), clamp(since / (M.enter * 3)))}</div>
          <div style={{ ...enter(M.stagger * 2), fontFamily: T, fontWeight: 700, fontSize: 58 * u, color: P.fg, marginTop: 24 * u }}>{data.label}</div>
          {data.sub && <div style={{ ...enter(M.stagger * 4), fontFamily: T, fontSize: 36 * u, color: P.dim, marginTop: 14 * u }}>{data.sub}</div>}
        </>}
        {card === "thesis" && <div style={{ fontFamily: D, fontWeight: dw, fontSize: (vertical ? 96 : 104) * u, lineHeight: 1.12, color: P.fg, maxWidth: 1500 * u, ...glow }}>
          {String(data.text ?? "").split(/\s+/).map((w, i, a) => <span key={i} style={{ display: "inline-block", marginRight: 22 * u, ...enter(i * M.stagger, 30), color: i === a.length - 1 ? P.accent : P.fg }}>{w}</span>)}
        </div>}
        {card === "section" && <>
          <div style={{ ...enter(0, -30), fontFamily: T, fontWeight: 800, fontSize: 44 * u, letterSpacing: 10 * u, color: P.accent }}>{data.num}</div>
          <div style={{ height: 6 * u, width: `${clamp(inK(M.stagger)) * 220 * u}px`, background: P.accent, margin: `${22 * u}px 0` }} />
          <div style={{ ...enter(M.stagger * 2), fontFamily: D, fontWeight: dw, fontSize: (vertical ? 100 : 120) * u, color: P.fg, lineHeight: 1.05, ...glow }}>{data.title}</div>
        </>}
        {card === "quote" && <>
          <div style={{ ...enter(0, 20), fontFamily: D, fontSize: 260 * u, lineHeight: 0.6, color: P.accent, height: 120 * u }}>“</div>
          <div style={{ ...enter(M.stagger), fontFamily: D, fontWeight: dw, fontSize: (vertical ? 76 : 84) * u, lineHeight: 1.18, color: P.fg, maxWidth: 1400 * u }}>{data.text}</div>
          {data.who && <div style={{ ...enter(M.stagger * 3), fontFamily: T, fontWeight: 700, fontSize: 38 * u, color: P.dim, marginTop: 30 * u }}>— {data.who}</div>}
        </>}
      </div>
    );
  }
  // tier 2: a panel zone; the footage stays visible
  const zw = vertical ? W - 120 * u : W * 0.33, fit = (txt: string, max: number, k = 0.56) => Math.min(max * u, (zw * 0.92) / Math.max(1, String(txt ?? "").length * k));   // never wider than the zone
  const zone: React.CSSProperties = vertical ? { left: 60 * u, right: 60 * u, top: H * 0.09 } : { right: 70 * u, top: H * 0.16, width: W * 0.33 };
  const panel: React.CSSProperties = { background: `${P.panel}ee`, border: `${2 * u}px solid ${P.accent}55`, borderRadius: 14 * u, padding: `${26 * u}px ${30 * u}px`, boxShadow: `0 ${18 * u}px ${50 * u}px rgba(0,0,0,.35)`, ...texture };
  return (
    <div style={{ position: "absolute", ...zone }}>
      {card === "label" && <div style={{ ...enter(0, 24), display: "inline-block", background: P.accent, color: S.dark ? "#0b0b0b" : "#fff", fontFamily: D, fontWeight: dw, fontSize: fit(data.text, 64), padding: `${10 * u}px ${26 * u}px`, borderRadius: 10 * u, whiteSpace: "nowrap", transform: `${enter(0, 24).transform} rotate(-2deg)` }}>{data.text}</div>}
      {card === "lower" && <div style={{ ...panel, ...enter(0, 20), display: "inline-block" }}>
        <div style={{ fontFamily: D, fontWeight: dw, fontSize: fit(data.name, 58), color: P.fg, whiteSpace: "nowrap", ...glow }}>{data.name}</div>
        <div style={{ fontFamily: T, fontSize: 32 * u, color: P.accent, marginTop: 6 * u, fontWeight: 600 }}>{data.role}</div>
      </div>}
      {card === "list" && <div style={{ ...panel, ...enter(0, 20) }}>
        {data.title && <div style={{ fontFamily: T, fontWeight: 800, fontSize: 30 * u, letterSpacing: 2 * u, color: P.accent, textTransform: "uppercase", marginBottom: 16 * u }}>{data.title}</div>}
        {(data.items as string[] ?? []).map((it, i) => {
          const tt = itemTimes?.[i] ?? at + M.enter + i * Math.max(M.stagger * 4, (dur - M.enter - 0.6) / Math.max(1, (data.items as string[]).length));
          const k = ease((t - tt) / M.enter, M.ease, M.overshoot), on = t >= tt;
          return <div key={i} style={{ display: "flex", alignItems: "center", gap: 18 * u, opacity: (on ? 1 : 0.45) * outK, transform: `translateX(${(1 - clamp(k)) * -26 * u}px)`, fontFamily: T, fontWeight: 700, fontSize: 48 * u, color: P.fg, margin: `${10 * u}px 0` }}>
            <span style={{ width: 34 * u, height: 34 * u, borderRadius: S.id === "swiss-paper" ? 0 : 999, background: on ? P.accent : "transparent", border: `${3 * u}px solid ${P.accent}`, flex: "none", transform: `scale(${0.6 + 0.4 * clamp(k)})` }} />{it}</div>;
        })}
      </div>}
      {card === "versus" && <div style={{ ...panel, ...enter(0, 20) }}>
        {data.label && <div style={{ fontFamily: T, fontWeight: 800, fontSize: 28 * u, letterSpacing: 2 * u, color: P.dim, textTransform: "uppercase", marginBottom: 14 * u }}>{data.label}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 20 * u }}>
          <div style={{ flex: 1, ...enter(M.stagger, 16), fontFamily: D, fontWeight: dw, fontSize: 54 * u, color: P.fg, textAlign: "center" }}>{data.a}</div>
          <div style={{ ...enter(M.stagger * 2, 0), fontFamily: T, fontWeight: 800, fontSize: 30 * u, color: S.dark ? "#0b0b0b" : "#fff", background: P.accent, borderRadius: 999, padding: `${8 * u}px ${14 * u}px` }}>VS</div>
          <div style={{ flex: 1, ...enter(M.stagger * 3, 16), fontFamily: D, fontWeight: dw, fontSize: 54 * u, color: (P as any).accent2 ?? P.accent, textAlign: "center" }}>{data.b}</div>
        </div>
      </div>}
    </div>
  );
};

/** every card of every style, frozen once fully revealed, on a neutral footage stand-in: the library at a glance */
export const CardGallery: React.FC<{ style?: string }> = ({ style }) => {
  const styles = style ? CARD_STYLES.filter((s) => s.id === style) : CARD_STYLES, W = 1920, H = 1080, sc = 0.24, gap = 12;
  return (
    <div style={{ position: "absolute", inset: 0, background: "#222", padding: 20 }}>
      {styles.map((s) => <div key={s.id} style={{ marginBottom: 18 }}>
        <div style={{ color: "#fff", fontFamily: FONT.inter, fontWeight: 800, fontSize: 22, margin: "4px 0 8px" }}>{s.name} <span style={{ color: "#999", fontWeight: 600 }}>({s.id} · {s.motion})</span></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap, width: 4 * W * sc + 3 * gap }}>
        {CARD_DEFS.map((c) => <div key={c.id} style={{ width: W * sc, height: H * sc, flex: "none", position: "relative", overflow: "hidden", borderRadius: 6, background: "linear-gradient(135deg,#55606e,#2f3742)" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `scale(${sc})`, transformOrigin: "0 0" }}>
            <div style={{ position: "absolute", left: W * 0.18, bottom: 0, width: W * 0.3, height: H * 0.75, borderRadius: "45% 45% 0 0", background: "#8892a0" }} />
            <Card card={c.id as CardId} style={s.id} t={2.5} at={0} dur={5} data={c.slots} W={W} H={H} />
          </div>
          <div style={{ position: "absolute", left: 4, bottom: 2, color: "#fff", fontFamily: FONT.inter, fontSize: 13, textShadow: "0 1px 2px #000" }}>{s.id}.{c.id} · tier {c.tier}</div>
        </div>)}
        </div>
      </div>)}
    </div>
  );
};
