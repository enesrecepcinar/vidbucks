// ClipVlog: assembles AI-generated clips into a finished short: title / end cards over a blurred still, the clips
// themselves (muted: sound is mixed separately), "insert" moments made from a still (a slow push into a region with
// a hand-written line appearing on it), word-timed captions, and an honest AI disclosure line on the end card.
// Built for the Dreamina / Seedance route (docs: knowledge/ai-video/dreamina-seedance-workflow.md) but takes any clips.
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fInter } from "@remotion/google-fonts/Inter";
import { loadFont as fHand } from "@remotion/google-fonts/PatrickHand";
import { EASE, clamp, enterK, persona } from "../motion";

const INTER = fInter("normal", { weights: ["600", "800", "900"], subsets: ["latin", "latin-ext"] }).fontFamily;
const HAND = fHand("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] }).fontFamily;

export type VlogSeg =
  | { kind: "card"; at: number; dur: number; still: string; title: string; sub?: string; note?: string }
  | { kind: "clip"; at: number; dur: number; src: string; from?: number }
  | { kind: "insert"; at: number; dur: number; still: string; focus: [number, number]; zoom?: number; write?: string; writeAt?: number };
export type VlogCaption = { at: number; end: number; text: string };
export type VlogCfg = { segments: VlogSeg[]; captions: VlogCaption[]; duration: number; accent?: string };

const Card: React.FC<{ s: Extract<VlogSeg, { kind: "card" }>; t: number; W: number; H: number; accent: string }> = ({ s, t, W, H, accent }) => {
  const u = Math.min(W, H) / 1080, k = enterK(t, 0.1, persona("confident")), push = 1.08 + 0.06 * EASE.inOut(clamp(t / s.dur));
  return (
    <AbsoluteFill style={{ background: "#0d0b09" }}>
      <Img src={staticFile(s.still)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(18px) brightness(.45)", transform: `scale(${push})` }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 * u, textAlign: "center" }}>
        <div style={{ fontFamily: INTER, fontWeight: 900, fontSize: 120 * u, lineHeight: 1.02, color: "#fff", opacity: clamp(k * 2), transform: `translateY(${(1 - clamp(k)) * 30 * u}px)` }}>{s.title}</div>
        {s.sub && <div style={{ fontFamily: HAND, fontSize: 64 * u, color: accent, marginTop: 26 * u, opacity: clamp((t - 0.35) / 0.3) }}>{s.sub}</div>}
      </AbsoluteFill>
      {s.note && <div style={{ position: "absolute", left: 0, right: 0, bottom: H * 0.24, textAlign: "center", fontFamily: INTER, fontWeight: 600, fontSize: 30 * u, color: "rgba(255,255,255,.75)", opacity: clamp((t - 0.6) / 0.4) }}>{s.note}</div>}
    </AbsoluteFill>
  );
};

const Insert: React.FC<{ s: Extract<VlogSeg, { kind: "insert" }>; t: number; W: number; H: number }> = ({ s, t, W, H }) => {
  const u = Math.min(W, H) / 1080, z = 1 + ((s.zoom ?? 2.6) - 1) * EASE.inOut(clamp(t / (s.dur * 0.55)));
  const [fx, fy] = s.focus, wa = s.writeAt ?? s.dur * 0.45, wk = clamp((t - wa) / 0.9), glow = clamp(1 - Math.abs(t - wa - 0.9) / 0.5);
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <Img src={staticFile(s.still)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transformOrigin: `${fx * 100}% ${fy * 100}%`, transform: `scale(${z})` }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 42%, rgba(255,230,170,${0.25 * glow}), rgba(0,0,0,.25) 70%)` }} />
      {s.write && <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.34, textAlign: "center" }}>
        <span style={{ fontFamily: HAND, fontSize: 210 * u, color: "rgba(250,248,240,.93)", textShadow: `0 0 ${18 * u}px rgba(255,240,200,${0.5 * glow + 0.15})`, letterSpacing: 4 * u,
          clipPath: `inset(0 ${100 - wk * 100}% 0 0)`, display: "inline-block", filter: "url(#vl-chalk)" }}>{s.write}</span></div>}
      <svg width="0" height="0" style={{ position: "absolute" }}><filter id="vl-chalk"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={3} /><feDisplacementMap in="SourceGraphic" scale={4} /></filter></svg>
    </AbsoluteFill>
  );
};

export const ClipVlog: React.FC<{ cfg: VlogCfg }> = ({ cfg }) => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, u = Math.min(W, H) / 1080, accent = cfg.accent ?? "#ffcf6b";
  const cap = cfg.captions.find((c) => t >= c.at && t < c.end);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {cfg.segments.map((s, i) => (
        <Sequence key={i} from={Math.round(s.at * fps)} durationInFrames={Math.round(s.dur * fps)} layout="none">
          <AbsoluteFill>
            {s.kind === "clip" ? <OffthreadVideo src={staticFile(s.src)} muted startFrom={Math.round((s.from ?? 0) * fps)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : s.kind === "card" ? <Card s={s} t={t - s.at} W={W} H={H} accent={accent} /> : <Insert s={s} t={t - s.at} W={W} H={H} />}
          </AbsoluteFill>
        </Sequence>
      ))}
      {cap && (() => { const k = clamp((t - cap.at) / 0.12), out = clamp((cap.end - t) / 0.1);
        return <div style={{ position: "absolute", left: W * 0.08, right: W * 0.08, top: H * 0.7, display: "flex", justifyContent: "center", opacity: Math.min(k, out) }}>
          <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 54 * u, lineHeight: 1.18, color: "#fff", textAlign: "center", background: "rgba(10,10,12,.72)", padding: `${12 * u}px ${24 * u}px`, borderRadius: 14 * u, transform: `scale(${0.96 + 0.04 * k})` }}>{cap.text}</div>
        </div>; })()}
    </AbsoluteFill>
  );
};
