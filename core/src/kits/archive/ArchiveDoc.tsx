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
export type Fx = "grain" | "scratches" | "dust" | "flicker" | "weave" | "leak" | "letterbox" | "frame" | "burn";
export type Locator = { mapSrc: string; place: string; label?: string; zoom?: number };
type Over = { date?: string; caption?: string; credit?: string; in?: "cut" | "dissolve" | "black"; dur: number; fx?: Fx[]; locator?: Locator };
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
export type MapRoute = { from: string; to: string; at?: number; dur?: number; bend?: number; icon?: "ship" | "plane" | "arrow" | "none"; color?: string; label?: string; width?: number };
export type MapPin = { place: string; at?: number; label?: string };
export type MapZone = { place: string; r: number; at?: number; label?: string; color?: string };
export type MapCam = { t: number; place?: string; at?: [number, number]; z?: number };
export type MapShot = Over & { kind: "map"; map?: MapData; mapSrc?: string; highlight?: string[]; route?: [string, string]; distance?: string; title?: string; pins?: string[];
  routes?: MapRoute[]; pinsAt?: MapPin[]; zones?: MapZone[]; cam?: MapCam[]; labels?: { text: string; place?: string; at?: [number, number] }[]; regionLabels?: boolean;
  theme?: "paper" | "dark"; grid?: boolean; inset?: boolean };
export type MontageShot = Over & { kind: "montage"; items: { src: string; grade?: Grade; trim?: number; move?: Move }[]; flash?: boolean };
export type SplitShot = Over & { kind: "split"; items: { src: string; label?: string; grade?: Grade; trim?: number }[] };
export type CompareShot = Over & { kind: "compare"; items: { src: string; label: string }[]; title?: string };
export type PlaceShot = Over & { kind: "place"; native?: string; name: string; sub?: string; bg?: string };
export type ArchiveShot = MediaShot | PrintShot | ChapterShot | NumberShot | QuoteShot | DocShot | TableShot | BarsShot | CalendarShot | MapShot | CompareShot | PlaceShot | MontageShot | SplitShot;
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
/** map data inline or from a board_map.py JSON in public/ (cached per file, loaded once) */
const MAP_CACHE: Record<string, MapData> = {};
function useMapSrc(src?: string, inline?: MapData): MapData | null {
  const [m, setM] = React.useState<MapData | null>(inline ?? (src ? MAP_CACHE[src] ?? null : null));
  const [h] = React.useState(() => (inline || !src || MAP_CACHE[src] ? null : delayRender("map " + src)));
  React.useEffect(() => { if (inline || !src || MAP_CACHE[src]) return; fetch(staticFile(src)).then((r) => r.json()).then((j) => { MAP_CACHE[src] = j; setM(j); if (h !== null) continueRender(h); }); }, [src]);
  return m;
}
const MapView: React.FC<{ s: MapShot; t: number }> = ({ s, t }) => {
  const map = useMapSrc(s.mapSrc, s.map);
  return map ? <MapDraw s={s} map={map} t={t} /> : null;
};
/** region centre and size from the numbers of its svg path (good enough for labels) */
const BOX_CACHE: Record<string, [number, number, number]> = {};
function regionBox(name: string, d: string): [number, number, number] {
  if (BOX_CACHE[name + d.length]) return BOX_CACHE[name + d.length];
  const n = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let k = 0; k + 1 < n.length; k += 2) { x0 = Math.min(x0, n[k]); x1 = Math.max(x1, n[k]); y0 = Math.min(y0, n[k + 1]); y1 = Math.max(y1, n[k + 1]); }
  return (BOX_CACHE[name + d.length] = [(x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0)]);
}
const ICONS: Record<string, string> = {
  ship: "M-16,-3 L12,-3 L18,0 L12,3 L-16,3 Z M-6,-3 L-6,-8 L4,-8 L4,-3 Z",
  plane: "M18,0 L4,-2 L-2,-14 L-6,-14 L-2,-2 L-12,-2 L-15,-7 L-18,-7 L-16,0 L-18,7 L-15,7 L-12,2 L-2,2 L-6,14 L-2,14 L4,2 Z",
  arrow: "M14,0 L-8,-9 L-4,0 L-8,9 Z",
};
const MapDraw: React.FC<{ s: MapShot; map: MapData; t: number }> = ({ s, map, t }) => {
  const { width: W, height: H } = useVideoConfig(), dark = s.theme === "dark", [x0, y0, x1, y1] = map.bounds;
  const sc = Math.min(W / (x1 - x0), H / (y1 - y0)) * 0.96, ox = (W - (x1 - x0) * sc) / 2 - x0 * sc, oy = (H - (y1 - y0) * sc) / 2 - y0 * sc;
  const F = (p: [number, number]): [number, number] => [ox + p[0] * sc, oy + p[1] * sc];        // world -> fitted screen
  const place = (n?: string, at?: [number, number]) => (at ? F(at) : n && map.places[n] ? F(map.places[n]) : null);
  // camera: keyframes on a place or a world point, zoom relative to the fitted map
  const keys = (s.cam ?? []).map((c) => ({ t: c.t, z: c.z ?? 1, p: place(c.place, c.at) ?? [W / 2, H / 2] as [number, number] }));
  let cz = 1 + 0.05 * EASE.inOut(clamp(t / s.dur)), cp: [number, number] = [W / 2, H / 2];
  if (keys.length) {
    if (t <= keys[0].t) { cz = keys[0].z; cp = keys[0].p; }
    else if (t >= keys[keys.length - 1].t) { const k = keys[keys.length - 1]; cz = k.z * (1 + 0.02 * clamp((t - k.t) / 4)); cp = k.p; }
    else for (let q = 0; q < keys.length - 1; q++) if (t <= keys[q + 1].t) { const a = keys[q], b = keys[q + 1], e = EASE.inOut((t - a.t) / Math.max(0.01, b.t - a.t));
      cz = a.z + (b.z - a.z) * e; cp = [a.p[0] + (b.p[0] - a.p[0]) * e, a.p[1] + (b.p[1] - a.p[1]) * e]; break; }
  }
  const follow = clamp((cz - 1) * 2);                                        // at zoom 1 the map stays centred
  const cx = W / 2 + (cp[0] - W / 2) * follow, cy = H / 2 + (cp[1] - H / 2) * follow;
  const S = (p: [number, number]): [number, number] => [W / 2 + (p[0] - cx) * cz, H / 2 + (p[1] - cy) * cz];   // fitted -> camera screen
  const sea = dark ? "#11161d" : "#b9d3e3", land = dark ? "#2b3038" : "#e8e2cf", edge = dark ? "#3c424c" : "#cfc6ab", ink = dark ? CREAM : "#1f2a33";
  const routes: MapRoute[] = [...(s.routes ?? []), ...(s.route ? [{ from: s.route[0], to: s.route[1], at: 0.8, dur: 1.8, icon: "none" as const, label: s.distance }] : [])];
  const pins: MapPin[] = [...(s.pinsAt ?? []), ...(s.pins ?? []).map((p) => ({ place: p, at: 0.5, label: p }))];
  const fs = H * 0.02;
  return <AbsoluteFill style={{ background: sea }}>
    <svg width={W} height={H}>
      <defs><filter id="mapgrain"><feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="3" /><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncA type="linear" slope="0.08" /></feComponentTransfer></filter></defs>
      <g transform={`translate(${W / 2 - cx * cz} ${H / 2 - cy * cz}) scale(${cz})`}>
        {s.grid !== false && Array.from({ length: 13 }, (_, k) => <g key={k} opacity={dark ? 0.18 : 0.25}>
          <line x1={(k / 12) * W} x2={(k / 12) * W} y1={0} y2={H} stroke={dark ? "#4a5260" : "#9fbccd"} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <line y1={(k / 12) * H} y2={(k / 12) * H} x1={0} x2={W} stroke={dark ? "#4a5260" : "#9fbccd"} strokeWidth={1} vectorEffect="non-scaling-stroke" /></g>)}
        <g transform={`translate(${ox} ${oy}) scale(${sc})`}>{Object.entries(map.regions).map(([n, d]) => { const hi = s.highlight?.includes(n);
          return <path key={n} d={d} fill={hi ? GOLD : land} fillOpacity={hi ? 0.55 + 0.45 * fade(t, 0.4, 0.8) : 1} stroke={edge} strokeWidth={1} vectorEffect="non-scaling-stroke" />; })}</g>
      </g>
      <rect width={W} height={H} filter="url(#mapgrain)" />
      {(s.zones ?? []).map((z, k) => { const p = place(z.place); if (!p) return null; const q = S(p), r = z.r * sc * cz * fade(t, z.at ?? 0.5, 0.8), c = z.color ?? "#b8402f";
        return <g key={k} opacity={fade(t, z.at ?? 0.5, 0.4)}><circle cx={q[0]} cy={q[1]} r={r} fill={c} fillOpacity={0.18} stroke={c} strokeWidth={2.5} strokeDasharray="8 6" strokeDashoffset={-t * 20} />
          <circle cx={q[0]} cy={q[1]} r={r * (1 + 0.08 * Math.sin(t * 3))} fill="none" stroke={c} strokeOpacity={0.35} strokeWidth={1.5} /></g>; })}
      {routes.map((rt, k) => { const a0 = place(rt.from), b0 = place(rt.to); if (!a0 || !b0) return null; const a = S(a0), b = S(b0), at = rt.at ?? 0.8, d = rt.dur ?? 2;
        const p = EASE.inOut(clamp((t - at) / d)); if (p <= 0) return null;
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]), bend = rt.bend ?? 0.18, nx = -(b[1] - a[1]) / (len || 1), ny = (b[0] - a[0]) / (len || 1);
        const c: [number, number] = [mx + nx * len * bend, my + ny * len * bend];
        const at2 = (u: number): [number, number] => [(1 - u) ** 2 * a[0] + 2 * (1 - u) * u * c[0] + u * u * b[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * c[1] + u * u * b[1]];
        const tip = at2(p), pre = at2(Math.max(0, p - 0.02)), ang = Math.atan2(tip[1] - pre[1], tip[0] - pre[0]) * 57.3, col = rt.color ?? (dark ? GOLD : "#1f2a33"), w = rt.width ?? 3.5, icon = rt.icon ?? "arrow";
        const dpath = `M${a[0]},${a[1]} Q${c[0]},${c[1]} ${b[0]},${b[1]}`;
        return <g key={k}><path d={dpath} fill="none" stroke={col} strokeWidth={w} strokeLinecap="round" pathLength={1} strokeDasharray={`${p} 1`} opacity={0.9} />
          {icon !== "none" && <path d={ICONS[icon]} transform={`translate(${tip[0]} ${tip[1]}) rotate(${ang}) scale(${H / 900})`} fill={col} />}
          <circle cx={a[0]} cy={a[1]} r={6} fill={col} />{p >= 0.999 && <circle cx={b[0]} cy={b[1]} r={7} fill="#b8402f" />}
          {rt.label && <text x={c[0] * 0.5 + (a[0] + b[0]) / 4 + nx * 18} y={c[1] * 0.5 + (a[1] + b[1]) / 4 + ny * 18} fontFamily={SERIF_I} fontSize={H * 0.032} fill={ink} opacity={fade(t, at + d * 0.8, 0.5)} textAnchor="middle">{rt.label}</text>}</g>; })}
      {s.regionLabels && Object.entries(map.regions).map(([n, d]) => { const [bx, by, sz] = regionBox(n, d), q = S(F([bx, by])), pix = sz * sc * cz;
        if (pix < W * 0.06 || q[0] < W * 0.04 || q[0] > W * 0.96 || q[1] < H * 0.08 || q[1] > H * 0.92) return null;
        return <text key={n} x={q[0]} y={q[1]} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={fs * 0.8} letterSpacing="0.25em" fill={ink} opacity={0.85 * fade(t, 0.3)}>{n.toUpperCase()}</text>; })}
      {pins.map((pn, k) => { const p0 = place(pn.place); if (!p0) return null; const q = S(p0), kk = fade(t, pn.at ?? 0.5, 0.4);
        return <g key={k} opacity={kk}><circle cx={q[0]} cy={q[1]} r={7 + 10 * ((t * 0.8 + k * 0.3) % 1)} fill="none" stroke={GOLD} strokeOpacity={1 - ((t * 0.8 + k * 0.3) % 1)} strokeWidth={2} />
          <circle cx={q[0]} cy={q[1]} r={6} fill={dark ? GOLD : "#1f2a33"} stroke="#fff" strokeWidth={1.5} />
          {pn.label && <g transform={`translate(${q[0] + 14} ${q[1] - 12})`}><rect width={pn.label.length * fs * 0.56 + 18} height={fs * 1.5} rx={3} fill={dark ? "rgba(239,232,214,.92)" : "rgba(20,24,30,.85)"} />
            <text x={9} y={fs * 1.06} fontFamily={SERIF} fontWeight={600} fontSize={fs} fill={dark ? INK : CREAM}>{pn.label}</text></g>}</g>; })}
      {(s.labels ?? []).map((l, k) => { const p0 = place(l.place, l.at); if (!p0) return null; const q = S(p0);
        return <text key={k} x={q[0]} y={q[1]} textAnchor="middle" fontFamily={SERIF_I} fontSize={H * 0.03} fill={ink} opacity={fade(t, 0.6 + k * 0.2)}>{l.text}</text>; })}
    </svg>
    {s.inset && <div style={{ position: "absolute", right: W * 0.05, bottom: H * 0.07, width: W * 0.16, height: W * 0.16 * (y1 - y0) / (x1 - x0), border: `2px solid ${GOLD}`, background: sea, overflow: "hidden", opacity: fade(t, 0.6) }}>
      <svg width="100%" height="100%" viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`}>{Object.entries(map.regions).map(([n, d]) => <path key={n} d={d} fill={land} />)}
        {(() => { const v0 = [(cx - W / 2 / cz - ox) / sc, (cy - H / 2 / cz - oy) / sc], vw = W / cz / sc, vh = H / cz / sc; return <rect x={v0[0]} y={v0[1]} width={vw} height={vh} fill="none" stroke="#b8402f" strokeWidth={(x1 - x0) / 120} />; })()}</svg></div>}
    {s.title && <div style={{ position: "absolute", left: W * 0.05, top: H * 0.06, fontFamily: SERIF, fontSize: H * 0.034, color: ink, letterSpacing: "0.08em" }}>{s.title}</div>}
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

/** several clips or photos inside one line: hard cuts (or a white flash) at even steps */
const Montage: React.FC<{ s: MontageShot; t: number; i: number }> = ({ s, t, i }) => {
  const { fps } = useVideoConfig(), n = Math.max(1, s.items.length), seg = s.dur / n, k = Math.min(n - 1, Math.floor(t / seg)), it = s.items[k], lt = t - k * seg, fl = s.flash && k > 0 ? 1 - clamp(lt / 0.18) : 0;
  return <AbsoluteFill style={{ background: INK }}><Sequence from={Math.round(k * seg * fps)} layout="none" key={k}><Pic src={it.src} t={lt} dur={seg} move={it.move} grade={it.grade} seed={i * 11 + k} trim={(it.trim ?? 0) + 0} /></Sequence>
    <Vignette k={0.45} />{fl > 0 && <AbsoluteFill style={{ background: "#fff", opacity: fl * 0.85 }} />}</AbsoluteFill>;
};
/** two or three panels side by side (stacked in portrait), each sliding in after the last */
const Split: React.FC<{ s: SplitShot; t: number; i: number }> = ({ s, t, i }) => {
  const { width: W, height: H } = useVideoConfig(), P = W < H, g = 6;
  return <AbsoluteFill style={{ background: INK, display: "flex", flexDirection: P ? "column" : "row", gap: g }}>{s.items.map((it, k) => { const e = EASE.out(clamp((t - k * 0.35) / 0.7));
    return <div key={k} style={{ flex: 1, position: "relative", overflow: "hidden", opacity: e, transform: P ? `translateY(${(1 - e) * 60}px)` : `translateX(${(1 - e) * 60}px)` }}>
      <Pic src={it.src} t={t} dur={s.dur} grade={it.grade} seed={i * 13 + k} trim={it.trim} /><Vignette k={0.4} />
      {it.label && <div style={{ position: "absolute", left: 0, right: 0, bottom: H * 0.06, textAlign: "center", fontFamily: SERIF_I, fontSize: H * 0.03, color: CREAM, textShadow: "0 2px 8px rgba(0,0,0,.8)" }}>{it.label}</div>}</div>; })}</AbsoluteFill>;
};
/** film treatments over any shot: grain, scratches, dust, flicker, light leak, letterbox, gold frame, burnt edges */
const FxLayer: React.FC<{ fx: Fx[]; t: number }> = ({ fx, t }) => {
  const { width: W, height: H, fps } = useVideoConfig(), fr = Math.floor(t * fps), on = (k: Fx) => fx.includes(k);
  return <>
    {on("flicker") && <AbsoluteFill style={{ background: "#000", opacity: 0.04 + 0.08 * hash(fr) }} />}
    {on("scratches") && <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>{Array.from({ length: 3 }, (_, k) => hash(fr * 3 + k) > 0.55 ? <line key={k} x1={hash(fr * 7 + k) * W} x2={hash(fr * 7 + k) * W + (hash(k + fr) - 0.5) * 6} y1={0} y2={H} stroke={k % 2 ? "#fff" : "#000"} strokeOpacity={0.35} strokeWidth={1.2} /> : null)}</svg>}
    {on("dust") && <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>{Array.from({ length: 10 }, (_, k) => hash(fr * 5 + k * 3) > 0.6 ? <circle key={k} cx={hash(fr * 13 + k) * W} cy={hash(fr * 17 + k) * H} r={1 + 3 * hash(fr + k * 7)} fill={k % 3 ? "#000" : "#fff"} opacity={0.5} /> : null)}</svg>}
    {on("leak") && <AbsoluteFill style={{ mixBlendMode: "screen", opacity: 0.35 + 0.15 * Math.sin(t * 0.9), background: `radial-gradient(ellipse at ${20 + 30 * Math.sin(t * 0.3)}% 30%, rgba(255,150,60,.55), transparent 55%), radial-gradient(ellipse at 90% ${70 + 10 * Math.sin(t * 0.5)}%, rgba(255,80,40,.35), transparent 50%)` }} />}
    {on("burn") && <Vignette k={0.85} />}
    {on("frame") && <div style={{ position: "absolute", left: W * 0.03, top: H * 0.04, right: W * 0.03, bottom: H * 0.04, border: `1.5px solid ${GOLD}`, opacity: 0.8 }} />}
    {on("letterbox") && <>{[0, 1].map((k) => <div key={k} style={{ position: "absolute", left: 0, right: 0, [k ? "bottom" : "top"]: 0, height: H * 0.1 * EASE.out(clamp(t / 0.6)), background: "#000" } as React.CSSProperties} />)}</>}
  </>;
};
/** a small map card in the corner that says where this footage is */
const LocatorCard: React.FC<{ l: Locator; t: number }> = ({ l, t }) => {
  const map = useMapSrc(l.mapSrc), { width: W, height: H } = useVideoConfig();
  if (!map || !map.places[l.place]) return null;
  const [px, py] = map.places[l.place], span = (map.bounds[2] - map.bounds[0]) / (l.zoom ?? 3), w = W * 0.17, h = w * 0.7, k = fade(t, 0.5, 0.6), m = W * 0.05;
  return <div style={{ position: "absolute", right: m, bottom: H * 0.08, width: w, height: h, border: `2px solid ${GOLD}`, background: "#b9d3e3", overflow: "hidden", opacity: k, transform: `translateY(${(1 - k) * 20}px)`, boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}>
    <svg width="100%" height="100%" viewBox={`${px - span / 2} ${py - span * 0.35} ${span} ${span * 0.7}`}>{Object.entries(map.regions).map(([n, d]) => <path key={n} d={d} fill="#e8e2cf" stroke="#cfc6ab" strokeWidth={span / 400} />)}
      <circle cx={px} cy={py} r={span * 0.03 * (1 + ((t * 0.8) % 1))} fill="none" stroke="#b8402f" strokeWidth={span / 200} opacity={1 - ((t * 0.8) % 1)} /><circle cx={px} cy={py} r={span * 0.018} fill="#b8402f" /></svg>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "rgba(12,13,16,.8)", color: CREAM, fontFamily: SERIF, fontWeight: 600, fontSize: H * 0.018, padding: `${H * 0.004}px ${H * 0.01}px`, letterSpacing: "0.08em" }}>{(l.label ?? l.place).toUpperCase()}</div></div>;
};

const Body: React.FC<{ s: ArchiveShot; i: number }> = ({ s, i }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), t = f / fps;
  let el: React.ReactNode;
  switch (s.kind) {
    case "media": el = <Media s={s} t={t} i={i} />; break; case "print": el = <Print s={s} t={t} i={i} />; break; case "chapter": el = <Chapter s={s} t={t} i={i} />; break;
    case "number": el = <Num s={s} t={t} i={i} />; break; case "quote": el = <Quote s={s} t={t} i={i} />; break; case "doc": el = <Doc s={s} t={t} />; break;
    case "table": el = <Table s={s} t={t} />; break; case "bars": el = <Bars s={s} t={t} />; break; case "calendar": el = <Calendar s={s} t={t} />; break;
    case "map": el = <MapView s={s} t={t} />; break; case "compare": el = <Compare s={s} t={t} i={i} />; break; case "place": el = <Place s={s} t={t} i={i} />; break;
    case "montage": el = <Montage s={s} t={t} i={i} />; break; case "split": el = <Split s={s} t={t} i={i} />; break;
  }
  const fx = s.fx ?? [], fr = Math.floor(t * 30), wv = fx.includes("weave") ? `translate(${(hash(fr) - 0.5) * 3}px, ${(hash(fr + 99) - 0.5) * 3}px)` : undefined;
  return <AbsoluteFill><AbsoluteFill style={{ transform: wv }}>{el}</AbsoluteFill><Grain t={t} />{fx.length > 0 && <FxLayer fx={fx} t={t} />}{s.locator && <LocatorCard l={s.locator} t={t} />}<Overlays s={s} t={t} /></AbsoluteFill>;
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
  { kind: "map", dur: 6, mapSrc: "archive/demo/map_channel.json", title: "Across the Channel", regionLabels: true, inset: true,
    cam: [{ t: 0, z: 1 }, { t: 2.5, z: 2.2, place: "Portsmouth" }, { t: 5.5, z: 2.6, place: "Normandy" }],
    routes: [{ from: "Portsmouth", to: "Normandy", at: 2.4, dur: 2.4, icon: "ship", label: "about 100 mi", bend: 0.2 }],
    pinsAt: [{ place: "Portsmouth", at: 1.6, label: "Portsmouth" }, { place: "Normandy", at: 4.6, label: "Normandy" }] },
  { kind: "map", dur: 5, theme: "dark", mapSrc: "archive/demo/map_channel.json", highlight: ["France"], cam: [{ t: 0, z: 1.4, place: "Caen" }, { t: 4.5, z: 2.4, place: "Caen" }],
    zones: [{ place: "Caen", r: 60, at: 0.8 }], routes: [{ from: "Cherbourg", to: "Caen", at: 1.2, dur: 1.8, icon: "arrow", color: "#c9a24a", bend: -0.3 }, { from: "London", to: "Caen", at: 2, dur: 2, icon: "plane", color: "#efe8d6", bend: 0.25 }],
    pinsAt: [{ place: "Caen", at: 0.6, label: "Caen" }] },
  { kind: "media", dur: 4, src: "archive/clips/aircraft-carrier-launch-1.webm", trim: 12, fx: ["scratches", "dust", "flicker", "weave"], locator: { mapSrc: "archive/demo/map_channel.json", place: "Portsmouth", label: "Off Portsmouth" }, credit: "U.S. Navy" },
  { kind: "montage", dur: 4, flash: true, fx: ["letterbox", "leak"], items: [{ src: "archive/clips/bomber-formation-flight-4.webm", trim: 3 }, { src: "archive/clips/ocean-waves-3.webm", trim: 2 }, { src: D + "uss-missouri-1944-battleship-1.jpg" }, { src: "archive/clips/battleship-guns-firing-2.webm", trim: 8, grade: "bw" }] },
  { kind: "split", dur: 4, fx: ["frame"], items: [{ src: D + "aircraft-carrier-1945-navy-photograph-4.jpg", label: "1945", grade: "bw" }, { src: "archive/clips/ocean-waves-3.webm", label: "Today" }] },
  { kind: "doc", dur: 3.5, in: "black", heading: "MEMORANDUM · NOT FOR RELEASE", lines: ["Subject: island fortifications", "1. Batteries remain in place.", "2. Access is closed to visitors.", "3. Review in ten years."], stamp: "DECLASSIFIED" },
  { kind: "table", dur: 4, title: "RECORD OF SITES", rows: [["Battery A", "1910", "closed"], ["Battery B", "1912", "closed"], ["Site C", "1914", "sealed"], ["Fort Island", "1916", "restricted"], ["Site E", "1918", "open"], ["Site F", "1920", "open"]], redact: [2], highlight: 3, tag: "THIS ONE" },
  { kind: "bars", dur: 3.5, title: "Visitors per year (illustrative)", items: [{ label: "Open sites", value: 52000 }, { label: "Restricted sites", value: 1200 }, { label: "Fort Island", value: 0, display: "0" }], highlight: 2 },
  { kind: "calendar", dur: 3, title: "36 DAYS", days: 36, highlight: 23, label: "Day 23: the guns fall silent (illustrative)" },
  { kind: "compare", dur: 3.5, title: "Then and now", items: [{ src: D + "aircraft-carrier-1945-navy-photograph-4.jpg", label: "1945" }, { src: D + "corregidor-island-aerial-5.jpeg", label: "Today" }] },
  { kind: "media", dur: 3.5, in: "dissolve", src: D + "war-memorial-plaque-pacific-island-9.jpg", caption: "What still stands", credit: "USMC" },
] };
