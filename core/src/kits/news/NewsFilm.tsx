// NewsFilm - a data-driven long-form news explainer: licensed photos and clips with camera moves, chapter cards,
// statement cards, counters, a timeline, a map, a grid, a procedural network, a known/unknown board.
// cfg.shots are laid on the narration clock; neighbouring shots blend through TransitionStage (kinds rotate).
import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fInter } from "@remotion/google-fonts/Inter";
import { loadFont as fCond } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as fMono } from "@remotion/google-fonts/IBMPlexMono";
import { EASE, clamp } from "../motion";
import { TransitionStage, TKind } from "../transitions";

const INTER = fInter("normal", { weights: ["400", "600", "800"], subsets: ["latin"] }).fontFamily;
const COND = fCond("normal", { weights: ["600", "800"], subsets: ["latin"] }).fontFamily;
const MONO = fMono("normal", { weights: ["400", "600"], subsets: ["latin"] }).fontFamily;

export const C = { bg: "#07090d", panel: "#11161e", line: "#263040", text: "#f2f4f7", mute: "#9aa3b2", red: "#e3241b", amber: "#ffb02e", cyan: "#3ec5ff", green: "#3ddc97" };

type Base = { t0: number; t1: number; trans?: TKind; credit?: string };
export type Shot = Base & (
  | { kind: "photo"; src: string; move?: "in" | "out" | "left" | "right" | "up" | "down"; focus?: [number, number]; tag?: string; grade?: "cool" | "warm" | "bw" | "red" }
  | { kind: "video"; src: string; from?: number; rate?: number; tag?: string; grade?: "cool" | "warm" | "bw" | "red" }
  | { kind: "chapter"; num: string; title: string; sub?: string }
  | { kind: "headline"; kicker?: string; lines: string[]; accent?: number; bgSrc?: string }
  | { kind: "quote"; who: string; role: string; text: string; src: string; bgSrc?: string }
  | { kind: "stat"; value: number; decimals?: number; prefix?: string; suffix?: string; label: string; src: string; bgSrc?: string }
  | { kind: "timeline"; active: number }
  | { kind: "grid"; n: number; lit: number; label: string; src: string }
  | { kind: "map"; pins: string[]; label: string; zoom?: number }
  | { kind: "network"; down: number; label?: string }
  | { kind: "causes"; items: string[]; title: string }
  | { kind: "board"; col: "confirmed" | "reported" | "unknown"; items: string[] }
  | { kind: "compare"; left: { head: string; lines: string[] }; right: { head: string; lines: string[] } }
  | { kind: "article" | "xpost" | "archive" | "wall" | "split" | "breaking"; [k: string]: any }
);
export type NewsCfg = { duration: number; fps: number; audio?: string; shots: Shot[]; chapters: { t: number; title: string; tint?: string }[]; topic: string; geo?: any; ticker?: string[] };

const ease = EASE.out;
const R = (t: number, a: number, d: number) => clamp((t - a) / d);
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------- shared pieces ----------
const Grain: React.FC<{ t: number; o?: number }> = ({ t, o = 0.06 }) => (
  <AbsoluteFill style={{ pointerEvents: "none", opacity: o, mixBlendMode: "overlay",
    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' seed='${Math.floor(t * 12) % 9}'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")` }} />
);
const Vignette: React.FC<{ k?: number }> = ({ k = 0.75 }) => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,${k}) 100%)` }} />
);
const Backdrop: React.FC<{ t: number; src?: string }> = ({ t, src }) => (
  <AbsoluteFill style={{ background: C.bg }}>
    {src ? <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(0.7) brightness(0.2) blur(6px)", transform: `scale(${1.1 + 0.02 * t})` }} /> :
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${C.line}55 1px, transparent 1px), linear-gradient(90deg, ${C.line}55 1px, transparent 1px)`, backgroundSize: "80px 80px", backgroundPosition: `${-t * 14}px ${-t * 7}px`, opacity: 0.7 }} />}
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at ${30 + 10 * Math.sin(t * 0.3)}% ${20 + 8 * Math.cos(t * 0.25)}%, ${C.red}38, transparent 60%), radial-gradient(ellipse at 80% 90%, #1d3b5a44, transparent 55%)` }} />
  </AbsoluteFill>
);
const Src: React.FC<{ text: string; t: number }> = ({ text, t }) => (
  <div style={{ position: "absolute", left: 110, bottom: 100, fontFamily: MONO, fontSize: 24, color: C.mute, opacity: ease(R(t, 0.4, 0.5)), letterSpacing: 0.5 }}>SOURCE: {text}</div>
);
const GRADE: Record<string, string> = { cool: "saturate(0.75) contrast(1.08) brightness(0.86) hue-rotate(-6deg)", warm: "saturate(0.9) contrast(1.05) brightness(0.9) sepia(0.12)", bw: "grayscale(1) contrast(1.15) brightness(0.85)", red: "grayscale(0.85) contrast(1.15) brightness(0.8)" };

// ---------- shot kinds ----------
const Photo: React.FC<{ s: any; t: number; d: number }> = ({ s, t, d }) => {
  const k = EASE.sine(t / Math.max(1, d)), mv = s.move ?? "in";
  const sc = mv === "in" ? 1.06 + 0.12 * k : mv === "out" ? 1.2 - 0.12 * k : 1.14;
  const dx = mv === "left" ? 40 - 80 * k : mv === "right" ? -40 + 80 * k : 0, dy = mv === "up" ? 30 - 60 * k : mv === "down" ? -30 + 60 * k : 0;
  const f = s.focus ?? [0.5, 0.5];
  return <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
    <Img src={staticFile(s.src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${f[0] * 100}% ${f[1] * 100}%`, transformOrigin: `${f[0] * 100}% ${f[1] * 100}%`, transform: `translate(${dx}px,${dy}px) scale(${sc})`, filter: GRADE[s.grade ?? "cool"] }} />
    {s.grade === "red" && <AbsoluteFill style={{ background: C.red, mixBlendMode: "multiply", opacity: 0.35 }} />}
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.55) 100%)" }} />
    {s.tag && <Tag text={s.tag} t={t} />}
  </AbsoluteFill>;
};
const Video: React.FC<{ s: any; t: number }> = ({ s }) => (
  <AbsoluteFill style={{ background: "#000" }}>
    <OffthreadVideo src={staticFile(s.src)} startFrom={Math.round((s.from ?? 0) * 30)} playbackRate={s.rate ?? 1} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: GRADE[s.grade ?? "cool"] }} />
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.5) 100%)" }} />
  </AbsoluteFill>
);
const Tag: React.FC<{ text: string; t: number }> = ({ text, t }) => {
  const k = ease(R(t, 0.25, 0.6));
  return <div style={{ position: "absolute", left: 110, top: 150, display: "flex", alignItems: "center", gap: 14, opacity: k, transform: `translateX(${(1 - k) * -30}px)` }}>
    <div style={{ width: 14, height: 14, borderRadius: 7, background: C.red, boxShadow: `0 0 18px ${C.red}` }} />
    <div style={{ fontFamily: COND, fontWeight: 800, fontSize: 40, color: C.text, letterSpacing: 2, textTransform: "uppercase", textShadow: "0 2px 12px #000" }}>{text}</div>
  </div>;
};

const Chapter: React.FC<{ s: any; t: number; d: number }> = ({ s, t }) => {
  const k = ease(R(t, 0.1, 0.7)), k2 = ease(R(t, 0.35, 0.7)), bar = EASE.inOut(R(t, 0, 0.6));
  const glitch = t < 0.35 ? (hash(Math.floor(t * 30)) - 0.5) * 30 : 0;
  return <AbsoluteFill>
    <Backdrop t={t} />
    <div style={{ position: "absolute", left: 0, top: 470, height: 6, width: `${bar * 100}%`, background: C.red }} />
    <div style={{ position: "absolute", left: 160, top: 250, fontFamily: COND, fontWeight: 800, fontSize: 200, color: "transparent", WebkitTextStroke: `3px ${C.red}`, opacity: k, transform: `translateX(${glitch}px)` }}>{s.num}</div>
    <div style={{ position: "absolute", left: 160, top: 510, fontFamily: COND, fontWeight: 800, fontSize: 118, lineHeight: 1, color: C.text, textTransform: "uppercase", opacity: k, transform: `translateY(${(1 - k) * 40}px)`, maxWidth: 1600 }}>{s.title}</div>
    {s.sub && <div style={{ position: "absolute", left: 164, top: 650, fontFamily: INTER, fontWeight: 400, fontSize: 40, color: C.mute, opacity: k2, maxWidth: 1500 }}>{s.sub}</div>}
  </AbsoluteFill>;
};

const Headline: React.FC<{ s: any; t: number; d: number }> = ({ s, t }) => (
  <AbsoluteFill>
    <Backdrop t={t} src={s.bgSrc} />
    <div style={{ position: "absolute", left: 160, right: 160, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {s.kicker && <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 34, color: "#ff6b61", textShadow: "0 2px 10px #000", letterSpacing: 4, marginBottom: 26, opacity: ease(R(t, 0, 0.4)) }}>{s.kicker}</div>}
      {s.lines.map((ln: string, i: number) => {
        const k = ease(R(t, 0.15 + i * 0.35, 0.55));
        return <div key={i} style={{ overflow: "hidden" }}><div style={{ fontFamily: COND, fontWeight: 800, fontSize: 120, lineHeight: 1.04, textTransform: "uppercase", color: i === (s.accent ?? -1) ? C.red : C.text, transform: `translateY(${(1 - k) * 110}%)` }}>{ln}</div></div>;
      })}
    </div>
  </AbsoluteFill>
);

const Quote: React.FC<{ s: any; t: number; d: number }> = ({ s, t, d }) => {
  const words = s.text.split(" "), span = Math.max(1.2, Math.min(d * 0.7, words.length * 0.28));
  const k = ease(R(t, 0, 0.5));
  return <AbsoluteFill>
    <Backdrop t={t} src={s.bgSrc} />
    <div style={{ position: "absolute", left: 150, top: 170, right: 150, opacity: k, transform: `translateY(${(1 - k) * 30}px)` }}>
      <div style={{ fontFamily: COND, fontWeight: 800, fontSize: 200, color: C.red, lineHeight: 0.6, height: 90 }}>“</div>
      <div style={{ fontFamily: INTER, fontWeight: 600, fontSize: words.length > 18 ? 60 : 72, lineHeight: 1.25, color: C.text, maxWidth: 1580 }}>
        {words.map((w: string, i: number) => { const on = R(t, 0.3 + (i / words.length) * span, 0.25); return <span key={i} style={{ opacity: 0.55 + 0.45 * on }}>{w} </span>; })}
      </div>
      <div style={{ marginTop: 48, display: "flex", alignItems: "center", gap: 22, opacity: ease(R(t, 0.5, 0.5)) }}>
        <div style={{ width: 60, height: 4, background: C.red }} />
        <div><div style={{ fontFamily: COND, fontWeight: 800, fontSize: 46, color: C.text, textTransform: "uppercase", letterSpacing: 1 }}>{s.who}</div>
          <div style={{ fontFamily: INTER, fontSize: 30, color: C.mute }}>{s.role}</div></div>
      </div>
    </div>
    <Src text={s.src} t={t} />
  </AbsoluteFill>;
};

const fmt = (v: number, dec = 0) => v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const Stat: React.FC<{ s: any; t: number; d: number }> = ({ s, t }) => {
  const k = EASE.expo(R(t, 0.2, 1.4)), v = s.value * k;
  return <AbsoluteFill>
    <Backdrop t={t} src={s.bgSrc} />
    <div style={{ position: "absolute", left: 160, right: 160, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontFamily: COND, fontWeight: 800, fontSize: 280, lineHeight: 1, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: -2 }}>
        <span style={{ color: C.red }}>{s.prefix}</span>{fmt(v, s.decimals ?? 0)}<span style={{ color: C.red, fontSize: 160 }}>{s.suffix}</span></div>
      <div style={{ marginTop: 18, fontFamily: INTER, fontWeight: 600, fontSize: 52, color: C.text, opacity: ease(R(t, 0.6, 0.5)), maxWidth: 1500 }}>{s.label}</div>
    </div>
    <Src text={s.src} t={t} />
  </AbsoluteFill>;
};

export const EVENTS = [
  { d: "THU 12", what: "Microsoft 365", why: "software defect, no malicious activity", c: C.cyan },
  { d: "FRI 13", what: "FAA ground stop", why: "new router during fiber upgrade", c: C.amber },
  { d: "MON 16", what: "Banks: Chase, BofA, Wells", why: "Chase: software release", c: C.green },
  { d: "MON 16", what: "United Airlines", why: "computer problem", c: C.green },
  { d: "TUE 17", what: "NSA Net", why: "scheduled maintenance (NSA)", c: C.red },
];
const Timeline: React.FC<{ s: any; t: number; d: number }> = ({ s, t }) => {
  const x0 = 280, x1 = 1640, n = EVENTS.length, line = EASE.inOut(R(t, 0, 0.9));
  return <AbsoluteFill>
    <Backdrop t={t} />
    <div style={{ position: "absolute", left: x0, top: 120, fontFamily: MONO, fontSize: 32, color: C.mute, letterSpacing: 3 }}>NOVEMBER 2026 · SIX DAYS</div>
    <div style={{ position: "absolute", left: x0, top: 520, width: (x1 - x0) * line, height: 4, background: C.line }} />
    {EVENTS.map((e, i) => {
      const x = x0 + (i / (n - 1)) * (x1 - x0), on = i <= s.active, k = ease(R(t, 0.3 + i * 0.18, 0.5)), cur = i === s.active;
      const up = i % 2 === 0;
      return <div key={i} style={{ position: "absolute", left: x - 180, top: up ? 190 : 575, width: 360, opacity: k * (on ? 1 : 0.75), transform: `translateY(${(1 - k) * (up ? -20 : 20)}px)`, textAlign: "center" }}>
        {!up && <div style={{ height: 0 }} />}
        <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 36, color: on ? (e.c === C.red ? "#ff6b61" : e.c) : "#c3cad6" }}>{e.d}</div>
        <div style={{ fontFamily: COND, fontWeight: 800, fontSize: cur ? 64 : 56, color: C.text, textTransform: "uppercase", lineHeight: 1.05, marginTop: 8 }}>{e.what}</div>
        <div style={{ fontFamily: INTER, fontWeight: 600, fontSize: 34, color: "#c3cad6", marginTop: 10, lineHeight: 1.25 }}>{e.why}</div>
      </div>;
    })}
    {EVENTS.map((e, i) => { const x = x0 + (i / (n - 1)) * (x1 - x0), on = i <= s.active, cur = i === s.active, pulse = cur ? 1 + 0.25 * Math.sin(t * 5) : 1;
      return <div key={"d" + i} style={{ position: "absolute", left: x - 16, top: 506, width: 32, height: 32, borderRadius: 16, background: on ? e.c : C.panel, border: `3px solid ${e.c}`, transform: `scale(${pulse * ease(R(t, 0.2 + i * 0.18, 0.4))})`, boxShadow: cur ? `0 0 30px ${e.c}` : "none" }} />; })}
    <Src text="Fox News timeline, CNBC, CBS News, Nextgov" t={t} />
  </AbsoluteFill>;
};

const Grid: React.FC<{ s: any; t: number; d: number }> = ({ s, t }) => {
  const cols = 11, size = 118, gap = 26, W = cols * size + (cols - 1) * gap;
  return <AbsoluteFill>
    <Backdrop t={t} />
    <div style={{ position: "absolute", left: (1920 - W) / 2, top: 230, width: W, display: "flex", flexWrap: "wrap", gap }}>
      {Array.from({ length: s.n }, (_, i) => { const lit = i < s.lit, at = 0.6 + i * 0.07, k = R(t, at, 0.2), flick = lit && k > 0 && hash(i * 7 + Math.floor(t * 12)) > 0.75 ? 0.55 : 1;
        return <div key={i} style={{ width: size, height: size, borderRadius: 14, border: `3px solid ${lit && k > 0 ? C.red : C.line}`, background: lit && k > 0 ? `${C.red}${flick < 1 ? "55" : "aa"}` : C.panel, display: "flex", alignItems: "center", justifyContent: "center", opacity: ease(R(t, i * 0.025, 0.3)) }}>
          <svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="22" fill="none" stroke={lit && k > 0 ? "#fff" : C.mute} strokeWidth="3" /><line x1="28" y1="28" x2={28 + 20 * Math.cos(t * 3 + i)} y2={28 + 20 * Math.sin(t * 3 + i)} stroke={lit && k > 0 ? "#fff" : C.mute} strokeWidth="3" /></svg>
        </div>; })}
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", fontFamily: COND, fontWeight: 800, fontSize: 92, color: C.text, textTransform: "uppercase" }}>
      <span style={{ color: C.red }}>{Math.min(s.lit, Math.max(0, Math.floor((t - 0.6) / 0.07) + 1))}</span> of {s.n}</div>
    <div style={{ position: "absolute", left: 0, right: 0, top: 760, textAlign: "center", fontFamily: INTER, fontWeight: 600, fontSize: 44, color: C.mute }}>{s.label}</div>
    <Src text={s.src} t={t} />
  </AbsoluteFill>;
};

const MapShot: React.FC<{ s: any; t: number; d: number; geo: any }> = ({ s, t, d, geo }) => {
  if (!geo) return <Backdrop t={t} />;
  const [bx0, by0, bx1, by1] = geo.bounds, z = (s.zoom ?? 1) * (1 + 0.05 * EASE.sine(t / Math.max(1, d)));
  const sc = Math.min(1600 / (bx1 - bx0), 820 / (by1 - by0)) * z, cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
  const P = (p: number[]) => [960 + (p[0] - cx) * sc, 560 + (p[1] - cy) * sc];
  return <AbsoluteFill>
    <Backdrop t={t} />
    <svg width={1920} height={1080} style={{ position: "absolute" }}>
      <g transform={`translate(${960 - cx * sc},${560 - cy * sc}) scale(${sc})`}>
        {Object.entries(geo.regions).map(([name, dd]: any) => <path key={name} d={dd} fill={name === "United States of America" ? "#1a2230" : "#0e131a"} stroke={name === "United States of America" ? "#4a5a72" : "#1c2430"} strokeWidth={1.2 / sc} />)}
      </g>
      {s.pins.map((p: string, i: number) => { const q = geo.places[p]; if (!q) return null; const [x, y] = P(q), k = ease(R(t, 0.4 + i * 0.5, 0.5)), ring = (t * 0.8 + i * 0.3) % 1;
        return <g key={p} opacity={k}>
          <circle cx={x} cy={y} r={14 + ring * 50} fill="none" stroke={C.red} strokeWidth={3} opacity={1 - ring} />
          <circle cx={x} cy={y} r={12} fill={C.red} />
          <text x={x + 26} y={y - 18} fill={C.text} style={{ fontFamily: COND, fontWeight: 800, fontSize: 44, textTransform: "uppercase" }}>{p}</text>
        </g>; })}
    </svg>
    <div style={{ position: "absolute", left: 110, top: 120, fontFamily: MONO, fontSize: 32, color: C.mute, letterSpacing: 3 }}>{s.label}</div>
    <div style={{ position: "absolute", right: 110, bottom: 100, fontFamily: MONO, fontSize: 22, color: C.mute }}>MAP: NATURAL EARTH (PUBLIC DOMAIN)</div>
  </AbsoluteFill>;
};

const Network: React.FC<{ s: any; t: number; d: number }> = ({ s, t }) => {
  const N = 34, nodes = Array.from({ length: N }, (_, i) => ({ x: 260 + hash(i) * 1400, y: 180 + hash(i + 50) * 720 }));
  const edges: [number, number][] = []; nodes.forEach((a, i) => { const dist = nodes.map((b, j) => [Math.hypot(a.x - b.x, a.y - b.y), j]).sort((p, q) => p[0] - q[0]); for (let k = 1; k <= 2; k++) edges.push([i, dist[k][1]]); });
  const fail = s.down > 0 ? R(t, s.down, 1.6) : 0;
  const alive = (i: number) => fail <= 0 || hash(i + 9) > fail;
  return <AbsoluteFill>
    <Backdrop t={t} />
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, ${fail > 0.3 ? C.red : C.cyan}33, transparent 60%)` }} />
    <svg width={1920} height={1080} style={{ position: "absolute" }}>
      {edges.map(([a, b], i) => { const on = alive(a) && alive(b), A = nodes[a], B = nodes[b], pk = (t * 0.6 + hash(i)) % 1;
        return <g key={i}><line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={on ? C.cyan : "#2a1416"} strokeWidth={2} opacity={on ? 0.45 : 0.6} />
          {on && <circle cx={A.x + (B.x - A.x) * pk} cy={A.y + (B.y - A.y) * pk} r={4} fill={C.cyan} />}</g>; })}
      {nodes.map((n, i) => { const on = alive(i); return <circle key={i} cx={n.x} cy={n.y} r={on ? 10 : 9} fill={on ? C.cyan : C.red} opacity={on ? 1 : 0.5 + 0.5 * (hash(i + Math.floor(t * 8)) > 0.5 ? 1 : 0)} />; })}
    </svg>
    {s.label && <div style={{ position: "absolute", left: 0, right: 0, bottom: 150, textAlign: "center", fontFamily: COND, fontWeight: 800, fontSize: 72, color: fail > 0.3 ? C.red : C.text, textTransform: "uppercase", letterSpacing: 4, opacity: ease(R(t, 0.3, 0.5)) }}>{s.label}</div>}
  </AbsoluteFill>;
};

const Causes: React.FC<{ s: any; t: number; d: number }> = ({ s, t, d }) => {
  const step = Math.min(1.2, (d - 1) / s.items.length);
  return <AbsoluteFill>
    <Backdrop t={t} />
    <div style={{ position: "absolute", left: 160, top: 130, fontFamily: MONO, fontSize: 34, color: C.mute, letterSpacing: 3 }}>{s.title}</div>
    {s.items.map((it: string, i: number) => { const k = EASE.back(1.6)(R(t, 0.4 + i * step, 0.35));
      return <div key={i} style={{ position: "absolute", left: 160, top: 240 + i * 175, display: "flex", alignItems: "center", gap: 36, transform: `scale(${0.6 + 0.4 * k})`, transformOrigin: "left center", opacity: clamp(k * 1.5) }}>
        <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 44, color: C.red, width: 70 }}>0{i + 1}</div>
        <div style={{ fontFamily: COND, fontWeight: 800, fontSize: 98, color: C.text, textTransform: "uppercase", borderBottom: `5px solid ${C.red}`, paddingBottom: 4 }}>{it}</div>
      </div>; })}
  </AbsoluteFill>;
};

const COLS = { confirmed: { t: "CONFIRMED", c: C.green }, reported: { t: "REPORTED, NOT CONFIRMED", c: C.amber }, unknown: { t: "STILL UNKNOWN", c: C.red } };
const Board: React.FC<{ s: any; t: number; d: number }> = ({ s, t, d }) => {
  const col = (COLS as any)[s.col], step = Math.min(1.4, (d - 1) / s.items.length);
  return <AbsoluteFill>
    <Backdrop t={t} />
    <div style={{ position: "absolute", left: 160, top: 120, display: "flex", alignItems: "center", gap: 20 }}>
      <div style={{ width: 26, height: 26, background: col.c, borderRadius: 4 }} />
      <div style={{ fontFamily: COND, fontWeight: 800, fontSize: 80, color: col.c, letterSpacing: 2 }}>{col.t}</div></div>
    {s.items.map((it: string, i: number) => { const k = ease(R(t, 0.5 + i * step, 0.5));
      return <div key={i} style={{ position: "absolute", left: 160, right: 160, top: 280 + i * 150, display: "flex", gap: 30, alignItems: "baseline", opacity: k, transform: `translateX(${(1 - k) * 60}px)` }}>
        <div style={{ fontFamily: COND, fontWeight: 800, fontSize: 60, color: col.c }}>{s.col === "unknown" ? "?" : s.col === "reported" ? "~" : "✓"}</div>
        <div style={{ fontFamily: INTER, fontWeight: 600, fontSize: 56, color: C.text, lineHeight: 1.2 }}>{it}</div></div>; })}
  </AbsoluteFill>;
};

const Compare: React.FC<{ s: any; t: number; d: number }> = ({ s, t }) => {
  const side = (o: any, i: number) => { const k = ease(R(t, 0.2 + i * 0.6, 0.6));
    return <div style={{ flex: 1, padding: "60px 70px", background: C.panel, border: `2px solid ${i ? C.red : C.line}`, borderRadius: 10, opacity: k, transform: `translateY(${(1 - k) * 40}px)` }}>
      <div style={{ fontFamily: COND, fontWeight: 800, fontSize: 140, color: i ? C.red : C.text, lineHeight: 1 }}>{o.head}</div>
      {o.lines.map((l: string, j: number) => <div key={j} style={{ fontFamily: INTER, fontWeight: 600, fontSize: 44, color: C.text, marginTop: 30, opacity: ease(R(t, 0.6 + i * 0.6 + j * 0.3, 0.4)) }}>{l}</div>)}
    </div>; };
  return <AbsoluteFill><Backdrop t={t} />
    <div style={{ position: "absolute", left: 140, right: 140, top: 180, bottom: 200, display: "flex", gap: 60 }}>{side(s.left, 0)}{side(s.right, 1)}</div>
    <Src text="GCN (Feb 2000), CBS News, Nextgov" t={t} />
  </AbsoluteFill>;
};

const S_DIR = (t0: number) => (Math.floor(t0 * 7) % 2 ? 1 : -1);

// ---------- news-room kinds: real article captures, verified X posts, archive film, headline wall, split, breaking ----------
type Mark = { phrase: string; rects: number[][] };
const Article: React.FC<{ s: any; t: number; d: number }> = ({ s, t, d }) => {
  const m = s.meta as { w: number; h: number; scale: number; marks: Mark[] };
  const [cx0, cy0, cw, ch] = s.crop ?? [0, 0, m.w, m.h];
  const fit = Math.min(1200 / cw, 820 / ch), W = cw * fit, Hh = ch * fit;
  const mk: Mark | undefined = s.mark != null ? m.marks[s.mark] : undefined;
  const rects = (mk?.rects ?? []).filter((r) => r[2] > 2).map((r) => [(r[0] - cx0) * fit, (r[1] - cy0) * fit, r[2] * fit, r[3] * fit]);
  // camera: tilted page settles flat, then pushes toward the marked line
  const settle = EASE.out(R(t, 0, 1.0)), focusK = rects.length ? EASE.inOut(R(t, d * 0.28, Math.min(1.6, d * 0.3))) : EASE.sine(t / Math.max(1, d)) * 0.25;
  const fx = rects.length ? rects.reduce((a, r) => a + r[0] + r[2] / 2, 0) / rects.length : W / 2, fy = rects.length ? rects.reduce((a, r) => a + r[1] + r[3] / 2, 0) / rects.length : Hh * 0.3;
  const zoom = 1 + focusK * (rects.length ? 0.55 : 0.12);
  const tx = (W / 2 - fx) * focusK * (rects.length ? 1 : 0.3), ty = (Hh / 2 - fy) * focusK * (rects.length ? 1 : 0.3);
  const rx = (1 - settle) * 14 * S_DIR(s.t0), ry = (1 - settle) * -10;
  const hl = rects.length ? R(t, d * 0.28 + 0.9, Math.min(1.4, d * 0.35)) : 0;
  const total = rects.reduce((a, r) => a + r[2], 0);
  let acc = 0;
  return <AbsoluteFill>
    <Backdrop t={t} src={s.bg} />
    <AbsoluteFill style={{ perspective: 2200, alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: W, height: Hh, position: "relative", transform: `translate(${tx}px,${ty + (1 - settle) * 40}px) scale(${zoom}) rotateX(${rx}deg) rotateY(${ry}deg)`, transformOrigin: `${fx}px ${fy}px`, boxShadow: "0 40px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)", borderRadius: 6, overflow: "hidden", background: "#fff" }}>
        <Img src={staticFile(s.src)} style={{ position: "absolute", left: -cx0 * fit, top: -cy0 * fit, width: m.w * fit, height: m.h * fit }} />
        {rects.length > 0 && <svg width={W} height={Hh} style={{ position: "absolute", left: 0, top: 0, opacity: Math.min(1, hl * 3) }}>
          <path fillRule="evenodd" fill="rgba(0,0,0,0.45)" d={`M0 0H${W}V${Hh}H0Z ` + rects.map((r) => `M${r[0] - 6} ${r[1] - 4}h${r[2] + 12}v${r[3] + 8}h${-(r[2] + 12)}Z`).join(" ")} /></svg>}
        {rects.map((r, i) => { const share = r[2] / Math.max(1, total), k = clamp((hl * total - acc) / Math.max(1, r[2])); acc += r[2]; void share;
          return <div key={i} style={{ position: "absolute", left: r[0] - 4, top: r[1] - 2, height: r[3] + 4, width: (r[2] + 8) * k, background: "#ffd400", mixBlendMode: "multiply", borderRadius: 3 }} />; })}
      </div>
    </AbsoluteFill>
    <div style={{ position: "absolute", left: 110, top: 128, display: "flex", gap: 0, opacity: ease(R(t, 0.3, 0.5)) }}>
      <div style={{ background: C.text, color: C.bg, fontFamily: COND, fontWeight: 800, fontSize: 34, padding: "4px 16px", letterSpacing: 1 }}>{s.outlet}</div>
      <div style={{ background: "rgba(8,10,14,0.85)", color: C.text, fontFamily: MONO, fontSize: 26, padding: "8px 16px" }}>{s.date}</div>
    </div>
    <div style={{ position: "absolute", right: 40, bottom: 66, fontFamily: MONO, fontSize: 18, color: "#ffffffb0", textShadow: "0 1px 4px #000" }}>Screenshot: {s.outlet}, cited for news reporting</div>
  </AbsoluteFill>;
};

const XPost: React.FC<{ s: any; t: number; d: number }> = ({ s, t, d }) => {
  const k = EASE.back(1.3)(R(t, 0.05, 0.6)), words = s.text.split(/\s+/), span = Math.max(1, Math.min(d * 0.55, words.length * 0.12));
  const initials = s.author.split(" ").map((w: string) => w[0]).join("").slice(0, 2);
  return <AbsoluteFill>
    <Backdrop t={t} src={s.bg} />
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 1180, background: "#0b0d10", border: "1px solid #2f3336", borderRadius: 28, padding: "46px 56px", transform: `scale(${0.85 + 0.15 * k}) translateY(${(1 - k) * 60}px) rotate(${(1 - k) * -2}deg)`, opacity: clamp(k * 1.4), boxShadow: "0 40px 120px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ width: 84, height: 84, borderRadius: 42, background: s.color ?? "#3d4a5c", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: INTER, fontWeight: 800, fontSize: 34 }}>{initials}</div>
          <div style={{ flex: 1 }}><div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 38, color: "#e7e9ea" }}>{s.author}</div>
            <div style={{ fontFamily: INTER, fontSize: 30, color: "#71767b" }}>{s.handle}</div></div>
          <div style={{ fontFamily: MONO, fontSize: 24, color: "#71767b", border: "1px solid #2f3336", borderRadius: 8, padding: "6px 12px" }}>POST ON X</div>
        </div>
        <div style={{ marginTop: 30, fontFamily: INTER, fontWeight: 400, fontSize: words.length > 34 ? 40 : 48, lineHeight: 1.32, color: "#e7e9ea", whiteSpace: "pre-wrap" }}>
          {words.map((w: string, i: number) => { const on = R(t, 0.45 + (i / words.length) * span, 0.18); const em = /^[“"].*|^BREAKING:?$|^NEW:$/.test(w) ? "#ff6b61" : undefined; return <span key={i} style={{ opacity: 0.25 + 0.75 * on, color: em }}>{w} </span>; })}
        </div>
        <div style={{ marginTop: 26, fontFamily: INTER, fontSize: 28, color: "#71767b" }}>{s.date}</div>
      </div>
    </AbsoluteFill>
    <div style={{ position: "absolute", right: 40, bottom: 66, fontFamily: MONO, fontSize: 18, color: "#ffffffb0" }}>Recreated from the public post (links removed); text verified via X oEmbed</div>
  </AbsoluteFill>;
};

const Archive: React.FC<{ s: any; t: number; d: number }> = ({ s, t, d }) => {
  const rate = Math.min(1, (s.len - (s.from ?? 0) - 0.1) / Math.max(0.5, d)), flick = 0.9 + 0.1 * hash(Math.floor(t * 24));
  const W = 1240, H = 930, k = EASE.out(R(t, 0, 0.7));
  return <AbsoluteFill style={{ background: "#0a0806" }}>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: W, height: H, position: "relative", overflow: "hidden", borderRadius: 18, boxShadow: "0 0 0 10px #15110c, 0 30px 90px rgba(0,0,0,0.8)", transform: `scale(${0.94 + 0.06 * k + 0.03 * EASE.sine(t / Math.max(1, d))})` }}>
        <OffthreadVideo src={staticFile(s.src)} startFrom={Math.round((s.from ?? 0) * 30)} playbackRate={rate} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: `sepia(${s.sepia ?? 0.35}) contrast(1.12) brightness(${0.92 * flick}) saturate(0.85)` }} />
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.65) 100%)" }} />
        <div style={{ position: "absolute", left: (hash(Math.floor(t * 8)) * W) | 0, top: 0, width: 2, height: H, background: "rgba(255,255,255,0.12)" }} />
      </div>
    </AbsoluteFill>
    <div style={{ position: "absolute", left: 110, top: 128, display: "flex", opacity: ease(R(t, 0.3, 0.5)) }}>
      <div style={{ background: C.amber, color: "#111", fontFamily: COND, fontWeight: 800, fontSize: 32, padding: "4px 14px", letterSpacing: 2 }}>ARCHIVE</div>
      <div style={{ background: "rgba(8,10,14,0.85)", color: C.text, fontFamily: MONO, fontSize: 24, padding: "8px 14px" }}>{s.label}</div>
    </div>
    <div style={{ position: "absolute", right: 40, bottom: 66, fontFamily: MONO, fontSize: 18, color: "#ffffffb0" }}>{s.credit}</div>
  </AbsoluteFill>;
};

const Wall: React.FC<{ s: any; t: number; d: number }> = ({ s, t, d }) => {
  const n = s.items.length, cam = EASE.sine(t / Math.max(1, d));
  return <AbsoluteFill>
    <Backdrop t={t} />
    <AbsoluteFill style={{ transform: `scale(${1.02 + 0.08 * cam}) translateX(${-30 * cam}px)` }}>
      {s.items.map((it: any, i: number) => { const col = i % 3, row = Math.floor(i / 3), k = EASE.out(R(t, 0.15 + i * Math.min(0.45, (d * 0.5) / n), 0.6));
        const x = 120 + col * 580 + (row % 2) * 60, y = 150 + row * 430, rot = (hash(i + 3) - 0.5) * 7, cw = it.cw ?? it.w, chh = Math.min(it.ch ?? it.h, cw * 0.62), f = 520 / cw;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: 520, height: chh * f, overflow: "hidden", background: "#fff", borderRadius: 4, boxShadow: "0 24px 60px rgba(0,0,0,0.65)", transform: `translateY(${(1 - k) * 220}px) rotate(${rot + (1 - k) * 10}deg) scale(${0.9 + 0.1 * k})`, opacity: clamp(k * 1.5) }}>
          <Img src={staticFile(it.src)} style={{ position: "absolute", left: -(it.cx ?? 0) * f, top: -(it.cy ?? 0) * f, width: it.w * f, height: it.h * f }} />
          <div style={{ position: "absolute", left: 0, bottom: 0, background: C.red, color: "#fff", fontFamily: COND, fontWeight: 800, fontSize: 24, padding: "2px 10px" }}>{it.outlet}</div>
        </div>; })}
    </AbsoluteFill>
    {s.title && <div style={{ position: "absolute", left: 0, right: 0, bottom: 120, textAlign: "center", fontFamily: COND, fontWeight: 800, fontSize: 72, color: C.text, textTransform: "uppercase", textShadow: "0 4px 24px #000", opacity: ease(R(t, d * 0.45, 0.6)) }}>{s.title}</div>}
    <div style={{ position: "absolute", right: 40, bottom: 66, fontFamily: MONO, fontSize: 18, color: "#ffffffb0" }}>Screenshots of the cited outlets, for news reporting</div>
  </AbsoluteFill>;
};

const Split: React.FC<{ s: any; t: number; d: number }> = ({ s, t, d }) => {
  const k = EASE.inOut(R(t, 0.1, 0.8)), side = (o: any, i: number) => {
    const inner = o.video ? <OffthreadVideo src={staticFile(o.src)} startFrom={Math.round((o.from ?? 0) * 30)} playbackRate={Math.min(1, (o.len - (o.from ?? 0) - 0.1) / Math.max(0.5, d))} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: o.filter ?? GRADE.cool }} />
      : <Img src={staticFile(o.src)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: o.filter ?? GRADE.cool, transform: `scale(${1.08 + 0.06 * EASE.sine(t / Math.max(1, d))})` }} />;
    return <div style={{ position: "absolute", top: 0, bottom: 0, left: i ? `${50 + (1 - k) * 50}%` : 0, width: i ? "50%" : `${50 * (i ? 1 : 1)}%`, overflow: "hidden", borderLeft: i ? `6px solid ${C.red}` : "none" }}>
      {inner}<div style={{ position: "absolute", left: 40, bottom: 120, background: i ? C.red : "rgba(8,10,14,0.85)", color: "#fff", fontFamily: COND, fontWeight: 800, fontSize: 52, padding: "6px 20px", textTransform: "uppercase" }}>{o.label}</div></div>; };
  return <AbsoluteFill style={{ background: "#000" }}>{side(s.left, 0)}{side(s.right, 1)}
    <div style={{ position: "absolute", right: 40, bottom: 66, fontFamily: MONO, fontSize: 18, color: "#ffffffb0" }}>{s.credit}</div></AbsoluteFill>;
};

const Breaking: React.FC<{ s: any; t: number; d: number }> = ({ s, t }) => {
  const a = EASE.out(R(t, 0, 0.45)), b = EASE.out(R(t, 0.2, 0.5)), c = ease(R(t, 0.55, 0.5));
  return <AbsoluteFill style={{ background: C.bg }}>
    <Backdrop t={t} src={s.bg} />
    <div style={{ position: "absolute", left: 0, top: 380, height: 150, width: `${a * 100}%`, background: C.red }} />
    <div style={{ position: "absolute", left: 0, top: 530, height: 120, width: `${b * 100}%`, background: C.text }} />
    <div style={{ position: "absolute", left: 120, top: 392, fontFamily: COND, fontWeight: 800, fontSize: 120, color: "#fff", letterSpacing: 6, opacity: a, lineHeight: 1.05 }}>{s.kicker ?? "BREAKING"}</div>
    <div style={{ position: "absolute", left: 120, top: 548, fontFamily: COND, fontWeight: 800, fontSize: 76, color: C.bg, opacity: c, transform: `translateX(${(1 - c) * 60}px)`, textTransform: "uppercase" }}>{s.text}</div>
  </AbsoluteFill>;
};

const Ticker: React.FC<{ items: string[]; t: number; hide: number }> = ({ items, t, hide }) => {
  const line = items.join("   ●   ") + "   ●   ", px = 13.5 * line.length, x = -((t * 120) % px);
  return <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 58, display: "flex", background: "rgba(6,8,12,0.92)", borderTop: `2px solid ${C.red}`, transform: `translateY(${hide * 70}px)` }}>
    <div style={{ background: C.red, color: "#fff", fontFamily: COND, fontWeight: 800, fontSize: 30, padding: "10px 22px", letterSpacing: 2, zIndex: 2 }}>LATEST</div>
    <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: x, top: 12, whiteSpace: "nowrap", fontFamily: INTER, fontWeight: 600, fontSize: 26, color: C.text }}>{line}{line}{line}</div>
    </div>
  </div>;
};
const ShotView: React.FC<{ s: Shot; t: number; geo: any }> = ({ s, t, geo }) => {
  const d = s.t1 - s.t0, lt = t - s.t0, x = s as any;
  let body: React.ReactNode;
  switch (s.kind) {
    case "photo": body = <Photo s={x} t={lt} d={d} />; break;
    case "video": body = <Video s={x} t={lt} />; break;
    case "chapter": body = <Chapter s={x} t={lt} d={d} />; break;
    case "headline": body = <Headline s={x} t={lt} d={d} />; break;
    case "quote": body = <Quote s={x} t={lt} d={d} />; break;
    case "stat": body = <Stat s={x} t={lt} d={d} />; break;
    case "timeline": body = <Timeline s={x} t={lt} d={d} />; break;
    case "grid": body = <Grid s={x} t={lt} d={d} />; break;
    case "map": body = <MapShot s={x} t={lt} d={d} geo={geo} />; break;
    case "network": body = <Network s={x} t={lt} d={d} />; break;
    case "causes": body = <Causes s={x} t={lt} d={d} />; break;
    case "board": body = <Board s={x} t={lt} d={d} />; break;
    case "compare": body = <Compare s={x} t={lt} d={d} />; break;
    case "article": body = <Article s={x} t={lt} d={d} />; break;
    case "xpost": body = <XPost s={x} t={lt} d={d} />; break;
    case "archive": body = <Archive s={x} t={lt} d={d} />; break;
    case "wall": body = <Wall s={x} t={lt} d={d} />; break;
    case "split": body = <Split s={x} t={lt} d={d} />; break;
    case "breaking": body = <Breaking s={x} t={lt} d={d} />; break;
  }
  const graphic = !["photo", "video", "article", "archive", "split", "xpost", "wall"].includes(s.kind);
  const push = graphic ? 1 + 0.028 * EASE.sine(lt / Math.max(1, d)) : 1, drift = graphic ? (S_DIR(s.t0) * 10 * EASE.sine(lt / Math.max(1, d))) : 0;
  return <AbsoluteFill>{graphic ? <AbsoluteFill style={{ transform: `translateX(${drift}px) scale(${push})` }}>{body}</AbsoluteFill> : body}{s.credit && !["archive", "split"].includes(s.kind) && <div style={{ position: "absolute", right: 40, bottom: 66, fontFamily: MONO, fontSize: 18, color: "#ffffffb0", textShadow: "0 1px 4px #000" }}>{s.credit}</div>}</AbsoluteFill>;
};

// ---------- persistent overlays ----------
const Bug: React.FC<{ cfg: NewsCfg; t: number }> = ({ cfg, t }) => {
  const ch = [...cfg.chapters].reverse().find((c) => t >= c.t), since = ch ? t - ch.t : 99;
  const show = ease(R(since, 3.2, 0.5)) * (1 - ease(R(since, 9, 0.6)));
  return <>
    <div style={{ position: "absolute", left: 60, top: 48, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ background: C.red, color: "#fff", fontFamily: COND, fontWeight: 800, fontSize: 30, padding: "4px 14px", letterSpacing: 2 }}>ANALYSIS</div>
      <div style={{ fontFamily: COND, fontWeight: 600, fontSize: 30, color: C.text, letterSpacing: 2, textShadow: "0 1px 8px #000" }}>{cfg.topic}</div>
    </div>
    {ch && show > 0.01 && <div style={{ position: "absolute", left: 110, bottom: 170, display: "flex", opacity: show, transform: `translateX(${(1 - show) * -40}px)` }}>
      <div style={{ width: 10, background: C.red }} />
      <div style={{ background: "rgba(8,10,14,0.88)", padding: "16px 30px" }}>
        <div style={{ fontFamily: COND, fontWeight: 800, fontSize: 46, color: C.text, textTransform: "uppercase", letterSpacing: 1 }}>{ch.title}</div>
      </div></div>}
  </>;
};

const OVER = 0.5;   // transition overlap (s)
export const NewsFilm: React.FC<{ cfg: NewsCfg }> = ({ cfg }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), t = f / fps, S = cfg.shots;
  let i = S.findIndex((s) => t >= s.t0 && t < s.t1); if (i < 0) i = t < S[0].t0 ? 0 : S.length - 1;
  const cur = S[i];
  let view: React.ReactNode = <ShotView s={cur} t={t} geo={cfg.geo} />;
  const inStart = i > 0 && t < cur.t0 + OVER / 2, inEnd = i < S.length - 1 && t >= cur.t1 - OVER / 2;
  if (inStart || inEnd) {
    const a = inStart ? S[i - 1] : cur, b = inStart ? cur : S[i + 1], p = clamp((t - (b.t0 - OVER / 2)) / OVER);
    view = <TransitionStage kind={b.trans ?? "luma"} p={p} dir={(S.indexOf(b) % 2 ? -1 : 1) as 1 | -1} color={C.red} colors={[C.red, C.bg, C.panel, C.amber, C.text]}
      A={<ShotView s={a} t={t} geo={cfg.geo} />} B={<ShotView s={b} t={t} geo={cfg.geo} />} />;
  }
  return <AbsoluteFill style={{ background: C.bg }}>
    {view}
    {(() => { const ch = [...cfg.chapters].reverse().find((c) => t >= c.t); return ch?.tint ? <AbsoluteFill style={{ background: ch.tint, mixBlendMode: "color", opacity: 0.22 }} /> : null; })()}
    <Vignette k={0.55} />
    <Grain t={t} o={(() => { const ch = [...cfg.chapters].reverse().find((c) => t >= c.t); return ch?.tint ? 0.1 : 0.06; })()} />
    <Bug cfg={cfg} t={t} />
    {cfg.ticker && <Ticker items={cfg.ticker} t={t} hide={["chapter", "breaking"].includes(cur.kind) ? 1 : 0} />}
    {cfg.audio && <Audio src={staticFile(cfg.audio)} />}
  </AbsoluteFill>;
};
export const newsLength = (cfg: NewsCfg) => Math.ceil(cfg.duration * cfg.fps);
