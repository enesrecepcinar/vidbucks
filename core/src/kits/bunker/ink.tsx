// Comic-ink primitives for the animated survival serial: one palette, a hand-drawn "boil" (the outline wobbles a
// little every few frames, like redrawn animation), soft painted shading and paper grain. Everything is vector.
import React from "react";
import { loadFont as fBangers } from "@remotion/google-fonts/Bangers";
import { loadFont as fHand } from "@remotion/google-fonts/PermanentMarker";
export const BANG = fBangers("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
export const HAND = fHand("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;

export const INK = "#26201d";
export const C = {
  ink: INK, skin: "#fbf6ec", skinShade: "#e6dccb", hair: "#2b2422", beanie: "#e3a22c", beanieShade: "#b97c17", jacket: "#5f6e3a", jacketShade: "#46522a",
  pants: "#3d4656", shoe: "#3a2d27", sweat: "#7cc8f2", alert: "#e5352b", glow: "#9fd6ff", paper: "#f3ead8",
};
export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ramp = (t: number, t0: number, d: number) => (d <= 0 ? (t >= t0 ? 1 : 0) : clamp((t - t0) / d));
export const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
export const back = (x: number, s = 1.6) => { x = clamp(x); const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const rnd = (seed: number) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

/** filters every scene uses: `boil` wobbles outlines (seed steps every 3 frames), `soft` blurs shadows, `glowf` blooms lights */
export const Defs: React.FC<{ f: number }> = ({ f }) => (
  <defs>
    <filter id="boil" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={2} seed={Math.floor(f / 3) % 7} result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={3.2} xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <filter id="soft"><feGaussianBlur stdDeviation="14" /></filter>
    <filter id="softS"><feGaussianBlur stdDeviation="5" /></filter>
    <filter id="glowf" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22" /></filter>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={Math.floor(f / 2) % 50} /><feColorMatrix values="0 0 0 0 .3  0 0 0 0 .25  0 0 0 0 .2  0 0 0 .5 0" /></filter>
    <pattern id="tiles" width="64" height="34" patternUnits="userSpaceOnUse">
      <rect width="64" height="34" fill="#eef0ea" /><rect x="1.5" y="1.5" width="61" height="31" rx="3" fill="#f8f9f4" stroke="#c9cdc3" strokeWidth="2.5" />
      <rect x="6" y="5" width="30" height="6" rx="3" fill="#ffffff" opacity=".7" />
    </pattern>
  </defs>
);

/** paper grain over the whole frame + a painted vignette */
export const Finish: React.FC<{ v?: number }> = ({ v = 0.55 }) => (
  <>
    <rect width={1920} height={1080} filter="url(#grain)" opacity={0.16} style={{ mixBlendMode: "multiply" }} />
    <rect width={1920} height={1080} fill="url(#vig)" opacity={v} />
    <defs><radialGradient id="vig" cx="50%" cy="48%" r="75%"><stop offset="62%" stopColor="#000" stopOpacity="0" /><stop offset="100%" stopColor="#140d08" stopOpacity="0.85" /></radialGradient></defs>
  </>
);

/** a comic caption box (yellow card, ink border, slight tilt) that pops in */
export const Caption: React.FC<{ x: number; y: number; text: string; k: number; size?: number; rot?: number; fill?: string; color?: string }> = ({ x, y, text, k, size = 64, rot = -3, fill = "#ffd84a", color = INK }) => {
  if (k <= 0) return null;
  const w = text.length * size * 0.6 + size * 0.9, h = size * 1.45, sc = back(k, 2.2);
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${sc})`}>
      <rect x={-w / 2 + 8} y={-h / 2 + 10} width={w} height={h} rx={10} fill={INK} opacity={0.35} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={10} fill={fill} stroke={INK} strokeWidth={6} />
      <text x={0} y={size * 0.36} textAnchor="middle" fontFamily={BANG} fontSize={size} letterSpacing={2} fill={color}>{text}</text>
    </g>
  );
};

/** a lettered sound word (comic onomatopoeia) */
export const Sfx: React.FC<{ x: number; y: number; text: string; k: number; size?: number; rot?: number; fill?: string }> = ({ x, y, text, k, size = 90, rot = -8, fill = "#ffd84a" }) => {
  if (k <= 0) return null;
  return (
    <text x={x} y={y} transform={`rotate(${rot} ${x} ${y}) `} textAnchor="middle" fontFamily={BANG} fontSize={size * back(k, 2.5)} fill={fill} stroke={INK} strokeWidth={size * 0.09} paintOrder="stroke" opacity={Math.min(1, k * 3)} letterSpacing={3}>{text}</text>
  );
};
