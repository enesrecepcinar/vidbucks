// transitions.tsx - a vocabulary of transitions that BLEND two layers over an overlap (no dead hard cuts), for any kit.
// <TransitionStage kind p A B /> draws the outgoing layer A and the incoming layer B at progress p (0..1). Every kind keeps
// the eye moving in one direction through the join (motion carries across the cut), eases in and out (smooth), and costs at
// most two renders of each layer. Pick a different kind for neighbouring joins (`pickTransition` rotates without repeats).
//   push · whip · zoom-through · flip · spin · stack · iris · diagonal · wave · blob · tiles (cover) · bars (cover) ·
//   glitch · flash · luma (soft dissolve) · split (strips; for light layers only)
import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { EASE, clamp } from "./motion";

export type TKind = "push" | "whip" | "zoom" | "flip" | "spin" | "stack" | "iris" | "diagonal" | "wave" | "blob" | "tiles" | "bars" | "glitch" | "flash" | "luma" | "split";
export const T_ALL: TKind[] = ["push", "whip", "zoom", "flip", "spin", "stack", "iris", "diagonal", "wave", "blob", "tiles", "bars", "glitch", "flash", "luma"];
/** a sequence of kinds where no kind repeats within `gap` joins (deterministic) */
export function pickTransition(i: number, pool: TKind[] = T_ALL) { return pool[(i * 7) % pool.length]; }
const hash = (n: number) => { const s = Math.sin(n * 91.3 + 17.1) * 43758.5453; return s - Math.floor(s); };
const io = EASE.inOut;

export const TransitionStage: React.FC<{ kind: TKind; p: number; A: React.ReactNode; B: React.ReactNode; dir?: 1 | -1; color?: string; colors?: string[]; at?: [number, number] }> =
  ({ kind, p, A, B, dir = 1, color = "#ffb02e", colors = ["#ffb02e", "#ff5a36", "#4f8cff", "#2ec4a0", "#f4f5f7"], at = [0.5, 0.5] }) => {
    const { width: W, height: H } = useVideoConfig(), k = io(clamp(p)), mid = Math.sin(Math.PI * clamp(p));
    const L = (node: React.ReactNode, st: React.CSSProperties, key: string) => <AbsoluteFill key={key} style={{ overflow: "hidden", ...st }}>{node}</AbsoluteFill>;
    switch (kind) {
      case "push":
        return <AbsoluteFill>{L(A, { transform: `translateX(${-dir * k * W}px)`, filter: `blur(${mid * 6}px)` }, "a")}{L(B, { transform: `translateX(${dir * (1 - k) * W}px)`, filter: `blur(${mid * 6}px)` }, "b")}</AbsoluteFill>;
      case "whip": {   // a fast pan: motion blur peaks at the seam, the frames slide past each other
        const e = EASE.inOut(clamp(p));
        return <AbsoluteFill>{L(A, { transform: `translateX(${-dir * e * W * 1.2}px) skewX(${dir * mid * -8}deg)`, filter: `blur(${mid * 38}px)`, opacity: p < 0.6 ? 1 : 0 }, "a")}
          {L(B, { transform: `translateX(${dir * (1 - e) * W * 1.2}px) skewX(${dir * mid * -8}deg)`, filter: `blur(${mid * 38}px)`, opacity: p > 0.4 ? 1 : 0 }, "b")}</AbsoluteFill>;
      }
      case "zoom": {   // fly through A into B: A grows past the lens, B arrives from a little smaller
        const a1 = clamp(p / 0.6), b1 = clamp((p - 0.35) / 0.65);
        return <AbsoluteFill>{L(B, { transform: `scale(${0.75 + 0.25 * EASE.out(b1)})`, opacity: EASE.out(b1), filter: `blur(${(1 - b1) * 14}px)` }, "b")}
          {p < 0.75 && L(A, { transform: `scale(${1 + 3 * EASE.in(a1)})`, opacity: 1 - EASE.in(clamp((p - 0.3) / 0.45)), filter: `blur(${EASE.in(a1) * 16}px)`, transformOrigin: `${at[0] * 100}% ${at[1] * 100}%` }, "a")}</AbsoluteFill>;
      }
      case "flip": {   // a 3D card turn about the vertical axis
        const half = p < 0.5, r = half ? io(p / 0.5) * 90 : -90 + io((p - 0.5) / 0.5) * 90;
        return <AbsoluteFill style={{ perspective: W * 1.2, background: "#000" }}>{L(half ? A : B, { transform: `rotateY(${dir * r}deg) scale(${1 - 0.12 * mid})`, filter: `brightness(${1 - 0.4 * mid})` }, half ? "a" : "b")}</AbsoluteFill>;
      }
      case "spin": {
        const half = p < 0.5, r = half ? io(p / 0.5) * 90 : -90 + io((p - 0.5) / 0.5) * 90;
        return <AbsoluteFill style={{ background: "#000" }}>{L(half ? A : B, { transform: `rotate(${dir * r}deg) scale(${1 + 0.6 * mid})`, filter: `blur(${mid * 18}px)` }, half ? "a" : "b")}</AbsoluteFill>;
      }
      case "stack":    // B slides up over A like a card on a pile; A sinks back
        return <AbsoluteFill>{L(A, { transform: `scale(${1 - 0.1 * k})`, filter: `brightness(${1 - 0.6 * k})`, borderRadius: 30 * k }, "a")}
          {L(B, { transform: `translateY(${(1 - k) * H}px)`, boxShadow: `0 -30px 80px rgba(0,0,0,${0.6 * (1 - k)})`, borderRadius: 30 * (1 - k) }, "b")}</AbsoluteFill>;
      case "iris":
        return <AbsoluteFill>{L(A, { transform: `scale(${1 + 0.08 * k})` }, "a")}{L(B, { clipPath: `circle(${k * 80}% at ${at[0] * 100}% ${at[1] * 100}%)`, transform: `scale(${1.1 - 0.1 * k})` }, "b")}</AbsoluteFill>;
      case "diagonal": {
        const x = -0.4 + 1.8 * k;
        return <AbsoluteFill>{L(A, {}, "a")}{L(B, { clipPath: `polygon(0 0, ${(x + 0.3) * 100}% 0, ${x * 100}% 100%, 0 100%)` }, "b")}
          <AbsoluteFill style={{ clipPath: `polygon(${(x + 0.3) * 100}% 0, ${(x + 0.34) * 100}% 0, ${(x + 0.04) * 100}% 100%, ${x * 100}% 100%)`, background: color, opacity: mid }} /></AbsoluteFill>;
      }
      case "wave": {   // B rises with a moving sine edge
        const y = 1.1 - 1.25 * k, pts = Array.from({ length: 25 }, (_, i) => `${(i / 24) * 100}% ${(y + 0.05 * Math.sin(i * 0.7 + p * 9) * mid) * 100}%`).join(", ");
        return <AbsoluteFill>{L(A, { transform: `translateY(${-k * 80}px)` }, "a")}{L(B, { clipPath: `polygon(${pts}, 100% 100%, 0 100%)` }, "b")}</AbsoluteFill>;
      }
      case "blob": {   // an ink blot opens B from a point
        const R = Math.hypot(W, H) * EASE.inOut(clamp(p)), n = 40, cx = at[0] * W, cy = at[1] * H;
        const d = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, r = R * (1 + 0.18 * Math.sin(a * 5 + p * 6) * (1 - p)); return `${i ? "L" : "M"}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`; }).join("") + "Z";
        return <AbsoluteFill>{L(A, { filter: `brightness(${1 - 0.3 * k})` }, "a")}{L(B, { clipPath: `path('${d}')` }, "b")}</AbsoluteFill>;
      }
      case "tiles": {  // a grid of colour squares covers A (staggered from a corner) and opens on B
        const cols = 8, rows = Math.round(cols * H / W), cw = W / cols, ch = H / rows, swap = p >= 0.5;
        return <AbsoluteFill>{L(swap ? B : A, {}, swap ? "b" : "a")}
          {Array.from({ length: cols * rows }, (_, i) => { const c = i % cols, r = Math.floor(i / cols), d = (c + r) / (cols + rows - 2) * 0.35, s = p < 0.5 ? io(clamp((p - d * 0.5) / 0.3)) : 1 - io(clamp((p - 0.5 - d * 0.5) / 0.3));
            return <div key={i} style={{ position: "absolute", left: c * cw, top: r * ch, width: cw + 1, height: ch + 1, background: colors[(c + r) % colors.length], transform: `scale(${s})`, borderRadius: (1 - s) * 30 }} />; })}</AbsoluteFill>;
      }
      case "bars": {   // colour bars sweep up to cover, then away to reveal
        const swap = p >= 0.5;
        return <AbsoluteFill>{L(swap ? B : A, {}, swap ? "b" : "a")}
          {colors.map((c, i) => { const q = p < 0.5 ? io(clamp(p * 2 * 1.3 - i * 0.06)) : 1 - io(clamp((p - 0.5) * 2 * 1.3 - i * 0.06)); return <div key={i} style={{ position: "absolute", left: (W / colors.length) * i, width: W / colors.length + 1, [swap ? "top" : "bottom"]: 0, height: H * q, background: c } as React.CSSProperties} />; })}</AbsoluteFill>;
      }
      case "glitch": { // slices jump and colour-split for a few frames around the swap
        const swap = p >= 0.5, g = mid, node = swap ? B : A;
        return <AbsoluteFill style={{ background: "#000" }}>
          {Array.from({ length: 6 }, (_, s) => <AbsoluteFill key={s} style={{ clipPath: `inset(${(s / 6) * 100}% 0 ${100 - ((s + 1) / 6) * 100}% 0)`, transform: `translateX(${(hash(s * 13 + Math.floor(p * 20)) - 0.5) * 160 * g}px)`, overflow: "hidden" }}>{node}</AbsoluteFill>)}
          <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(255,0,80,.25), rgba(0,220,255,.25))", mixBlendMode: "screen", opacity: g }} /></AbsoluteFill>;
      }
      case "flash": {
        const swap = p >= 0.5;
        return <AbsoluteFill>{L(swap ? B : A, { transform: `scale(${1 + 0.06 * mid})` }, swap ? "b" : "a")}<AbsoluteFill style={{ background: "#fff", opacity: Math.pow(mid, 2) * 0.95 }} /></AbsoluteFill>;
      }
      case "split": {  // strips slide alternately up and down (renders A per strip: keep it for light layers)
        const n = 6;
        return <AbsoluteFill>{L(B, { transform: `scale(${1.08 - 0.08 * k})` }, "b")}
          {Array.from({ length: n }, (_, s) => <AbsoluteFill key={s} style={{ clipPath: `inset(0 ${100 - ((s + 1) / n) * 100}% 0 ${(s / n) * 100}%)`, transform: `translateY(${(s % 2 ? 1 : -1) * EASE.in(clamp(p * 1.2 - s * 0.03)) * H * 1.05}px)`, overflow: "hidden" }}>{A}</AbsoluteFill>)}</AbsoluteFill>;
      }
      default:         // luma: a soft dissolve with a slow push, the smoothest join
        return <AbsoluteFill>{L(A, { transform: `scale(${1 + 0.05 * k})` }, "a")}{L(B, { opacity: k, transform: `scale(${1.05 - 0.05 * k})` }, "b")}</AbsoluteFill>;
    }
  };
