// LogoReveal: the user's own logo (tools/logo_prep.py -> logo.json) animated three ways, then held with a soft shine:
//   draw      every part's outline writes on (staggered), then the fills arrive and the outline settles
//   assemble  the parts fly in from scattered, rotated positions on springs and lock together
//   mask      a bright bar sweeps across and reveals the mark behind it, with a short glow
// The wordmark and tagline follow as secondary motion; the land moment (LAND[style]) is where the sound logo's impact goes.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fInter } from "@remotion/google-fonts/Inter";
import { persona, EASE, clamp, enterK, mixOklch } from "../motion";

const INTER = fInter("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] }).fontFamily;
export type LogoData = { viewBox: string; parts: { d: string; fill: string; stroke: string; sw: number }[]; wordmark?: string | null; tagline?: string | null; style?: "draw" | "assemble" | "mask" };
export type LogoProps = { logo: LogoData; bg?: string; ink?: string; accent?: string; duration?: number };
export const LAND = { draw: 1.9, assemble: 1.5, mask: 1.4 };
const lum = (hex: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 0.5; const n = parseInt(m[1], 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
const rnd = (i: number) => { const s = Math.sin(i * 91.7 + 13.3) * 43758.5453; return s - Math.floor(s); };

export const LogoReveal: React.FC<LogoProps> = ({ logo, bg = "#0d0f14", ink = "#f4f5f7", accent = "#ffb02e" }) => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, u = Math.min(W, H) / 1080, style = logo.style ?? "draw", land = LAND[style];
  const [vx, vy, vw, vh] = logo.viewBox.split(/[ ,]+/).map(Number), n = logo.parts.length, vertical = H > W;
  const size = Math.min(W, H) * (logo.wordmark ? 0.42 : 0.55), sc = size / Math.max(vw, vh);
  const cx = W / 2, cy = H * (logo.wordmark ? (vertical ? 0.4 : 0.38) : 0.5);
  const P = persona("playful"), hold = clamp((t - land) / 2);
  const parts = logo.parts.map((p, i) => {
    const fill = p.fill === "none" ? "none" : p.fill, own = p.stroke !== "none" ? p.stroke : fill === "none" ? ink : fill;
    const stroke = Math.abs(lum(own) - lum(bg)) < 0.25 ? ink : own;   // a dark part on a dark ground draws in the ink colour, or the line is invisible
    if (style === "draw") {
      const a = 0.15 + i * Math.min(0.12, 0.9 / Math.max(1, n)), k = EASE.inOut(clamp((t - a) / 0.9)), fk = EASE.out(clamp((t - (land - 0.35)) / 0.45));
      return <path key={i} d={p.d} fill={fill} fillOpacity={fill === "none" ? 0 : fk} stroke={stroke} strokeWidth={Math.max(p.sw, 2.5 / sc)} strokeOpacity={1 - 0.7 * fk * (p.stroke === "none" ? 1 : 0)}
        pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - k} strokeLinejoin="round" strokeLinecap="round" />;
    }
    if (style === "assemble") {
      const a = i * Math.min(0.12, 0.6 / Math.max(1, n)), k = clamp(enterK(t, a + 0.3, P, land - 0.3 - Math.min(0.12, 0.6 / Math.max(1, n)) * (n - 1)), -0.2, 1.2),   /* the last part locks on the land beat */ dx = (rnd(i) - 0.5) * vw * 1.6, dy = (rnd(i + 7) - 0.5) * vh * 1.6, rot = (rnd(i + 3) - 0.5) * 140;
      return <g key={i} transform={`translate(${dx * (1 - k)} ${dy * (1 - k)}) rotate(${rot * (1 - k)} ${vx + vw / 2} ${vy + vh / 2})`} opacity={clamp((t - a - 0.3) / 0.15)}>
        <path d={p.d} fill={fill} stroke={p.stroke} strokeWidth={p.sw} strokeLinejoin="round" /></g>;
    }
    return <path key={i} d={p.d} fill={fill} stroke={p.stroke} strokeWidth={p.sw} strokeLinejoin="round" />;
  });
  // mask: the bar's x across the logo box
  const bar = style === "mask" ? EASE.inOut(clamp((t - 0.3) / (land - 0.3))) : 1, barX = vx - vw * 0.2 + vw * 1.4 * bar;
  const glow = style === "mask" ? clamp(1 - Math.abs(t - land) / 0.5) : style === "assemble" ? clamp(1 - Math.abs(t - land - 0.1) / 0.35) : clamp(1 - Math.abs(t - land) / 0.4);
  const shine = (t - land - 0.8) / 0.9;   // one soft shine across the held logo
  const wk = clamp((t - land - 0.15) / 0.5), tk = clamp((t - land - 0.45) / 0.5);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 42%, ${mixOklch(bg, accent, 0.12 + 0.1 * glow)}, ${bg})` }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <clipPath id="lr-mask"><rect x={vx - vw} y={vy - vh} width={barX - (vx - vw)} height={vh * 3} /></clipPath>
          <linearGradient id="lr-shine" x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="0.5" stopColor="#fff" stopOpacity="0.55" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
          <filter id="lr-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={18 / sc} /></filter>
          <clipPath id="lr-shape">{logo.parts.map((p, i) => <path key={i} d={p.d} />)}</clipPath>
        </defs>
        <g transform={`translate(${cx} ${cy}) scale(${sc * (1 + 0.025 * EASE.inOut(hold))}) translate(${-(vx + vw / 2)} ${-(vy + vh / 2)})`}>
          {glow > 0 && <g filter="url(#lr-glow)" opacity={0.55 * glow}>{logo.parts.map((p, i) => <path key={i} d={p.d} fill={accent} />)}</g>}
          <g clipPath={style === "mask" ? "url(#lr-mask)" : undefined}>{parts}</g>
          {style === "mask" && bar > 0 && bar < 1 && <rect x={barX - vw * 0.04} y={vy - vh * 0.3} width={vw * 0.04} height={vh * 1.6} fill="#fff" opacity={0.9} />}
          {shine > 0 && shine < 1 && <g clipPath="url(#lr-shape)"><rect x={vx - vw * 0.6 + vw * 2.2 * EASE.inOut(shine)} y={vy - vh} width={vw * 0.35} height={vh * 3} fill="url(#lr-shine)" transform={`skewX(-20)`} /></g>}
        </g>
      </svg>
      {logo.wordmark && <div style={{ position: "absolute", left: 0, right: 0, top: cy + size * 0.62, textAlign: "center", fontFamily: INTER, fontWeight: 800, fontSize: (vertical ? 110 : 96) * u, letterSpacing: (8 - 6 * EASE.out(wk)) * u, color: ink, opacity: wk, transform: `translateY(${(1 - EASE.out(wk)) * 26 * u}px)` }}>{logo.wordmark}</div>}
      {logo.tagline && <div style={{ position: "absolute", left: 0, right: 0, top: cy + size * 0.62 + (vertical ? 150 : 130) * u, textAlign: "center", fontFamily: INTER, fontWeight: 600, fontSize: 40 * u, color: mixOklch(ink, bg, 0.35), opacity: tk }}>{logo.tagline}</div>}
    </AbsoluteFill>
  );
};

/** studio default: a simple geometric mark drawn for this demo */
export const DEMO_LOGO: LogoData = { viewBox: "0 0 200 200", style: "draw", wordmark: "Vidbucks", tagline: "reference in, original out", parts: [
  { d: "M100 10 A90 90 0 1 1 99.9 10 Z", fill: "#ffb02e", stroke: "none", sw: 0 },
  { d: "M52 62 L100 150 L148 62 L124 62 L100 108 L76 62 Z", fill: "#0d0f14", stroke: "none", sw: 0 },
  { d: "M92 40 L118 54 L92 68 Z", fill: "#0d0f14", stroke: "none", sw: 0 } ] };
