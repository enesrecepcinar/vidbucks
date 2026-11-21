// StormWorld - a flat-vector "paper landscape" documentary look for weather and natural-disaster explainers.
// One world, many shots. The world: a sky gradient with a low sun, a scalloped cloud ceiling, banded ground with swaying
// grass, silhouette sets (plains, farm, city, town), procedural tornadoes in ten shapes with a LIFE (descend from the cloud,
// touch down with a dust burst, widen, rope out, fade), sliding wind bands, a dust skirt and orbiting debris, rain, lightning,
// bird flocks, a recurring observer seen from behind with poses (idle, shade the eyes, point, camera, binoculars) and a name
// tag, a place-and-date pin, in-world annotations (titles, width brackets, vortex dots) and counters, and a keyframed camera.
// Inserts: field notebook (grid pages, tabs, slots, taped polaroids, a hand that writes, sketches and ticks), camera
// viewfinder, developing polaroid that flies away, paper title card, big number, intensity scale chips, waffle percent grid,
// media/radar panel (optionally held by two hands), concept diagrams (vortex tube, spotlight stage), newspaper front page,
// paper damage map, old TV. Transitions into a shot: cut, dissolve, iris, flash, slide (notebook page wipe).
// All art is drawn here: no outside images, so every frame is original.
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fMont } from "@remotion/google-fonts/Montserrat";
import { loadFont as fHand } from "@remotion/google-fonts/PatrickHand";
import { loadFont as fSerif } from "@remotion/google-fonts/DMSerifDisplay";
import { EASE, clamp } from "../motion";

/** inserts are laid out on a landscape box; in a portrait frame they render on a 16:9 box scaled to the width */
const BoxCtx = React.createContext<{ width: number; height: number } | null>(null);
const useBox = () => { const v = useVideoConfig(), b = React.useContext(BoxCtx); return b ? { ...v, width: b.width, height: b.height } : v; };
const MONT = fMont("normal", { weights: ["500", "700", "800"], subsets: ["latin", "latin-ext"] }).fontFamily;
const HAND = fHand("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] }).fontFamily;
const SERIF = fSerif("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] }).fontFamily;

export type Sky = "dusk" | "day" | "storm" | "night" | "clear" | "smoke" | "sunset";
export type Land = "plains" | "farm" | "city" | "town" | "coast" | "mountains" | "desert" | "forest";
export type Shape = "rope" | "cone" | "stovepipe" | "wedge" | "hourglass" | "corkscrew" | "sideways" | "twin" | "satellite" | "walker";
export type Pose = "idle" | "shade" | "point" | "camera" | "binoculars";
export type Cam = { t: number; z?: number; x?: number; y?: number };          // zoom 1 = wide; focus point in 0..1
export type Life = { at?: number; descend?: number; ropeOut?: number; gone?: number };
export type Twister = { shape: Shape; x?: number; scale?: number; life?: Life };
export type Note = { t: number; kind: "title" | "measure" | "dot"; text?: string; x: number; y: number; w?: number };
/** natural events that are not tornadoes: each grows from `at` over `ramp` seconds to `power` (0..1) */
export type EvKind = "flood" | "fire" | "quake" | "volcano" | "wave" | "snow" | "hail" | "meteor" | "dust";
export type Ev = { kind: EvKind; at?: number; ramp?: number; power?: number; x?: number };
export type Trans = "cut" | "dissolve" | "iris" | "flash" | "slide";
type Base = { dur: number; in?: Trans; cam?: Cam[] };
export type SceneShot = Base & {
  kind: "scene"; sky?: Sky; land?: Land; tornado?: Twister; tornadoes?: Twister[]; rain?: boolean; lightning?: number[];
  observer?: { x?: number; tag?: [string, string]; friend?: boolean; pose?: Pose; poseAt?: number; friendPose?: Pose; coat?: string }; place?: [string, string]; push?: number;
  birds?: number; notes?: Note[]; counter?: { t: number; value: number; label: string }; events?: Ev[];
};
export type NotebookShot = Base & {
  kind: "notebook"; title: string; entries: string[]; photo?: { shape?: Shape; world?: WorldSpec; caption: string; slot?: number }; write?: string;
  sketch?: { shape: Shape; slot: number; label?: string }; checks?: number[];
};
export type CardShot = Base & { kind: "card"; kicker?: string; title: string; sky?: Sky; land?: Land };
export type NumberShot = Base & { kind: "number"; value: string; label: string; tornado?: Shape };
export type ViewfinderShot = Base & WorldSpec & { kind: "viewfinder"; flashAt?: number };
export type PolaroidShot = Base & { kind: "polaroid"; sky?: Sky; land?: Land; shape?: Shape; world?: WorldSpec; caption: string };
export type ScaleShot = Base & { kind: "scale"; title: string; items: string[]; highlight: number; notes?: string[] };
export type WaffleShot = Base & { kind: "waffle"; title: string; value: number; label: string };
export type PanelShot = Base & { kind: "panel"; title: string; shapes?: Shape[]; worlds?: WorldSpec[]; held?: boolean; sky?: Sky; land?: Land };
export type DiagramShot = Base & { kind: "diagram"; mode: "tube" | "stage"; caption: string; shape?: Shape };
export type NewsShot = Base & { kind: "newspaper"; masthead: string; headline: string; shape?: Shape; world?: WorldSpec; date?: string };
export type MapShot = Base & { kind: "map"; title: string; path: [number, number][]; labels?: { x: number; y: number; text: string }[]; width?: number };
export type TvShot = Base & { kind: "tv"; shape?: Shape; world?: WorldSpec; caption?: string; sky?: Sky };
export type StormShot = SceneShot | NotebookShot | CardShot | NumberShot | ViewfinderShot | PolaroidShot | ScaleShot | WaffleShot | PanelShot | DiagramShot | NewsShot | MapShot | TvShot;
export type StormCfg = { shots: StormShot[]; trans?: number; audio?: string };

const SKY: Record<Sky, [string, string, string, string]> = {
  dusk: ["#3d4258", "#8b8278", "#e8c48e", "#ffe2a6"], day: ["#5c6372", "#9d9c92", "#cdbf98", "#f4e6bd"],
  storm: ["#3a3f4f", "#5d6170", "#8d8a80", "#b9b19a"], night: ["#151a2e", "#232a45", "#323a5a", "#3d466a"],
  clear: ["#4f7fae", "#8fb4cf", "#e3dcc2", "#fff3cf"], smoke: ["#3b2a24", "#8a4b2c", "#d98a45", "#ffc06a"], sunset: ["#3e3a5e", "#b0607a", "#f0a466", "#ffd9a0"],
};
const CALM: Sky[] = ["clear", "sunset", "dusk", "day"];
/** ground bands (near, mid, far) and grass colour per land */
const GROUND: Record<Land, [string, string, string, string]> = {
  plains: ["#5c6c45", "#4f6040", "#435537", "#9aa57a"], farm: ["#6d6f45", "#5c6440", "#4d5838", "#a8a77a"], city: ["#55604a", "#4a5541", "#3f4a38", "#8d9a76"],
  town: ["#55604a", "#4a5541", "#3f4a38", "#8d9a76"], coast: ["#d8c79e", "#c9b78c", "#b9a77c", "#a99a6e"], mountains: ["#5d6a52", "#4e5b46", "#424e3c", "#8f9c7c"],
  desert: ["#d6b57e", "#c9a46c", "#b9935d", "#a98a55"], forest: ["#4b5e3d", "#3f5234", "#34462b", "#7d9466"],
};
/** a world spec from a bare tornado shape (inserts accept either) */
const worldOf = (shape?: Shape, world?: WorldSpec, sky: Sky = "day", land: Land = "plains"): WorldSpec => world ?? { sky, land, ...(shape ? { tornado: { shape, x: 0.5, scale: 0.85 } } : {}) };
const TAB = ["#e9a23b", "#3f9a8f", "#e7743f", "#5b8fd6", "#d6524a", "#8d72d1"];
const EF = ["#7cc46d", "#b7d45a", "#f2c443", "#f0913a", "#e2583f", "#b45bd0"];
const INK = "#2b2f3d", PAPER = "#f3ecdc", GOLD = "#e9b53a";
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const stormLength = (c: StormCfg) => c.shots.reduce((a, s) => a + s.dur, 0);
const fadeIn = (t: number, at: number, d = 0.5) => EASE.out(clamp((t - at) / d));

/* ---------- camera ---------- */
function camAt(cam: Cam[] | undefined, t: number, dur: number, push = 0.06): Required<Cam> {
  if (!cam || !cam.length) return { t, z: 1 + push * EASE.inOut(clamp(t / dur)), x: 0.5, y: 0.6 };
  const k = cam.map((c) => ({ t: c.t, z: c.z ?? 1, x: c.x ?? 0.5, y: c.y ?? 0.55 }));
  if (t <= k[0].t) return k[0];
  for (let i = 0; i < k.length - 1; i++) if (t <= k[i + 1].t) {
    const e = EASE.inOut(clamp((t - k[i].t) / Math.max(0.01, k[i + 1].t - k[i].t))), a = k[i], b = k[i + 1];
    return { t, z: a.z + (b.z - a.z) * e, x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
  }
  const last = k[k.length - 1]; return { ...last, z: last.z * (1 + 0.02 * EASE.inOut(clamp((t - last.t) / Math.max(1, dur - last.t)))) };
}
const CamWrap: React.FC<{ cam?: Cam[]; t: number; dur: number; push?: number; children: React.ReactNode }> = ({ cam, t, dur, push, children }) => {
  const { width: W, height: H } = useBox(), c = camAt(cam, t, dur, push), k = clamp((c.z - 1) * 1.5);
  const tx = (0.5 - c.x) * W * c.z * k, ty = (0.5 - c.y) * H * c.z * k;
  return <AbsoluteFill style={{ transform: `translate(${tx}px, ${ty}px) scale(${c.z})`, transformOrigin: "50% 50%" }}>{children}</AbsoluteFill>;
};

/* ---------- tornado: centre line cx(y), half width w(y); y 0 = cloud base, 1 = ground ---------- */
type Funnel = { cx: (y: number) => number; w: (y: number) => number; y0?: number; y1?: number };
function funnels(shape: Shape, t: number): Funnel[] {
  const sway = (y: number, a: number) => a * Math.sin(y * 3 + t * 0.6);
  switch (shape) {
    case "rope": return [{ cx: (y) => 0.18 * Math.sin(y * 2.6 + 0.4) + sway(y, 0.02), w: (y) => 0.012 + 0.03 * (1 - y) ** 3 }];
    case "corkscrew": return [{ cx: (y) => 0.1 * Math.sin(y * 13 + t * 1.5) * y, w: (y) => 0.02 + 0.05 * (1 - y) ** 2 }];
    case "sideways": return [{ cx: (y) => -0.55 * (1 - y) ** 2 + 0.05, w: (y) => 0.025 + 0.03 * (1 - y) }];
    case "cone": return [{ cx: (y) => sway(y, 0.01), w: (y) => 0.03 + 0.2 * (1 - y) ** 1.4 }];
    case "stovepipe": return [{ cx: (y) => sway(y, 0.008), w: (y) => 0.12 + 0.04 * (1 - y) ** 3 }];
    case "wedge": return [{ cx: () => 0, w: (y) => 0.36 - 0.06 * y }];
    case "hourglass": return [{ cx: (y) => sway(y, 0.01), w: (y) => 0.035 + 0.3 * Math.abs(y - 0.48) ** 1.5 * 1.8 }];
    case "twin": return [{ cx: (y) => -0.16 + sway(y, 0.01), w: (y) => 0.025 + 0.11 * (1 - y) ** 1.3 }, { cx: (y) => 0.16 - sway(y, 0.01), w: (y) => 0.025 + 0.11 * (1 - y) ** 1.3 }];
    case "satellite": return [{ cx: () => 0, w: (y) => 0.05 + 0.2 * (1 - y) ** 1.2 }, { cx: (y) => 0.38 + 0.05 * Math.sin(y * 5 + t), w: (y) => 0.008 + 0.012 * (1 - y), y0: 0.05 }];
    case "walker": return [
      { cx: () => 0, w: (y) => 0.28 - 0.08 * y, y1: 0.6 },
      { cx: (y) => -0.11 - 0.03 * Math.sin(t * 1.4) * (y - 0.55), w: (y) => 0.05 + 0.03 * (1 - y), y0: 0.5 },
      { cx: (y) => 0.11 + 0.04 * Math.sin(t * 1.4 + 1.5) * (y - 0.55), w: (y) => 0.05 + 0.03 * (1 - y), y0: 0.5 },
    ];
  }
}
/** life state at time t: reach (how far down), thin (rope-out), fade, burst (touch-down dust) */
function lifeAt(l: Life | undefined, t: number) {
  if (!l) return { reach: 1, thin: 1, fade: 1, burst: 0 };
  const at = l.at ?? 0, d = l.descend ?? 0, reach = d ? EASE.inOut(clamp((t - at) / d)) : t >= at ? 1 : 0;
  const touch = at + d, burst = d ? clamp((t - touch) / 1.2) * (1 - clamp((t - touch - 1.2) / 2)) : 0;
  const thin = l.ropeOut !== undefined ? 1 - 0.85 * EASE.inOut(clamp((t - l.ropeOut) / 1.8)) : 1;
  const fade = (t < at ? 0 : 1) * (l.gone !== undefined ? 1 - clamp((t - l.gone) / 1) : 1);
  return { reach, thin, fade, burst };
}
export const Tornado: React.FC<{ shape: Shape; x: number; top: number; ground: number; size: number; t: number; id: string; life?: Life; fade?: number }> = ({ shape, x, top, ground, size, t, id, life, fade = 1 }) => {
  const L = lifeAt(life, t), fs = funnels(shape, t), h = ground - top;
  if (L.fade <= 0 || L.reach <= 0.001) return null;
  const wave = (y: number) => (1 - L.thin) * 0.16 * Math.sin(y * 7 + t * 2);
  const body = fs.map((f) => {
    const a = f.y0 ?? 0, b = Math.min(f.y1 ?? 1, L.reach), n = 48, Lp: string[] = [], Rp: string[] = [];
    if (b <= a) return "";
    for (let i = 0; i <= n; i++) {
      const y = a + ((b - a) * i) / n, tip = L.reach < 1 ? clamp((L.reach - y) / 0.12) : 1;
      const cx = x + (f.cx(y) + wave(y)) * size, w = f.w(y) * size * (0.25 + 0.75 * L.thin) * (0.3 + 0.7 * tip), py = top + y * h;
      Lp.push(`${(cx - w).toFixed(1)},${py.toFixed(1)}`); Rp.unshift(`${(cx + w).toFixed(1)},${py.toFixed(1)}`);
    }
    return `M${Lp.join(" L")} L${Rp.join(" L")} Z`;
  }).join(" ");
  const touched = L.reach > 0.97, bands = Array.from({ length: 7 }, (_, i) => top + h * (0.12 + i * 0.11 + 0.03 * hash(i + 40)));
  const debris = touched ? Array.from({ length: 46 }, (_, i) => {
    const r = hash(i), ang = t * (0.9 + r) * 2.2 + i * 1.7, rad = size * (0.12 + 0.32 * hash(i + 9)) * (0.4 + 0.6 * L.thin), yy = ground - h * (0.05 + 0.55 * hash(i + 3));
    return { x: x + Math.cos(ang) * rad, y: yy + Math.sin(ang) * rad * 0.18, rot: ang * 57, s: 3 + 5 * hash(i + 5), o: Math.sin(ang) > -0.3 ? 0.9 : 0.35 };
  }) : [];
  const dust = touched ? 0.6 + 0.4 * L.thin + L.burst * 0.8 : 0;
  return (
    <g opacity={fade * L.fade}>
      <defs>
        <clipPath id={`tc-${id}`}><path d={body} /></clipPath>
        <linearGradient id={`tg-${id}`} x1="0" x2="1"><stop offset="0" stopColor="#4a4e5c" /><stop offset="0.55" stopColor="#6d707b" /><stop offset="1" stopColor="#3f4350" /></linearGradient>
      </defs>
      <path d={body} fill={`url(#tg-${id})`} opacity={0.94} />
      <g clipPath={`url(#tc-${id})`}>
        {bands.map((y, i) => <line key={i} x1={x - size} x2={x + size} y1={y} y2={y + size * 0.012} stroke="#d9dce3" strokeOpacity={0.42} strokeWidth={size * 0.009}
          strokeLinecap="round" strokeDasharray={`${size * (0.22 + 0.12 * hash(i + 70))} ${size * 0.16}`} strokeDashoffset={-(t * size * 0.5 + i * 37)} />)}
      </g>
      {dust > 0 && Array.from({ length: 9 }, (_, i) => { const dx = (i - 4) * size * 0.07 * (1 + L.burst * 0.8), rr = size * (0.06 + 0.05 * hash(i + 21)) * (1 + 0.08 * Math.sin(t * 2 + i)) * dust;
        return <circle key={i} cx={x + dx + (fs[0].cx(1) + wave(1)) * size} cy={ground - rr * 0.35} r={rr} fill="#8a7a63" opacity={0.75} />; })}
      {debris.map((d, i) => <rect key={i} x={d.x} y={d.y} width={d.s} height={d.s * 0.45} fill="#2b2a2c" opacity={d.o} transform={`rotate(${d.rot} ${d.x} ${d.y})`} />)}
    </g>
  );
};

/* ---------- natural events (non-tornado) ---------- */
type EvProps = { evs: Ev[]; pw: (e: Ev) => number; W: number; H: number; gy: number; t: number; u: number };
const EventsBack: React.FC<EvProps> = ({ evs, pw, W, H, gy, t, u }) => <>{evs.map((e, i) => {
  const k = pw(e), x = W * (e.x ?? 0.5);
  if (k <= 0) return null;
  if (e.kind === "volcano") { const top = gy - 330 * u, plume = Array.from({ length: 16 }, (_, j) => { const age = ((t * 0.35 + j / 16) % 1), r = (40 + 160 * age) * u * k;
      return <circle key={j} cx={x + Math.sin(j * 2.3 + t) * 40 * u * age} cy={top - age * H * 0.55 * k} r={r} fill={j % 3 ? "#4b4440" : "#5d5450"} opacity={0.85 * (1 - age * 0.6)} />; });
    return <g key={i}>{plume}<polygon points={`${x - 360 * u},${gy} ${x - 60 * u},${top} ${x + 60 * u},${top} ${x + 360 * u},${gy}`} fill="#5b4d46" />
      {[0, 1, 2].map((j) => <path key={j} d={`M${x + (j - 1) * 30 * u},${top} q${(j - 1) * 40 * u},${120 * u} ${(j - 1) * 90 * u},${200 * u * k}`} stroke="#ff7a2e" strokeWidth={10 * u} fill="none" strokeLinecap="round" opacity={0.9} />)}
      <ellipse cx={x} cy={top} rx={70 * u} ry={18 * u} fill="#ffb347" opacity={0.6 + 0.3 * Math.sin(t * 6)} /></g>; }
  if (e.kind === "meteor") { const p = clamp((t - (e.at ?? 0)) / 1.6), hx = W * (0.95 - 0.7 * p), hy = H * (0.08 + 0.5 * p);
    return p < 1 ? <g key={i}><line x1={hx} y1={hy} x2={hx + 260 * u} y2={hy - 190 * u} stroke="#ffd59a" strokeWidth={8 * u} strokeLinecap="round" opacity={0.8} /><circle cx={hx} cy={hy} r={16 * u} fill="#fff4d6" /></g>
      : <rect key={i} width={W} height={H} fill="#fff3d6" opacity={Math.max(0, 0.7 - (t - (e.at ?? 0) - 1.6))} />; }
  return null;
})}</>;
const EventsFront: React.FC<EvProps> = ({ evs, pw, W, H, gy, t, u }) => <>{evs.map((e, i) => {
  const k = pw(e), x = W * (e.x ?? 0.5);
  if (k <= 0) return null;
  if (e.kind === "flood") { const lvl = gy + H * 0.25 - k * H * 0.32, pts = Array.from({ length: 41 }, (_, j) => `${(j / 40) * W},${lvl + Math.sin(j * 0.8 + t * 2.4) * 8 * u}`).join(" L");
    return <g key={i}><path d={`M${pts} L${W},${H} L0,${H} Z`} fill="#5d7f93" opacity={0.92} /><path d={`M${pts}`} stroke="#cfe0e8" strokeWidth={3 * u} fill="none" opacity={0.7} />
      {Array.from({ length: 7 }, (_, j) => <rect key={j} x={((hash(j) * W + t * 40 * u) % W)} y={lvl + (6 + 14 * hash(j + 3)) * u + Math.sin(t * 2 + j) * 4 * u} width={(24 + 30 * hash(j + 5)) * u} height={7 * u} rx={3 * u} fill="#6b5240" />)}</g>; }
  if (e.kind === "fire") return <g key={i}>{Array.from({ length: 18 }, (_, j) => { const fx = x + (j - 9) * 42 * u, fh = (60 + 90 * hash(j)) * u * k * (0.8 + 0.25 * Math.sin(t * 9 + j * 1.7));
      return <g key={j}><polygon points={`${fx - 24 * u},${gy + 6 * u} ${fx + Math.sin(t * 7 + j) * 10 * u},${gy - fh} ${fx + 24 * u},${gy + 6 * u}`} fill="#f07a2b" /><polygon points={`${fx - 12 * u},${gy + 6 * u} ${fx + Math.sin(t * 8 + j) * 6 * u},${gy - fh * 0.6} ${fx + 12 * u},${gy + 6 * u}`} fill="#ffd25a" /></g>; })}
    {Array.from({ length: 12 }, (_, j) => { const age = (t * 0.25 + j / 12) % 1; return <circle key={`s${j}`} cx={x + (hash(j + 30) - 0.5) * 520 * u + age * 90 * u + Math.sin(t + j) * 20 * u} cy={gy - 80 * u - age * H * 0.55} r={(50 + 150 * age) * u} fill="#4a403b" opacity={0.5 * k * (1 - age)} />; })}
    <rect width={W} height={H} fill="#ff8a3d" opacity={0.12 * k} /></g>;
  if (e.kind === "quake") { const cp = clamp(k * 1.2), pts = Array.from({ length: 9 }, (_, j) => `${x + (j - 4) * 90 * u * cp},${gy + H * 0.1 + (hash(j + 11) - 0.5) * 50 * u}`).join(" L");
    return <path key={i} d={`M${pts}`} stroke="#241d18" strokeWidth={10 * u * cp} fill="none" strokeLinejoin="round" />; }
  if (e.kind === "wave") { const p = EASE.inOut(clamp((t - (e.at ?? 0)) / (e.ramp ?? 3))), wx = -W * 0.4 + p * W * 1.5, top = gy - H * 0.42 * (e.power ?? 1);
    return <g key={i}><path d={`M${wx - W},${H} L${wx - W},${gy - 20 * u} Q${wx - W * 0.3},${gy - 40 * u} ${wx - W * 0.12},${top + 60 * u} Q${wx},${top - 40 * u} ${wx + 80 * u},${top + 40 * u} Q${wx + 30 * u},${top + 10 * u} ${wx},${top + 90 * u} Q${wx + 40 * u},${gy} ${wx + 160 * u},${H} Z`} fill="#3f6f8a" />
      <path d={`M${wx - W * 0.12},${top + 60 * u} Q${wx},${top - 40 * u} ${wx + 80 * u},${top + 40 * u}`} stroke="#e6f1f5" strokeWidth={10 * u} fill="none" strokeLinecap="round" /></g>; }
  if (e.kind === "snow" || e.kind === "hail") return <g key={i}>{Array.from({ length: 120 }, (_, j) => { const sp = e.kind === "hail" ? 900 : 120, x2 = (hash(j) * W + Math.sin(t + j) * 30 * u) % W, y2 = (hash(j + 4) * H + t * sp * u * (0.6 + 0.6 * hash(j + 9))) % H;
      return <circle key={j} cx={x2} cy={y2} r={(e.kind === "hail" ? 4 : 3 + 3 * hash(j + 2)) * u} fill={e.kind === "hail" ? "#e3ecf2" : "#ffffff"} opacity={0.85 * k} />; })}
    {e.kind === "snow" && <rect x={0} y={gy + H * 0.01} width={W} height={H} fill="#f2f4f6" opacity={0.75 * k} />}</g>;
  if (e.kind === "dust") return <g key={i}>{Array.from({ length: 10 }, (_, j) => <ellipse key={j} cx={((j / 10) * W * 1.4 + t * 160 * u) % (W * 1.4) - W * 0.2} cy={gy - (40 + 160 * hash(j)) * u} rx={(260 + 200 * hash(j + 3)) * u} ry={(90 + 80 * hash(j + 5)) * u} fill="#b48b5c" opacity={0.45 * k} />)}
    <rect width={W} height={H} fill="#c39a63" opacity={0.3 * k} /></g>;
  return null;
})}</>;

/* ---------- world parts ---------- */
const Clouds: React.FC<{ W: number; H: number; t: number; tone: string }> = ({ W, H, t, tone }) => {
  const r = W * 0.042, row = (y: number, off: number, fill: string, rim?: string) => Array.from({ length: Math.ceil(W / (r * 1.5)) + 3 }, (_, i) => {
    const cx = ((i * r * 1.5 + off + t * 6) % (W + r * 3)) - r * 1.5;
    return <circle key={i} cx={cx} cy={y + r * 0.12 * Math.sin(i * 1.9)} r={r} fill={fill} stroke={rim} strokeWidth={rim ? 2 : 0} strokeOpacity={0.6} />;
  });
  return <g><rect x={0} y={0} width={W} height={H * 0.05} fill="#2f3342" />{row(H * 0.02, r * 0.4, "#2f3342")}{row(H * 0.055, r * 0.9, "#3a3e4f", "#7d8398")}{row(H * 0.09, 0, tone, "#9aa0b4")}</g>;
};
const Silhouettes: React.FC<{ land: Land; W: number; H: number; gy: number; night: boolean; t: number }> = ({ land, W, H, gy, night, t }) => {
  const far = night ? "#20263b" : "#6f7564", u = H / 1080;
  if (land === "city") return <g>{Array.from({ length: 22 }, (_, i) => { const w = (50 + 60 * hash(i)) * u, h = (90 + 220 * hash(i + 4)) * u, x = (i / 22) * W + 20 * hash(i + 7);
    return <g key={i}><rect x={x} y={gy - h} width={w} height={h} fill={night ? "#1b2033" : "#5d6069"} />
      {Array.from({ length: Math.floor(h / (34 * u)) }, (_, j) => <rect key={j} x={x + w * 0.25} y={gy - h + 14 * u + j * 34 * u} width={w * 0.5} height={10 * u} fill={night ? "#f2c66b" : "#8a8d96"} opacity={hash(i * 9 + j) > 0.5 ? 0.9 : 0.25} />)}</g>; })}
    <rect x={W * 0.06} y={gy - 200 * u} width={8 * u} height={200 * u} fill="#4b4e58" /><ellipse cx={W * 0.06 + 4 * u} cy={gy - 205 * u} rx={44 * u} ry={30 * u} fill="#4b4e58" /></g>;
  if (land === "town") return <g>{Array.from({ length: 16 }, (_, i) => { const x = (i / 16) * W + 30 * hash(i), w = 70 * u, h = 55 * u;
    return <g key={i}><rect x={x} y={gy - h} width={w} height={h} fill="#161b2c" /><polygon points={`${x - 6 * u},${gy - h} ${x + w / 2},${gy - h - 34 * u} ${x + w + 6 * u},${gy - h}`} fill="#161b2c" />
      <rect x={x + w * 0.35} y={gy - h * 0.7} width={w * 0.3} height={h * 0.3} fill="#f2b85b" opacity={0.6 + 0.3 * Math.sin(t * 3 + i)} /></g>; })}
    <polygon points={`${W * 0.8},${gy} ${W * 0.8},${gy - 160 * u} ${W * 0.81},${gy - 230 * u} ${W * 0.82},${gy - 160 * u} ${W * 0.82},${gy}`} fill="#161b2c" /></g>;
  const mill = <g><rect x={W * 0.08} y={gy - 120 * u} width={5 * u} height={120 * u} fill={far} />{[0, 1, 2, 3].map((k) => <rect key={k} x={W * 0.08 - 22 * u} y={gy - 124 * u} width={46 * u} height={6 * u} fill={far} transform={`rotate(${k * 45 + t * 40} ${W * 0.08 + 2.5 * u} ${gy - 121 * u})`} />)}</g>;
  if (land === "coast") return <g><rect x={0} y={gy - 40 * u} width={W} height={40 * u} fill={night ? "#1c2a44" : "#4f7f99"} />
    {Array.from({ length: 30 }, (_, i) => <path key={i} d={`M${((i / 30) * W + t * 30 * u) % W},${gy - 22 * u} q${12 * u},${-8 * u} ${24 * u},0`} stroke="#dfe9ee" strokeOpacity={0.5} strokeWidth={2 * u} fill="none" />)}
    <rect x={W * 0.86} y={gy - 190 * u} width={30 * u} height={150 * u} fill="#e9e4da" /><rect x={W * 0.86} y={gy - 150 * u} width={30 * u} height={22 * u} fill="#c4473a" /><rect x={W * 0.857} y={gy - 205 * u} width={36 * u} height={18 * u} fill="#3a3f4e" />
    <circle cx={W * 0.875} cy={gy - 196 * u} r={60 * u} fill="#fff3c4" opacity={night ? 0.25 + 0.2 * Math.sin(t * 3) : 0} /></g>;
  if (land === "mountains") return <g>{[0, 1, 2].map((r) => <polygon key={r} fill={night ? ["#232a45", "#1d233a", "#181d30"][r] : ["#8a8f98", "#737985", "#5f6672"][r]}
      points={[`0,${gy}`, ...Array.from({ length: 9 }, (_, i) => `${(i / 8) * W},${gy - (120 + 260 * hash(i + r * 13)) * u * (1 - r * 0.25)}`), `${W},${gy}`].join(" ")} />)}
    {Array.from({ length: 9 }, (_, i) => { const hh = (j: number) => 120 + 260 * hash(j), h = hh(i), x = (i / 8) * W, top = gy - h * u;
      if (h < 230 || h < hh(i - 1) || h < hh(i + 1)) return null;
      const dl = (h - hh(i - 1)) * u, dr = (h - hh(i + 1)) * u, f = 0.22;
      return <polygon key={i} points={`${x - (W / 8) * f},${top + dl * f} ${x},${top} ${x + (W / 8) * f},${top + dr * f}`} fill="#f2f0ea" opacity={0.9} />; })}</g>;
  if (land === "desert") return <g>{[0, 1].map((r) => <path key={r} d={`M0,${gy} ${Array.from({ length: 6 }, (_, i) => `Q${(i + 0.5) * W / 6},${gy - (60 + 70 * hash(i + r * 7)) * u} ${(i + 1) * W / 6},${gy - 10 * u}`).join(" ")} L${W},${gy} Z`} fill={r ? "#c29a62" : "#d1ab72"} />)}
    <rect x={W * 0.3} y={gy - 40 * u} width={60 * u} height={40 * u} fill="#b88c5a" /><rect x={W * 0.3 + 20 * u} y={gy - 28 * u} width={16 * u} height={28 * u} fill="#6b4b33" /></g>;
  if (land === "forest") return <g>{Array.from({ length: 34 }, (_, i) => { const x = (i / 34) * W + 20 * hash(i), h = (70 + 110 * hash(i + 3)) * u;
    return <polygon key={i} points={`${x - h * 0.28},${gy} ${x},${gy - h} ${x + h * 0.28},${gy}`} fill={night ? "#18202e" : i % 2 ? "#3d5a3a" : "#4a6a44"} />; })}</g>;
  if (land === "farm") return <g>{mill}<rect x={W * 0.52} y={gy - 70 * u} width={110 * u} height={70 * u} fill="#9b4a3a" /><polygon points={`${W * 0.52 - 8 * u},${gy - 70 * u} ${W * 0.52 + 55 * u},${gy - 115 * u} ${W * 0.52 + 118 * u},${gy - 70 * u}`} fill="#7d3a2f" />
    <rect x={W * 0.52 - 40 * u} y={gy - 130 * u} width={30 * u} height={130 * u} rx={15 * u} fill="#8a8578" /><circle cx={W * 0.2} cy={gy - 40 * u} r={38 * u} fill={far} /><rect x={W * 0.2 - 4 * u} y={gy - 20 * u} width={8 * u} height={20 * u} fill={far} /></g>;
  return <g>{Array.from({ length: 40 }, (_, i) => <rect key={i} x={(i / 40) * W} y={gy - 26 * u} width={3 * u} height={26 * u} fill={far} />)}<rect x={0} y={gy - 20 * u} width={W} height={2.5 * u} fill={far} />{mill}</g>;
};
/** observer seen from behind; arms pose smoothly from idle to `pose` starting at `poseAt` */
const Observer: React.FC<{ x: number; gy: number; u: number; t: number; coat?: string; pose?: Pose; poseAt?: number }> = ({ x, gy, u, t, coat = "#e6b33c", pose = "idle", poseAt = 0 }) => {
  const b = 1 + 0.008 * Math.sin(t * 2.2), k = EASE.inOut(clamp((t - poseAt) / 0.5));
  const ARMS: Record<Pose, [number, number]> = { idle: [0, 0], shade: [0, 140], point: [0, -100], camera: [-145, 145], binoculars: [-150, 150] };
  const [la, ra] = ARMS[pose].map((a) => a * k);
  return <g transform={`translate(${x} ${gy}) scale(${u} ${u * b})`}>
    <ellipse cx={0} cy={2} rx={46} ry={8} fill="#000" opacity={0.18} />
    <rect x={-22} y={-98} width={19} height={92} fill="#3d5a8a" /><rect x={3} y={-98} width={19} height={92} fill="#36527e" />
    <rect x={-26} y={-10} width={24} height={12} rx={5} fill="#5b3b28" /><rect x={2} y={-10} width={24} height={12} rx={5} fill="#5b3b28" />
    <path d="M-44,-100 Q-46,-200 -28,-222 L28,-222 Q46,-200 44,-100 Z" fill={coat} />
    <g transform={`rotate(${la} -47 -206)`}><rect x={-56} y={-212} width={18} height={92} rx={9} fill={coat} /><circle cx={-47} cy={-122} r={9} fill="#d9a780" /></g>
    <g transform={`rotate(${ra} 47 -206)`}><rect x={38} y={-212} width={18} height={92} rx={9} fill={coat} /><circle cx={47} cy={-122} r={9} fill="#d9a780" /></g>
    <rect x={-30} y={-206} width={60} height={76} rx={14} fill="#2f8a86" /><rect x={-20} y={-180} width={40} height={4} rx={2} fill="#9ed6cf" />
    <circle cx={0} cy={-246} r={26} fill="#4a2f22" /><path d="M-28,-252 Q0,-292 28,-252 Z" fill="#c4543a" /><rect x={-30} y={-256} width={60} height={8} rx={4} fill="#a8432d" />
    {(pose === "camera" || pose === "binoculars") && k > 0.6 && <rect x={-26} y={-262} width={52} height={20} rx={5} fill="#2a2a2e" opacity={(k - 0.6) / 0.4} />}
  </g>;
};
const Birds: React.FC<{ W: number; H: number; t: number; at: number; u: number }> = ({ W, H, t, at, u }) => {
  const p = (t - at) / 5; if (p < 0 || p > 1) return null;
  return <g>{Array.from({ length: 9 }, (_, i) => { const x = -0.1 * W + p * W * 1.25 - (i % 3) * 40 * u - Math.floor(i / 3) * 70 * u, y = H * (0.3 + 0.03 * Math.sin(i * 2.1)) + (i % 3) * 24 * u, f = Math.sin(t * 14 + i) * 8 * u;
    return <path key={i} d={`M${x - 14 * u},${y - f} Q${x - 6 * u},${y - 4 * u} ${x},${y} Q${x + 6 * u},${y - 4 * u} ${x + 14 * u},${y - f}`} stroke="#22252e" strokeWidth={3 * u} fill="none" strokeLinecap="round" />; })}</g>;
};
const Annotations: React.FC<{ notes: Note[]; t: number; W: number; H: number }> = ({ notes, t, W, H }) => <>{notes.map((n, i) => {
  const k = fadeIn(t, n.t, 0.6), x = n.x * W, y = n.y * H;
  if (k <= 0) return null;
  if (n.kind === "measure") { const w = (n.w ?? 0.3) * W * k;
    return <div key={i} style={{ position: "absolute", left: x - w / 2, top: y, width: w, height: H * 0.02, borderLeft: "2px solid #fff", borderRight: "2px solid #fff", borderTop: "2px solid #fff", opacity: 0.9 }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: -H * 0.045, textAlign: "center", fontFamily: MONT, fontWeight: 700, fontSize: H * 0.02, color: "#fff", letterSpacing: "0.12em", whiteSpace: "nowrap", opacity: k, textShadow: "0 1px 6px rgba(0,0,0,.7)" }}>{n.text}</div></div>; }
  if (n.kind === "dot") return <div key={i} style={{ position: "absolute", left: x - H * 0.014, top: y - H * 0.014, width: H * 0.028, height: H * 0.028, borderRadius: "50%", border: `3px solid ${GOLD}`, transform: `scale(${0.6 + 0.4 * k + 0.08 * Math.sin(t * 5 + i)})`, boxShadow: `0 0 18px ${GOLD}` }}>
    {n.text && <div style={{ position: "absolute", left: H * 0.04, top: -H * 0.004, fontFamily: MONT, fontWeight: 700, fontSize: H * 0.016, color: "#fff", whiteSpace: "nowrap", letterSpacing: "0.1em", opacity: k, textShadow: "0 1px 6px rgba(0,0,0,.7)" }}>{n.text}</div>}</div>;
  return <div key={i} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, ${(1 - k) * 10}px)`, opacity: k, textAlign: "center", fontFamily: MONT, color: "#fff" }}>
    <div style={{ fontWeight: 800, fontSize: H * 0.03, letterSpacing: "0.14em", textShadow: "0 2px 8px rgba(0,0,0,.35)" }}>{n.text}</div>
    <div style={{ margin: `${H * 0.006}px auto 0`, width: H * 0.08 * k, height: 2, background: GOLD }} /></div>;
})}</>;
const Pin: React.FC<{ place: [string, string]; W: number; H: number; k: number }> = ({ place, W, H, k }) => (
  <div style={{ position: "absolute", left: W * 0.045, top: H * 0.045, opacity: k, transform: `translateY(${(1 - k) * -12}px)`, fontFamily: MONT, color: "#fff" }}>
    <div style={{ display: "flex", alignItems: "center", gap: H * 0.012 }}>
      <svg width={H * 0.028} height={H * 0.036} viewBox="0 0 20 26"><path d="M10 0C4.5 0 0 4.4 0 9.8 0 17 10 26 10 26s10-9 10-16.2C20 4.4 15.5 0 10 0z" fill={GOLD} /><circle cx="10" cy="9.6" r="3.6" fill={INK} /></svg>
      <span style={{ fontWeight: 800, fontSize: H * 0.03, letterSpacing: "0.02em" }}>{place[0]}</span></div>
    <div style={{ fontWeight: 500, fontSize: H * 0.014, letterSpacing: "0.16em", marginLeft: H * 0.04, opacity: 0.85 }}>{place[1]}</div>
  </div>
);
const Tag: React.FC<{ tag: [string, string]; W: number; H: number; k: number }> = ({ tag, W, H, k }) => (
  <div style={{ position: "absolute", left: W * 0.045, bottom: H * 0.07, opacity: k, fontFamily: MONT, color: "#fff", borderLeft: `${H * 0.003}px solid ${GOLD}`, paddingLeft: H * 0.012,
    background: "linear-gradient(90deg, rgba(20,22,30,.55), rgba(20,22,30,0))", paddingRight: H * 0.06 }}>
    <div style={{ fontWeight: 800, fontSize: H * 0.032 }}>{tag[0]}</div><div style={{ fontWeight: 500, fontSize: H * 0.013, letterSpacing: "0.2em", opacity: 0.8 }}>{tag[1]}</div>
  </div>
);

export type WorldSpec = { sky?: Sky; land?: Land; tornado?: Twister; tornadoes?: Twister[]; rain?: boolean; lightning?: number[]; birds?: number; observer?: SceneShot["observer"]; events?: Ev[] };
/** the landscape itself (no camera, no overlays); used full-frame and inside polaroids, panels and viewfinders */
export const Land2D: React.FC<{ spec: WorldSpec; t: number; idKey: string; w?: number; h?: number; figures?: boolean }> = ({ spec, t, idKey, w, h, figures = true }) => {
  const cfg = useBox(), W = w ?? cfg.width, H = h ?? cfg.height, u = H / 1080, sky = spec.sky ?? "dusk", c = SKY[sky], gy = H * 0.74, night = sky === "night";
  const tws = [...(spec.tornado ? [spec.tornado] : []), ...(spec.tornadoes ?? [])];
  const flash = (spec.lightning ?? []).reduce((a, at) => Math.max(a, t >= at && t < at + 0.35 ? 1 - (t - at) / 0.35 : 0), 0), o = spec.observer;
  const evs = spec.events ?? [], pw = (e: Ev) => (e.power ?? 1) * EASE.inOut(clamp((t - (e.at ?? 0)) / (e.ramp ?? 2)));
  const quake = evs.filter((e) => e.kind === "quake").reduce((a, e) => Math.max(a, pw(e)), 0), sh = quake * 14 * u;
  const shake = quake > 0 ? `translate(${(Math.sin(t * 47) * sh).toFixed(1)} ${(Math.sin(t * 61 + 1) * sh * 0.6).toFixed(1)})` : undefined;
  const gc = night ? ["#1a2030", "#151a28", "#11151f", "#2a3346"] : GROUND[spec.land ?? "plains"] ?? GROUND.plains;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`sky-${idKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c[0]} /><stop offset="0.55" stopColor={c[1]} /><stop offset="1" stopColor={c[2]} /></linearGradient>
        <radialGradient id={`sun-${idKey}`}><stop offset="0" stopColor={c[3]} stopOpacity={0.95} /><stop offset="1" stopColor={c[3]} stopOpacity={0} /></radialGradient>
        <filter id={`grain-${idKey}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" /><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.07 0" /></filter>
      </defs>
      <rect width={W} height={H} fill={`url(#sky-${idKey})`} />
      {!night && <circle cx={W * 0.12} cy={gy - H * 0.05} r={H * 0.32} fill={`url(#sun-${idKey})`} />}
      {flash > 0 && <rect width={W} height={H} fill="#dfe6ff" opacity={flash * 0.35} />}
      {(spec.lightning ?? []).map((at, i) => t >= at && t < at + 0.3 && <polyline key={i} fill="none" stroke="#f4f6ff" strokeWidth={4 * u} points={Array.from({ length: 8 }, (_, j) => `${W * (0.15 + 0.6 * hash(i + 2)) + (hash(i * 7 + j) - 0.5) * 90 * u},${H * 0.08 + j * gy * 0.11}`).join(" ")} />)}
      <g transform={shake}>
      {tws.map((tw, i) => <Tornado key={i} shape={tw.shape} x={W * (tw.x ?? 0.55)} top={H * 0.1} ground={gy + H * 0.01} size={H * (tw.scale ?? 0.9)} t={t} id={`${idKey}-${i}`} life={tw.life} />)}
      <Silhouettes land={spec.land ?? "plains"} W={W} H={H} gy={gy} night={night} t={t} />
      <EventsBack evs={evs} pw={pw} W={W} H={H} gy={gy} t={t} u={u} />
      <rect x={0} y={gy} width={W} height={H - gy} fill={gc[0]} />
      <rect x={0} y={gy + H * 0.07} width={W} height={H} fill={gc[1]} />
      <rect x={0} y={gy + H * 0.16} width={W} height={H} fill={gc[2]} />
      {Array.from({ length: 34 }, (_, i) => { const x = hash(i + 50) * W, y = gy + H * (0.03 + 0.24 * hash(i + 60)), k = 0.6 + y / H, sw = Math.sin(t * 2.4 + i) * 5 * u;
        return <path key={i} d={`M${x},${y} l${-6 * k * u + sw},${-18 * k * u} M${x},${y} l${sw},${-24 * k * u} M${x},${y} l${7 * k * u + sw},${-16 * k * u}`} stroke={gc[3]} strokeWidth={2.4 * u} strokeLinecap="round" />; })}
      <EventsFront evs={evs} pw={pw} W={W} H={H} gy={gy} t={t} u={u} />
      </g>
      {spec.birds !== undefined && <Birds W={W} H={H} t={t} at={spec.birds} u={u} />}
      {!CALM.includes(sky) || tws.length > 0 || spec.rain ? <Clouds W={W} H={H} t={t} tone={night ? "#1f2438" : sky === "smoke" ? "#4a3a34" : "#4a4e60"} /> : null}
      {spec.rain && Array.from({ length: 90 }, (_, i) => { const x = ((hash(i) * W + t * 260 * u) % W), y = ((hash(i + 3) * H + t * 1400 * u * (0.8 + hash(i + 8) * 0.4)) % H);
        return <line key={i} x1={x} y1={y} x2={x - 8 * u} y2={y + 34 * u} stroke="#c8d0e8" strokeOpacity={0.35} strokeWidth={1.6 * u} />; })}
      {figures && o && <Observer x={W * (o.x ?? 0.8)} gy={H * 0.98} u={u * 1.55} t={t} pose={o.pose} poseAt={o.poseAt} coat={o.coat} />}
      {figures && o?.friend && <Observer x={W * (o.x ?? 0.8) + 230 * u} gy={H * 0.98} u={u * 1.45} t={t + 1} coat="#5b7fb0" pose={o.friendPose} poseAt={o.poseAt} />}
      <rect width={W} height={H} filter={`url(#grain-${idKey})`} />
    </svg>
  );
};

const Scene: React.FC<{ shot: SceneShot; t: number; idKey: string }> = ({ shot, t, idKey }) => {
  const { width: W, height: H } = useBox(), c = shot.counter;
  const cv = c ? Math.round(c.value * EASE.out(clamp((t - c.t) / 1.4))) : 0;
  return <AbsoluteFill>
    <CamWrap cam={shot.cam} t={t} dur={shot.dur} push={shot.push}><Land2D spec={shot} t={t} idKey={idKey} />{shot.notes && <Annotations notes={shot.notes} t={t} W={W} H={H} />}</CamWrap>
    {shot.place && <Pin place={shot.place} W={W} H={H} k={fadeIn(t, 0.4, 0.6) * (1 - clamp((t - (shot.dur - 0.6)) / 0.5))} />}
    {shot.observer?.tag && <Tag tag={shot.observer.tag} W={W} H={H} k={fadeIn(t, 0.8, 0.6) * (1 - clamp((t - 3.5) / 0.6))} />}
    {c && t >= c.t && <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.14, textAlign: "center", fontFamily: MONT, color: "#fff", opacity: fadeIn(t, c.t, 0.4) }}>
      <div style={{ fontWeight: 800, fontSize: H * 0.075, lineHeight: 1, textShadow: "0 4px 14px rgba(0,0,0,.4)" }}>{cv.toLocaleString("en-US")}</div>
      <div style={{ fontWeight: 600, fontSize: H * 0.016, letterSpacing: "0.3em", marginTop: H * 0.01 }}>{c.label}</div></div>}
  </AbsoluteFill>;
};

/* ---------- field notebook ---------- */
const sketchPath = (shape: Shape, x: number, y: number, w: number, h: number) => {
  const f = funnels(shape, 0)[0], n = 24, L: string[] = [], R: string[] = [];
  for (let i = 0; i <= n; i++) { const yy = i / n, cx = x + w / 2 + f.cx(yy) * w * 0.9, ww = f.w(yy) * w * 0.9, py = y + yy * h; L.push(`${(cx - ww).toFixed(1)},${py.toFixed(1)}`); R.unshift(`${(cx + ww).toFixed(1)},${py.toFixed(1)}`); }
  return `M${L.join(" L")} L${R.join(" L")}`;
};
const Notebook: React.FC<{ shot: NotebookShot; t: number; idKey: string }> = ({ shot, t, idKey }) => {
  const { width: W, height: H } = useBox(), pw = Math.min(W * (W < H ? 0.46 : 0.36), H * 0.5), ph = Math.min(H * 0.74, pw * 1.5), x0 = W * 0.5 - pw, y0 = (H - ph) * 0.45;
  const grid = `repeating-linear-gradient(0deg, transparent 0 ${H * 0.024 - 1}px, rgba(120,140,160,.18) ${H * 0.024 - 1}px ${H * 0.024}px), repeating-linear-gradient(90deg, transparent 0 ${H * 0.024 - 1}px, rgba(120,140,160,.18) ${H * 0.024 - 1}px ${H * 0.024}px)`;
  const page: React.CSSProperties = { position: "absolute", top: y0, width: pw, height: ph, background: `${grid}, ${PAPER}`, boxShadow: "0 30px 60px rgba(0,0,0,.35)", borderRadius: H * 0.008 };
  const slotXY = (s: number) => ({ x: (s < 3 ? x0 : W * 0.5) + pw * 0.08, y: y0 + ph * (0.17 + (s % 3) * 0.27), w: pw * 0.84, h: ph * 0.22 });
  const sk = shot.sketch, skP = sk ? clamp((t - 0.8) / 1.6) : 0, skB = sk ? slotXY(sk.slot) : null;
  const skLabelN = sk?.label ? Math.floor(clamp((t - 2.5) / (sk.label.length * 0.07)) * sk.label.length) : 0;
  const writeN = shot.write ? Math.floor(clamp((t - 1.2) / Math.max(1.2, shot.write.length * 0.07)) * shot.write.length) : 0;
  const ph2 = shot.photo, pk = EASE.out(clamp((t - 0.9) / 0.5));
  let hand: { x: number; y: number } | null = null, handText = "";
  if (sk && skB && t < 2.5) { const a = skP * Math.PI * 2; hand = { x: skB.x + skB.w * 0.3 + Math.cos(a * 2) * skB.w * 0.08, y: skB.y + skB.h * (0.15 + 0.6 * skP) }; }
  else if (sk?.label && skB && skLabelN < sk.label.length + 1) { hand = { x: skB.x + skB.w * 0.45 + skLabelN * H * 0.017, y: skB.y + skB.h * 0.55 }; }
  else if (shot.write) { handText = shot.write.slice(0, writeN); hand = { x: W * 0.5 + pw * 0.12 + handText.length * H * 0.017, y: y0 + ph * 0.79 }; }
  return (
    <AbsoluteFill style={{ background: "radial-gradient(120% 90% at 30% 20%, #2d3b5e, #18213a)", fontFamily: HAND }}>
      <CamWrap cam={shot.cam} t={t} dur={shot.dur} push={0.05}>
        <div style={{ ...page, left: x0 }}>
          <div style={{ position: "absolute", left: pw * 0.08, top: ph * 0.05, fontFamily: MONT, fontWeight: 500, fontSize: H * 0.026, color: "#4b4f5c", letterSpacing: "0.04em" }}>{shot.title}</div>
          <div style={{ position: "absolute", left: pw * 0.08, top: ph * 0.105, width: pw * 0.12, height: H * 0.003, background: "#3f9a8f" }} />
        </div>
        <div style={{ ...page, left: W * 0.5 }}>
          {TAB.map((c, i) => <div key={i} style={{ position: "absolute", right: -H * 0.03, top: ph * (0.1 + i * 0.12), width: H * 0.03, height: H * 0.05, background: c, borderRadius: `0 ${H * 0.008}px ${H * 0.008}px 0`, color: "#fff", fontFamily: MONT, fontWeight: 700, fontSize: H * 0.016, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>)}
        </div>
        {shot.entries.slice(0, 6).map((e, i) => { const b = slotXY(i), checked = shot.checks?.includes(i) && t > 1 + i * 0.3;
          return <div key={i} style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, border: `${H * 0.002}px dashed rgba(90,95,110,.45)`, borderRadius: H * 0.008, opacity: clamp((t - 0.3 - i * 0.12) / 0.4) }}>
            <div style={{ position: "absolute", left: -H * 0.018, top: -H * 0.018, width: H * 0.036, height: H * 0.036, borderRadius: "50%", background: TAB[i % 6], color: "#fff", fontFamily: MONT, fontWeight: 700, fontSize: H * 0.017, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
            <div style={{ position: "absolute", left: H * 0.03, bottom: H * 0.01, fontSize: H * 0.024, color: "#4b4f5c", display: "flex", alignItems: "center", gap: H * 0.008 }}>
              {sk?.slot === i ? null : <>{shot.checks && <span style={{ display: "inline-flex", width: H * 0.02, height: H * 0.02, border: "2px solid #4b4f5c", alignItems: "center", justifyContent: "center", color: "#3f9a8f", fontSize: H * 0.022 }}>{checked ? "✓" : ""}</span>}{e}</>}</div></div>; })}
        {sk && skB && <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={W} height={H}>
          <path d={sketchPath(sk.shape, skB.x + skB.w * 0.22, skB.y + skB.h * 0.12, skB.w * 0.3, skB.h * 0.7)} fill="none" stroke="#3a3f4e" strokeWidth={H * 0.0025} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - skP} />
          {[0.3, 0.5, 0.7].map((yy, i) => <line key={i} x1={skB.x + skB.w * 0.3} x2={skB.x + skB.w * 0.42} y1={skB.y + skB.h * yy} y2={skB.y + skB.h * yy} stroke="#3a3f4e" strokeWidth={H * 0.0018} opacity={clamp(skP * 3 - 2)} />)}
        </svg>}
        {sk?.label && skB && <div style={{ position: "absolute", left: skB.x + skB.w * 0.45, top: skB.y + skB.h * 0.38, fontSize: H * 0.034, color: "#2a3040" }}>{sk.label.slice(0, skLabelN)}</div>}
        {ph2 && <div style={{ position: "absolute", left: slotXY(ph2.slot ?? 1).x + pw * 0.22, top: slotXY(ph2.slot ?? 1).y - ph * 0.05, width: pw * 0.42, padding: H * 0.012, paddingBottom: H * 0.05, background: "#fbf8f1",
          boxShadow: "0 12px 24px rgba(0,0,0,.25)", transform: `rotate(-3deg) scale(${0.8 + 0.2 * pk})`, opacity: pk }}>
          <div style={{ position: "relative", width: "100%", height: pw * 0.25, overflow: "hidden" }}><Land2D spec={worldOf(ph2.shape, ph2.world)} t={t} idKey={`${idKey}-p`} w={400} h={240} figures={false} /></div>
          <div style={{ position: "absolute", bottom: H * 0.012, left: 0, right: 0, textAlign: "center", fontSize: H * 0.022, color: "#2a2620" }}>{ph2.caption}</div>
          {[-1, 1].map((d) => <div key={d} style={{ position: "absolute", top: -H * 0.012, [d < 0 ? "left" : "right"]: -H * 0.01, width: H * 0.06, height: H * 0.022, background: "rgba(120,200,190,.7)", transform: `rotate(${d * 30}deg)` } as React.CSSProperties} />)}
        </div>}
        {shot.write && <div style={{ position: "absolute", left: W * 0.5 + pw * 0.12, top: y0 + ph * 0.79 - H * 0.04, fontSize: H * 0.034, color: "#2a3040" }}>{handText || (writeN >= (shot.write?.length ?? 0) ? shot.write : "")}</div>}
        {hand && <Hand x={hand.x} y={hand.y} H={H} t={t} />}
        <div style={{ position: "absolute", left: W * 0.5 - H * 0.006, top: y0 - H * 0.01, width: H * 0.012, height: ph + H * 0.07, background: "#b8443a", borderRadius: H * 0.004 }} />
      </CamWrap>
    </AbsoluteFill>
  );
};
const Hand: React.FC<{ x: number; y: number; H: number; t: number }> = ({ x, y, H, t }) => (
  <svg style={{ position: "absolute", left: x - H * 0.02, top: y - H * 0.02 + Math.sin(t * 18) * H * 0.003, overflow: "visible" }} width={H * 0.3} height={H * 0.3} viewBox="0 0 300 300">
    <rect x={10} y={-30} width={14} height={120} rx={4} fill="#e2b04a" transform="rotate(-35 17 30)" /><polygon points="4,0 18,0 11,-16" fill="#3a3330" transform="rotate(-35 17 30)" />
    <rect x={60} y={60} width={300} height={74} rx={30} fill="#e6b33c" transform="rotate(32 60 60)" /><ellipse cx={52} cy={62} rx={34} ry={26} fill="#f2c9a5" /><ellipse cx={30} cy={44} rx={12} ry={9} fill="#f2c9a5" />
  </svg>
);

/* ---------- inserts ---------- */
const Viewfinder: React.FC<{ shot: ViewfinderShot; t: number; idKey: string }> = ({ shot, t, idKey }) => {
  const { width: W, height: H } = useBox(), fw = W * 0.78, fh = H * 0.74, fa = shot.flashAt ?? shot.dur - 0.3, fl = t >= fa ? 1 - clamp((t - fa) / 0.5) : 0, z = 1 + 0.1 * EASE.inOut(clamp(t / shot.dur));
  return <AbsoluteFill style={{ background: "#0b0c0f", alignItems: "center", justifyContent: "center" }}>
    <div style={{ position: "relative", width: fw, height: fh, borderRadius: H * 0.04, overflow: "hidden", boxShadow: "0 0 0 3px #222, 0 0 60px rgba(0,0,0,.8) inset" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${z})` }}><Land2D spec={{ ...shot, observer: undefined }} t={t} idKey={idKey} w={fw} h={fh} /></div>
      {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b], i) => <div key={i} style={{ position: "absolute", [a ? "right" : "left"]: H * 0.03, [b ? "bottom" : "top"]: H * 0.03, width: H * 0.05, height: H * 0.05, borderColor: "rgba(255,255,255,.7)", borderStyle: "solid", borderWidth: `${b ? 0 : 3}px ${a ? 3 : 0}px ${b ? 3 : 0}px ${a ? 0 : 3}px` } as React.CSSProperties} />)}
      <div style={{ position: "absolute", left: "50%", top: "50%", width: H * 0.06, height: H * 0.06, marginLeft: -H * 0.03, marginTop: -H * 0.03, border: "2px solid rgba(255,255,255,.5)", borderRadius: "50%" }} />
      <div style={{ position: "absolute", bottom: H * 0.03, left: 0, right: 0, display: "flex", justifyContent: "center", gap: H * 0.018 }}>{[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ width: H * 0.01, height: H * 0.01, borderRadius: "50%", background: i === 2 ? "#7be07b" : "rgba(255,255,255,.5)" }} />)}</div>
      <div style={{ position: "absolute", top: H * 0.035, right: H * 0.06, display: "flex", alignItems: "center", gap: H * 0.008, fontFamily: MONT, fontWeight: 700, fontSize: H * 0.016, color: "#fff" }}>
        <div style={{ width: H * 0.014, height: H * 0.014, borderRadius: "50%", background: "#e5483c", opacity: Math.sin(t * 6) > 0 ? 1 : 0.3 }} />REC</div>
    </div>
    {fl > 0 && <AbsoluteFill style={{ background: "#fff", opacity: fl }} />}
  </AbsoluteFill>;
};
const Polaroid: React.FC<{ shot: PolaroidShot; t: number; idKey: string }> = ({ shot, t, idKey }) => {
  const { width: W, height: H } = useBox(), dev = clamp((t - 0.1) / 1.4), cap = Math.floor(clamp((t - 1.2) / (shot.caption.length * 0.07)) * shot.caption.length);
  const out = EASE.in(clamp((t - (shot.dur - 0.7)) / 0.7)), pw = Math.min(H * 0.62, W * 0.8);
  return <AbsoluteFill>
    <div style={{ position: "absolute", inset: 0, filter: "blur(5px) brightness(.6)" }}><Land2D spec={worldOf(shot.shape, shot.world, shot.sky, shot.land)} t={t} idKey={`${idKey}-bg`} figures={false} /></div>
    <div style={{ position: "absolute", left: W / 2 - pw / 2, top: H * 0.12, width: pw, padding: H * 0.02, paddingBottom: H * 0.1, background: "#fbf8f1", boxShadow: "0 30px 60px rgba(0,0,0,.45)",
      transform: `translate(${out * W * 0.7}px, ${out * -H * 0.1}px) rotate(${-3 + out * 25}deg) scale(${0.92 + 0.08 * EASE.out(clamp(t / 0.5))})` }}>
      <div style={{ position: "relative", width: "100%", height: pw * 0.75, overflow: "hidden", background: "#eee" }}>
        <div style={{ opacity: dev, filter: `saturate(${dev}) brightness(${1.6 - 0.6 * dev})` }}><Land2D spec={worldOf(shot.shape, shot.world, shot.sky, shot.land)} t={t} idKey={`${idKey}-ph`} w={pw * 0.94} h={pw * 0.75} figures={false} /></div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: H * 0.03, textAlign: "center", fontFamily: HAND, fontSize: H * 0.04, color: "#2a2620" }}>{shot.caption.slice(0, cap)}</div>
    </div>
  </AbsoluteFill>;
};
const Card: React.FC<{ shot: CardShot; t: number; idKey: string }> = ({ shot, t, idKey }) => {
  const { height: H } = useBox(), k = fadeIn(t, 0.2, 0.6);
  return <AbsoluteFill>
    <div style={{ position: "absolute", inset: 0, filter: "blur(6px) brightness(.7)" }}><Land2D spec={shot} t={t} idKey={idKey} figures={false} /></div>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: PAPER, padding: `${H * 0.03}px ${H * 0.06}px`, borderRadius: H * 0.006, boxShadow: "0 20px 40px rgba(0,0,0,.35)", textAlign: "center", fontFamily: MONT, transform: `translateY(${(1 - k) * 30}px) rotate(${-1 + k}deg)`, opacity: k }}>
        {shot.kicker && <div style={{ fontWeight: 500, fontSize: H * 0.014, letterSpacing: "0.25em", color: "#7a6f5e", marginBottom: H * 0.008 }}>{shot.kicker}</div>}
        <div style={{ fontWeight: 800, fontSize: H * 0.04, color: INK, letterSpacing: "0.02em" }}>{shot.title}</div>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>;
};
const BigNumber: React.FC<{ shot: NumberShot; t: number; idKey: string }> = ({ shot, t, idKey }) => {
  const { width: W, height: H } = useBox(), k = fadeIn(t, 0.15, 0.5), num = parseFloat(shot.value.replace(/[^0-9.]/g, "")), suffix = shot.value.replace(/^[0-9.,]+/, "");
  const shown = isNaN(num) ? shot.value : `${Math.round(num * EASE.out(clamp(t / 1.1))).toLocaleString("en-US")}${suffix}`;
  return <AbsoluteFill style={{ background: "radial-gradient(90% 80% at 50% 40%, #3a3f4c, #1d2029)", alignItems: "center", justifyContent: "center", fontFamily: MONT, color: PAPER }}>
    {shot.tornado && <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.35 }}><Tornado shape={shot.tornado} x={W * 0.5} top={H * 0.05} ground={H * 0.95} size={H * 0.9} t={t} id={idKey} /></svg>}
    <div style={{ fontWeight: 800, fontSize: H * 0.16, opacity: k, transform: `scale(${0.9 + 0.1 * k})`, lineHeight: 1 }}>{shown}</div>
    <div style={{ fontWeight: 500, fontSize: H * 0.02, letterSpacing: "0.3em", marginTop: H * 0.02, opacity: k * 0.85 }}>{shot.label}</div>
  </AbsoluteFill>;
};
const Dark: React.FC<{ children: React.ReactNode; title?: string; t: number }> = ({ children, title, t }) => {
  const { height: H } = useBox();
  return <AbsoluteFill style={{ background: "radial-gradient(100% 90% at 50% 30%, #283150, #141a2c)", fontFamily: MONT, color: PAPER }}>
    {title && <div style={{ position: "absolute", top: H * 0.12, left: 0, right: 0, textAlign: "center", fontWeight: 600, fontSize: H * 0.022, letterSpacing: "0.3em", opacity: fadeIn(t, 0.1) }}>{title}</div>}
    {children}</AbsoluteFill>;
};
const Scale: React.FC<{ shot: ScaleShot; t: number }> = ({ shot, t }) => {
  const { width: W, height: H } = useBox(), n = shot.items.length, cw = Math.min(W * 0.12, (W * 0.8) / n), hk = fadeIn(t, 0.6 + n * 0.12, 0.5);
  return <Dark title={shot.title} t={t}><div style={{ position: "absolute", top: H * 0.42, left: W / 2 - (n * cw * 1.1) / 2, display: "flex", gap: cw * 0.1 }}>
    {shot.items.map((it, i) => { const k = fadeIn(t, 0.3 + i * 0.12, 0.4), on = i === shot.highlight;
      return <div key={i} style={{ width: cw, textAlign: "center", opacity: k * (on || hk < 1 ? 1 : 0.45 + 0.55 * (1 - hk)), transform: `translateY(${(1 - k) * 20}px) scale(${on ? 1 + 0.18 * hk : 1})` }}>
        {on && <div style={{ width: 0, height: 0, margin: `0 auto ${H * 0.01}px`, borderLeft: `${H * 0.012}px solid transparent`, borderRight: `${H * 0.012}px solid transparent`, borderTop: `${H * 0.016}px solid ${PAPER}`, opacity: hk }} />}
        <div style={{ background: EF[i % EF.length], borderRadius: H * 0.012, padding: `${H * 0.016}px 0`, fontWeight: 800, fontSize: H * 0.03, color: INK, boxShadow: on ? `0 0 ${30 * hk}px ${EF[i % EF.length]}` : "none" }}>{it}</div>
        {shot.notes?.[i] && <div style={{ fontWeight: 500, fontSize: H * 0.014, marginTop: H * 0.012, opacity: 0.8, letterSpacing: "0.05em" }}>{shot.notes[i]}</div>}</div>; })}
  </div></Dark>;
};
const Waffle: React.FC<{ shot: WaffleShot; t: number }> = ({ shot, t }) => {
  const { width: W, height: H } = useBox(), s = H * 0.04, g = s * 0.22, x0 = W * 0.28, y0 = H * 0.25, red = fadeIn(t, 1.8, 0.8), shown = Math.floor(clamp((t - 0.3) / 1.4) * 100);
  return <Dark title={shot.title} t={t}>
    {Array.from({ length: 100 }, (_, i) => { const c = i % 10, r = Math.floor(i / 10), on = i < shown, hot = i >= 100 - shot.value;
      return <div key={i} style={{ position: "absolute", left: x0 + c * (s + g), top: y0 + r * (s + g), width: s, height: s, borderRadius: s * 0.15, background: hot && red > 0 ? `rgba(196,74,58,${0.25 + 0.75 * red})` : "#efe6cf", opacity: on ? 1 : 0.06, transform: `scale(${on ? 1 : 0.6})` }} />; })}
    <div style={{ position: "absolute", left: x0 + 10 * (s + g) + W * 0.05, top: y0 + 3.5 * (s + g), opacity: red }}>
      <div style={{ fontWeight: 800, fontSize: H * 0.1, lineHeight: 1 }}>{Math.round(shot.value * red)}%</div>
      <div style={{ fontWeight: 500, fontSize: H * 0.018, letterSpacing: "0.2em", marginTop: H * 0.01, maxWidth: W * 0.2 }}>{shot.label}</div></div>
  </Dark>;
};
const Panel: React.FC<{ shot: PanelShot; t: number; idKey: string }> = ({ shot, t, idKey }) => {
  const { width: W, height: H } = useBox(), k = EASE.out(clamp(t / 0.6)), pw = W * 0.62, phh = H * 0.56, items = shot.worlds ?? (shot.shapes ?? []).map((s, i) => worldOf(s, undefined, i % 2 ? "storm" : "day")), n = Math.max(1, items.length), iw = (pw - H * 0.08 - (n - 1) * H * 0.02) / n;
  return <AbsoluteFill>
    <div style={{ position: "absolute", inset: 0, filter: "blur(4px) brightness(.45)" }}><Land2D spec={{ sky: shot.sky ?? "night", land: shot.land ?? "town", rain: true }} t={t} idKey={`${idKey}-bg`} figures={false} /></div>
    <div style={{ position: "absolute", left: W / 2 - pw / 2, top: H * 0.16, width: pw, height: phh, background: "rgba(22,26,40,.92)", borderRadius: H * 0.02, border: "1px solid rgba(255,255,255,.15)", transform: `translateY(${(1 - k) * H * 0.3}px) rotate(${shot.held ? -2 : 0}deg)`, fontFamily: MONT, color: PAPER }}>
      <div style={{ position: "absolute", left: H * 0.04, top: H * 0.025, fontWeight: 700, fontSize: H * 0.016, letterSpacing: "0.25em", opacity: 0.8 }}>{shot.title}</div>
      {items.map((wd, i) => <div key={i} style={{ position: "absolute", left: H * 0.04 + i * (iw + H * 0.02), top: H * 0.07, width: iw, height: phh * 0.62, borderRadius: H * 0.01, overflow: "hidden", border: i === n - 1 ? "2px solid #fff" : "none", opacity: fadeIn(t, 0.4 + i * 0.25) }}>
        <Land2D spec={wd} t={t} idKey={`${idKey}-${i}`} w={iw} h={phh * 0.62} figures={false} /></div>)}
      <div style={{ position: "absolute", left: H * 0.04, right: H * 0.04, bottom: H * 0.05, height: H * 0.006, background: "rgba(255,255,255,.2)", borderRadius: 4 }}>
        <div style={{ width: `${clamp(t / shot.dur) * 100}%`, height: "100%", background: "#e5483c", borderRadius: 4 }} /></div>
      <div style={{ position: "absolute", left: H * 0.04, bottom: H * 0.075, width: 0, height: 0, borderTop: `${H * 0.01}px solid transparent`, borderBottom: `${H * 0.01}px solid transparent`, borderLeft: `${H * 0.016}px solid #fff` }} />
    </div>
    {shot.held && [-1, 1].map((d) => <svg key={d} style={{ position: "absolute", left: W / 2 + d * pw * 0.45 - H * 0.12, top: H * 0.62 + (1 - k) * H * 0.3, overflow: "visible" }} width={H * 0.24} height={H * 0.5} viewBox="0 0 240 500">
      <rect x={70} y={70} width={110} height={460} rx={50} fill="#e6b33c" transform={`rotate(${d * -12} 120 70)`} /><ellipse cx={120} cy={60} rx={56} ry={44} fill="#f2c9a5" /></svg>)}
  </AbsoluteFill>;
};
const Diagram: React.FC<{ shot: DiagramShot; t: number; idKey: string }> = ({ shot, t, idKey }) => {
  const { width: W, height: H } = useBox(), cap = <div style={{ position: "absolute", bottom: H * 0.12, left: 0, right: 0, textAlign: "center", fontWeight: 700, fontSize: H * 0.024, letterSpacing: "0.2em", opacity: fadeIn(t, 0.8) }}>{shot.caption}</div>;
  if (shot.mode === "tube") {
    const arc = EASE.inOut(clamp((t - 0.5) / 2.5)), gy = H * 0.66, x1 = W * 0.2, x2 = W * 0.8, mid = gy - arc * H * 0.42;
    const d = `M${x1},${gy} C${x1 + W * 0.12},${gy} ${W * 0.38},${mid} ${W / 2},${mid} S${x2 - W * 0.12},${gy} ${x2},${gy}`;
    return <Dark t={t}><svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <line x1={0} x2={W} y1={gy + H * 0.02} y2={gy + H * 0.02} stroke="rgba(255,255,255,.18)" strokeWidth={2} />
      <path d={d} fill="none" stroke="#7a6748" strokeWidth={H * 0.05} strokeLinecap="round" /><path d={d} fill="none" stroke="#c7aa76" strokeWidth={H * 0.03} strokeLinecap="round" />
      <path d={d} fill="none" stroke="#f3e2b8" strokeWidth={H * 0.006} strokeLinecap="round" strokeDasharray={`${H * 0.03} ${H * 0.05}`} strokeDashoffset={-t * H * 0.2} />
      {arc > 0.85 && [x1, x2].map((x, i) => <Tornado key={i} shape="rope" x={x} top={H * 0.15} ground={gy} size={H * 0.5} t={t} id={`${idKey}-${i}`} fade={(arc - 0.85) / 0.15} />)}
    </svg>{cap}</Dark>;
  }
  return <Dark t={t}><svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
    <defs><linearGradient id={`spot-${idKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff6d8" stopOpacity={0.45} /><stop offset="1" stopColor="#fff6d8" stopOpacity={0.05} /></linearGradient></defs>
    <polygon points={`${W * 0.47},0 ${W * 0.53},0 ${W * 0.68},${H * 0.66} ${W * 0.32},${H * 0.66}`} fill={`url(#spot-${idKey})`} opacity={fadeIn(t, 0.2)} />
    <ellipse cx={W / 2} cy={H * 0.66} rx={W * 0.2} ry={H * 0.06} fill="#5f8a4b" /><ellipse cx={W / 2} cy={H * 0.66} rx={W * 0.2} ry={H * 0.06} fill="none" stroke="#86b06c" strokeWidth={3} />
    <Tornado shape={shot.shape ?? "walker"} x={W / 2} top={H * 0.22} ground={H * 0.66} size={H * 0.5} t={t} id={`${idKey}-m`} life={{ at: 0.4, descend: 1.4 }} />
    <rect x={W / 2 - H * 0.016} y={H * 0.78} width={H * 0.032} height={H * 0.022} rx={4} fill={GOLD} /><circle cx={W / 2} cy={H * 0.791} r={H * 0.006} fill={INK} />
  </svg>{cap}</Dark>;
};
const News: React.FC<{ shot: NewsShot; t: number; idKey: string }> = ({ shot, t, idKey }) => {
  const { width: W, height: H } = useBox(), k = EASE.out(clamp(t / 0.9)), pw = H * 0.72, ph = H * 0.92;
  return <AbsoluteFill style={{ background: "radial-gradient(90% 80% at 50% 40%, #5a3f2c, #2a1d14)" }}>
    <div style={{ position: "absolute", left: W / 2 - pw / 2, top: H * 0.04, width: pw, height: ph, background: "#efe6d2", boxShadow: "0 30px 60px rgba(0,0,0,.5)", padding: H * 0.03, boxSizing: "border-box",
      transform: `rotate(${-14 * (1 - k) - 2}deg) scale(${0.55 + 0.45 * k})`, opacity: clamp(t / 0.3), color: "#1d1a16" }}>
      <div style={{ fontFamily: SERIF, fontSize: H * 0.06, textAlign: "center", borderBottom: "3px double #1d1a16", paddingBottom: H * 0.008 }}>{shot.masthead}</div>
      <div style={{ fontFamily: MONT, fontSize: H * 0.012, display: "flex", justifyContent: "space-between", padding: `${H * 0.006}px 0`, borderBottom: "1px solid #1d1a16", letterSpacing: "0.1em" }}><span>{shot.date ?? ""}</span><span>EXTRA</span></div>
      <div style={{ fontFamily: SERIF, fontSize: H * 0.055, textAlign: "center", lineHeight: 1.05, margin: `${H * 0.016}px 0` }}>{shot.headline}</div>
      <div style={{ width: "100%", height: ph * 0.36, overflow: "hidden", filter: "grayscale(1) contrast(1.1)" }}><Land2D spec={worldOf(shot.shape, shot.world, "storm", "farm")} t={0} idKey={`${idKey}-n`} w={pw - H * 0.06} h={ph * 0.36} figures={false} /></div>
      <div style={{ display: "flex", gap: H * 0.02, marginTop: H * 0.02 }}>{[0, 1, 2].map((c) => <div key={c} style={{ flex: 1 }}>{Array.from({ length: 9 }, (_, i) => <div key={i} style={{ height: H * 0.007, background: "#6b645a", opacity: 0.55, margin: `${H * 0.008}px 0`, width: `${70 + 30 * hash(c * 20 + i)}%` }} />)}</div>)}</div>
    </div>
  </AbsoluteFill>;
};
const MapView: React.FC<{ shot: MapShot; t: number }> = ({ shot, t }) => {
  const { width: W, height: H } = useBox(), p = EASE.inOut(clamp((t - 0.6) / Math.max(1, shot.dur - 1.5))), pts = shot.path.map(([x, y]) => [x * W, y * H]);
  const d = pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ");
  return <AbsoluteFill style={{ background: "#e9dfc6" }}>
    <CamWrap cam={shot.cam} t={t} dur={shot.dur} push={0.08}><svg width={W} height={H}>
      {Array.from({ length: 14 }, (_, i) => <line key={`h${i}`} x1={0} x2={W} y1={(i / 14) * H + 20 * hash(i)} y2={(i / 14) * H + 20 * hash(i + 1)} stroke="#cdbf9f" strokeWidth={i % 4 === 0 ? 4 : 1.5} />)}
      {Array.from({ length: 22 }, (_, i) => <line key={`v${i}`} y1={0} y2={H} x1={(i / 22) * W + 20 * hash(i + 5)} x2={(i / 22) * W + 20 * hash(i + 6)} stroke="#cdbf9f" strokeWidth={i % 5 === 0 ? 4 : 1.5} />)}
      <path d={`M0,${H * 0.72} C${W * 0.3},${H * 0.6} ${W * 0.5},${H * 0.9} ${W},${H * 0.78}`} stroke="#8fb3c9" strokeWidth={10} fill="none" />
      {Array.from({ length: 40 }, (_, i) => <rect key={i} x={W * (0.35 + 0.25 * hash(i))} y={H * (0.3 + 0.3 * hash(i + 9))} width={14} height={10} fill="#b9ab8b" />)}
      <path d={d} stroke="#c4473a" strokeOpacity={0.35} strokeWidth={(shot.width ?? 0.03) * H} strokeLinecap="round" strokeLinejoin="round" fill="none" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
      <path d={d} stroke="#c4473a" strokeWidth={3} fill="none" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
      {p > 0.98 && pts.length > 1 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={10} fill="none" stroke="#c4473a" strokeWidth={4} />}
      {pts.length > 0 && <circle cx={pts[0][0]} cy={pts[0][1]} r={10} fill="#c4473a" />}
    </svg>
    {(shot.labels ?? []).map((l, i) => <div key={i} style={{ position: "absolute", left: l.x * W, top: l.y * H, fontFamily: HAND, fontSize: H * 0.03, color: "#3a332a", opacity: fadeIn(t, 0.8 + i * 0.4) }}>{l.text}</div>)}</CamWrap>
    <div style={{ position: "absolute", left: W * 0.045, top: H * 0.05, fontFamily: MONT, fontWeight: 800, fontSize: H * 0.026, color: "#3a332a", letterSpacing: "0.12em" }}>{shot.title}</div>
  </AbsoluteFill>;
};
const Tv: React.FC<{ shot: TvShot; t: number; idKey: string }> = ({ shot, t, idKey }) => {
  const { height: H } = useBox(), tw = H * 0.95, th = H * 0.72;
  return <AbsoluteFill style={{ background: "radial-gradient(90% 80% at 50% 40%, #3b3530, #1c1814)", alignItems: "center", justifyContent: "center" }}>
    <div style={{ position: "relative", width: tw, height: th, background: "#6b5a45", borderRadius: H * 0.04, boxShadow: "0 30px 60px rgba(0,0,0,.5)", transform: `scale(${1 + 0.05 * EASE.inOut(clamp(t / shot.dur))})` }}>
      <div style={{ position: "absolute", left: H * 0.05, top: H * 0.05, width: tw * 0.72, height: th - H * 0.1, borderRadius: H * 0.05, overflow: "hidden", background: "#111" }}>
        <div style={{ filter: "grayscale(.85) contrast(1.15)" }}><Land2D spec={worldOf(shot.shape, shot.world, shot.sky ?? "storm")} t={t} idKey={`${idKey}-tv`} w={tw * 0.72} h={th - H * 0.1} figures={false} /></div>
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, rgba(0,0,0,.25) 0 2px, transparent 2px 4px)" }} />
        <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 80px rgba(0,0,0,.8)" }} /></div>
      {[0, 1].map((i) => <div key={i} style={{ position: "absolute", right: tw * 0.08, top: th * (0.2 + i * 0.22), width: H * 0.07, height: H * 0.07, borderRadius: "50%", background: "#3b3128", border: "4px solid #8a7458" }} />)}
      {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ position: "absolute", right: tw * 0.06, top: th * (0.66 + i * 0.05), width: tw * 0.14, height: 4, background: "#3b3128" }} />)}
    </div>
    {shot.caption && <div style={{ position: "absolute", bottom: H * 0.06, fontFamily: MONT, fontWeight: 700, fontSize: H * 0.022, letterSpacing: "0.2em", color: PAPER, opacity: fadeIn(t, 0.5) }}>{shot.caption}</div>}
  </AbsoluteFill>;
};

/* ---------- the film ---------- */
const BOXED = new Set(["notebook", "scale", "waffle", "panel", "diagram", "newspaper", "tv"]);
const BOX_BG: Record<string, string> = { newspaper: "#3a2a1e", tv: "#241f1a" };
const ShotView: React.FC<{ shot: StormShot; i: number }> = ({ shot, i }) => {
  const v = useVideoConfig();
  if (v.height > v.width && BOXED.has(shot.kind)) {
    const bw = 1920, bh = 1080, k = v.width / (bw * 0.8);
    return <AbsoluteFill style={{ background: BOX_BG[shot.kind] ?? "#18213a", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: (v.width - bw * k) / 2, top: (v.height - bh * k) / 2, width: bw, height: bh, transform: `scale(${k})`, transformOrigin: "0 0" }}>
        <BoxCtx.Provider value={{ width: bw, height: bh }}><ShotBody shot={shot} i={i} /></BoxCtx.Provider></div></AbsoluteFill>;
  }
  return <ShotBody shot={shot} i={i} />;
};
const ShotBody: React.FC<{ shot: StormShot; i: number }> = ({ shot, i }) => {
  const f = useCurrentFrame(), { fps } = useBox(), t = f / fps, id = `s${i}`;
  switch (shot.kind) {
    case "notebook": return <Notebook shot={shot} t={t} idKey={id} />;
    case "card": return <Card shot={shot} t={t} idKey={id} />;
    case "number": return <BigNumber shot={shot} t={t} idKey={id} />;
    case "viewfinder": return <Viewfinder shot={shot} t={t} idKey={id} />;
    case "polaroid": return <Polaroid shot={shot} t={t} idKey={id} />;
    case "scale": return <Scale shot={shot} t={t} />;
    case "waffle": return <Waffle shot={shot} t={t} />;
    case "panel": return <Panel shot={shot} t={t} idKey={id} />;
    case "diagram": return <Diagram shot={shot} t={t} idKey={id} />;
    case "newspaper": return <News shot={shot} t={t} idKey={id} />;
    case "map": return <MapView shot={shot} t={t} />;
    case "tv": return <Tv shot={shot} t={t} idKey={id} />;
    default: return <Scene shot={shot} t={t} idKey={id} />;
  }
};
/** how the incoming shot covers the outgoing one during the overlap (k 0..1) */
function transStyle(kind: Trans, k: number, W: number, H: number): { style: React.CSSProperties; over?: React.ReactNode } {
  const e = EASE.inOut(k);
  switch (kind) {
    case "dissolve": return { style: { opacity: e } };
    case "iris": return { style: { clipPath: `circle(${e * 80}% at 50% 55%)` }, over: <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 55%, transparent ${e * 70}%, rgba(0,0,0,${0.7 * (1 - e)}) ${e * 80}%)` }} /> };
    case "flash": return { style: { opacity: k > 0.35 ? 1 : 0 }, over: <AbsoluteFill style={{ background: "#fff", opacity: Math.sin(Math.PI * k) }} /> };
    case "slide": return { style: { transform: `translateX(${(1 - e) * W}px)`, boxShadow: "-30px 0 60px rgba(0,0,0,.45)" }, over: <div style={{ position: "absolute", left: (1 - e) * W - H * 0.006, top: 0, width: H * 0.012, height: H, background: "#b8443a", opacity: 1 - e }} /> };
    default: return { style: {} };
  }
}
export const StormWorld: React.FC<{ cfg: StormCfg }> = ({ cfg }) => {
  const { fps, width: W, height: H } = useBox(), f = useCurrentFrame(), D = Math.round((cfg.trans ?? 0.5) * fps);
  let at = 0;
  return <AbsoluteFill style={{ background: "#111" }}>
    {cfg.audio && <Audio src={staticFile(cfg.audio)} />}
    {cfg.shots.map((s, i) => {
      const from = Math.round(at * fps), len = Math.round(s.dur * fps); at += s.dur;
      const next = cfg.shots[i + 1], tail = next && (next.in ?? "cut") !== "cut" ? D : 0, kind = i === 0 ? "cut" : s.in ?? "cut";
      const k = kind === "cut" ? 1 : clamp((f - from) / D), tr = transStyle(kind, k, W, H);
      return <Sequence key={i} from={from} durationInFrames={len + tail}><AbsoluteFill style={tr.style}><ShotView shot={s} i={i} /></AbsoluteFill>{k < 1 && tr.over}</Sequence>;
    })}
  </AbsoluteFill>;
};

export const DEMO_STORM: StormCfg = {
  shots: [
    { kind: "scene", dur: 4.5, sky: "storm", land: "plains", tornado: { shape: "wedge", x: 0.42, scale: 0.85, life: { at: 0.2, descend: 1.6 } }, observer: { x: 0.78, tag: ["YOU", "FIELD OBSERVER"], pose: "shade", poseAt: 1.6 }, place: ["PRAIRIE COUNTY", "MAY 2026"],
      cam: [{ t: 0, z: 1 }, { t: 2.6, z: 1 }, { t: 4.5, z: 1.35, x: 0.74, y: 0.62 }] },
    { kind: "viewfinder", dur: 2.6, in: "iris", sky: "storm", land: "plains", tornado: { shape: "wedge", x: 0.5, scale: 0.9 }, flashAt: 2.2 },
    { kind: "polaroid", dur: 3, sky: "storm", land: "plains", shape: "wedge", caption: "may, 5:42 pm" },
    { kind: "notebook", dur: 4.5, in: "slide", title: "THE RARE ONES", entries: ["rope", "cone", "stovepipe", "hourglass", "corkscrew", "walker"], sketch: { shape: "hourglass", slot: 3, label: "HOURGLASS" },
      cam: [{ t: 0, z: 1 }, { t: 1, z: 1.7, x: 0.62, y: 0.3 }] },
    { kind: "scene", dur: 5, sky: "day", land: "farm", tornado: { shape: "hourglass", x: 0.45, scale: 0.85, life: { at: 0, descend: 2, ropeOut: 4.2 } }, observer: { x: 0.8, pose: "point", poseAt: 2.2 }, birds: 0.5,
      notes: [{ t: 2.2, kind: "title", text: "THE HOURGLASS", x: 0.45, y: 0.12 }, { t: 2.8, kind: "measure", text: "NARROW WAIST", x: 0.45, y: 0.42, w: 0.08 }], cam: [{ t: 0, z: 1 }, { t: 5, z: 1.12, x: 0.5, y: 0.5 }] },
    { kind: "scale", dur: 3, in: "dissolve", title: "INTENSITY SCALE", items: ["EF0", "EF1", "EF2", "EF3", "EF4", "EF5"], highlight: 4, notes: ["weak", "", "strong", "", "violent", ""] },
    { kind: "waffle", dur: 3, title: "OUT OF EVERY 100 TORNADOES", value: 2, label: "ILLUSTRATIVE SHARE THAT REACH THE TOP RATINGS" },
    { kind: "scene", dur: 4, in: "dissolve", sky: "night", land: "town", tornado: { shape: "satellite", x: 0.5, scale: 0.8 }, rain: true, lightning: [0.6, 2.6], place: ["RIVER BEND", "JUNE 2026"],
      notes: [{ t: 1.2, kind: "dot", text: "MAIN VORTEX", x: 0.5, y: 0.5 }, { t: 1.8, kind: "dot", text: "SATELLITE", x: 0.67, y: 0.55 }] },
    { kind: "panel", dur: 3, title: "ARCHIVE FOOTAGE", shapes: ["cone", "satellite"], held: true },
    { kind: "diagram", dur: 3.5, mode: "tube", caption: "A SPINNING TUBE OF AIR TILTS UP" },
    { kind: "newspaper", dur: 3, masthead: "The Prairie Ledger", headline: "TWIN FUNNELS CROSS COUNTY", shape: "twin", date: "JUNE 9" },
    { kind: "scene", dur: 4, in: "flash", sky: "dusk", land: "city", tornado: { shape: "twin", x: 0.45, scale: 0.75 }, observer: { x: 0.74, friend: true, pose: "binoculars", poseAt: 0.8, friendPose: "point" },
      counter: { t: 1.4, value: 38, label: "BUILDINGS IN THE PATH (ILLUSTRATIVE)" } },
    { kind: "map", dur: 3.5, title: "DAMAGE PATH", path: [[0.2, 0.75], [0.35, 0.6], [0.5, 0.52], [0.68, 0.38], [0.8, 0.3]], labels: [{ x: 0.22, y: 0.79, text: "touchdown" }, { x: 0.78, y: 0.24, text: "lifted" }] },
    { kind: "diagram", dur: 3, mode: "stage", shape: "walker", caption: "SUB-VORTICES LOOK LIKE LEGS" },
    { kind: "tv", dur: 2.5, shape: "walker", caption: "THE WALKING STORM" },
    { kind: "card", dur: 2.5, in: "dissolve", kicker: "UP NEXT", title: "THE LONGEST TRACK", sky: "storm", land: "plains" },
  ],
};
