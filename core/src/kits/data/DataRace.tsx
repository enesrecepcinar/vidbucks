// DataRace: a bar chart race from keyframed data. Values ease between keyframes, ranks swap smoothly (the rank is averaged
// over the last 0.3 s, so an overtake slides instead of jumping), the scale eases to the current leader, every bar counts its
// own value, the period (year) sits large in the corner, and a leader change gets a flash on the new #1.
// Honesty: every chart shows its source line; data without a real source must say "Illustrative data" (never invent figures).
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fInter } from "@remotion/google-fonts/Inter";
import { persona, PersonaName, EASE, clamp, mixOklch } from "../motion";

const INTER = fInter("normal", { weights: ["500", "700", "800", "900"], subsets: ["latin", "latin-ext"] }).fontFamily;
export type RaceCfg = {
  title: string; subtitle?: string; unit?: string; source: string;          // source is required: "Illustrative data" when not real
  keys: { label: string; values: Record<string, number> }[];               // one keyframe per period
  colors?: Record<string, string>; top?: number; step?: number;            // bars shown, seconds per keyframe
  theme?: "night" | "day"; decimals?: number; motion?: PersonaName; intro?: number; outro?: number;
};
const PALETTE = ["#4f8cff", "#ff7a59", "#2ec4a0", "#f5b83d", "#b37bff", "#ff5c8a", "#5bc0eb", "#9bc53d", "#e55934", "#7d8597", "#00a6a6", "#f08cae"];
const THEME = { night: { bg1: "#0c0f17", bg2: "#171c2a", ink: "#f4f6fb", dim: "#8a93a6", grid: "rgba(255,255,255,.07)" }, day: { bg1: "#f7f5f0", bg2: "#e9eef5", ink: "#13161c", dim: "#5f6775", grid: "rgba(0,0,0,.07)" } };

export const raceLength = (c: RaceCfg) => (c.intro ?? 1.2) + (c.keys.length - 1) * (c.step ?? 1.4) + (c.outro ?? 2.5);

export const DataRace: React.FC<{ cfg: RaceCfg }> = ({ cfg }) => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, vertical = H > W, u = Math.min(W, H) / 1080;
  const Th = THEME[cfg.theme ?? "night"], P = persona(cfg.motion ?? "confident"), step = cfg.step ?? 1.4, intro = cfg.intro ?? 1.2, N = cfg.keys.length;
  const names = React.useMemo(() => Array.from(new Set(cfg.keys.flatMap((k) => Object.keys(k.values)))), [cfg.keys]);
  const color = (n: string) => cfg.colors?.[n] ?? PALETTE[names.indexOf(n) % PALETTE.length];
  // values at any time: linear between keyframes (a race reads as continuous), clamped to the first/last keyframe
  const valuesAt = (time: number) => {
    const x = clamp((time - intro) / step, 0, N - 1), i = Math.min(N - 2, Math.floor(x)), k = N === 1 ? 0 : x - i;
    const A = cfg.keys[i].values, B = cfg.keys[Math.min(N - 1, i + 1)].values;
    return Object.fromEntries(names.map((n) => [n, (A[n] ?? 0) + ((B[n] ?? 0) - (A[n] ?? 0)) * k]));
  };
  const rankAt = (time: number) => { const v = valuesAt(time); const order = [...names].sort((a, b) => v[b] - v[a]); return Object.fromEntries(order.map((n, i) => [n, i])); };
  const v = valuesAt(t), ranks = names.map((n) => { let s = 0; for (let j = 0; j < 7; j++) s += rankAt(t - j * 0.05)[n]; return [n, s / 7] as const; });
  const top = Math.min(cfg.top ?? (vertical ? 8 : 10), names.length), maxV = Math.max(...names.map((n) => v[n])) || 1;
  const leader = [...names].sort((a, b) => v[b] - v[a])[0], prevLeader = [...names].sort((a, b) => valuesAt(t - 0.4)[b] - valuesAt(t - 0.4)[a])[0];
  const flash = leader !== prevLeader ? 1 : 0;
  // chart area: 9:16 keeps clear of the platform UI (bottom 20 %, right rail)
  const X0 = vertical ? W * 0.06 : W * 0.06, X1 = vertical ? W * 0.84 : W * 0.86, Y0 = vertical ? H * 0.2 : H * 0.2, Y1 = vertical ? H * 0.66 : H * 0.88;
  const rowH = (Y1 - Y0) / top, barH = rowH * 0.72, longest = Math.max(...names.map((n) => n.length)), labelW = vertical ? 0 : clamp(longest * barH * 0.42 * 0.56 + 30 * u, 180 * u, W * 0.3);   // the label column fits the longest name
  const appear = EASE.out(clamp(t / P.enter)), x = clamp((t - intro) / step, 0, N - 1), period = cfg.keys[Math.round(x)].label;
  const fmt = (n: number) => (cfg.decimals ? n.toFixed(cfg.decimals) : Math.round(n).toLocaleString("en-US")) + (cfg.unit ? ` ${cfg.unit}` : "");
  return (
    <AbsoluteFill style={{ background: `linear-gradient(170deg, ${Th.bg1}, ${Th.bg2})`, fontFamily: INTER }}>
      <div style={{ position: "absolute", left: X0, right: W - X1, top: vertical ? H * 0.06 : H * 0.05, opacity: appear, transform: `translateY(${(1 - appear) * 20 * u}px)` }}>
        <div style={{ fontWeight: 900, fontSize: (vertical ? 66 : 60) * u, lineHeight: 1.08, color: Th.ink }}>{cfg.title}</div>
        {cfg.subtitle && <div style={{ fontWeight: 500, fontSize: 30 * u, color: Th.dim, marginTop: 10 * u }}>{cfg.subtitle}</div>}
      </div>
      {/* scale grid: four ticks that follow the eased maximum */}
      {(() => { const raw = maxV / 4, mag = Math.pow(10, Math.floor(Math.log10(raw || 1))), st = [1, 2, 5, 10].map((m) => m * mag).find((x) => x >= raw) ?? raw;
        return Array.from({ length: Math.floor(maxV / st) }, (_, i) => (i + 1) * st); })().map((gv) => { const g = gv / maxV; const gx = X0 + labelW + (X1 - X0 - labelW) * g * 0.86 * appear; return <div key={gv} style={{ position: "absolute", left: gx, top: Y0 - 10 * u, bottom: H - Y1, width: 2 * u, background: Th.grid }}>
        <div style={{ position: "absolute", top: -34 * u, left: -60 * u, width: 120 * u, textAlign: "center", fontSize: 22 * u, fontWeight: 600, color: Th.dim }}>{fmt(gv)}</div></div>; })}
      {ranks.filter(([, r]) => r < top + 0.5).map(([n, r]) => {
        const y = Y0 + r * rowH, w = Math.max(4 * u, (X1 - X0 - labelW) * 0.86 * (v[n] / maxV) * appear), c = color(n), lead = n === leader;
        const fade = clamp(top + 0.5 - r);
        return (
          <div key={n} style={{ position: "absolute", left: X0, top: y, height: barH, width: X1 - X0, opacity: fade, zIndex: Math.round(100 - r * 10) }}>
            {!vertical && <div style={{ position: "absolute", left: 0, width: labelW - 20 * u, top: 0, height: barH, display: "flex", alignItems: "center", justifyContent: "flex-end", fontWeight: 700, fontSize: barH * 0.42, color: Th.ink, whiteSpace: "nowrap", overflow: "hidden" }}>{n}</div>}
            <div style={{ position: "absolute", left: labelW, top: 0, height: barH, width: w, borderRadius: 10 * u, background: `linear-gradient(90deg, ${mixOklch(c, "#ffffff", 0.08)}, ${c})`,
              boxShadow: lead && flash ? `0 0 ${40 * u}px ${mixOklch(c, "#ffffff", 0.3)}` : "none" }}>
              {vertical && <div style={{ position: "absolute", left: 18 * u, top: 0, height: barH, display: "flex", alignItems: "center", fontWeight: 800, fontSize: barH * 0.4, color: "#fff", whiteSpace: "nowrap", textShadow: "0 1px 3px rgba(0,0,0,.35)" }}>{w > n.length * barH * 0.24 + 40 * u ? n : ""}</div>}
            </div>
            <div style={{ position: "absolute", left: labelW + w + 14 * u, top: 0, height: barH, display: "flex", alignItems: "center", fontWeight: 700, fontSize: barH * 0.38, color: Th.ink, whiteSpace: "nowrap" }}>
              {vertical && w <= n.length * barH * 0.24 + 40 * u ? <span style={{ marginRight: 12 * u, color: c, fontWeight: 800 }}>{n}</span> : null}{fmt(v[n])}
            </div>
          </div>
        );
      })}
      <div style={{ position: "absolute", right: vertical ? W * 0.16 : W * 0.06, ...(vertical ? { top: Y1 + 10 * u } : { bottom: H * 0.14 }), fontWeight: 900, fontSize: (vertical ? 150 : 170) * u, color: Th.ink, opacity: 0.5 * appear, letterSpacing: -2 * u }}>{period}</div>
      <div style={{ position: "absolute", left: X0, bottom: vertical ? H * 0.21 : H * 0.035, fontSize: 22 * u, fontWeight: 500, color: Th.dim }}>Source: {cfg.source}</div>
    </AbsoluteFill>
  );
};

/** studio default: clearly fictional data, labelled as such */
export const DEMO_RACE: RaceCfg = {
  title: "Most borrowed books at a fictional town library", subtitle: "Loans per year (fictional numbers)", source: "Illustrative data (not real)", step: 1.3,
  keys: [
    { label: "2016", values: { "The Lighthouse Code": 120, "Moss & Stone": 90, "Night Trains": 60, "Paper Kites": 40, "Salt Roads": 30, "Glass Orchard": 20 } },
    { label: "2017", values: { "The Lighthouse Code": 150, "Moss & Stone": 140, "Night Trains": 95, "Paper Kites": 70, "Salt Roads": 45, "Glass Orchard": 35 } },
    { label: "2018", values: { "The Lighthouse Code": 170, "Moss & Stone": 200, "Night Trains": 150, "Paper Kites": 110, "Salt Roads": 60, "Glass Orchard": 80 } },
    { label: "2019", values: { "The Lighthouse Code": 185, "Moss & Stone": 230, "Night Trains": 240, "Paper Kites": 150, "Salt Roads": 90, "Glass Orchard": 160 } },
    { label: "2020", values: { "The Lighthouse Code": 190, "Moss & Stone": 245, "Night Trains": 300, "Paper Kites": 210, "Salt Roads": 140, "Glass Orchard": 290 } },
    { label: "2021", values: { "The Lighthouse Code": 195, "Moss & Stone": 250, "Night Trains": 330, "Paper Kites": 260, "Salt Roads": 230, "Glass Orchard": 380 } },
  ],
};
