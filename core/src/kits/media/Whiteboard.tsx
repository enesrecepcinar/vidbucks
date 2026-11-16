// Whiteboard: marker drawings that draw themselves with a hand on the pen. The marker tip sits exactly on the end of the
// stroke being drawn (the hand is placed by the same arc length the stroke reveals), lifts between strokes on a small arc,
// writes words left to right, and an eraser wipe clears the board between ideas. The hand is our own cartoon (white glove
// fill, ink outline: no skin tone to choose, no stock photo). Items come from the media icon library or point lists.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fMarker } from "@remotion/google-fonts/PermanentMarker";
import { Pt, path, densify, wob } from "./Media";
import { ICONS, IconId } from "./MediaScene";
import { EASE, clamp } from "../motion";

const MARKER = fMarker("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
export type WbItem =
  | { kind: "icon"; icon: IconId; x: number; y: number; s: number; color?: string; at?: number }
  | { kind: "line"; P: Pt[]; color?: string; w?: number; at?: number }
  | { kind: "text"; text: string; x: number; y: number; size: number; color?: string; at?: number };
export type WbCfg = { items: WbItem[]; speed?: number; wipeAt?: number; duration?: number };
type Seg = { kind: "stroke"; P: Pt[]; L: number[]; len: number; color: string; w: number; at: number; dur: number } | { kind: "text"; text: string; x: number; y: number; size: number; color: string; at: number; dur: number; width: number };

let mctx: CanvasRenderingContext2D | null = null;
/** the real width of a word in the marker font (an estimate put the hand far ahead of the ink) */
function textWidth(text: string, size: number) {
  if (typeof document === "undefined") return text.length * size * 0.55;
  if (!mctx) mctx = document.createElement("canvas").getContext("2d");
  mctx!.font = `${size}px ${MARKER}`; return mctx!.measureText(text).width;
}
const lenOf = (P: Pt[]) => { const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return L; };
function pointAt(P: Pt[], L: number[], d: number): Pt {
  const total = L[L.length - 1]; d = clamp(d, 0, total); let i = 1; while (i < L.length - 1 && L[i] < d) i++;
  const k = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * k, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * k];
}
/** the board's timeline: every stroke and word gets a start and a duration from its length (speed px/s) */
export function planBoard(cfg: WbCfg): Seg[] {
  const v = cfg.speed ?? 1500, segs: Seg[] = []; let t = 0.6;
  for (const it of cfg.items) {
    if (it.at != null) t = Math.max(t, it.at);
    if (it.kind === "text") {
      const width = textWidth(it.text, it.size), dur = clamp(it.text.length * 0.09, 0.4, 2.5);
      segs.push({ kind: "text", text: it.text, x: it.x, y: it.y, size: it.size, color: it.color ?? "#1d1e22", at: t, dur, width }); t += dur + 0.25; continue;
    }
    const strokes: Pt[][] = it.kind === "line" ? [it.P] : (ICONS[it.icon] as { P: Pt[]; closed: boolean }[]).map((p) => {
      const Q = p.P.map(([x, y]) => [it.x + x * it.s, it.y + y * it.s] as Pt); return p.closed ? [...Q, Q[0]] : Q; });
    for (const S of strokes) {
      const P = wob(densify(S, false, 10), 3, 1.2, 0), L = lenOf(P), len = L[L.length - 1], dur = clamp(len / v, 0.18, 2.2);
      segs.push({ kind: "stroke", P, L, len, color: it.color ?? "#1d1e22", w: it.kind === "line" ? it.w ?? 9 : 9, at: t, dur }); t += dur + 0.12;
    }
    t += 0.2;
  }
  return segs;
}
export const boardLength = (cfg: WbCfg) => cfg.duration ?? (() => { const s = planBoard(cfg), e = s[s.length - 1]; return e.at + e.dur + 2.2 + (cfg.wipeAt ? 1.2 : 0); })();

/** the drawn hand holding a marker; the tip of the marker is the origin */
const Hand: React.FC<{ x: number; y: number; rot: number; lift: number }> = ({ x, y, rot, lift }) => (
  <g transform={`translate(${x} ${y - lift}) rotate(${rot}) scale(1.8)`}>
    <g opacity={0.18} transform="translate(26 30)"><path d="M0 0 L22 -10 L120 190 L96 204 Z" fill="#000" /><ellipse cx={150} cy={260} rx={95} ry={70} fill="#000" /></g>
    <path d="M0 0 L14 -8 L30 20 L18 28 Z" fill="#1d1e22" />
    <path d="M18 28 L30 20 L120 190 L98 202 Z" fill="#2f6fde" stroke="#1d1e22" strokeWidth={4} strokeLinejoin="round" />
    <path d="M62 112 L80 102 L92 126 L74 136 Z" fill="#e8ecf2" />
    <g fill="#ffffff" stroke="#1d1e22" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round">
      <path d="M86 150 C 70 150, 58 168, 70 182 C 82 196, 104 186, 108 172 Z" />
      <path d="M96 128 C 120 112, 168 120, 196 150 C 228 186, 230 246, 196 286 C 166 318, 112 312, 90 280 C 72 254, 78 214, 98 196 C 86 176, 84 148, 96 128 Z" />
      <path d="M100 196 C 116 192, 126 204, 120 218" fill="none" />
      <path d="M118 238 C 132 236, 140 248, 134 260" fill="none" />
      <path d="M150 300 L 168 380 L 238 372 L 226 280" />
    </g>
  </g>
);

export const Whiteboard: React.FC<{ cfg: WbCfg }> = ({ cfg }) => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps;
  const segs = React.useMemo(() => planBoard(cfg), [cfg]);
  // the tip: inside a segment it is the reveal point; between segments it travels on a lifted arc; before/after it is off board
  const tipOf = (s: Seg, k: number): Pt => s.kind === "stroke" ? pointAt(s.P, s.L, s.len * k) : [s.x + s.width * k, s.y - s.size * 0.3 + Math.sin(k * s.text.length * 2.2) * s.size * 0.12];
  let tip: Pt = [W * 1.15, H * 1.2], lift = 0;
  const cur = segs.find((s) => t >= s.at && t <= s.at + s.dur);
  if (cur) tip = tipOf(cur, (t - cur.at) / cur.dur);
  else {
    const prev = [...segs].reverse().find((s) => t > s.at + s.dur), next = segs.find((s) => t < s.at);
    const from = prev ? tipOf(prev, 1) : [W * 1.15, H * 1.25] as Pt, to = next ? tipOf(next, 0) : [W * 1.2, H * 1.3] as Pt;
    const a = prev ? prev.at + prev.dur : 0, b = next ? next.at : a + 0.7, k = EASE.inOut(clamp((t - a) / Math.max(0.05, b - a)));
    tip = [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k]; lift = Math.sin(Math.PI * k) * Math.min(60, Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.25);
  }
  const wipe = cfg.wipeAt != null ? clamp((t - cfg.wipeAt) / 0.9) : 0, wipeX = -W * 0.2 + W * 1.5 * EASE.inOut(wipe);
  const handHidden = wipe > 0;
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 40%, #ffffff, #eef0f2)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <clipPath id="wb-wipe"><rect x={wipeX} y={0} width={W * 2} height={H} /></clipPath>
          {segs.map((s, i) => s.kind === "text" ? <clipPath key={i} id={`wb-t${i}`}><rect x={s.x - 10} y={s.y - s.size * 1.2} width={10 + s.width * clamp((t - s.at) / s.dur) * 1.05} height={s.size * 1.6} /></clipPath> : null)}
        </defs>
        <g clipPath={wipe > 0 ? "url(#wb-wipe)" : undefined}>
          {segs.map((s, i) => {
            if (t < s.at) return null;
            const k = clamp((t - s.at) / s.dur);
            if (s.kind === "text") return <text key={i} x={s.x} y={s.y} clipPath={`url(#wb-t${i})`} fontFamily={MARKER} fontSize={s.size} fill={s.color}>{s.text}</text>;
            const n = Math.max(2, Math.ceil(s.P.length * k)), P = s.P.slice(0, n);
            if (k < 1) P[P.length - 1] = pointAt(s.P, s.L, s.len * k);
            return <path key={i} d={path(P)} fill="none" stroke={s.color} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />;
          })}
        </g>
        {wipe > 0 && wipe < 1 && <g transform={`translate(${wipeX} ${H * 0.5})`}><rect x={-60} y={-H * 0.55} width={120} height={H * 1.1} rx={30} fill="#3a3f47" /><rect x={-60} y={-H * 0.55} width={120} height={40} fill="#5b6470" /></g>}
        {!handHidden && <Hand x={tip[0]} y={tip[1]} rot={-28} lift={lift} />}
      </svg>
    </AbsoluteFill>
  );
};

export const DEMO_WB: WbCfg = { items: [
  { kind: "icon", icon: "bulb", x: 560, y: 470, s: 210 },
  { kind: "line", P: [[820, 470], [1060, 470]], w: 10 }, { kind: "line", P: [[1020, 440], [1062, 470], [1020, 500]], w: 10 },
  { kind: "icon", icon: "gear", x: 1300, y: 470, s: 190, color: "#2f6fde" },
  { kind: "text", text: "idea -> system", x: 640, y: 860, size: 92, color: "#d63b2f" },
], wipeAt: 7.2 };
