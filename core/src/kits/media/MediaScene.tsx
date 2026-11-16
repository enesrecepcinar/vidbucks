// MediaScene: the automatic scene engine for the drawing media. A segment's lines become beats; each beat is drawn in the
// segment's medium (crosshatch, sketchbook, cut-paper, riso, pixel, isometric, math) without hand-authored art:
//   object -> an icon from a shared library (sun, house, coin, clock, globe, person, chart ...) drawn with the medium's own
//             primitives + a hand/printed label;   number -> the line's number, counted up (years stamp);   title -> big words.
// Every beat enters the medium's way (write-on, pop, plates sliding into register, pixel steps, layers dropping, a sweep),
// the world behind it belongs to the medium, and the caption shows the spoken line with each word lit on its own time.
// Data comes from tools/segment_draft.py (renderer "media"); the agent may edit icons, labels and kinds by hand.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fHand } from "@remotion/google-fonts/PatrickHand";
import { loadFont as fSerif } from "@remotion/google-fonts/CrimsonPro";
import { loadFont as fPix } from "@remotion/google-fonts/Silkscreen";
import { loadFont as fInter } from "@remotion/google-fonts/Inter";
import { loadFont as fBlack } from "@remotion/google-fonts/ArchivoBlack";
import { KitTiming } from "../time";
import { Persona, PersonaName, persona, MEDIUM_PERSONA, secondary, entrance } from "../motion";
import {
  Pt, clamp, seg, out, pop, smooth, io, path, ellipse, rect, Ink, Hatch, Paper, PaperDefs, Cut, RisoDefs, RisoPrint, RISO,
  PixelCanvas, ditherBand, IsoBox, iso, ISO, MC,
} from "./Media";

const HAND = fHand("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] }).fontFamily;
const SERIF = fSerif("italic", { weights: ["500"], subsets: ["latin", "latin-ext"] }).fontFamily;
const PIX = fPix("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] }).fontFamily;
const SANS = fInter("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] }).fontFamily;
const BLACK = fBlack("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] }).fontFamily;

export type Medium = "crosshatch" | "sketchbook" | "cut-paper" | "riso" | "pixel" | "isometric" | "math";
export type MediaBeat = {
  line: number; w?: number; kind: "object" | "number" | "title" | "compare" | "list";
  icon?: IconId; label?: string; big?: string; text?: string; side?: "left" | "right";
  icons?: IconId[]; labels?: string[]; link?: "vs" | "to"; w2?: number;      // compare: two figures, the second lands on word w2
  items?: { text: string; w?: number }[];                                       // list: rows that land on their own words
};
/** where a beat's figures stand: one (object, left/right/centre), two (compare) or one beside a list */
type Fig = { icon: IconId; label?: string; cx: number; cy: number; s: number; at: number };
function figures(beat: MediaBeat, w: number, h: number, t0: number, times: number[]): Fig[] {
  const u = Math.min(w, h), land = w > h, cy = h * (land ? 0.44 : 0.38);
  if (beat.kind === "compare" && beat.icons?.length === 2) {
    const s = u * (land ? 0.2 : 0.17);
    return beat.icons.map((ic, i) => ({ icon: ic, label: beat.labels?.[i], s, at: i ? times[0] ?? t0 + 0.7 : t0,
      cx: land ? w * (i ? 0.7 : 0.3) : w / 2, cy: land ? cy : h * (i ? 0.52 : 0.22) }));
  }
  if (beat.kind === "list") return beat.icon ? [{ icon: beat.icon, label: beat.label, s: u * 0.17, at: t0, cx: land ? w * 0.27 : w / 2, cy: land ? cy : h * 0.2 }] : [];
  const x = !land || !beat.side ? 0.5 : beat.side === "left" ? 0.33 : 0.67;
  return [{ icon: beat.icon ?? "star", label: beat.label, s: u * 0.25, at: t0, cx: w * x, cy }];
}
export type MediaCfg = { medium: Medium; beats: MediaBeat[]; captions?: boolean; motion?: PersonaName };   // motion: one personality for the film (default by medium)

/* ---------------------------------------------------------------- the icon library (unit coords, radius ~1) ---------------------------------------------------------------- */
type Hue = "yellow" | "red" | "blue" | "green" | "brown" | "grey" | "dark";
type Part = { P: Pt[]; closed: boolean; hue: Hue; ring?: boolean };   // ring: a closed outline that is never filled
const C = (x: number, y: number, r: number, ry = r, n = 40): Pt[] => ellipse(x, y, r, ry, n);
const R = (x: number, y: number, w: number, h: number): Pt[] => rect(x, y, w, h);
const L = (...p: Pt[]): Part => ({ P: p, closed: false, hue: "dark" });
const F = (P: Pt[], hue: Hue): Part => ({ P, closed: true, hue });
export const ICONS = {
  sun: [F(C(0, 0, 0.5), "yellow"), ...Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return L([0.68 * Math.cos(a), 0.68 * Math.sin(a)], [0.95 * Math.cos(a), 0.95 * Math.sin(a)]); })],
  house: [F(R(-0.62, -0.05, 1.24, 0.95), "grey"), F([[-0.85, -0.02], [0, -0.85], [0.85, -0.02]], "red"), F(R(-0.16, 0.42, 0.32, 0.48), "brown"), F(R(0.24, 0.12, 0.24, 0.22), "blue")],
  mug: [F([[-0.55, -0.55], [0.45, -0.55], [0.38, 0.75], [-0.48, 0.75]], "red"), { P: ellipse(0.55, 0.05, 0.28, 0.32, 24, -1.3, 2.6), closed: false, hue: "dark" }],
  tree: [F(R(-0.1, 0.25, 0.2, 0.7), "brown"), F(C(0, -0.25, 0.62, 0.58), "green")],
  coin: [F(C(0, 0, 0.8), "yellow"), { P: C(0, 0, 0.58), closed: true, hue: "dark", ring: true }, L([0, -0.4], [0, 0.4])],
  clock: [F(C(0, 0, 0.82), "grey"), L([0, 0], [0, -0.55]), L([0, 0], [0.38, 0.12]), ...Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return L([0.66 * Math.cos(a), 0.66 * Math.sin(a)], [0.74 * Math.cos(a), 0.74 * Math.sin(a)]); })],
  heart: [F(Array.from({ length: 48 }, (_, i) => { const a = (i / 48) * Math.PI * 2, x = 16 * Math.sin(a) ** 3, y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); return [x / 18, -y / 18 + 0.05] as Pt; }), "red")],
  person: [F(C(0, -0.55, 0.3), "brown"), F([[-0.5, 0.95], [-0.42, 0.05], [0, -0.15], [0.42, 0.05], [0.5, 0.95]], "blue")],
  globe: [F(C(0, 0, 0.82), "blue"), { P: ellipse(0, 0, 0.36, 0.82, 32), closed: true, hue: "dark", ring: true }, L([-0.82, 0], [0.82, 0]), F(C(-0.25, -0.2, 0.22, 0.16, 16), "green"), F(C(0.3, 0.3, 0.18, 0.24, 16), "green")],
  book: [F(R(-0.7, -0.55, 1.4, 1.1), "blue"), L([0, -0.55], [0, 0.55]), F(R(-0.6, -0.45, 0.52, 0.9), "grey"), F(R(0.08, -0.45, 0.52, 0.9), "grey")],
  chart: [F(R(-0.75, 0.25, 0.36, 0.6), "blue"), F(R(-0.2, -0.15, 0.36, 1.0), "green"), F(R(0.35, -0.65, 0.36, 1.5), "red"), L([-0.9, 0.86], [0.9, 0.86])],
  arrow: [F([[-0.85, -0.18], [0.25, -0.18], [0.25, -0.5], [0.9, 0], [0.25, 0.5], [0.25, 0.18], [-0.85, 0.18]], "red")],
  bulb: [F(C(0, -0.25, 0.55, 0.58), "yellow"), F(R(-0.22, 0.38, 0.44, 0.38), "grey"), L([-0.12, -0.2], [0, 0.05], [0.12, -0.2])],
  box: [F(R(-0.7, -0.45, 1.4, 1.2), "brown"), F(R(-0.78, -0.62, 1.56, 0.25), "brown"), L([0, -0.62], [0, 0.75])],
  star: [F(Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 0.4 : 0.9, a = (i / 10) * Math.PI * 2 - Math.PI / 2; return [r * Math.cos(a), r * Math.sin(a)] as Pt; }), "yellow")],
  warning: [F([[0, -0.85], [0.9, 0.7], [-0.9, 0.7]], "yellow"), L([0, -0.35], [0, 0.2]), { P: C(0, 0.45, 0.06, 0.06, 10), closed: true, hue: "dark" }],
  question: [F(C(0, 0, 0.82), "grey"), L([-0.28, -0.3], [-0.2, -0.48], [0, -0.55], [0.22, -0.46], [0.26, -0.25], [0, -0.05], [0, 0.18]), { P: C(0, 0.42, 0.06, 0.06, 10), closed: true, hue: "dark" }],
  // ---- places, transport, things (added after the first auto film: "tunnel" and "station" had nothing to draw)
  train: [F(R(-0.92, -0.5, 1.84, 0.9), "red"), F(R(-0.75, -0.36, 0.38, 0.3), "blue"), F(R(-0.2, -0.36, 0.38, 0.3), "blue"), F(R(0.35, -0.36, 0.38, 0.3), "blue"),
    F(C(-0.55, 0.48, 0.14, 0.14, 16), "dark"), F(C(0.55, 0.48, 0.14, 0.14, 16), "dark"), L([-1, 0.66], [1, 0.66])],
  tunnel: [F([[-1, 0.8], [-1, -0.1], [-0.6, -0.6], [0, -0.78], [0.6, -0.6], [1, -0.1], [1, 0.8]], "brown"), F([...ellipse(0, 0.35, 0.45, 0.6, 24, Math.PI, Math.PI), [0.45, 0.8], [-0.45, 0.8]] as Pt[], "dark"), L([-0.2, 0.8], [-0.35, 1]), L([0.2, 0.8], [0.35, 1])],
  door: [F(R(-0.5, -0.92, 1.0, 1.84), "brown"), { P: R(-0.36, -0.75, 0.72, 0.6), closed: true, hue: "dark", ring: true }, { P: R(-0.36, -0.02, 0.72, 0.75), closed: true, hue: "dark", ring: true }, F(C(0.32, 0.0, 0.07, 0.07, 12), "dark")],
  phone: [F(R(-0.46, -0.92, 0.92, 1.84), "dark"), F(R(-0.36, -0.74, 0.72, 1.32), "blue"), F(C(0, 0.76, 0.07, 0.07, 12), "grey")],
  city: [F(R(-0.95, -0.15, 0.45, 1.05), "blue"), F(R(-0.45, -0.8, 0.45, 1.7), "grey"), F(R(0.05, -0.42, 0.42, 1.32), "brown"), F(R(0.5, -0.02, 0.45, 0.92), "blue"), L([-1, 0.9], [1, 0.9])],
  car: [F([[-0.95, 0.35], [-0.95, 0], [-0.55, -0.06], [-0.3, -0.45], [0.35, -0.45], [0.62, -0.06], [0.95, 0], [0.95, 0.35]], "red"), F([[-0.24, -0.36], [0.3, -0.36], [0.48, -0.08], [-0.44, -0.08]], "blue"),
    F(C(-0.52, 0.38, 0.2, 0.2, 18), "dark"), F(C(0.52, 0.38, 0.2, 0.2, 18), "dark")],
  ship: [F(R(-0.05, -0.7, 0.22, 0.42), "yellow"), F(R(-0.42, -0.32, 0.75, 0.42), "grey"), F([[-0.95, 0.1], [0.95, 0.1], [0.65, 0.55], [-0.65, 0.55]], "red"),
    L(...Array.from({ length: 21 }, (_, i) => [-1 + i * 0.1, 0.72 + 0.05 * Math.sin(i * 1.3)] as Pt))],
  plane: [F([[-0.25, 0], [0.2, 0], [-0.15, -0.78], [-0.42, -0.78]], "blue"), F([[-0.25, 0], [0.2, 0], [-0.15, 0.78], [-0.42, 0.78]], "blue"), F(C(0, 0, 0.95, 0.17, 30), "grey"), F([[0.66, -0.02], [0.95, -0.42], [0.98, -0.02]], "red")],
  key: [F(C(-0.55, 0, 0.36, 0.36, 28), "yellow"), { P: C(-0.55, 0, 0.13, 0.13, 16), closed: true, hue: "dark", ring: true }, F(R(-0.22, -0.08, 1.1, 0.16), "yellow"), F(R(0.55, 0.08, 0.12, 0.22), "yellow"), F(R(0.75, 0.08, 0.12, 0.3), "yellow")],
  lock: [{ P: ellipse(0, -0.3, 0.38, 0.5, 20, Math.PI, Math.PI), closed: false, hue: "dark" }, F(R(-0.6, -0.3, 1.2, 1.05), "yellow"), F(C(0, 0.12, 0.1, 0.1, 14), "dark"), L([0, 0.18], [0, 0.45])],
  flame: [F([[0, -0.95], [0.35, -0.4], [0.55, 0.1], [0.45, 0.55], [0, 0.85], [-0.45, 0.55], [-0.55, 0.1], [-0.25, -0.25], [-0.1, -0.05]], "red"), F([[0, -0.3], [0.25, 0.2], [0.2, 0.55], [0, 0.7], [-0.2, 0.55], [-0.25, 0.25]], "yellow")],
  wave: [F([...Array.from({ length: 21 }, (_, i) => [-1 + i * 0.1, 0.05 + 0.18 * Math.sin(i * 0.75)] as Pt), [1, 0.9], [-1, 0.9]], "blue"), L(...Array.from({ length: 21 }, (_, i) => [-1 + i * 0.1, -0.35 + 0.12 * Math.sin(i * 0.75 + 1)] as Pt))],
  mountain: [F([[-1, 0.8], [-0.3, -0.72], [0.1, -0.1], [0.42, -0.46], [1, 0.8]], "brown"), F([[-0.3, -0.72], [-0.1, -0.3], [-0.3, -0.38], [-0.5, -0.3]], "grey")],
  gear: [F(Array.from({ length: 64 }, (_, i) => { const a = (i / 64) * Math.PI * 2, r = i % 8 < 4 ? 0.88 : 0.66; return [r * Math.cos(a), r * Math.sin(a)] as Pt; }), "grey"), { P: C(0, 0, 0.26, 0.26, 20), closed: true, hue: "dark", ring: true }],
  shield: [F([[-0.7, -0.78], [0.7, -0.78], [0.7, 0], [0, 0.92], [-0.7, 0]], "blue"), L([0, -0.78], [0, 0.92])],
  envelope: [F(R(-0.88, -0.56, 1.76, 1.12), "grey"), L([-0.88, -0.56], [0, 0.1], [0.88, -0.56])],
  flag: [F([[-0.7, -0.9], [0.8, -0.76], [0.6, -0.46], [0.8, -0.16], [-0.7, -0.26]], "red"), L([-0.7, -0.92], [-0.7, 0.95])],
  crown: [F([[-0.82, 0.5], [-0.82, -0.42], [-0.4, 0], [0, -0.62], [0.4, 0], [0.82, -0.42], [0.82, 0.5]], "yellow"), L([-0.82, 0.3], [0.82, 0.3])],
  eye: [F(C(0, 0, 0.92, 0.46, 36), "grey"), F(C(0, 0, 0.33, 0.33, 24), "blue"), F(C(0, 0, 0.13, 0.13, 14), "dark")],
  cloud: [F(Array.from({ length: 48 }, (_, i) => { const a = (i / 48) * Math.PI * 2, b = 1 + 0.13 * Math.cos(5 * a); return [0.88 * Math.cos(a) * b, 0.46 * Math.sin(a) * b] as Pt; }), "grey"),
    L([-0.4, 0.6], [-0.5, 0.9]), L([0, 0.6], [-0.1, 0.9]), L([0.4, 0.6], [0.3, 0.9])],
  bolt: [F([[0.18, -0.95], [-0.5, 0.12], [-0.05, 0.12], [-0.22, 0.95], [0.52, -0.16], [0.06, -0.16], [0.3, -0.95]], "yellow")],
  moon: [F([...ellipse(0, 0, 0.8, 0.8, 30, (70 * Math.PI) / 180, (220 * Math.PI) / 180), ...ellipse(0.32, -0.02, 0.62, 0.62, 24, (250 * Math.PI) / 180, (-140 * Math.PI) / 180)], "yellow")],
  burst: [F(Array.from({ length: 24 }, (_, i) => { const r = i % 2 ? 0.48 : 0.95, a = (i / 24) * Math.PI * 2; return [r * Math.cos(a), r * Math.sin(a)] as Pt; }), "red"), F(Array.from({ length: 16 }, (_, i) => { const r = i % 2 ? 0.25 : 0.5, a = (i / 16) * Math.PI * 2 + 0.2; return [r * Math.cos(a), r * Math.sin(a)] as Pt; }), "yellow")],
} satisfies Record<string, Part[]>;
export type IconId = keyof typeof ICONS;

/* ---------------------------------------------------------------- medium palettes ---------------------------------------------------------------- */
const HUES: Record<Medium, Record<Hue, string>> = {
  crosshatch: { yellow: "#f0c55a", red: "#d4382c", blue: "#9cc4d6", green: "#5f9c5c", brown: "#c97b4a", grey: "#e6dccb", dark: "#3a2417" },
  sketchbook: { yellow: "#d97757", red: "#d97757", blue: "#d97757", green: "#d97757", brown: "#d97757", grey: "#d97757", dark: "#2a2420" },
  "cut-paper": { yellow: "#f6cf55", red: "#e2574c", blue: "#7cc3d8", green: "#79c25a", brown: "#c08048", grey: "#fbf6ea", dark: "#26315f" },
  riso: { yellow: "", red: "", blue: "", green: "", brown: "", grey: "", dark: "" },
  pixel: { yellow: "#f4d24a", red: "#c9403b", blue: "#5aaee0", green: "#2d8749", brown: "#a46a3f", grey: "#f5f1e6", dark: "#120f1c" },
  isometric: { yellow: "#ffffff", red: "#ffffff", blue: "#ffffff", green: "#ffffff", brown: "#ffffff", grey: "#ffffff", dark: ISO.edge },
  math: { yellow: MC.yellow, red: MC.red, blue: MC.blue, green: MC.green, brown: MC.red, grey: MC.grey, dark: MC.grey },
};
const RTONE: Record<Hue, Partial<Record<"teal" | "pink" | "yellow", number>>> = {
  yellow: { yellow: 1 }, red: { pink: 1, yellow: 0.8 }, blue: { teal: 0.8 }, green: { teal: 0.6, yellow: 1 }, brown: { pink: 0.5, yellow: 0.9, teal: 0.3 }, grey: { teal: 0.2 }, dark: { teal: 1, pink: 0.9 },
};

/* ---------------------------------------------------------------- helpers ---------------------------------------------------------------- */
const place = (P: Pt[], cx: number, cy: number, s: number): Pt[] => P.map(([x, y]) => [cx + x * s, cy + y * s]);
/** a number counted up to its value (years and short codes stamp instead) */
function counted(big: string, k: number) {
  const m = big.match(/^(\D*)(\d[\d.,]*)(.*)$/); if (!m || big.includes(":")) return big;   // clock times stamp
  const raw = m[2], isYear = /^(1[0-9]{3}|20[0-9]{2})$/.test(raw); if (isYear || k >= 1) return big;
  const sep = raw.includes(",") && raw.indexOf(",") < raw.length - 3 ? "," : raw.includes(".") && raw.length - raw.lastIndexOf(".") === 4 ? "." : "";
  const v = Number(raw.replace(/[.,]/g, sep ? "" : ".")); if (!isFinite(v)) return big;
  const cur = Math.round(v * out(k));
  return m[1] + (sep ? cur.toLocaleString("en-US").replace(/,/g, sep) : String(cur)) + m[3];
}
/** a scribble fill (sketchbook): zigzag strokes across the shape's box, clipped to it, written on with frac */
function scribblePts(P: Pt[], gap = 14): Pt[] {
  const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), Q: Pt[] = [];
  for (let y = y0, i = 0; y <= y1; y += gap, i++) Q.push(i % 2 ? [x1, y] : [x0, y]);
  return Q;
}

/* ---------------------------------------------------------------- one icon in one medium (SVG media) ---------------------------------------------------------------- */
const IconSvg: React.FC<{ medium: Medium; icon: IconId; cx: number; cy: number; s: number; k: number; B: number; uid: string; P?: Persona }> = ({ P, medium, icon, cx, cy, s, k, B, uid }) => {
  const parts = (ICONS[icon] as Part[]).map((p) => (p.ring ? { ...p, closed: false, P: [...p.P, p.P[0]] } : p)), H = HUES[medium];
  if (medium === "riso") {
    const lift = (1 - out(k)) * s * 0.5;
    return (
      <g transform={`translate(0 ${lift})`} opacity={clamp(k * 3)}>
        <RisoPrint B={B} misreg={4 + 20 * (1 - out(k))} items={parts.filter((p) => p.closed).map((p) => ({ d: path(place(p.P, cx, cy, s), true), tones: RTONE[p.hue] }))} />
        <g style={{ mixBlendMode: "multiply" }}>{parts.filter((p) => !p.closed).map((p, i) => <path key={i} d={path(place(p.P, cx, cy, s))} stroke={RISO.teal} strokeWidth={s * 0.06} strokeLinecap="round" fill="none" />)}</g>
      </g>
    );
  }
  if (medium === "cut-paper") {
    const p = P ? (P.overshoot > 0 ? pop(k, P.overshoot) : out(k)) : pop(k), sc = (P?.scaleFrom ?? 0.5) + (1 - (P?.scaleFrom ?? 0.5)) * p;   // the personality decides the bounce
    return (
      <g transform={`translate(${cx} ${cy}) scale(${sc}) translate(${-cx} ${-cy})`} opacity={clamp(k * 4)}>
        {parts.map((pt, i) => pt.closed ? <Cut key={i} P={place(pt.P, cx, cy, s)} fill={H[pt.hue]} seed={i + 3} B={B} shadow={i === 0 || pt.hue !== "dark"} />
          : <path key={i} d={path(place(pt.P, cx, cy, s))} stroke={H.dark} strokeWidth={s * 0.07} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
      </g>
    );
  }
  if (medium === "math") {
    const u = smooth(k);
    return <g fill="none" strokeLinecap="round" strokeLinejoin="round">{parts.map((pt, i) => <path key={i} d={path(place(pt.P, cx, cy, s), pt.closed)} stroke={H[pt.hue]} strokeWidth={pt.closed ? 5 : 4} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - clamp(u * 1.3 - i * 0.05)} fill={pt.closed && pt.hue !== "dark" ? H[pt.hue] : "none"} fillOpacity={0.14 * u} />)}</g>;
  }
  if (medium === "sketchbook") {
    const pen = seg(k, 0, 0.35), ink = seg(k, 0.3, 0.4), col = seg(k, 0.6, 0.4), main = parts.findIndex((p) => p.closed);
    return (
      <g>
        {parts.map((pt, i) => <Ink key={`g${i}`} P={place(pt.P, cx + 6, cy - 4, s * 1.03)} closed={pt.closed} B={B} w={2.5} color="#9a948b" amt={3.5} frac={pen} double={false} seed={40 + i} />)}
        {main >= 0 && (() => { const P = place(parts[main].P, cx, cy, s), id = `${uid}-sc`; return (<g>
          <defs><clipPath id={id}><path d={path(P, true)} /></clipPath></defs>
          <path d={path(P, true)} fill="#d97757" opacity={0.2 * col} />
          <g clipPath={`url(#${id})`}><Ink P={scribblePts(P, s * 0.07)} B={B} w={s * 0.035} color="#d97757" amt={3} frac={col} double={false} seed={9} /></g>
        </g>); })()}
        {parts.map((pt, i) => <Ink key={`i${i}`} P={place(pt.P, cx, cy, s)} closed={pt.closed} B={B} w={6} frac={ink} seed={i + 1} />)}
      </g>
    );
  }
  // crosshatch
  const fr = out(k);
  return (
    <g>
      {parts.map((pt, i) => {
        const P = place(pt.P, cx, cy, s);
        if (!pt.closed) return <Ink key={i} P={P} B={B} w={6} frac={clamp(fr * 1.4 - 0.3)} seed={i + 1} />;
        return (<g key={i}>
          <path d={path(P.map(([x, y]) => [x + 5, y + 4] as Pt), true)} fill={H[pt.hue]} opacity={clamp(fr * 1.5)} />
          <Hatch id={`${uid}-h${i}`} P={P} B={B} cross={i === 0} frac={fr} gap={Math.max(8, s * 0.045)} />
          <Ink P={P} closed B={B} w={5.5} frac={clamp(fr * 1.5)} seed={i + 1} />
        </g>);
      })}
    </g>
  );
};

/* ---------------------------------------------------------------- the beat layer per medium ---------------------------------------------------------------- */
type BeatProps = { cfg: MediaCfg; beat: MediaBeat; t0: number; t: number; B: number; w: number; h: number; uid: string; times: number[] };
const BeatSvg: React.FC<BeatProps> = ({ cfg, beat, t0, t, B, w, h, uid, times }) => {
  const P = persona(cfg.motion ?? MEDIUM_PERSONA[cfg.medium]), tempo = P.enter / 0.35;   // draw-on times scale with the personality
  const m = cfg.medium, u = Math.min(w, h), cx = w / 2, cy = h * (h > w ? 0.38 : 0.44);
  const color = m === "math" ? MC.white : m === "isometric" ? ISO.accent : m === "riso" ? RISO.teal : "#2a2420";
  const font = m === "math" ? SERIF : m === "isometric" ? SANS : m === "riso" ? BLACK : HAND;
  if (beat.kind === "number" && beat.big) {
    const txt = counted(beat.big, seg(t, t0, 0.9 * tempo)), size = u * (beat.big.length > 6 ? 0.2 : 0.28), sc = m === "cut-paper" ? pop(seg(t, t0, 0.5)) : 1;
    return (
      <g opacity={clamp(seg(t, t0, 0.15))}>
        {m === "cut-paper" && <Cut P={rect(cx - size * 0.4 * txt.length * 0.62 - 40, cy - size * 0.82, size * 0.8 * txt.length * 0.62 + 80, size * 1.05)} fill="#fbf6ea" seed={21} B={B} />}
        {m === "riso" && <RisoPrint B={B} items={[{ d: path(rect(cx - size * 0.36 * txt.length - 40, cy - size * 0.85, size * 0.72 * txt.length + 80, size * 1.1), true), tones: { yellow: 1 } }]} />}
        <text x={cx} y={cy} textAnchor="middle" fontFamily={font} fontSize={size} fill={m === "math" ? MC.yellow : color} transform={`translate(${cx} ${cy}) scale(${sc}) translate(${-cx} ${-cy})`} style={m === "riso" ? { mixBlendMode: "multiply" } : undefined}>{txt}</text>
        {beat.label && <text x={cx} y={cy + u * 0.12} textAnchor="middle" fontFamily={font} fontSize={u * 0.06} fill={m === "math" ? MC.grey : color} opacity={out(seg(t, t0 + 0.4, 0.4))}>{beat.label}</text>}
        {m === "crosshatch" && <Ink P={[[cx - size * 0.3 * txt.length, cy + u * 0.03], [cx + size * 0.3 * txt.length, cy + u * 0.025]]} B={B} w={7} color="#d4382c" frac={seg(t, t0 + 0.5, 0.4)} />}
        {m === "sketchbook" && <rect x={cx - size * 0.3 * txt.length} y={cy - size * 0.5} width={size * 0.6 * txt.length * out(seg(t, t0 + 0.6, 0.4))} height={size * 0.55} fill="#f7d64a" opacity={0.55} style={{ mixBlendMode: "multiply" }} />}
        {m === "math" && <path d={`M${cx - size * 0.32 * txt.length} ${cy + 24}H${cx - size * 0.32 * txt.length + size * 0.64 * txt.length * smooth(seg(t, t0 + 0.3, 0.6))}`} stroke={MC.yellow} strokeWidth={4} />}
      </g>
    );
  }
  if (beat.kind === "title") {
    const words = (beat.text ?? beat.label ?? "").split(" "), size = u * (words.join(" ").length > 22 ? 0.085 : 0.12);
    return (
      <g>
        {m === "riso" && <RisoPrint B={B} items={[{ d: path(rect(w * 0.08, cy - size * 1.1, w * 0.84 * out(seg(t, t0, 0.5)), size * 1.6), true), tones: { pink: 1 } }]} />}
        <text x={cx} y={cy} textAnchor="middle" fontFamily={font} fontSize={size} fill={m === "riso" ? RISO.paper : color}>
          {words.map((wd, i) => <tspan key={i} opacity={out(seg(t, t0 + 0.12 * i, 0.3))}>{wd}{i < words.length - 1 ? " " : ""}</tspan>)}
        </text>
      </g>
    );
  }
  const still = m === "math", figs = figures(beat, w, h, t0, times);
  const fig = (F: Fig, n: number) => {
    const live = t - F.at, kk = seg(t, F.at, (m === "math" ? 0.9 : m === "sketchbook" ? 1.2 : 0.7) * tempo), ly = F.cy - F.s * 1.35, fsz = u * (figs.length > 1 ? 0.052 : 0.062);
    const bob = still ? 0 : Math.sin(live * 2.2 + n) * u * 0.008, sway = still ? 0 : Math.sin(live * 1.4 + 1 + n) * 2.2;   // idle life: never a frozen picture
    if (t < F.at - 0.01) return null;
    return (
      <g key={n}>
        <g transform={`translate(0 ${bob}) rotate(${sway} ${F.cx} ${F.cy + F.s})`}><IconSvg P={P} medium={m} icon={F.icon} cx={F.cx} cy={F.cy} s={F.s} k={kk} B={B} uid={`${uid}f${n}`} /></g>
        {F.label && (m === "cut-paper"
          ? <g opacity={clamp(seg(t, secondary(F.at + 0.25 * tempo, P), 0.2) * 3)} transform={`rotate(${n ? 3 : -3} ${F.cx} ${ly})`}><Cut P={rect(F.cx - F.label.length * fsz * 0.36 - 30, ly - fsz * 1.05, F.label.length * fsz * 0.72 + 60, fsz * 1.45)} fill="#fbf6ea" seed={33 + n} B={B} />
              <text x={F.cx} y={ly} textAnchor="middle" fontFamily={HAND} fontSize={fsz} fill="#2a1d18">{F.label}</text></g>
          : <text x={F.cx} y={ly + fsz * 0.1} textAnchor="middle" fontFamily={font} fontSize={m === "riso" ? fsz * 0.8 : fsz} fill={m === "math" ? MC.blue : color} letterSpacing={m === "riso" ? 4 : 0}
              opacity={out(seg(t, secondary(F.at + 0.2 * tempo, P), P.enter))}>{m === "riso" ? F.label.toUpperCase() : F.label}</text>)}
      </g>
    );
  };
  const rows = beat.kind === "list" ? beat.items ?? [] : [];
  const land = w > h, rx = land ? (figs.length ? w * 0.47 : w * 0.3) : w * 0.14, ry0 = land ? h * 0.24 : h * 0.4, rh = u * 0.11, rfs = u * 0.058;
  const link = beat.kind === "compare" && figs.length === 2 ? (() => {
    const a = figs[0], b = figs[1], k2 = seg(t, b.at - 0.25, 0.4), mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
    if (beat.link === "to") {
      const P: Pt[] = land ? [[a.cx + a.s * 1.25, my], [b.cx - b.s * 1.25, my]] : [[mx, a.cy + a.s * 1.15], [mx, b.cy - b.s * 1.95]];
      const [e, g] = [P[1], P[0]], ang = Math.atan2(e[1] - g[1], e[0] - g[0]), hd = u * 0.035;
      const head: Pt[] = [[e[0] - hd * Math.cos(ang - 0.5), e[1] - hd * Math.sin(ang - 0.5)], e, [e[0] - hd * Math.cos(ang + 0.5), e[1] - hd * Math.sin(ang + 0.5)]];
      return m === "crosshatch" || m === "sketchbook" ? <g><Ink P={P} B={B} w={7} frac={k2} /><Ink P={head} B={B} w={7} frac={seg(t, b.at + 0.1, 0.2)} seed={5} /></g>
        : <g opacity={k2} stroke={m === "math" ? MC.grey : m === "riso" ? RISO.pink : color} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" style={m === "riso" ? { mixBlendMode: "multiply" } : undefined}>
            <path d={path(P)} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - k2} /><path d={path(head)} /></g>;
    }
    const sz = u * 0.09, sc = m === "cut-paper" ? pop(k2) : out(k2);
    return <g opacity={clamp(k2 * 3)} transform={`translate(${mx} ${my}) scale(${sc}) translate(${-mx} ${-my})`}>
      {m === "cut-paper" && <Cut P={ellipse(mx, my - sz * 0.3, sz * 0.8, sz * 0.8, 24)} fill="#f6cf55" seed={44} B={B} />}
      {m === "riso" && <RisoPrint B={B} items={[{ d: path(ellipse(mx, my - sz * 0.3, sz * 0.8, sz * 0.8, 30), true), tones: { pink: 1 } }]} />}
      <text x={mx} y={my} textAnchor="middle" fontFamily={font} fontSize={sz} fill={m === "riso" ? RISO.paper : m === "math" ? MC.yellow : m === "crosshatch" ? "#d4382c" : color}>vs</text></g>;
  })() : null;
  return (
    <g>
      {figs.map(fig)}
      {link}
      {rows.map((r, i) => { const at = times[i] ?? t0 + 0.5 + i * 0.6; if (t < at - 0.01) return null; const y = ry0 + i * rh, E = entrance(t, at, P, u / 1080, "left"), k3 = clamp(E.k), dot: Pt = [rx, y - rfs * 0.32];
        return <g key={`r${i}`} opacity={E.opacity} transform={`translate(${(1 - out(k3)) * -30} 0)`}>
          {m === "cut-paper" ? <Cut P={ellipse(dot[0], dot[1], rfs * 0.28, rfs * 0.28, 14)} fill="#e2574c" seed={50 + i} B={B} shadow={false} />
            : m === "riso" ? <RisoPrint B={B} items={[{ d: path(ellipse(dot[0], dot[1], rfs * 0.28, rfs * 0.28, 16), true), tones: { pink: 1 } }]} />
            : m === "crosshatch" || m === "sketchbook" ? <Ink P={ellipse(dot[0], dot[1], rfs * 0.26, rfs * 0.26, 14)} closed B={B} w={6} seed={60 + i} frac={out(k3)} />
            : <circle cx={dot[0]} cy={dot[1]} r={rfs * 0.22} fill={m === "math" ? MC.yellow : color} />}
          <text x={rx + rfs * 0.7} y={y} fontFamily={font} fontSize={rfs} fill={m === "math" ? MC.white : color}>{r.text}</text></g>; })}
    </g>
  );
};

/* ---------------------------------------------------------------- worlds ---------------------------------------------------------------- */
const WorldSvg: React.FC<{ m: Medium; f: number; t: number; w: number; h: number; B: number }> = ({ m, f, t, w, h, B }) => {
  if (m === "crosshatch") { const floor: Pt[] = [[0, h * 0.8], [w, h * 0.8], [w, h], [0, h]];
    return <g><Paper f={f} tone="#f4ecd9" w={w} h={h} /><path d={path(floor, true)} fill="#d6a466" /><Hatch id="w-floor" P={floor} B={B} angle={-8} gap={13} /><Ink P={[[0, h * 0.8], [w, h * 0.8]]} B={B} w={5} /></g>; }
  if (m === "sketchbook") return <Paper f={f} dots w={w} h={h} />;
  if (m === "cut-paper") return <g><PaperDefs /><rect width={w} height={h} fill="url(#cp-stripes)" /><Cut P={rect(-20, h * 0.8, w + 40, h * 0.3)} fill="url(#cp-ging)" seed={4} B={B} /></g>;
  if (m === "riso") { const hill = (y: number, amp: number, ph: number) => { const P: Pt[] = [[0, h]]; for (let x = 0; x <= w; x += 40) P.push([x, y + amp * Math.sin(x / 260 + ph)]); P.push([w, h]); return path(P, true); };
    return <g><RisoDefs /><rect width={w} height={h} fill={RISO.paper} /><RisoPrint B={B} items={[{ d: hill(h * 0.82, 30, t * 0.1), tones: { teal: 0.35, yellow: 0.6 } }, { d: hill(h * 0.9, 24, 2 + t * 0.2), tones: { teal: 0.8, yellow: 0.9 } }]} /></g>; }
  if (m === "isometric") { const o: Pt = [w / 2, h * 0.62];
    return <g><rect width={w} height={h} fill={ISO.paper} />{Array.from({ length: 15 }, (_, i) => <g key={i}><path d={path([iso(-350 + i * 50, -350, 0, o), iso(-350 + i * 50, 350, 0, o)])} stroke={ISO.inner} strokeWidth={1.5} /><path d={path([iso(-350, -350 + i * 50, 0, o), iso(350, -350 + i * 50, 0, o)])} stroke={ISO.inner} strokeWidth={1.5} /></g>)}</g>; }
  if (m === "math") return <g><rect width={w} height={h} fill={MC.bg} />{Array.from({ length: Math.ceil(w / 120) + 1 }, (_, i) => <path key={i} d={`M${i * 120} 0V${h}`} stroke="#29abca" strokeOpacity={0.12} />)}{Array.from({ length: Math.ceil(h / 120) + 1 }, (_, i) => <path key={`y${i}`} d={`M0 ${i * 120}H${w}`} stroke="#29abca" strokeOpacity={0.12} />)}</g>;
  return null;
};

/* ---------------------------------------------------------------- pixel medium (canvas) ---------------------------------------------------------------- */
const PixelBeat: React.FC<{ beat: MediaBeat; t0: number; t: number; f: number; w: number; h: number; times: number[] }> = ({ beat, t0, t, f, w, h, times }) => {
  const res: [number, number] = w >= h ? [192, 108] : [108, 192], px = w / res[0], figs = React.useMemo(() => figures(beat, w, h, t0, times), [beat, w, h, t0, times]);
  const draw = React.useCallback((c: CanvasRenderingContext2D, W: number, H: number) => {
    ditherBand(c, 0, 0, W, Math.round(H * 0.6), "#262b52", "#ee8a35", (v) => v * 0.9);
    const ridge = (base: number, amp: number, fr: number, sp: number, col: string) => { c.fillStyle = col; for (let x = 0; x < W; x++) { const y = Math.round(base + amp * Math.sin((x + t * sp) * fr)); c.fillRect(x, y, 1, H - y); } };
    ridge(H * 0.62, 5, 0.06, 6, "#4b4f68"); ridge(H * 0.8, 3, 0.1, 18, "#2d8749"); ridge(H * 0.9, 2, 0.14, 30, "#89cf4b");
    const sc = W / w;
    figs.forEach((F) => {
      const step = Math.min(4, Math.floor(seg(t, F.at, 0.5) * 4)), s = F.s * sc * 0.96 * (step / 4), cx = F.cx * sc, cy = F.cy * sc;
      if (!step) return;
      (ICONS[F.icon] as Part[]).map((p) => (p.ring ? { ...p, closed: false, P: [...p.P, p.P[0]] } : p)).forEach((pt) => {
        const P = place(pt.P, cx, cy, s); c.beginPath(); P.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        if (pt.closed) { c.closePath(); c.fillStyle = HUES.pixel[pt.hue]; c.fill(); c.strokeStyle = "#120f1c"; c.lineWidth = 1; c.stroke(); }
        else { c.strokeStyle = "#120f1c"; c.lineWidth = 1.4; c.stroke(); }
      });
    });
  }, [figs, t, w]);
  const u = Math.min(w, h), blink = Math.floor((t - t0) * 4) % 2 === 0 || t - t0 > 1;
  return (
    <AbsoluteFill>
      <PixelCanvas res={res} draw={draw} frameKey={f} />
      {(beat.kind === "number" || beat.kind === "title") && <div style={{ position: "absolute", left: 0, right: 0, top: h * 0.3, textAlign: "center", fontFamily: PIX, fontSize: Math.round(u * (beat.kind === "number" ? 0.2 : 0.1) / px) * px, color: "#f4d24a", textShadow: `${px}px ${px}px 0 #120f1c`, opacity: blink ? 1 : 0 }}>
        {beat.kind === "number" ? counted(beat.big ?? "", seg(t, t0, 0.9)) : beat.text ?? beat.label}</div>}
      {figs.map((F, i) => F.label && t >= F.at && <div key={i} style={{ position: "absolute", left: F.cx - w * 0.25, width: w * 0.5, top: F.cy - F.s * 1.6 - u * 0.03, textAlign: "center" }}>
        <span style={{ fontFamily: PIX, fontSize: Math.round(u * 0.05 / px) * px, color: "#f5f1e6", background: "#120f1c", padding: `${px}px ${2 * px}px`, opacity: blink || t - F.at > 1 ? 1 : 0 }}>{F.label.toUpperCase()}</span></div>)}
      {beat.kind === "compare" && figs.length === 2 && t >= figs[1].at - 0.25 && <div style={{ position: "absolute", left: (figs[0].cx + figs[1].cx) / 2 - u * 0.1, width: u * 0.2, top: (figs[0].cy + figs[1].cy) / 2 - u * 0.06, textAlign: "center", fontFamily: PIX, fontSize: Math.round(u * 0.08 / px) * px, color: "#f4d24a", textShadow: `${px}px ${px}px 0 #120f1c` }}>{beat.link === "to" ? (w > h ? ">" : "v") : "VS"}</div>}
      {beat.kind === "list" && (beat.items ?? []).map((r, i) => t >= (times[i] ?? t0 + 0.5 + i * 0.6) && <div key={`r${i}`} style={{ position: "absolute", left: w > h ? w * (figs.length ? 0.47 : 0.3) : w * 0.12, top: (w > h ? h * 0.18 : h * 0.36) + i * u * 0.11, fontFamily: PIX, fontSize: Math.round(u * 0.05 / px) * px, color: "#f5f1e6", textShadow: `${px}px ${px}px 0 #120f1c` }}>{"> " + r.text.toUpperCase()}</div>)}
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- isometric beat ---------------------------------------------------------------- */
const IsoBeat: React.FC<{ beat: MediaBeat; t0: number; t: number; w: number; h: number; times: number[] }> = ({ beat, t0, t, w, h, times }) => {
  const u = Math.min(w, h), n = beat.kind === "number" ? 3 : 1, figs = figures(beat, w, h, t0, times), many = figs.length > 1;
  const slabs = figs.length ? figs.map((F) => ({ F, o: [F.cx, h * (w > h ? 0.62 : F.cy / h + 0.2)] as Pt, S: u * (many ? 0.22 : beat.kind === "list" ? 0.24 : 0.32) })) : beat.kind === "number" || beat.kind === "title" ? [{ F: null, o: [w / 2, h * 0.62] as Pt, S: u * 0.32 }] : [];
  return (
    <g>
      {slabs.map(({ F, o, S }, si) => {
        const at = F?.at ?? t0, top = n * 34 + 10, up = (P: Pt[]) => P.map(([x, y]) => iso(x * S * 0.5, 0, top + (1 - y) * S * 0.5, o));   // upright, standing on the slab's middle
        const ik = seg(t, at + 0.45, 0.5), rise = out(seg(t, at + 0.35, 0.45));
        if (t < at - 0.01) return null;
        return (
          <g key={si}>
            {Array.from({ length: n }, (_, i) => { const drop = 1 - out(seg(t, at + i * 0.15, 0.45)); return <g key={i} opacity={clamp(1 - drop * 1.6)}><IsoBox x={-S / 2} y={-S / 2} z={10 + i * 34 + drop * 400} w={S} d={S} h={22} o={o} accent={beat.kind === "number" && i === n - 1} /></g>; })}
            {F && <g transform={`translate(0 ${(1 - rise) * 60})`} opacity={rise}>{(ICONS[F.icon] as Part[]).map((pt, i) => <path key={i} d={path(up(pt.P), pt.closed && !pt.ring)} fill={pt.closed && !pt.ring ? ISO.face : "none"} stroke={i === 0 ? ISO.accent : ISO.edge} strokeWidth={i === 0 ? 3 : 2.2} strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - ik} />)}</g>}
            {F?.label && <text x={o[0]} y={h * (w > h ? 0.2 : o[1] / h - 0.3)} textAnchor="middle" fontFamily={SANS} fontWeight={500} fontSize={u * 0.045} fill={ISO.edge} opacity={out(seg(t, at + 0.6, 0.4))}>{F.label}</text>}
          </g>
        );
      })}
      {beat.kind === "compare" && many && <text x={w / 2} y={h * 0.5} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={u * 0.07} fill={ISO.accent} opacity={out(seg(t, figs[1].at - 0.2, 0.3))}>{beat.link === "to" ? "→" : "vs"}</text>}
      {beat.kind === "list" && (beat.items ?? []).map((r, i) => { const at = times[i] ?? t0 + 0.5 + i * 0.6; return t >= at && <text key={i} x={w > h ? w * (figs.length ? 0.5 : 0.3) : w * 0.12} y={(w > h ? h * 0.3 : h * 0.45) + i * u * 0.1} fontFamily={SANS} fontWeight={500} fontSize={u * 0.055} fill={ISO.accent} opacity={out(seg(t, at, 0.3))}>— {r.text}</text>; })}
      {beat.kind === "number" && <text x={w / 2} y={h * 0.22} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={u * 0.16} fill={ISO.accent} opacity={out(seg(t, t0 + 0.3, 0.4))}>{counted(beat.big ?? "", seg(t, t0 + 0.3, 0.9))}</text>}
      {beat.kind === "title" && <text x={w / 2} y={h * 0.22} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={u * 0.09} fill={ISO.accent} opacity={out(seg(t, t0, 0.5))}>{beat.text ?? beat.label}</text>}
      {beat.kind === "number" && beat.label && <text x={w * 0.08} y={h * 0.12} fontFamily={SANS} fontWeight={500} fontSize={u * 0.045} fill={ISO.edge} opacity={out(seg(t, t0 + 0.6, 0.4))}>{beat.label}</text>}
    </g>
  );
};

/* ---------------------------------------------------------------- caption ---------------------------------------------------------------- */
const Caption: React.FC<{ m: Medium; line?: KitTiming["lines"][number]; t: number; w: number; h: number }> = ({ m, line, t, w, h }) => {
  if (!line) return null;
  const u = Math.min(w, h), words = line.words?.length ? line.words.map(([x, a]) => [x, a] as [string, number]) : line.text.split(" ").map((x, i, all) => [x, line.start + ((line.end - line.start) * i) / all.length] as [string, number]);
  const st: Record<Medium, React.CSSProperties> = {
    crosshatch: { fontFamily: HAND, color: "#2a2420", background: "rgba(251,246,234,.92)", border: "3px solid #3a2417", borderRadius: 6, transform: "rotate(-1deg)" },
    sketchbook: { fontFamily: HAND, color: "#2a2420", background: "rgba(255,253,246,.9)", borderRadius: 4, boxShadow: "0 2px 0 #efe2b4" },
    "cut-paper": { fontFamily: HAND, color: "#2a1d18", background: "#fbf6ea", boxShadow: "4px 6px 10px rgba(42,29,24,.3)", transform: "rotate(-1deg)" },
    riso: { fontFamily: BLACK, color: RISO.paper, background: RISO.teal, letterSpacing: 1 },
    pixel: { fontFamily: PIX, color: "#f5f1e6", background: "#120f1c", border: "4px solid #f5f1e6" },
    isometric: { fontFamily: SANS, fontWeight: 500, color: ISO.accent, background: "rgba(255,255,255,.94)", border: `2px solid ${ISO.inner}` },
    math: { fontFamily: SERIF, color: MC.white, background: "rgba(14,14,16,.8)" },
  };
  const fs = u * (m === "pixel" ? 0.04 : m === "riso" ? 0.042 : 0.05);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: h * (h > w ? 0.24 : 0.065), display: "flex", justifyContent: "center" }}>   {/* anchored by its bottom: a two-line caption grows upward, inside title-safe */}
      <div style={{ ...st[m], fontSize: fs, lineHeight: 1.2, padding: `${fs * 0.25}px ${fs * 0.55}px`, maxWidth: w * 0.84, textAlign: "center" }}>
        {words.map(([x, a], i) => <span key={i} style={{ opacity: t >= a - 0.03 ? 1 : 0.72 }}>{x}{i < words.length - 1 ? " " : ""}</span>)}
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------- the scene ---------------------------------------------------------------- */
/** draws a segment: one beat per line (the beat holds until the next one starts); timing is the segment's local timing */
export const MediaScene: React.FC<{ cfg: MediaCfg; timing: KitTiming }> = ({ cfg, timing }) => {
  const f = useCurrentFrame(), { fps, width: w, height: h } = useVideoConfig(), t = f / fps, B = Math.floor(f / 2), m = cfg.medium;
  // the segment's first beat is already half-drawn on frame 0 (a film's hook, and the picture an iris opens onto)
  const start = (b: MediaBeat) => { const l = timing.lines.find((x) => x.id === b.line); const a = b.w && l?.words?.[b.w] ? l.words[b.w][1] : l?.start ?? 0; return b === cfg.beats[0] ? Math.min(0, a) - 0.2 : Math.max(0, a - 0.12); };
  let bi = 0; cfg.beats.forEach((b, i) => { if (i && t >= start(b)) bi = i; });
  const beat = cfg.beats[bi], t0 = beat ? start(beat) : 0, line = timing.lines.find((l) => l.id === beat?.line && t < l.end + 0.5);
  const wordAt = (wi?: number) => { const l = timing.lines.find((x) => x.id === beat?.line); return wi != null && l?.words?.[wi] ? l.words[wi][1] - 0.05 : undefined; };
  const times = !beat ? [] : beat.kind === "compare" ? [wordAt(beat.w2) ?? t0 + 0.8] : beat.kind === "list" ? (beat.items ?? []).map((r, i) => wordAt(r.w) ?? t0 + 0.5 + i * 0.6) : [];
  // camera: a slow push per beat, a small settle on entry (math and isometric stay still: they are diagrams)
  // camera: hand-made media never hold a dead frame - a slow push and a drift whose direction alternates per beat
  const P = persona(cfg.motion ?? MEDIUM_PERSONA[m]), live = clamp((t - t0) / 5), dir = bi % 2 ? -1 : 1;
  const push = m === "math" || m === "isometric" ? 1 : 1 + P.push * io(live) + (P.overshoot > 0 ? 0.025 * (1 - out(seg(t, t0, P.enter))) : 0);
  const drift = m === "math" || m === "isometric" ? 0 : dir * w * P.drift * (io(live) - 0.5);
  if (!beat) return null;
  return (
    <AbsoluteFill style={{ background: m === "math" ? MC.bg : "#fff" }}>
      {m === "pixel" ? <PixelBeat beat={beat} t0={t0} t={t} f={f} w={w} h={h} times={times} /> : (
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, isolation: "isolate" }}>
          <WorldSvg m={m} f={f} t={t} w={w} h={h} B={B} />
          <g transform={`translate(${w / 2 + drift} ${h / 2}) scale(${push}) translate(${-w / 2} ${-h / 2})`}>
            {m === "isometric" ? <IsoBeat beat={beat} t0={t0} t={t} w={w} h={h} times={times} /> : <BeatSvg cfg={cfg} beat={beat} t0={t0} t={t} B={B} w={w} h={h} uid={`b${bi}`} times={times} />}
          </g>
        </svg>
      )}
      {cfg.captions !== false && <Caption m={m} line={line} t={t} w={w} h={h} />}
    </AbsoluteFill>
  );
};

/** demo: the same four beats in every medium, for the sheet (Tpl-MediaScene renders one medium; pass props) */
export const DEMO_TIMING: KitTiming = { duration: 12, lines: [
  { id: 1, text: "Every city starts with a single house.", start: 0.2, end: 2.6 },
  { id: 2, text: "By 1900 it had grown to 4,500 homes.", start: 3.0, end: 5.6 },
  { id: 3, text: "Then the money came.", start: 6.0, end: 7.8 },
  { id: 4, text: "And time ran out.", start: 8.4, end: 10.4 },
] };
export const DEMO_CFG = (medium: Medium): MediaCfg => ({ medium, beats: [
  { line: 1, kind: "object", icon: "house", label: "one house" }, { line: 2, kind: "number", big: "4,500", label: "homes by 1900" },
  { line: 3, kind: "compare", icons: ["house", "coin"], labels: ["homes", "money"], link: "to", w2: 2 }, { line: 4, kind: "list", icon: "clock", label: "time", items: [{ text: "rent", w: 1 }, { text: "debt", w: 2 }, { text: "nothing left", w: 3 }] },
] });
export const MediaSceneDemo: React.FC<{ medium?: Medium; motion?: PersonaName }> = ({ medium = "crosshatch", motion }) => <MediaScene cfg={{ ...DEMO_CFG(medium), motion }} timing={DEMO_TIMING} />;

/** every icon in one SVG medium, finished: the sheet to check the library (pixel and isometric reuse the same outlines) */
export const IconSheet: React.FC<{ medium?: Medium }> = ({ medium = "crosshatch" }) => {
  const f = useCurrentFrame(), { width: w, height: h } = useVideoConfig(), ids = Object.keys(ICONS) as IconId[], cols = 10, cw = w / cols, rows = Math.ceil(ids.length / cols), ch = h / rows;
  return (
    <AbsoluteFill>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, isolation: "isolate" }}>
        <WorldSvg m={medium} f={f} t={0} w={w} h={h} B={0} />
        {ids.map((id, i) => { const cx = (i % cols + 0.5) * cw, cy = (Math.floor(i / cols) + 0.45) * ch;
          return <g key={id}><IconSvg medium={medium} icon={id} cx={cx} cy={cy} s={Math.min(cw, ch) * 0.3} k={1} B={0} uid={`s${i}`} />
            <text x={cx} y={cy + Math.min(cw, ch) * 0.46} textAnchor="middle" fontFamily={SANS} fontSize={20} fill={medium === "math" ? MC.grey : "#333"}>{id}</text></g>; })}
      </svg>
    </AbsoluteFill>
  );
};
