// Media kit: seven drawing media as reusable primitives + one demo scene each, and the bridges that join them.
// Everything is our own code (SVG + one low-res canvas); nothing is copied from the studied repos, only the ideas:
//   ink     - a hand line that boils on 2s (re-wobbles every 2 frames), writes on, doubles like a quick pen
//   hatch   - shading as hatching / crosshatch clipped inside a shape, denser toward the shadow side (never gradients)
//   sketch  - graphite construction lines -> inked over -> a one-colour scribble fill that writes on; a highlighter word
//   paper   - torn-edge cut paper with soft shadows, patterns (stripes, dots, gingham), a character with a face
//   riso    - three spot-ink plates (teal, pink, yellow) as rotated halftone screens, overprinted (multiply), off register
//   pixel   - drawn at 192x108 with whole pixels, snapped to a 16-colour palette, ordered dither, scaled up crisp
//   iso     - 2:1 isometric hairline objects, white faces hide what is behind, one dark accent, exploded-view motion
//   math    - near-black stage, axes and graphs that sweep on, a tracking dot with a live readout, a shape transform
// Bridges: iris (a window shaped like an object closes on it and the next world opens from it), torn hole, beam wipe.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fHand } from "@remotion/google-fonts/PatrickHand";
import { loadFont as fSerif } from "@remotion/google-fonts/CrimsonPro";

const HAND = fHand("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] }).fontFamily;
const SERIF = fSerif("italic", { weights: ["500"], subsets: ["latin", "latin-ext"] }).fontFamily;

export type Pt = [number, number];
export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const seg = (t: number, a: number, d: number) => (d <= 0 ? (t >= a ? 1 : 0) : clamp((t - a) / d));
export const io = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const out = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
export const smooth = (x: number) => { x = clamp(x); const s = (v: number) => 1 / (1 + Math.exp(-v)); return (s(10 * (x - 0.5)) - s(-5)) / (s(5) - s(-5)); };   // a sigmoid ease: slow both ends
export const pop = (x: number, s = 1.7) => { x = clamp(x); const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** a stable hash 0..1: the same inputs always give the same wobble, so a frame renders identically every time */
export const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** subdivide a polyline so a wobble reads as a hand line, not as bent corners */
export function densify(P: Pt[], closed = false, step = 16): Pt[] {
  const Q: Pt[] = [], n = P.length, m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const a = P[i], b = P[(i + 1) % n], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < k; j++) Q.push([lerp(a[0], b[0], j / k), lerp(a[1], b[1], j / k)]);
  }
  if (!closed) Q.push(P[n - 1]);
  return Q;
}
/** the boil: every point moves a little, reseeded each boil step B (= floor(frame / 2)); smooth along the stroke */
export function wob(P: Pt[], seed: number, amt: number, B: number): Pt[] {
  return P.map(([x, y], i) => {
    const u = i * 0.35, k = seed * 13.7 + B * 7.31;
    return [x + amt * (Math.sin(u + k) * 0.6 + (hash(i + k) - 0.5) * 0.8), y + amt * (Math.cos(u * 1.3 + k * 1.7) * 0.6 + (hash(i * 3.1 + k) - 0.5) * 0.8)];
  });
}
export const path = (P: Pt[], closed = false) => P.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("") + (closed ? "Z" : "");
export const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 48, a0 = -Math.PI / 2, sweep = Math.PI * 2): Pt[] =>
  Array.from({ length: n }, (_, i) => [cx + rx * Math.cos(a0 + (sweep * i) / (n - (sweep >= 6.28 ? 0 : 1))), cy + ry * Math.sin(a0 + (sweep * i) / (n - (sweep >= 6.28 ? 0 : 1)))] as Pt);
export const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const bbox = (P: Pt[]) => { const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]); return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }; };

/* ------------------------------------------------------------------ INK + HATCH ------------------------------------------------------------------ */

/** a hand-inked stroke: two passes that do not quite agree, boiling; frac writes it on (0..1) */
export const Ink: React.FC<{ P: Pt[]; closed?: boolean; w?: number; color?: string; amt?: number; seed?: number; B: number; frac?: number; double?: boolean; opacity?: number }> =
  ({ P, closed = false, w = 5, color = "#2a2420", amt = 2.2, seed = 1, B, frac = 1, double = true, opacity = 1 }) => {
    if (frac <= 0) return null;
    const D = densify(P, closed), dash = frac < 1 ? { pathLength: 1, strokeDasharray: "1 1", strokeDashoffset: 1 - frac } : {};
    return (
      <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" opacity={opacity}>
        <path d={path(wob(D, seed, amt, B), closed && frac >= 1)} strokeWidth={w} {...dash} />
        {double && <path d={path(wob(D, seed + 5, amt * 1.6, B), closed && frac >= 1)} strokeWidth={w * 0.35} opacity={0.55} {...dash} />}
      </g>
    );
  };

/** hatching clipped inside a shape: parallel wobbly lines at an angle; dens(x,y) 0..1 decides where ink goes
    (light from the top-left by default, so the bottom-right is darker); cross adds the second direction in the darks */
export const Hatch: React.FC<{ id: string; P: Pt[]; B: number; angle?: number; gap?: number; color?: string; w?: number; cross?: boolean; dens?: (x: number, y: number) => number; frac?: number; opacity?: number }> =
  ({ id, P, B, angle = -35, gap = 11, color = "#3a2417", w = 2, cross = false, dens, frac = 1, opacity = 0.75 }) => {
    const { x0, y0, x1, y1 } = bbox(P), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + gap;
    const D = dens ?? ((x: number, y: number) => clamp(0.1 + 0.55 * (x - x0) / (x1 - x0 + 1) + 0.55 * (y - y0) / (y1 - y0 + 1)));
    const lines = (ang: number, thr: number, salt: number) => {
      const a = (ang * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux; let d = "";
      for (let o = -R, li = 0; o <= R; o += gap, li++) {
        if (hash(li * 9.1 + salt) > frac) continue;
        for (let s = -R; s < R; s += 28) {                       // 28 px pieces: each keeps or drops by the density
          const mx = cx + nx * o + ux * (s + 14), my = cy + ny * o + uy * (s + 14);
          if (D(mx, my) < thr + 0.25 * hash(li * 3.7 + s * 0.13 + salt)) continue;
          const j = (k: number) => 1.4 * Math.sin(k * 0.9 + B * 2.1 + li);
          d += `M${(cx + nx * (o + j(s)) + ux * s).toFixed(1)} ${(cy + ny * (o + j(s)) + uy * s).toFixed(1)}L${(cx + nx * (o + j(s + 30)) + ux * (s + 30)).toFixed(1)} ${(cy + ny * (o + j(s + 30)) + uy * (s + 30)).toFixed(1)}`;
        }
      }
      return d;
    };
    return (
      <g>
        <defs><clipPath id={id}><path d={path(P, true)} /></clipPath></defs>
        <g clipPath={`url(#${id})`} stroke={color} strokeWidth={w} strokeLinecap="round" fill="none" opacity={opacity}>
          <path d={lines(angle, 0.3, 1)} />
          {cross && <path d={lines(angle + 80, 0.62, 2)} />}
        </g>
      </g>
    );
  };

/** a filled shape the ink way: colour slightly off the line, texture inside, the outline on top */
export const Shape: React.FC<{ id: string; P: Pt[]; B: number; fill?: string; hatch?: boolean; cross?: boolean; angle?: number; line?: string; w?: number; frac?: number; off?: Pt; seed?: number }> =
  ({ id, P, B, fill, hatch = true, cross = false, angle, line = "#2a2420", w = 5, frac = 1, off = [5, 4], seed = 1 }) => (
    <g>
      {fill && <path d={path(P.map(([x, y]) => [x + off[0], y + off[1]] as Pt), true)} fill={fill} opacity={clamp(frac * 1.4)} />}
      {hatch && <Hatch id={id} P={P} B={B} cross={cross} angle={angle} frac={frac} />}
      <Ink P={P} closed B={B} w={w} color={line} seed={seed} frac={clamp(frac * 1.6)} />
    </g>
  );

/** paper the scene sits on: grain + a soft vignette; tone is the paper colour */
export const Paper: React.FC<{ f: number; tone?: string; grain?: number; dots?: boolean; w?: number; h?: number }> = ({ f, tone = "#f2ead8", grain = 0.14, dots = false, w = 1920, h = 1080 }) => (
  <g>
    <defs>
      <filter id="m-grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={Math.floor(f / 2) % 40} /><feColorMatrix values="0 0 0 0 .25  0 0 0 0 .2  0 0 0 0 .15  0 0 0 .55 0" /></filter>
      <radialGradient id="m-vig" cx="50%" cy="46%" r="72%"><stop offset="60%" stopColor="#000" stopOpacity="0" /><stop offset="100%" stopColor="#2a1a0c" stopOpacity="0.32" /></radialGradient>
      <pattern id="m-dots" width="48" height="48" patternUnits="userSpaceOnUse"><circle cx="24" cy="24" r="2.2" fill="#b9ad98" /></pattern>
    </defs>
    <rect width={w} height={h} fill={tone} />
    {dots && <rect width={w} height={h} fill="url(#m-dots)" opacity={0.6} />}
    <rect width={w} height={h} filter="url(#m-grain)" opacity={grain} />
    <rect width={w} height={h} fill="url(#m-vig)" />
  </g>
);

const Svg: React.FC<{ children: React.ReactNode; bg?: string }> = ({ children, bg }) => (
  <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: "absolute", inset: 0, background: bg, isolation: "isolate" }}>{children}</svg>
);
const HandText: React.FC<{ x: number; y: number; text: string; k: number; size?: number; color?: string; rot?: number; anchor?: "start" | "middle" }> = ({ x, y, text, k, size = 72, color = "#2a2420", rot = 0, anchor = "start" }) => {
  const n = Math.floor(text.length * clamp(k));
  return <text x={x} y={y} fontFamily={HAND} fontSize={size} fill={color} textAnchor={anchor} transform={`rotate(${rot} ${x} ${y})`}>{text.slice(0, n)}</text>;
};

/* scene: CROSSHATCH - a desk at night-lamp light: mug with steam, lamp, plant, window; everything boils */
export const SceneHatch: React.FC<{ t: number; f: number }> = ({ t, f }) => {
  const B = Math.floor(f / 2), k = (a: number, d = 0.6) => out(seg(t, a, d));
  const mug: Pt[] = [[820, 560], [1040, 560], [1022, 820], [838, 820]], handle = ellipse(1060, 670, 62, 70, 30, -1.3, 2.6);
  const table: Pt[] = [[0, 820], [1920, 820], [1920, 1080], [0, 1080]], win = rect(1250, 150, 460, 420), lamp: Pt[] = [[380, 300], [600, 300], [660, 470], [320, 470]];
  const pot: Pt[] = [[1380, 690], [1560, 690], [1530, 820], [1410, 820]];
  return (
    <Svg>
      <Paper f={f} tone="#f4ecd9" />
      <Shape id="h-table" P={table} B={B} fill="#d6a466" angle={-8} frac={k(0, 0.5)} />
      <Shape id="h-win" P={win} B={B} fill="#9cc4d6" frac={k(0.1)} cross />
      <Ink P={[[1480, 150], [1480, 570]]} B={B} frac={k(0.3)} /><Ink P={[[1250, 360], [1710, 360]]} B={B} frac={k(0.35)} seed={3} />
      <Shape id="h-lamp" P={lamp} B={B} fill="#f0c55a" frac={k(0.2)} angle={20} />
      <Ink P={[[490, 470], [490, 820]]} B={B} w={7} frac={k(0.3)} seed={4} />
      <Shape id="h-mug" P={mug} B={B} fill="#d4382c" cross frac={k(0.5)} seed={5} />
      <Ink P={handle} B={B} w={6} frac={k(0.7)} seed={6} />
      <Shape id="h-pot" P={pot} B={B} fill="#c97b4a" frac={k(0.6)} seed={7} />
      {[0, 1, 2].map((i) => <Ink key={i} P={Array.from({ length: 9 }, (_, j) => [1470 + (i - 1) * 40 + 22 * Math.sin(j * 0.9 + i), 690 - j * 22] as Pt)} B={B} w={5} color="#5f9c5c" frac={k(0.8 + i * 0.1)} seed={8 + i} />)}
      {[0, 1, 2].map((i) => { const ph = (t * 0.6 + i / 3) % 1;   // steam: rising, writing on and fading
        return <Ink key={`s${i}`} P={Array.from({ length: 8 }, (_, j) => [880 + i * 50 + 16 * Math.sin(j * 0.8 + t * 2 + i), 540 - j * 20 - ph * 60] as Pt)} B={B} w={4} color="#7d6a5a" opacity={(1 - ph) * k(1)} seed={20 + i} />; })}
      <HandText x={140} y={170} text="crosshatch ink" k={seg(t, 1.1, 0.9)} size={84} color="#3a2417" rot={-3} />
    </Svg>
  );
};

/* scene: SKETCHBOOK - pencil construction, inked over, then a terracotta scribble; one highlighted word */
export const SceneSketch: React.FC<{ t: number; f: number }> = ({ t, f }) => {
  const B = Math.floor(f / 2), body = ellipse(960, 560, 230, 230, 60), pencil = (a: number, d = 0.7) => seg(t, a, d);
  const scribble: Pt[] = []; for (let i = 0; i < 26; i++) { const y = 360 + i * 16, half = Math.sqrt(Math.max(0, 210 ** 2 - (y - 560) ** 2)); scribble.push([960 - half + 10, y], [960 + half - 10, y + 8]); }
  const ink = seg(t, 0.9, 0.8), sc = seg(t, 1.7, 0.9), ray = (i: number) => { const a = (i / 8) * Math.PI * 2; return [[960 + 270 * Math.cos(a), 560 + 270 * Math.sin(a)], [960 + 330 * Math.cos(a), 560 + 330 * Math.sin(a)]] as Pt[]; };
  return (
    <Svg>
      <Paper f={f} dots />
      <Ink P={ellipse(960, 560, 240, 226, 60, -1.2)} B={B} w={2.5} color="#9a948b" amt={4} frac={pencil(0)} double={false} />
      <Ink P={[[700, 560], [1220, 560]]} B={B} w={2} color="#9a948b" frac={pencil(0.2)} double={false} seed={2} />
      <Ink P={[[960, 300], [960, 820]]} B={B} w={2} color="#9a948b" frac={pencil(0.3)} double={false} seed={3} />
      <defs><clipPath id="sk-c"><path d={path(body, true)} /></clipPath></defs>
      <path d={path(body, true)} fill="#d97757" opacity={0.22 * sc} />
      <g clipPath="url(#sk-c)"><Ink P={scribble} B={B} w={7} color="#d97757" frac={sc} amt={3} double={false} seed={9} /></g>
      <Ink P={body} closed B={B} w={6} frac={ink} seed={4} />
      {Array.from({ length: 8 }, (_, i) => <Ink key={i} P={ray(i)} B={B} w={6} frac={seg(t, 2.3 + i * 0.05, 0.25)} seed={10 + i} />)}
      <Ink P={ellipse(890, 520, 16, 22, 16)} closed B={B} w={6} frac={seg(t, 2.6, 0.2)} seed={30} /><Ink P={ellipse(1030, 520, 16, 22, 16)} closed B={B} w={6} frac={seg(t, 2.65, 0.2)} seed={31} />
      <Ink P={ellipse(960, 600, 70, 40, 20, 0.3, 2.5)} B={B} w={6} frac={seg(t, 2.75, 0.25)} seed={32} />
      <rect x={1270} y={180} width={430 * out(seg(t, 2.2, 0.4))} height={62} fill="#f7d64a" opacity={0.75} transform="rotate(-2 1270 210)" />
      <HandText x={1280} y={228} text="first, the idea" k={seg(t, 1.9, 0.6)} size={70} />
      <HandText x={160} y={950} text="pencil  ·  ink  ·  colour" k={seg(t, 0.4, 1.2)} size={56} color="#6f6a63" />
    </Svg>
  );
};

/* ------------------------------------------------------------------ CUT PAPER ------------------------------------------------------------------ */

/** a torn edge: the outline subdivided and nudged outward/inward; the tear is fixed per shape, only a slight boil moves */
export function tear(P: Pt[], seed: number, amt = 5, step = 14): Pt[] {
  const D = densify(P, true, step), { x0, y0, x1, y1 } = bbox(P), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return D.map(([x, y], i) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1, r = (hash(i * 1.7 + seed) - 0.5) * 2 * amt; return [x + (dx / l) * r, y + (dy / l) * r]; });
}
export const PaperDefs: React.FC = () => (
  <defs>
    <filter id="cp-shadow" x="-10%" y="-10%" width="125%" height="130%"><feDropShadow dx="6" dy="10" stdDeviation="7" floodColor="#2a1d18" floodOpacity="0.32" /></filter>
    <pattern id="cp-stripes" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(90)"><rect width="60" height="60" fill="#3f9f9a" /><rect width="26" height="60" fill="#56b2ac" /></pattern>
    <pattern id="cp-dots" width="34" height="34" patternUnits="userSpaceOnUse"><rect width="34" height="34" fill="#f3a3bf" /><circle cx="17" cy="17" r="5" fill="#fbf6ea" opacity=".8" /></pattern>
    <pattern id="cp-ging" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#fbf6ea" /><rect width="20" height="40" fill="#d4382c" opacity=".45" /><rect width="40" height="20" fill="#d4382c" opacity=".45" /></pattern>
    <pattern id="cp-wood" width="200" height="30" patternUnits="userSpaceOnUse"><rect width="200" height="30" fill="#c08048" /><path d="M0 10 Q50 4 100 12 T200 9 M0 22 Q60 18 120 25 T200 21" stroke="#9c6234" strokeWidth="2" fill="none" /></pattern>
    <filter id="cp-crayon"><feTurbulence type="fractalNoise" baseFrequency="0.04 0.6" numOctaves={2} seed={4} /><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.6 1.1" /><feComposite in2="SourceGraphic" operator="in" /></filter>
  </defs>
);
export const Cut: React.FC<{ P: Pt[]; fill: string; seed?: number; B: number; shadow?: boolean; crayon?: boolean; tearAmt?: number }> = ({ P, fill, seed = 1, B, shadow = true, crayon = true, tearAmt = 5 }) => {
  const T = wob(tear(P, seed, tearAmt), seed, 0.8, B);
  return (
    <g filter={shadow ? "url(#cp-shadow)" : undefined}>
      <path d={path(T, true)} fill={fill} />
      {crayon && <path d={path(T, true)} fill="#ffffff" opacity={0.18} filter="url(#cp-crayon)" />}
    </g>
  );
};
/* scene: CUT PAPER - a striped wall, a gingham table, a torn sun in a window, a mug character that pops in and blinks */
export const ScenePaper: React.FC<{ t: number; f: number }> = ({ t, f }) => {
  const B = Math.floor(f / 2), p = (a: number) => pop(seg(t, a, 0.45)), blink = Math.abs(((t * 0.8) % 1) - 0.5) < 0.04 ? 0.15 : 1, bob = Math.sin(t * 3) * 6;
  const sunR = 90 + 6 * Math.sin(t * 2);
  return (
    <Svg>
      <PaperDefs />
      <defs><filter id="m-grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={Math.floor(f / 2) % 40} /><feColorMatrix values="0 0 0 0 .25  0 0 0 0 .2  0 0 0 0 .15  0 0 0 .55 0" /></filter></defs>
      <rect width={1920} height={1080} fill="url(#cp-stripes)" />
      <rect width={1920} height={1080} filter="url(#m-grain)" opacity={0.12} />
      <Cut P={rect(1180, 140, 520, 420)} fill="#a8d8ea" seed={2} B={B} />
      <g opacity={p(0.2)}><Cut P={ellipse(1440, 330, sunR, sunR, 40)} fill="#f6cf55" seed={3} B={B} shadow={false} />
        {Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2 + t * 0.3; return <Cut key={i} P={[[1440 + 110 * Math.cos(a - 0.12), 330 + 110 * Math.sin(a - 0.12)], [1440 + 160 * Math.cos(a), 330 + 160 * Math.sin(a)], [1440 + 110 * Math.cos(a + 0.12), 330 + 110 * Math.sin(a + 0.12)]]} fill="#f6cf55" seed={10 + i} B={B} shadow={false} tearAmt={2} />; })}</g>
      <Cut P={rect(-20, 760, 1960, 340)} fill="url(#cp-ging)" seed={4} B={B} />
      <g transform={`translate(0 ${bob}) `}>
        <g transform={`translate(760 ${760 - 300 * p(0.5)}) scale(${0.6 + 0.4 * p(0.5)})`}>
          <Cut P={[[-170, -260], [170, -260], [150, 0], [-150, 0]]} fill="#26315f" seed={5} B={B} />
          <Cut P={ellipse(200, -140, 70, 80, 30)} fill="#26315f" seed={6} B={B} />
          <Cut P={ellipse(200, -140, 34, 44, 24)} fill="url(#cp-stripes)" seed={7} B={B} shadow={false} />
          <ellipse cx={-60} cy={-150} rx={20} ry={26 * blink} fill="#fbf6ea" /><ellipse cx={60} cy={-150} rx={20} ry={26 * blink} fill="#fbf6ea" />
          <path d="M-50 -90 Q0 -50 50 -90" stroke="#fbf6ea" strokeWidth={10} fill="none" strokeLinecap="round" />
          <Cut P={ellipse(-100, -110, 22, 14, 16)} fill="#f3a3bf" seed={8} B={B} shadow={false} /><Cut P={ellipse(100, -110, 22, 14, 16)} fill="#f3a3bf" seed={9} B={B} shadow={false} />
        </g>
      </g>
      <g opacity={p(0.9)} transform={`rotate(${-4 + 2 * Math.sin(t)} 330 230)`}>
        <Cut P={rect(150, 160, 380, 120)} fill="#fbf6ea" seed={11} B={B} /><HandText x={185} y={245} text="cut paper" k={seg(t, 1.0, 0.6)} size={78} color="#2a1d18" />
      </g>
      <Cut P={ellipse(1580, 760, 120, 26, 24)} fill="url(#cp-wood)" seed={12} B={B} />
      {[0, 1, 2].map((i) => <ellipse key={i} cx={760 + 200 + (i - 1) * 24} cy={420 - ((t * 60 + i * 40) % 140)} rx={10} ry={14} fill="#fbf6ea" opacity={0.6 * p(0.7) * (1 - ((t * 60 + i * 40) % 140) / 140)} />)}
    </Svg>
  );
};

/* ------------------------------------------------------------------ RISO ------------------------------------------------------------------ */

export const RISO = { paper: "#f2ece3", teal: "rgb(54,137,171)", pink: "rgb(220,68,160)", yellow: "rgb(238,222,30)" } as const;
type Ink3 = "teal" | "pink" | "yellow";
const ANG: Record<Ink3, number> = { teal: 15, pink: 75, yellow: 45 };
const LEVELS = 10;
/** halftone screens: one pattern per ink and tone level; a dot's area grows with the tone, solid at 1 */
export const RisoDefs: React.FC<{ cell?: number }> = ({ cell = 11 }) => (
  <defs>
    {(Object.keys(ANG) as Ink3[]).map((ink) => Array.from({ length: LEVELS }, (_, q) => {
      const tone = (q + 1) / LEVELS, r = Math.min(cell * 0.72, cell * Math.sqrt(tone / Math.PI));
      return (
        <pattern key={`${ink}${q}`} id={`ht-${ink}-${q}`} width={cell} height={cell} patternUnits="userSpaceOnUse" patternTransform={`rotate(${ANG[ink]})`}>
          {tone >= 1 ? <rect width={cell} height={cell} fill={RISO[ink]} /> : <circle cx={cell / 2} cy={cell / 2} r={r} fill={RISO[ink]} />}
        </pattern>
      );
    }))}
    <filter id="ri-wear"><feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves={1} seed={9} result="n" /><feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -9 7.6" result="m" /><feComposite in="SourceGraphic" in2="m" operator="in" /></filter>
  </defs>
);
const toneFill = (ink: Ink3, tone: number) => `url(#ht-${ink}-${Math.max(0, Math.min(LEVELS - 1, Math.round(tone * LEVELS) - 1))})`;
type Printed = { d: string; tones: Partial<Record<Ink3, number>> };
/** print a list of shapes: each ink is its own plate (multiply), slightly off register, a little worn */
export const RisoPrint: React.FC<{ items: Printed[]; B: number; misreg?: number }> = ({ items, B, misreg = 4 }) => (
  <g style={{ isolation: "isolate" }}>
    {(["yellow", "pink", "teal"] as Ink3[]).map((ink, k) => {
      const dx = ink === "teal" ? 0 : misreg * Math.cos(k * 2.1 + (B % 3) * 0.25), dy = ink === "teal" ? 0 : misreg * Math.sin(k * 1.7 + (B % 3) * 0.2);
      return (
        <g key={ink} transform={`translate(${dx.toFixed(1)} ${dy.toFixed(1)})`} style={{ mixBlendMode: "multiply" }} filter="url(#ri-wear)">
          {items.filter((it) => (it.tones[ink] ?? 0) > 0.04).map((it, i) => <path key={i} d={it.d} fill={toneFill(ink, it.tones[ink]!)} />)}
        </g>
      );
    })}
  </g>
);
/* scene: RISO - a rising sun over layered hills, a violet bird, a knocked-out title */
export const SceneRiso: React.FC<{ t: number; f: number }> = ({ t, f }) => {
  const B = Math.floor(f / 2), rise = smooth(seg(t, 0, 2.2)), hill = (y: number, amp: number, ph: number, sh: number) => {
    const P: Pt[] = [[0, 1080]]; for (let x = 0; x <= 1920; x += 40) P.push([x, y + amp * Math.sin(x / 260 + ph) + sh]); P.push([1920, 1080]); return path(P, true);
  };
  const bx = 300 + 1300 * seg(t, 0.6, 2.6), by = 330 + 40 * Math.sin(t * 3), flap = Math.sin(t * 9) * 40;
  return (
    <Svg bg={RISO.paper}>
      <RisoDefs />
      <rect width={1920} height={1080} fill={RISO.paper} />
      <RisoPrint B={B} items={[
        { d: path(ellipse(1200, 760 - 300 * rise, 230, 230, 60), true), tones: { yellow: 1, pink: 0.3 } },
        { d: hill(720, 50, 0.4 + t * 0.05, 0), tones: { teal: 0.3, yellow: 0.5 } },
        { d: hill(820, 60, 2 + t * 0.1, 0), tones: { teal: 0.6, yellow: 0.9 } },
        { d: hill(930, 40, 4 + t * 0.18, 0), tones: { teal: 1, pink: 0.2 } },
        { d: `M${bx - 90} ${by + flap}Q${bx - 40} ${by - 10} ${bx} ${by}Q${bx + 40} ${by - 10} ${bx + 90} ${by + flap}Q${bx + 30} ${by + 30} ${bx} ${by + 26}Q${bx - 30} ${by + 30} ${bx - 90} ${by + flap}Z`, tones: { teal: 1, pink: 1 } },
        { d: path(rect(140, 120, 880, 170), true), tones: { pink: 1 } },
      ]} />
      <text x={175} y={245} fontFamily="Arial Black, Arial" fontWeight={900} fontSize={110} fill={RISO.paper} letterSpacing={6}>RISO PRINT</text>
    </Svg>
  );
};

/* ------------------------------------------------------------------ PIXEL ------------------------------------------------------------------ */

export const PAL16 = ["#120f1c", "#262b52", "#2c5aa0", "#5aaee0", "#b0ecef", "#f5f1e6", "#8b8da1", "#4b4f68", "#2d8749", "#89cf4b", "#f4d24a", "#ee8a35", "#c9403b", "#7a3550", "#e07aa0", "#a46a3f"].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
/** draw at a low resolution with whole pixels, snap every pixel to the palette, scale up nearest-neighbour */
export const PixelCanvas: React.FC<{ res: [number, number]; draw: (c: CanvasRenderingContext2D, w: number, h: number) => void; pal?: number[][]; frameKey: number }> = ({ res, draw, pal = PAL16, frameKey }) => {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useLayoutEffect(() => {
    const c = ref.current!.getContext("2d")!; c.imageSmoothingEnabled = false; c.clearRect(0, 0, res[0], res[1]); draw(c, res[0], res[1]);
    const im = c.getImageData(0, 0, res[0], res[1]), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      let best = 0, bd = 1e9; for (let k = 0; k < pal.length; k++) { const p = pal[k], e = (d[i] - p[0]) ** 2 + (d[i + 1] - p[1]) ** 2 + (d[i + 2] - p[2]) ** 2; if (e < bd) { bd = e; best = k; } }
      d[i] = pal[best][0]; d[i + 1] = pal[best][1]; d[i + 2] = pal[best][2]; d[i + 3] = 255;
    }
    c.putImageData(im, 0, 0);
  }, [frameKey, res, draw, pal]);
  return <canvas ref={ref} width={res[0]} height={res[1]} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", imageRendering: "pixelated" }} />;
};
/** an ordered-dither band between two palette colours: k 0..1 of b over a */
export function ditherBand(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: string, b: string, k: (yy: number) => number) {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { c.fillStyle = BAYER[(y + yy) % 4][(x + xx) % 4] / 16 < k(yy / h) ? b : a; c.fillRect(x + xx, y + yy, 1, 1); }
}
const HERO = ["..XXX..", ".XXXXX.", ".XoXoX.", ".XXXXX.", "..XXX..", ".YYYYY.", "Y.YYY.Y", "..Y.Y..", ".Y...Y."];
/* scene: PIXEL - a dithered dusk sky, parallax mountains and clouds, a walking two-frame hero, a blinking title */
export const ScenePixel: React.FC<{ t: number; f: number }> = ({ t, f }) => {
  const draw = React.useCallback((c: CanvasRenderingContext2D, w: number, h: number) => {
    ditherBand(c, 0, 0, w, 64, "#262b52", "#ee8a35", (v) => v * 0.95);
    c.fillStyle = "#f4d24a"; const sy = Math.round(46 - 10 * clamp(t / 2.5)); for (let yy = -9; yy <= 9; yy++) { const hw = Math.round(Math.sqrt(81 - yy * yy)); c.fillRect(140 - hw, sy + yy, hw * 2, 1); }
    const ridge = (base: number, amp: number, fr: number, speed: number, col: string) => { c.fillStyle = col; for (let x = 0; x < w; x++) { const yy = Math.round(base + amp * Math.sin((x + t * speed) * fr) + amp * 0.5 * Math.sin((x + t * speed) * fr * 2.7)); c.fillRect(x, yy, 1, h - yy); } };
    ridge(60, 8, 0.05, 6, "#4b4f68"); ridge(72, 6, 0.08, 14, "#2d8749"); ridge(86, 3, 0.12, 30, "#89cf4b");
    c.fillStyle = "#f5f1e6"; [[20, 14, 18], [90, 22, 14], [160, 10, 20]].forEach(([x, y, l]) => { const xx = Math.round((x - t * 8) % (w + 30) + w + 30) % (w + 30) - 30; c.fillRect(xx, y, l, 3); c.fillRect(xx + 3, y - 2, l - 8, 2); });
    const step = Math.floor(t * 6) % 2, hx = Math.round(30 + t * 14) % (w + 10), hy = 88 - HERO.length - (step ? 1 : 0);
    HERO.forEach((row, yy) => [...row].forEach((ch, xx) => { if (ch === ".") return; c.fillStyle = ch === "X" ? "#f5f1e6" : ch === "o" ? "#120f1c" : "#c9403b"; const leg = yy >= 7 && step ? (xx < 3 ? 1 : -1) : 0; c.fillRect(hx + xx + leg, hy + yy, 1, 1); }));
    if (Math.floor(t * 2.5) % 2 === 0 || t < 1) { c.fillStyle = "#120f1c"; c.fillRect(54, 4, 84, 15); c.fillStyle = "#f5f1e6"; c.font = "bold 12px monospace"; c.textBaseline = "top"; c.fillText("PIXEL WORLD", 57, 5); }
  }, [t]);
  return <AbsoluteFill><PixelCanvas res={[192, 108]} draw={draw} frameKey={f} /></AbsoluteFill>;
};

/* ------------------------------------------------------------------ ISOMETRIC ------------------------------------------------------------------ */

export const ISO = { paper: "#ffffff", face: "#ffffff", edge: "#a4a4ac", inner: "#e0e0e4", accent: "#232327" };
/** 2:1 dimetric: x goes right-down, y goes left-down, z goes up */
export const iso = (x: number, y: number, z: number, o: Pt = [960, 380], u = 1): Pt => [o[0] + (x - y) * u, o[1] + (x + y) * u * 0.5 - z * u * 1.2247];
/** an isometric box: top and the two faces toward the viewer, white so they hide what is behind; hairline edges */
export const IsoBox: React.FC<{ x: number; y: number; z: number; w: number; d: number; h: number; o?: Pt; accent?: boolean; inner?: boolean }> = ({ x, y, z, w, d, h, o, accent = false, inner = true }) => {
  const P = (a: number, b: number, c: number) => iso(a, b, c, o);
  const top = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
  const right = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)];
  const left = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)];
  const st = { stroke: accent ? ISO.accent : ISO.edge, strokeWidth: 2, strokeLinejoin: "round" as const };
  return (
    <g>
      <path d={path(right, true)} fill={ISO.face} {...st} /><path d={path(left, true)} fill={ISO.face} {...st} />
      <path d={path(top, true)} fill={accent ? ISO.accent : ISO.face} {...st} />
      {inner && !accent && <path d={path([P(x + w * 0.12, y + d * 0.12, z + h), P(x + w * 0.88, y + d * 0.12, z + h), P(x + w * 0.88, y + d * 0.88, z + h), P(x + w * 0.12, y + d * 0.88, z + h)], true)} fill="none" stroke={ISO.inner} strokeWidth={2} />}
    </g>
  );
};
/* scene: ISOMETRIC - a stack of four layers drops into place, explodes apart with a dashed axis, settles; one dark layer */
export const SceneIso: React.FC<{ t: number; f: number }> = ({ t }) => {
  const layers = [0, 1, 2, 3], gap = 64 * smooth(seg(t, 1.3, 0.8)) * (1 - smooth(seg(t, 2.6, 0.5)));
  const o: Pt = [1150, 700];
  return (
    <Svg bg={ISO.paper}>
      <rect width={1920} height={1080} fill={ISO.paper} />
      {Array.from({ length: 13 }, (_, i) => <path key={i} d={path([iso(-300 + i * 50, -300, 0, o), iso(-300 + i * 50, 300, 0, o)])} stroke={ISO.inner} strokeWidth={1.5} />)}
      {Array.from({ length: 13 }, (_, i) => <path key={`b${i}`} d={path([iso(-300, -300 + i * 50, 0, o), iso(300, -300 + i * 50, 0, o)])} stroke={ISO.inner} strokeWidth={1.5} />)}
      <path d={path([iso(0, 0, -20, o), iso(0, 0, 560, o)])} stroke={ISO.edge} strokeWidth={2} strokeDasharray="8 10" opacity={clamp(gap / 60)} />
      {layers.map((i) => {
        const drop = 1 - out(seg(t, i * 0.22, 0.5)), z = 10 + i * 40 + i * gap + drop * 500;
        return <g key={i} opacity={clamp(1 - drop * 1.5)}><IsoBox x={-170} y={-170} z={z} w={340} d={340} h={22} o={o} accent={i === 2} /></g>;
      })}
      <text x={170} y={200} fontFamily="Inter, Arial" fontWeight={600} fontSize={54} fill={ISO.accent} opacity={out(seg(t, 0.8, 0.5))}>isometric line</text>
      <text x={170} y={250} fontFamily="Inter, Arial" fontSize={30} fill={ISO.edge} opacity={out(seg(t, 1.0, 0.5))}>hairlines · one accent</text>
    </Svg>
  );
};

/* ------------------------------------------------------------------ MATH ------------------------------------------------------------------ */

export const MC = { bg: "#0e0e10", white: "#ffffff", grey: "#bbbbbb", greyD: "#444444", red: "#fc6255", green: "#83c167", yellow: "#f7d96f", blue: "#58c4dd" };
/** resample a closed outline to m points by angle around its centre: two such outlines can be blended point by point */
export function byAngle(P: Pt[], m = 96): Pt[] {
  const cx = P.reduce((s, p) => s + p[0], 0) / P.length, cy = P.reduce((s, p) => s + p[1], 0) / P.length, D = densify(P, true, 4);
  return Array.from({ length: m }, (_, i) => { const a = -Math.PI + (i / m) * Math.PI * 2; let best = D[0], bd = 9; for (const p of D) { const da = Math.abs(Math.atan2(p[1] - cy, p[0] - cx) - a); if (da < bd) { bd = da; best = p; } } return best; });
}
export const morph = (A: Pt[], Bp: Pt[], u: number): Pt[] => { const a = byAngle(A), b = byAngle(Bp); return a.map((p, i) => [lerp(p[0], b[i][0], u), lerp(p[1], b[i][1], u)]); };
/* scene: MATH - a unit circle with a turning radius, its height traced into a sine wave, a live readout, circle -> square */
export const SceneMath: React.FC<{ t: number; f: number }> = ({ t }) => {
  const C: Pt = [470, 560], R = 220, gx0 = 860, gx1 = 1780, axes = smooth(seg(t, 0, 0.7)), th = Math.max(0, t - 0.8) * 1.6;
  const sx = (a: number) => gx0 + (a / (Math.PI * 2)) * (gx1 - gx0) * 0.5;
  const wave: Pt[] = []; for (let a = 0; a <= th; a += 0.04) wave.push([sx(a), C[1] - R * Math.sin(a)]);
  const dot: Pt = [C[0] + R * Math.cos(th), C[1] - R * Math.sin(th)], mk = smooth(seg(t, 3.1, 0.6));
  const circ = ellipse(C[0], C[1], R, R, 96), sq = rect(C[0] - R * 0.8, C[1] - R * 0.8, R * 1.6, R * 1.6), shape = mk > 0 ? morph(circ, sq, mk) : circ;
  const eq = "sin θ = ", val = Math.sin(th).toFixed(2);
  return (
    <Svg bg={MC.bg}>
      <rect width={1920} height={1080} fill={MC.bg} />
      <g stroke={MC.grey} strokeWidth={3}>
        <path d={`M${C[0] - 300} ${C[1]}H${C[0] - 300 + 600 * axes}`} /><path d={`M${C[0]} ${C[1] + 300}V${C[1] + 300 - 600 * axes}`} />
        <path d={`M${gx0} ${C[1]}H${gx0 + (gx1 - gx0) * axes}`} />
      </g>
      <path d={path(shape, true)} fill="none" stroke={MC.yellow} strokeWidth={5} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - smooth(seg(t, 0.3, 0.8))} />
      {t > 0.8 && <>
        <path d={`M${C[0]} ${C[1]}L${dot[0]} ${dot[1]}`} stroke={MC.blue} strokeWidth={5} />
        <path d={`M${dot[0]} ${dot[1]}V${C[1]}`} stroke={MC.green} strokeWidth={4} strokeDasharray="10 8" />
        <path d={`M${dot[0]} ${dot[1]}L${sx(th)} ${dot[1]}`} stroke={MC.greyD} strokeWidth={2} />
        <path d={path(wave)} fill="none" stroke={MC.green} strokeWidth={5} />
        <circle cx={dot[0]} cy={dot[1]} r={12} fill={MC.yellow} /><circle cx={sx(th)} cy={dot[1]} r={10} fill={MC.green} />
      </>}
      <g opacity={smooth(seg(t, 1.0, 0.5))} fontFamily={SERIF} fontSize={84}>
        <text x={1060} y={250} fill={MC.green}>{eq}<tspan fill={MC.white} fontFamily="Menlo, monospace" fontStyle="normal" fontSize={74}>{Number(val) >= 0 ? " " : ""}{val}</tspan></text>
      </g>
      <defs><clipPath id="mt-w"><rect x={160} y={110} width={760 * smooth(seg(t, 0.2, 1.0))} height={140} /></clipPath></defs>
      <text x={170} y={200} clipPath="url(#mt-w)" fontFamily={SERIF} fontSize={76} fill={MC.white}>a circle, <tspan fill={MC.green}>unrolled</tspan></text>
      <text x={C[0]} y={C[1] + R + 120} textAnchor="middle" fontFamily={SERIF} fontSize={48} fill={MC.yellow} opacity={mk}>same area? not quite.</text>
    </Svg>
  );
};

/* ------------------------------------------------------------------ BRIDGES ------------------------------------------------------------------ */

export type SceneC = React.FC<{ t: number; f: number }>;
/** iris bridge: scene A closes into a window shaped like `shape` around `at`, blank paper for `hold`, B opens from it */
export const Iris: React.FC<{ A: SceneC; Bs: SceneC; tA: number; tB: number; f: number; k: number; at?: Pt; shape?: "circle" | "torn" | "star"; paper?: string }> = ({ A, Bs, tA, tB, f, k, at = [960, 540], shape = "circle", paper = "#efe5cf" }) => {
  const close = io(clamp(k / 0.45)), open = io(clamp((k - 0.55) / 0.45)), showB = k >= 0.5, r = showB ? 30 + 1250 * open : 1250 * (1 - close) + 30;
  const P = shape === "circle" ? ellipse(at[0], at[1], r, r, 64) : shape === "star" ? Array.from({ length: 20 }, (_, i) => { const rr = i % 2 ? r * 0.5 : r, a = (i / 20) * Math.PI * 2 - Math.PI / 2; return [at[0] + rr * Math.cos(a), at[1] + rr * Math.sin(a)] as Pt; }) : tear(ellipse(at[0], at[1], r, r * 0.92, 40), 3, Math.max(4, r * 0.06), 10);
  const id = `iris-${shape}`;
  return (
    <AbsoluteFill style={{ background: paper }}>
      <svg width="0" height="0" style={{ position: "absolute" }}><defs><clipPath id={id} clipPathUnits="userSpaceOnUse"><path d={path(P, true)} /></clipPath></defs></svg>
      <AbsoluteFill style={{ clipPath: `url(#${id})` }}>{showB ? <Bs t={tB} f={f} /> : <A t={tA} f={f} />}</AbsoluteFill>
      <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}><path d={path(P, true)} fill="none" stroke="#2a2420" strokeWidth={shape === "torn" ? 3 : 6} opacity={0.8} /></svg>
    </AbsoluteFill>
  );
};
/** beam wipe: a coloured bar sweeps across; B is revealed behind its trailing edge */
export const Beam: React.FC<{ A: SceneC; Bs: SceneC; tA: number; tB: number; f: number; k: number; color?: string }> = ({ A, Bs, tA, tB, f, k, color = "#dc44a0" }) => {
  const e = io(clamp(k)), x = -300 + e * 2520, bw = 260;
  return (
    <AbsoluteFill>
      <A t={tA} f={f} />
      <AbsoluteFill style={{ clipPath: `polygon(0 0, ${((x - bw) / 1920) * 100}% 0, ${((x - bw - 200) / 1920) * 100}% 100%, 0 100%)` }}><Bs t={tB} f={f} /></AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `polygon(${((x - bw) / 1920) * 100}% 0, ${(x / 1920) * 100}% 0, ${((x - 200) / 1920) * 100}% 100%, ${((x - bw - 200) / 1920) * 100}% 100%)`, background: color }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ REEL + GALLERY ------------------------------------------------------------------ */

export const MEDIA: { id: string; name: string; C: SceneC }[] = [
  { id: "crosshatch", name: "Crosshatch ink", C: SceneHatch }, { id: "sketchbook", name: "Sketchbook", C: SceneSketch }, { id: "cut-paper", name: "Cut paper", C: ScenePaper },
  { id: "riso", name: "Riso print", C: SceneRiso }, { id: "pixel", name: "Pixel", C: ScenePixel }, { id: "isometric", name: "Isometric line", C: SceneIso }, { id: "math", name: "Math stage", C: SceneMath },
];
const SCENE = 3.4, BR = 0.9, LEAD = 0.7;
const JOIN: ({ kind: "iris"; shape: "circle" | "torn" | "star"; at: Pt } | { kind: "beam"; color: string } | { kind: "cut" })[] = [
  { kind: "iris", shape: "circle", at: [930, 690] }, { kind: "iris", shape: "torn", at: [960, 560] }, { kind: "beam", color: "#dc44a0" },
  { kind: "cut" }, { kind: "iris", shape: "star", at: [960, 540] }, { kind: "beam", color: "#232327" },
];
export const reelLength = () => MEDIA.length * SCENE;
/** all seven media joined by the bridges, 3.4 s each (the bridges overlap the scene ends) */
export const MediaReel: React.FC = () => {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), t = f / fps, i = Math.min(MEDIA.length - 1, Math.floor(t / SCENE)), raw = t - i * SCENE, local = raw + (i > 0 ? LEAD : 0);   // later scenes open half-drawn: the window shows a world, not blank paper
  const j = JOIN[i], k = (raw - (SCENE - BR / 2)) / BR;
  const Cur = MEDIA[i].C, Next = MEDIA[i + 1]?.C;
  if (Next && j && raw > SCENE - BR / 2 && j.kind !== "cut") {
    const kk = clamp(k), tB = LEAD;
    return j.kind === "iris" ? <Iris A={Cur} Bs={Next} tA={local} tB={tB} f={f} k={kk * 0.5} at={j.at} shape={j.shape} /> : <Beam A={Cur} Bs={Next} tA={local} tB={tB} f={f} k={kk * 0.5} color={j.color} />;
  }
  const prev = i > 0 ? JOIN[i - 1] : null;
  if (prev && prev.kind !== "cut" && raw < BR / 2) {
    const kk = 0.5 + clamp(raw / BR), Prev = MEDIA[i - 1].C;
    return prev.kind === "iris" ? <Iris A={Prev} Bs={Cur} tA={SCENE + (i > 1 ? LEAD : 0)} tB={local} f={f} k={kk} at={prev.at} shape={prev.shape} /> : <Beam A={Prev} Bs={Cur} tA={SCENE + (i > 1 ? LEAD : 0)} tB={local} f={f} k={kk} color={prev.color} />;
  }
  return <AbsoluteFill><Cur t={local} f={f} /></AbsoluteFill>;
};
/** every medium at one moment (t) in a 4 x 2 grid with its name: the sheet to choose a look from */
export const MediaGallery: React.FC<{ t?: number }> = ({ t = 2.8 }) => {
  const f = Math.round(t * 30), cw = 1920 / 4, ch = cw * 9 / 16;
  return (
    <AbsoluteFill style={{ background: "#151515" }}>
      {MEDIA.map((m, i) => (
        <div key={m.id} style={{ position: "absolute", left: (i % 4) * cw + 8, top: Math.floor(i / 4) * (ch + 60) + 70, width: cw - 16, height: ch - 10 }}>
          <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}><div style={{ width: 1920, height: 1080, transform: `scale(${(cw - 16) / 1920})`, transformOrigin: "0 0", position: "relative" }}><m.C t={t} f={f} /></div></div>
          <div style={{ position: "absolute", top: ch - 4, color: "#ffd84a", fontFamily: "Arial", fontSize: 24 }}>{i + 1}. {m.name} · {m.id}</div>
        </div>
      ))}
      <div style={{ position: "absolute", left: 20, top: 16, color: "white", fontFamily: "Arial", fontSize: 32 }}>MEDIA KIT · t = {t.toFixed(1)} s</div>
    </AbsoluteFill>
  );
};
