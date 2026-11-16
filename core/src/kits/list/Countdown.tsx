// Countdown: a "top N" list that counts down to #1. Each entry: the rank slams in, the title and a note follow (secondary
// motion), a visual sits beside it (an icon from the media library, or a licensed picture), a rail shows how far the
// countdown has come, entries change with a whip slide (direction alternates), and #1 gets the one "wow" of the piece.
// Times: each item may carry `at` (seconds, e.g. its narration line start); otherwise the list runs on `itemDur`.
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fInter } from "@remotion/google-fonts/Inter";
import { loadFont as fArchivo } from "@remotion/google-fonts/ArchivoBlack";
import { persona, PersonaName, EASE, clamp, enterK, secondary, mixOklch } from "../motion";
import { ICONS, IconId } from "../media/MediaScene";

const INTER = fInter("normal", { weights: ["500", "700", "800"], subsets: ["latin", "latin-ext"] }).fontFamily;
const DISPLAY = fArchivo("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] }).fontFamily;
export type CountItem = { title: string; note?: string; icon?: IconId; image?: string; at?: number };
export type CountCfg = { title: string; items: CountItem[]; itemDur?: number; intro?: number; outro?: number; theme?: "night" | "day"; accent?: string; motion?: PersonaName; source?: string };
const TH = { night: { bg1: "#0d0f16", bg2: "#1c1f2e", ink: "#f6f7fb", dim: "#9097a8", card: "#191c27" }, day: { bg1: "#f6f2ea", bg2: "#e6ecf4", ink: "#14161c", dim: "#5d6472", card: "#ffffff" } };
const HUE: Record<string, string> = { yellow: "#f4c64a", red: "#ef5a4c", blue: "#58a6f0", green: "#43b37b", brown: "#c4874f", grey: "#e9e6df", dark: "#20222b" };

/** item i (0 = the highest rank, shown first) starts at */
export const countTimes = (c: CountCfg) => c.items.map((it, i) => it.at ?? (c.intro ?? 1.6) + i * (c.itemDur ?? 3.2));
export const countLength = (c: CountCfg) => { const ts = countTimes(c); return ts[ts.length - 1] + (c.itemDur ?? 3.2) + (c.outro ?? 1.2); };

const FlatIcon: React.FC<{ icon: IconId; size: number; k: number }> = ({ icon, size, k }) => {
  const parts = ICONS[icon] as { P: [number, number][]; closed: boolean; hue: string; ring?: boolean }[];
  return (
    <svg viewBox="-1.1 -1.1 2.2 2.2" width={size} height={size} style={{ overflow: "visible", transform: `scale(${clamp(k, 0, 1.2)}) rotate(${(1 - clamp(k)) * -12}deg)` }}>
      {parts.map((p, i) => { const d = p.P.map((q, j) => `${j ? "L" : "M"}${q[0]} ${q[1]}`).join("") + (p.closed ? "Z" : "");
        return <path key={i} d={d} fill={p.closed && !p.ring ? HUE[p.hue] : "none"} stroke="#20222b" strokeWidth={0.05} strokeLinejoin="round" strokeLinecap="round" />; })}
    </svg>
  );
};

export const Countdown: React.FC<{ cfg: CountCfg }> = ({ cfg }) => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, vertical = H > W, u = Math.min(W, H) / 1080;
  const T = TH[cfg.theme ?? "night"], A = cfg.accent ?? "#ff5a36", P = persona(cfg.motion ?? "snappy"), n = cfg.items.length, ts = countTimes(cfg);
  const i = ts.reduce((acc, x, j) => (t >= x - 0.15 ? j : acc), -1), item = i >= 0 ? cfg.items[i] : null, at = i >= 0 ? ts[i] : 0, rank = n - i, isOne = rank === 1;
  const sw = 0.22, inK = EASE.out(clamp((t - (at - 0.15)) / sw)), dir = i % 2 ? -1 : 1;   // whip slide in, direction alternates
  const next = ts[i + 1], outK = next != null ? EASE.in(clamp((t - (next - 0.15 - sw)) / sw)) : 0;
  const slide = (1 - inK) * W * 0.6 * dir - outK * W * 0.6 * dir, skew = ((1 - inK) - outK) * 10 * dir;
  const rankK = enterK(t, at, persona("snappy")), titleAt = secondary(at + 0.12, P), noteAt = secondary(titleAt + 0.12, P);
  const titleK = clamp((t - titleAt) / P.enter), noteK = clamp((t - noteAt) / P.enter), visK = enterK(t, at + 0.2, persona("playful"));
  const flash = isOne ? clamp(1 - (t - at) / 0.25) : 0;
  const introK = 1 - EASE.in(clamp((t - ((cfg.intro ?? 1.6) - 0.35)) / 0.3));
  const accent = isOne ? mixOklch(A, "#ffd34d", 0.6) : A;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 30% 30%, ${T.bg2}, ${T.bg1})`, fontFamily: INTER, overflow: "hidden" }}>
      {/* the rail: one dot per entry, filled as the countdown passes it (top band on 9:16, left column on 16:9) */}
      <div style={{ position: "absolute", ...(vertical ? { left: W * 0.08, right: W * 0.16, top: H * 0.06, height: 70 * u, flexDirection: "row" } : { left: 60 * u, top: H * 0.2, bottom: H * 0.2, width: 70 * u, flexDirection: "column" }), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {cfg.items.map((_, j) => { const r = n - j, done = j < i, cur = j === i; return <div key={j} style={{ width: (cur ? 64 : 46) * u, height: (cur ? 64 : 46) * u, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center",
          background: cur ? accent : done ? mixOklch(A, T.bg1, 0.55) : "transparent", border: `${3 * u}px solid ${cur || done ? "transparent" : T.dim}`, color: cur ? "#111" : T.dim, fontWeight: 800, fontSize: (cur ? 28 : 22) * u }}>{r}</div>; })}
      </div>
      {item && (
        <div style={{ position: "absolute", inset: 0, transform: `translateX(${slide}px) skewX(${skew}deg) scale(${1 + 0.04 * EASE.inOut(clamp((t - at) / (cfg.itemDur ?? 3.2)))})`, transformOrigin: "40% 45%" }}>   {/* idle life: a slow push while the entry holds */}
          {/* rank */}
          <div style={{ position: "absolute", ...(vertical ? { left: W * 0.07, top: H * 0.11 } : { left: W * 0.1, top: H * 0.14 }), fontFamily: DISPLAY, fontSize: (vertical ? 300 : 360) * u, lineHeight: 1, color: accent,
            transform: `scale(${1 + (1 - clamp(rankK, 0, 1.2)) * 0.6})`, transformOrigin: "left top", opacity: clamp((t - at) / 0.08), textShadow: isOne ? `0 0 ${60 * u}px ${mixOklch(accent, "#ffffff", 0.3)}` : "none" }}>
            <span style={{ fontSize: "0.42em", verticalAlign: "top", marginRight: 6 * u }}>#</span>{rank}
          </div>
          {/* visual */}
          <div style={{ position: "absolute", ...(vertical ? { left: W * 0.08, top: H * 0.29, width: W * 0.76, height: H * 0.27 } : { right: W * 0.08, top: H * 0.16, width: H * 0.5, height: H * 0.5 }), display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 40 * u, background: item.image ? "transparent" : T.card, boxShadow: `0 ${20 * u}px ${60 * u}px rgba(0,0,0,.3)`, overflow: "hidden", transform: `translateY(${(1 - clamp(visK)) * 40 * u}px)`, opacity: clamp(visK * 2) }}>
            {item.image ? <Img src={staticFile(item.image)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.04 + 0.06 * clamp((t - at) / 3)})` }} /> : item.icon ? <div style={{ transform: `translateY(${Math.sin((t - at) * 2.4) * 8 * u}px) rotate(${Math.sin((t - at) * 1.6) * 3}deg)` }}><FlatIcon icon={item.icon} size={(vertical ? H * 0.19 : H * 0.34)} k={visK} /></div> : null}
          </div>
          {/* title + note */}
          <div style={{ position: "absolute", ...(vertical ? { left: W * 0.08, right: W * 0.16, top: H * 0.59 } : { left: W * 0.1, right: W * 0.45, top: H * 0.56 }) }}>
            <div style={{ fontWeight: 800, fontSize: (vertical ? 84 : 76) * u, lineHeight: 1.06, color: T.ink, opacity: titleK, transform: `translateY(${(1 - EASE.out(titleK)) * 30 * u}px)` }}>{item.title}</div>
            {item.note && <div style={{ fontWeight: 500, fontSize: (vertical ? 42 : 38) * u, lineHeight: 1.3, color: T.dim, marginTop: 22 * u, opacity: noteK, transform: `translateY(${(1 - EASE.out(noteK)) * 20 * u}px)` }}>{item.note}</div>}
          </div>
        </div>
      )}
      {flash > 0 && <AbsoluteFill style={{ background: "#fff", opacity: flash * 0.35 }} />}
      {introK > 0 && (
        <AbsoluteFill style={{ background: T.bg1, opacity: introK, alignItems: "center", justifyContent: "center", padding: 90 * u }}>
          <div style={{ fontFamily: DISPLAY, fontSize: (vertical ? 96 : 92) * u, lineHeight: 1.08, color: T.ink, textAlign: "center", transform: `scale(${0.94 + 0.06 * EASE.out(clamp(t / 0.5))})` }}>{cfg.title}</div>
        </AbsoluteFill>
      )}
      {cfg.source && <div style={{ position: "absolute", left: W * 0.08, bottom: vertical ? H * 0.21 : H * 0.04, fontSize: 22 * u, color: T.dim }}>{cfg.source}</div>}
    </AbsoluteFill>
  );
};

export const DEMO_COUNT: CountCfg = { title: "5 things to pack for a weekend hike", itemDur: 3.0, items: [
  { title: "A paper map", note: "Phones lose signal and battery; paper does neither.", icon: "flag" },
  { title: "A warm layer", note: "Hilltops are colder than the car park.", icon: "flame" },
  { title: "A headlamp", note: "Walks run late more often than they run early.", icon: "bulb" },
  { title: "More water than you think", note: "Thirst arrives after you needed the water.", icon: "wave" },
  { title: "Someone who knows your route", note: "Tell a friend where you are going and when you'll be back.", icon: "key" },
] };
