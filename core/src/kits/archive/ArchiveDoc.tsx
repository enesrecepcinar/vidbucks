// ArchiveDoc - a dark archival documentary: real public-domain photos and footage, framed prints with a thin gold rule on
// near-black, serif chapter cards, gold date tags, quote cards with attribution, approximate big numbers ("~3,000"), typed
// government memos, redacted record tables with a highlighted row, gold bar charts, calendar grids, a flat map with a route
// that draws on and a distance label, side-by-side comparisons, native-script place cards and a small source tag on every
// shot. Any topic: wars, places, disasters, companies, crimes, expeditions. Media are the caller's licensed files in public/.
// Transitions: cut (default), dissolve, black (dip). Every picture holds a slow, eased camera move.
import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fSerif } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as fSans } from "@remotion/google-fonts/Inter";
import { loadFont as fMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as fJP } from "@remotion/google-fonts/NotoSerifJP";
import { EASE, clamp } from "../motion";

const SERIF = fSerif("normal", { weights: ["500", "600", "700"], subsets: ["latin", "latin-ext"] }).fontFamily;
const SERIF_I = fSerif("italic", { weights: ["500"], subsets: ["latin", "latin-ext"] }).fontFamily;
const SANS = fSans("normal", { weights: ["400", "600"], subsets: ["latin", "latin-ext"] }).fontFamily;
const MONO = fMono("normal", { weights: ["400", "500"], subsets: ["latin", "latin-ext"] }).fontFamily;
const CJK = fJP("normal", { weights: ["600"] }).fontFamily;
const GOLD = "#c9a24a", INK = "#0c0d10", CREAM = "#efe8d6", DIM = "rgba(239,232,214,.72)";

export type Move = { from?: [number, number, number]; to?: [number, number, number] };   // [zoom, focusX, focusY]
export type Grade = "none" | "bw" | "sepia" | "faded";
type Over = { date?: string; caption?: string; credit?: string; in?: "cut" | "dissolve" | "black"; dur: number };
export type MediaShot = Over & { kind: "media"; src: string; move?: Move; grade?: Grade; trim?: number };
export type PrintShot = Over & { kind: "print"; src: string; name?: [string, string?]; grade?: Grade; quote?: { text: string; by: string } };
export type ChapterShot = Over & { kind: "chapter"; title: string; sub?: string; bg?: string };
export type NumberShot = Over & { kind: "number"; value: string; label: string; bg?: string };
export type QuoteShot = Over & { kind: "quote"; text: string; by: string; bg?: string };
export type DocShot = Over & { kind: "doc"; heading: string; lines: string[]; stamp?: string };
export type TableShot = Over & { kind: "table"; title: string; rows: string[][]; redact?: number[]; highlight: number; tag?: string };
export type BarsShot = Over & { kind: "bars"; title: string; items: { label: string; value: number; display?: string }[]; highlight?: number };
export type CalendarShot = Over & { kind: "calendar"; title: string; days: number; highlight?: number; label?: string };
export type MapData = { regions: Record<string, string>; places: Record<string, [number, number]>; bounds: [number, number, number, number] };
export type MapShot = Over & { kind: "map"; map?: MapData; mapSrc?: string; highlight?: string[]; route?: [string, string]; distance?: string; title?: string; pins?: string[] };
export type CompareShot = Over & { kind: "compare"; items: { src: string; label: string }[]; title?: string };
export type PlaceShot = Over & { kind: "place"; native?: string; name: string; sub?: string; bg?: string };
export type ArchiveShot = MediaShot | PrintShot | ChapterShot | NumberShot | QuoteShot | DocShot | TableShot | BarsShot | CalendarShot | MapShot | CompareShot | PlaceShot;
export type ArchiveCfg = { shots: ArchiveShot[]; audio?: string; trans?: number };
export const archiveLength = (c: ArchiveCfg) => c.shots.reduce((a, s) => a + s.dur, 0);

const isVid = (s: string) => /\.(mp4|webm|mov)$/i.test(s);
const fade = (t: number, at: number, d = 0.5) => EASE.out(clamp((t - at) / d));
const GRADE: Record<Grade, string> = { none: "none", bw: "grayscale(1) contrast(1.08)", sepia: "sepia(.55) contrast(1.05) brightness(.95)", faded: "saturate(.6) contrast(.95) brightness(.95)" };
const hash = (n: number) => { const s = Math.sin(n * 91.7 + 13.3) * 43758.5453; return s - Math.floor(s); };

/** a picture or clip filling its box with a slow eased move (default: gentle push, alternating focus) */
const Pic: React.FC<{ src: string; t: number; dur: number; move?: Move; grade?: Grade; seed?: number; fit?: "cover" | "contain"; trim?: number }> = ({ src, t, dur, move, grade = "none", seed = 0, fit = "cover", trim = 0 }) => {
  const { fps } = useVideoConfig(), d = move ?? { from: [1.04, 0.5 + (hash(seed) - 0.5) * 0.1, 0.5], to: [1.14, 0.5 + (hash(seed + 1) - 0.5) * 0.14, 0.48] };
  const f = d.from ?? [1, 0.5, 0.5], g = d.to ?? [1.1, 0.5, 0.5], k = EASE.inOut(clamp(t / dur)), z = f[0] + (g[0] - f[0]) * k, x = f[1] + (g[1] - f[1]) * k, y = f[2] + (g[2] - f[2]) * k;
  const st: React.CSSProperties = { width: "100%", height: "100%", objectFit: fit, transform: `scale(${z})`, transformOrigin: `${x * 100}% ${y * 100}%`, filter: GRADE[grade] };
  return isVid(src) ? <OffthreadVideo src={staticFile(src)} muted startFrom={Math.round(trim * fps)} style={st} /> : <Img src={staticFile(src)} style={st} />;
};
const Vignette: React.FC<{ k?: number }> = ({ k = 0.55 }) => <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${k}) 100%)` }} />;
const Grain: React.FC<{ t: number }> = ({ t }) => { const { width: W, height: H, fps } = useVideoConfig(), seed = Math.floor(t * fps / 2) % 8;
  return <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.09, mixBlendMode: "overlay" }}><filter id={`ag${seed}`}><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} /><feColorMatrix type="saturate" values="0" /></filter><rect width={W} height={H} filter={`url(#ag${seed})`} /></svg>; };
const Rule: React.FC<{ w: number; k: number }> = ({ w, k }) => <div style={{ width: w * k, height: 2, background: GOLD, margin: "0 auto" }} />;

/* ---------- overlays any shot can carry ---------- */
const Overlays: React.FC<{ s: Over; t: number }> = ({ s, t }) => {
  const { width: W, height: H } = useVideoConfig(), m = W * 0.05, mv = H * 0.05;
  return <>
    {s.credit && <div style={{ position: "absolute", right: m, top: mv, fontFamily: SANS, fontSize: H * 0.014, color: CREAM, background: "rgba(10,10,12,.55)", padding: `${H * 0.003}px ${H * 0.008}px`, letterSpacing: "0.08em", opacity: fade(t, 0.3) * 0.85 }}>[{s.credit}]</div>}
    {s.date && <div style={{ position: "absolute", left: m, bottom: H * 0.12, background: "rgba(201,162,74,.92)", color: INK, fontFamily: SERIF_I, fontSize: H * 0.03, padding: `${H * 0.006}px ${H * 0.016}px`, transform: `translateX(${(1 - fade(t, 0.4, 0.6)) * -40}px)`, opacity: fade(t, 0.4, 0.6) }}>{s.date}</div>}
    {s.caption && <div style={{ position: "absolute", left: m, bottom: H * 0.06, fontFamily: SERIF_I, fontSize: H * 0.03, color: CREAM, textShadow: "0 2px 8px rgba(0,0,0,.8)", opacity: fade(t, 0.5, 0.6), maxWidth: W * 0.6 }}>{s.caption}</div>}
  </>;
};

/* ---------- shots ---------- */
const Media: React.FC<{ s: MediaShot; t: number; i: number }> = ({ s, t, i }) => <AbsoluteFill style={{ background: INK }}><Pic src={s.src} t={t} dur={s.dur} move={s.move} grade={s.grade} seed={i} trim={s.trim} /><Vignette k={0.45} /></AbsoluteFill>;
const Print: React.FC<{ s: PrintShot; t: number; i: number }> = ({ s, t, i }) => {
  const { width: W, height: H } = useVideoConfig(), q = s.quote, P = W < H, bw = P ? W * 0.84 : Math.min(W * (q ? 0.36 : 0.56), H * (q ? 0.62 : 0.78) * 1.33), bh = bw * 0.75, k = fade(t, 0, 0.7);
  const fx = P || !q ? (W - bw) / 2 : W * 0.56, fy = P && q ? H * 0.16 : (H - bh) / 2 - H * 0.02;
  return <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, #1a1b20, ${INK})` }}>
    <div style={{ position: "absolute", left: fx, top: fy, width: bw, height: bh, border: `2px solid ${GOLD}`, boxShadow: "0 30px 70px rgba(0,0,0,.75)", overflow: "hidden", opacity: k, transform: `scale(${0.97 + 0.03 * k})` }}>
      <Pic src={s.src} t={t} dur={s.dur} grade={s.grade ?? "none"} seed={i} move={{ from: [1.02, 0.5, 0.45], to: [1.1, 0.5, 0.42] }} /></div>
    {s.name && <div style={{ position: "absolute", left: fx, top: fy + bh + H * 0.012, fontFamily: SERIF, color: CREAM, opacity: fade(t, 0.6) }}>
      <div style={{ fontSize: H * 0.03, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>{s.name[0]}</div>
      {s.name[1] && <div style={{ fontFamily: SERIF_I, fontSize: H * 0.022, color: DIM }}>{s.name[1]}</div>}</div>}
    {q && <div style={{ position: "absolute", left: W * 0.1, top: P ? fy + bh + H * 0.08 : H * 0.32, width: P ? W * 0.8 : W * 0.4, fontFamily: SERIF_I, color: CREAM, opacity: fade(t, 0.9, 0.8) }}>
      <div style={{ fontSize: H * 0.046, lineHeight: 1.25 }}>“{q.text}”</div>
      <div style={{ fontFamily: SANS, fontSize: H * 0.016, color: GOLD, letterSpacing: "0.16em", marginTop: H * 0.025 }}>— {q.by.toUpperCase()}</div></div>}
  </AbsoluteFill>;
};
const Dimmed: React.FC<{ bg?: string; t: number; dur: number; i: number; k?: number; children: React.ReactNode }> = ({ bg, t, dur, i, k = 0.62, children }) => (
  <AbsoluteFill style={{ background: INK }}>
    {bg && <AbsoluteFill style={{ opacity: 1 - k }}><Pic src={bg} t={t} dur={dur} seed={i} grade="faded" /></AbsoluteFill>}
    <Vignette k={0.7} /><AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>{children}</AbsoluteFill></AbsoluteFill>);
const Chapter: React.FC<{ s: ChapterShot; t: number; i: number }> = ({ s, t, i }) => { const { height: H } = useVideoConfig(), k = fade(t, 0.2, 0.9);
  return <Dimmed bg={s.bg} t={t} dur={s.dur} i={i}><div style={{ fontFamily: SERIF, color: CREAM, opacity: k, transform: `translateY(${(1 - k) * 14}px)` }}>
    <div style={{ fontSize: H * 0.075, fontWeight: 600, letterSpacing: "0.08em", fontVariant: "small-caps" }}>{s.title}</div><Rule w={H * 0.22} k={fade(t, 0.6, 0.8)} />
    {s.sub && <div style={{ fontFamily: SERIF_I, fontSize: H * 0.03, color: DIM, marginTop: H * 0.02 }}>{s.sub}</div>}</div></Dimmed>; };
const Num: React.FC<{ s: NumberShot; t: number; i: number }> = ({ s, t, i }) => { const { height: H } = useVideoConfig(), k = fade(t, 0.15, 0.7), m = s.value.match(/^([^0-9]*)([0-9][0-9,.]*)(.*)$/);
  const shown = m ? `${m[1]}${Math.round(parseFloat(m[2].replace(/,/g, "")) * EASE.out(clamp(t / 1.2))).toLocaleString("en-US")}${m[3]}` : s.value;
  return <Dimmed bg={s.bg} t={t} dur={s.dur} i={i}><div style={{ fontFamily: SERIF, color: CREAM, opacity: k }}>
    <div style={{ fontSize: H * 0.15, fontWeight: 600, lineHeight: 1 }}>{shown}</div><div style={{ height: H * 0.02 }} /><Rule w={H * 0.12} k={k} />
    <div style={{ fontFamily: SANS, fontSize: H * 0.017, letterSpacing: "0.22em", color: DIM, marginTop: H * 0.02 }}>{s.label.toUpperCase()}</div></div></Dimmed>; };
const Quote: React.FC<{ s: QuoteShot; t: number; i: number }> = ({ s, t, i }) => { const { width: W, height: H } = useVideoConfig();
  return <Dimmed bg={s.bg} t={t} dur={s.dur} i={i} k={0.7}><div style={{ width: W * 0.62, fontFamily: SERIF_I, color: CREAM, opacity: fade(t, 0.2, 0.9) }}>
    <div style={{ fontSize: H * 0.052, lineHeight: 1.3 }}>“{s.text}”</div>
    <div style={{ fontFamily: SANS, fontSize: H * 0.017, color: GOLD, letterSpacing: "0.18em", marginTop: H * 0.03, opacity: fade(t, 1, 0.6) }}>— {s.by.toUpperCase()}</div></div></Dimmed>; };
const Doc: React.FC<{ s: DocShot; t: number }> = ({ s, t }) => { const { width: W, height: H } = useVideoConfig(), pw = Math.min(W * 0.46, H * 0.62), k = fade(t, 0, 0.7), z = 1 + 0.08 * EASE.inOut(clamp(t / s.dur));
  return <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, #1c1d22, ${INK})`, alignItems: "center", justifyContent: "center" }}>
    <div style={{ width: pw, minHeight: pw * 1.1, background: "#ece4cf", boxShadow: "0 30px 70px rgba(0,0,0,.7)", padding: pw * 0.08, boxSizing: "border-box", fontFamily: MONO, color: "#2a2622", opacity: k, transform: `scale(${z}) rotate(-0.6deg)`, position: "relative" }}>
      <div style={{ fontSize: H * 0.018, letterSpacing: "0.12em", textAlign: "center", borderBottom: "1px solid #2a2622", paddingBottom: H * 0.012, marginBottom: H * 0.02 }}>{s.heading}</div>
      {s.lines.map((l, j) => <div key={j} style={{ fontSize: H * 0.017, lineHeight: 1.7, opacity: fade(t, 0.4 + j * 0.25, 0.3) }}>{l}</div>)}
      {s.stamp && <div style={{ position: "absolute", right: pw * 0.08, bottom: pw * 0.1, border: "3px solid #9c2f25", color: "#9c2f25", fontFamily: SANS, fontWeight: 600, fontSize: H * 0.022, padding: `${H * 0.004}px ${H * 0.012}px`, transform: `rotate(-8deg) scale(${1.4 - 0.4 * fade(t, 1.4, 0.25)})`, opacity: fade(t, 1.4, 0.25) * 0.85 }}>{s.stamp}</div>}
    </div></AbsoluteFill>; };
const Table: React.FC<{ s: TableShot; t: number }> = ({ s, t }) => {
  const { width: W, height: H } = useVideoConfig(), rh = H * 0.052, hl = s.highlight, pan = EASE.inOut(clamp((t - 0.6) / Math.max(1, s.dur - 1.6))), y0 = H * 0.5 - (hl * rh) * pan - rh * 2 * (1 - pan);
  return <AbsoluteFill style={{ background: "#e9e2cf", overflow: "hidden" }}>
    <div style={{ position: "absolute", left: W * 0.14, right: W * 0.14, top: y0, fontFamily: MONO, color: "#25221e", transform: `scale(${1 + 0.15 * pan})`, transformOrigin: `50% ${hl * rh}px` }}>
      <div style={{ fontSize: H * 0.02, letterSpacing: "0.12em", marginBottom: H * 0.02, marginTop: -H * 0.06 }}>{s.title}</div>
      {s.rows.map((r, j) => { const red = s.redact?.includes(j), on = j === hl;
        return <div key={j} style={{ display: "flex", gap: W * 0.03, height: rh, alignItems: "center", fontSize: Math.min(H * 0.026, W * 0.024), whiteSpace: "nowrap", position: "relative", background: on ? `rgba(201,162,74,${0.55 * fade(t, 1.2, 0.5)})` : "transparent" }}>
          {r.map((c, k) => <div key={k} style={{ flex: k === 0 ? 2.4 : 1, position: "relative" }}>{red && k === 0 ? <span style={{ background: "#111", color: "#111" }}>{c}</span> : c}{k === 0 && on && s.tag && <span style={{ marginLeft: W * 0.012, background: INK, color: GOLD, fontFamily: SANS, fontWeight: 600, fontSize: H * 0.014, padding: `${H * 0.003}px ${H * 0.008}px`, verticalAlign: "middle", opacity: fade(t, 1.4, 0.4) }}>{s.tag}</span>}</div>)}
          </div>; })}
    </div><Vignette k={0.35} /></AbsoluteFill>;
};
const Bars: React.FC<{ s: BarsShot; t: number }> = ({ s, t }) => { const { width: W, height: H } = useVideoConfig(), mx = Math.max(...s.items.map((x) => x.value)), bw = W * 0.5;
  return <AbsoluteFill style={{ background: `radial-gradient(ellipse at 40% 40%, #1b1c21, ${INK})` }}>
    <div style={{ position: "absolute", left: W * 0.2, top: H * 0.24, fontFamily: SANS, color: CREAM }}>
      <div style={{ fontFamily: SERIF, fontSize: H * 0.04, marginBottom: H * 0.05, opacity: fade(t, 0.1) }}>{s.title}</div>
      {s.items.map((it, j) => { const k = EASE.out(clamp((t - 0.4 - j * 0.3) / 1)), on = j === s.highlight;
        return <div key={j} style={{ marginBottom: H * 0.04 }}><div style={{ fontSize: H * 0.018, letterSpacing: "0.12em", color: on ? GOLD : DIM, marginBottom: H * 0.01 }}>{it.label.toUpperCase()}</div>
          <div style={{ display: "flex", alignItems: "center", gap: W * 0.012 }}><div style={{ width: bw * (it.value / mx) * k, height: H * 0.03, background: on ? GOLD : "rgba(239,232,214,.55)" }} />
            <div style={{ fontFamily: SERIF, fontSize: H * 0.03, opacity: k }}>{it.display ?? it.value.toLocaleString("en-US")}</div></div></div>; })}
    </div></AbsoluteFill>; };
const Calendar: React.FC<{ s: CalendarShot; t: number }> = ({ s, t }) => { const { width: W, height: H } = useVideoConfig(), cols = W < H ? 6 : 12, c = Math.min(H * 0.072, (W * 0.86) / (W < H ? 6 : 12) / 1.18), g = c * 0.18, gw = cols * (c + g), n = Math.floor(clamp((t - 0.4) / 1.6) * s.days);
  return <AbsoluteFill style={{ background: INK, alignItems: "center", justifyContent: "center", fontFamily: SANS, color: CREAM }}>
    <div style={{ fontFamily: SERIF, fontSize: H * 0.034, letterSpacing: "0.1em", marginBottom: H * 0.04 }}>{s.title}</div>
    <div style={{ width: gw, display: "flex", flexWrap: "wrap", gap: g }}>{Array.from({ length: s.days }, (_, j) => { const on = s.highlight === j + 1 && t > 2.1;
      return <div key={j} style={{ width: c, height: c, border: `1px solid ${on ? GOLD : "rgba(239,232,214,.35)"}`, background: on ? GOLD : j < n ? "rgba(239,232,214,.12)" : "transparent", color: on ? INK : DIM, fontSize: c * 0.36, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${on ? 1.15 : 1})` }}>{j + 1}</div>; })}</div>
    {s.label && <div style={{ fontFamily: SERIF_I, fontSize: H * 0.026, color: GOLD, marginTop: H * 0.04, opacity: fade(t, 2.2) }}>{s.label}</div>}
    <div style={{ width: W, height: 0 }} /></AbsoluteFill>; };
/** map data inline (`map`) or from a board_map.py JSON in public/ (`mapSrc`) */
function useMap(s: MapShot): MapData | null {
  const [m, setM] = React.useState<MapData | null>(s.map ?? null);
  const [h] = React.useState(() => (s.map || !s.mapSrc ? null : delayRender("map " + s.mapSrc)));
  React.useEffect(() => { if (!s.mapSrc || s.map) return; fetch(staticFile(s.mapSrc)).then((r) => r.json()).then((j) => { setM(j); if (h !== null) continueRender(h); }); }, [s.mapSrc]);
  return m;
}
const MapView: React.FC<{ s: MapShot; t: number }> = ({ s, t }) => {
  const map = useMap(s);
  return map ? <MapDraw s={s} map={map} t={t} /> : null;
};
const MapDraw: React.FC<{ s: MapShot; map: MapData; t: number }> = ({ s, map, t }) => {
  const { width: W, height: H } = useVideoConfig(), [x0, y0, x1, y1] = map.bounds, sc = Math.min(W / (x1 - x0), H / (y1 - y0)) * 0.92, ox = (W - (x1 - x0) * sc) / 2 - x0 * sc, oy = (H - (y1 - y0) * sc) / 2 - y0 * sc;
  const P = (n: string) => { const p = map.places[n]; return p ? [ox + p[0] * sc, oy + p[1] * sc] : null; }, a = s.route ? P(s.route[0]) : null, b = s.route ? P(s.route[1]) : null;
  const rp = EASE.inOut(clamp((t - 0.8) / 1.8)), z = 1 + 0.06 * EASE.inOut(clamp(t / s.dur));
  return <AbsoluteFill style={{ background: "#b9d3e3" }}>
    <svg width={W} height={H} style={{ transform: `scale(${z})` }}>
      <g transform={`translate(${ox} ${oy}) scale(${sc})`}>{Object.entries(map.regions).map(([n, d]) => <path key={n} d={d} fill={s.highlight?.includes(n) ? GOLD : "#e8e2cf"} />)}</g>
      {a && b && <><line x1={a[0]} y1={a[1]} x2={a[0] + (b[0] - a[0]) * rp} y2={a[1] + (b[1] - a[1]) * rp} stroke="#1f2a33" strokeWidth={3} strokeDasharray="10 8" />
        {[a, b].map((p, j) => <circle key={j} cx={p[0]} cy={p[1]} r={8} fill={j ? "#9c2f25" : "#1f2a33"} opacity={j ? fade(t, 2.6, 0.3) : 1} />)}</>}
      {(s.pins ?? []).map((n) => { const p = P(n); return p && <g key={n} opacity={fade(t, 0.5)}><circle cx={p[0]} cy={p[1]} r={7} fill="#1f2a33" /><text x={p[0] + 14} y={p[1] + 6} fontFamily={SANS} fontSize={H * 0.02} fill="#1f2a33">{n}</text></g>; })}
    </svg>
    {a && b && s.distance && <div style={{ position: "absolute", left: (a[0] + b[0]) / 2 + 20, top: (a[1] + b[1]) / 2, fontFamily: SERIF_I, fontSize: H * 0.034, color: "#1f2a33", opacity: fade(t, 2.4) }}>{s.distance}</div>}
    {s.title && <div style={{ position: "absolute", left: W * 0.05, top: H * 0.06, fontFamily: SERIF, fontSize: H * 0.034, color: "#1f2a33", letterSpacing: "0.08em" }}>{s.title}</div>}
  </AbsoluteFill>;
};
const Compare: React.FC<{ s: CompareShot; t: number; i: number }> = ({ s, t, i }) => { const { width: W, height: H } = useVideoConfig(), n = s.items.length, P = W < H, bw = P ? Math.min(W * 0.74, (H * 0.6) / n / 0.75 - H * 0.05) : Math.min((W * 0.84) / n - W * 0.03, H * 0.62 * 1.33);
  return <AbsoluteFill style={{ background: INK, alignItems: "center", justifyContent: "center" }}>
    {s.title && <div style={{ position: "absolute", top: H * 0.1, fontFamily: SERIF, fontSize: H * 0.034, color: CREAM, letterSpacing: "0.1em" }}>{s.title}</div>}
    <div style={{ display: "flex", flexDirection: P ? "column" : "row", gap: P ? H * 0.02 : W * 0.03 }}>{s.items.map((it, j) => <div key={j} style={{ opacity: fade(t, 0.2 + j * 0.4), textAlign: "center" }}>
      <div style={{ width: bw, height: bw * 0.75, border: `2px solid ${GOLD}`, overflow: "hidden" }}><Pic src={it.src} t={t} dur={s.dur} seed={i * 7 + j} /></div>
      <div style={{ fontFamily: SERIF_I, fontSize: H * 0.028, color: CREAM, marginTop: H * 0.015 }}>{it.label}</div></div>)}</div></AbsoluteFill>; };
const Place: React.FC<{ s: PlaceShot; t: number; i: number }> = ({ s, t, i }) => { const { height: H } = useVideoConfig();
  return <Dimmed bg={s.bg} t={t} dur={s.dur} i={i} k={0.75}><div style={{ color: CREAM }}>
    {s.native && <div style={{ fontFamily: CJK, fontSize: H * 0.12, letterSpacing: "0.1em", opacity: fade(t, 0.2, 0.9) }}>{s.native}</div>}
    <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: H * 0.026, letterSpacing: "0.4em", color: GOLD, marginTop: H * 0.02, opacity: fade(t, 0.8) }}>{s.name}</div>
    {s.sub && <div style={{ fontFamily: SERIF_I, fontSize: H * 0.024, color: DIM, marginTop: H * 0.012, opacity: fade(t, 1.2) }}>{s.sub}</div>}</div></Dimmed>; };

const Body: React.FC<{ s: ArchiveShot; i: number }> = ({ s, i }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), t = f / fps;
  let el: React.ReactNode;
  switch (s.kind) {
    case "media": el = <Media s={s} t={t} i={i} />; break; case "print": el = <Print s={s} t={t} i={i} />; break; case "chapter": el = <Chapter s={s} t={t} i={i} />; break;
    case "number": el = <Num s={s} t={t} i={i} />; break; case "quote": el = <Quote s={s} t={t} i={i} />; break; case "doc": el = <Doc s={s} t={t} />; break;
    case "table": el = <Table s={s} t={t} />; break; case "bars": el = <Bars s={s} t={t} />; break; case "calendar": el = <Calendar s={s} t={t} />; break;
    case "map": el = <MapView s={s} t={t} />; break; case "compare": el = <Compare s={s} t={t} i={i} />; break; case "place": el = <Place s={s} t={t} i={i} />; break;
  }
  return <AbsoluteFill>{el}<Grain t={t} /><Overlays s={s} t={t} /></AbsoluteFill>;
};
export const ArchiveDoc: React.FC<{ cfg: ArchiveCfg }> = ({ cfg }) => {
  const { fps } = useVideoConfig(), f = useCurrentFrame(), D = Math.round((cfg.trans ?? 0.6) * fps);
  let at = 0;
  return <AbsoluteFill style={{ background: "#000" }}>
    {cfg.audio && <Audio src={staticFile(cfg.audio)} />}
    {cfg.shots.map((s, i) => {
      const from = Math.round(at * fps), len = Math.round(s.dur * fps); at += s.dur;
      const nx = cfg.shots[i + 1], tail = nx && (nx.in ?? "cut") === "dissolve" ? D : 0, kind = i ? s.in ?? "cut" : "cut";
      const op = kind === "dissolve" ? clamp((f - from) / D) : 1;
      const dip = kind === "black" ? 1 - clamp((f - from) / D) : 0;
      return <Sequence key={i} from={from} durationInFrames={len + tail}><AbsoluteFill style={{ opacity: op }}><Body s={s} i={i} /></AbsoluteFill>{dip > 0 && <AbsoluteFill style={{ background: "#000", opacity: dip }} />}</Sequence>;
    })}
  </AbsoluteFill>;
};

const D = "archive/demo/";
export const DEMO_ARCHIVE: ArchiveCfg = { shots: [
  { kind: "media", dur: 4, src: D + "corregidor-island-aerial-5.jpeg", caption: "An island at the mouth of a bay", credit: "U.S. Navy", move: { from: [1.15, 0.3, 0.5], to: [1.02, 0.6, 0.45] } },
  { kind: "place", dur: 3, in: "dissolve", native: "要塞島", name: "FORT ISLAND", sub: "a fictional place card", bg: D + "fort-drum-el-fraile-island-10.jpeg" },
  { kind: "print", dur: 4, src: D + "uss-missouri-1944-battleship-1.jpg", name: ["A battleship at anchor", "August 1944"], credit: "U.S. Navy" },
  { kind: "chapter", dur: 3, title: "Thirty-Six Hours", sub: "an illustrative chapter title", bg: D + "aircraft-carrier-1945-navy-photograph-3.jpg" },
  { kind: "media", dur: 3.5, src: D + "aircraft-carrier-1945-navy-photograph-3.jpg", grade: "bw", date: "19 March 1945", credit: "U.S. Navy" },
  { kind: "number", dur: 3, value: "~3,000", label: "illustrative figure", bg: D + "uss-missouri-1944-battleship-2.jpg" },
  { kind: "print", dur: 4.5, src: D + "fort-drum-el-fraile-island-11.jpg", grade: "sepia", quote: { text: "We will hold this rock as long as the guns can speak.", by: "a fictional garrison officer" }, credit: "Public domain" },
  { kind: "map", dur: 4, title: "Distance", mapSrc: D + "map_pac.json", highlight: ["Philippines"], route: ["Tokyo", "Corregidor"], distance: "about 1,800 mi", pins: ["Tokyo", "Manila"] },
  { kind: "doc", dur: 3.5, in: "black", heading: "MEMORANDUM · NOT FOR RELEASE", lines: ["Subject: island fortifications", "1. Batteries remain in place.", "2. Access is closed to visitors.", "3. Review in ten years."], stamp: "DECLASSIFIED" },
  { kind: "table", dur: 4, title: "RECORD OF SITES", rows: [["Battery A", "1910", "closed"], ["Battery B", "1912", "closed"], ["Site C", "1914", "sealed"], ["Fort Island", "1916", "restricted"], ["Site E", "1918", "open"], ["Site F", "1920", "open"]], redact: [2], highlight: 3, tag: "THIS ONE" },
  { kind: "bars", dur: 3.5, title: "Visitors per year (illustrative)", items: [{ label: "Open sites", value: 52000 }, { label: "Restricted sites", value: 1200 }, { label: "Fort Island", value: 0, display: "0" }], highlight: 2 },
  { kind: "calendar", dur: 3, title: "36 DAYS", days: 36, highlight: 23, label: "Day 23: the guns fall silent (illustrative)" },
  { kind: "compare", dur: 3.5, title: "Then and now", items: [{ src: D + "aircraft-carrier-1945-navy-photograph-4.jpg", label: "1945" }, { src: D + "corregidor-island-aerial-5.jpeg", label: "Today" }] },
  { kind: "media", dur: 3.5, in: "dissolve", src: D + "war-memorial-plaque-pacific-island-9.jpg", caption: "What still stands", credit: "USMC" },
] };
