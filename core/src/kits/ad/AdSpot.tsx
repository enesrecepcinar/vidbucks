// AdSpot: one 15 s ad template, every field a prop, so a CSV of rows becomes N variants (tools/ad_variants.py).
// Anatomy: HOOK (0-2.4 s: the one thing that is varied most; its look follows the hook type) -> PRODUCT (name + picture
// or icon) -> 3 BENEFITS (stagger, one line each) -> PROOF (only when the row gives a real one: a quote with its source or a
// rating with its count; never invented) -> CTA end card (brand colour, offer, the action). 9:16, 1:1, 4:5 and 16:9 from the
// same props; text stays inside the platform-safe area.
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fInter } from "@remotion/google-fonts/Inter";
import { loadFont as fArchivo } from "@remotion/google-fonts/ArchivoBlack";
import { persona, PersonaName, EASE, clamp, enterK, staggerAt, mixOklch } from "../motion";
import { ICONS, IconId } from "../media/MediaScene";

const INTER = fInter("normal", { weights: ["500", "700", "800"], subsets: ["latin", "latin-ext"] }).fontFamily;
const DISPLAY = fArchivo("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] }).fontFamily;
export type HookType = "question" | "claim" | "pain" | "number" | "pov";
export type AdProps = {
  hook: string; hookType: HookType; product: string; tagline?: string; benefits: string[]; cta: string; offer?: string;
  proof?: { quote?: string; source?: string; rating?: number; count?: string } | null;   // real or absent
  color?: string; image?: string; icon?: IconId; motion?: PersonaName; theme?: "dark" | "light";
};
export const AD_LEN = 15;
const T = { hook: 0, product: 2.4, benefits: 5.0, proof: 9.4, cta: 11.6 };

const Icon: React.FC<{ icon: IconId; size: number }> = ({ icon, size }) => {
  const HUE: Record<string, string> = { yellow: "#f4c64a", red: "#ef5a4c", blue: "#58a6f0", green: "#43b37b", brown: "#c4874f", grey: "#eceae4", dark: "#20222b" };
  return <svg viewBox="-1.1 -1.1 2.2 2.2" width={size} height={size}>{(ICONS[icon] as { P: [number, number][]; closed: boolean; hue: string; ring?: boolean }[]).map((p, i) =>
    <path key={i} d={p.P.map((q, j) => `${j ? "L" : "M"}${q[0]} ${q[1]}`).join("") + (p.closed ? "Z" : "")} fill={p.closed && !p.ring ? HUE[p.hue] : "none"} stroke="#20222b" strokeWidth={0.05} strokeLinejoin="round" />)}</svg>;
};

export const AdSpot: React.FC<AdProps> = (p) => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, u = Math.min(W, H) / 1080, ar = W / H, tall = ar < 0.9;
  const P = persona(p.motion ?? "snappy"), C = p.color ?? "#ff5a36", dark = (p.theme ?? "dark") === "dark";
  const bg = dark ? "#0e1015" : "#f6f4ef", ink = dark ? "#f5f6f8" : "#14161b", dim = dark ? "#9aa1ae" : "#5d6472";
  const phase = t < T.product ? "hook" : t < T.benefits ? "product" : t < (p.proof ? T.proof : T.cta) ? "benefits" : t < T.cta ? "proof" : "cta";
  const safeX = W * (tall ? 0.08 : 0.07), safeR = W * (tall ? 0.16 : 0.07), top = H * (tall ? 0.12 : 0.1), bottomSafe = H * (tall ? 0.22 : 0.08);
  const leaveK = (end: number) => EASE.in(clamp((t - (end - P.exit)) / P.exit));
  const box: React.CSSProperties = { position: "absolute", left: safeX, right: safeR, top, bottom: bottomSafe, display: "flex", flexDirection: "column", justifyContent: "center" };
  let body: React.ReactNode = null;
  if (phase === "hook") {
    const words = p.hook.split(" "), out = leaveK(T.product), big = (tall ? 128 : 96) * u * (p.hook.length > 60 ? 0.7 : p.hook.length > 36 ? 0.85 : 1);
    const lead = { question: "?", claim: "", pain: "", number: "", pov: "POV:" }[p.hookType];
    body = <div style={{ ...box, opacity: 1 - out, transform: `translateY(${-out * 40 * u}px)` }}>
      {p.hookType === "pov" && <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 40 * u, color: C, letterSpacing: 3 * u, marginBottom: 18 * u, opacity: clamp(t / 0.2) }}>{lead}</div>}
      <div style={{ fontFamily: DISPLAY, fontSize: big, lineHeight: 1.06, color: p.hookType === "pain" ? mixOklch(ink, C, 0.25) : ink }}>
        {words.map((w, i) => { const at = staggerAt(0.05, i, words.length, P, 0.9), k = enterK(t, at, P), hot = p.hookType === "number" ? /\d/.test(w) : p.hookType === "claim" ? i === words.length - 1 : false;
          return <span key={i} style={{ display: "inline-block", marginRight: big * 0.25, opacity: clamp((t - at) / 0.08), transform: `translateY(${(1 - clamp(k)) * 40 * u}px) scale(${hot ? 1 + 0.12 * (1 - clamp(k)) : 1})`, color: hot ? C : undefined }}>{w}</span>; })}
      </div>
      {p.hookType === "question" && <div style={{ width: 140 * u * EASE.out(clamp((t - 0.8) / 0.4)), height: 12 * u, background: C, marginTop: 28 * u, borderRadius: 6 * u }} />}
    </div>;
  } else if (phase === "product") {
    const k = enterK(t, T.product, persona("playful")), out = leaveK(T.benefits);
    body = <div style={{ ...box, alignItems: tall ? "flex-start" : "center", flexDirection: tall ? "column" : "row", gap: 50 * u, opacity: 1 - out }}>
      <div style={{ width: (tall ? 520 : 440) * u, height: (tall ? 520 : 440) * u, borderRadius: 48 * u, background: dark ? "#1a1d25" : "#ffffff", boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,.35)`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
        transform: `scale(${0.7 + 0.3 * clamp(k, 0, 1.15)}) rotate(${(1 - clamp(k)) * -6}deg)` }}>
        {p.image ? <Img src={staticFile(p.image)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon icon={p.icon ?? "box"} size={(tall ? 330 : 280) * u} />}
      </div>
      <div style={{ opacity: clamp((t - T.product - 0.25) / 0.25) }}>
        <div style={{ fontFamily: DISPLAY, fontSize: (tall ? 96 : 84) * u, lineHeight: 1.04, color: ink }}>{p.product}</div>
        {p.tagline && <div style={{ fontFamily: INTER, fontWeight: 600, fontSize: 40 * u, color: dim, marginTop: 16 * u }}>{p.tagline}</div>}
      </div>
    </div>;
  } else if (phase === "benefits") {
    const end = p.proof ? T.proof : T.cta, out = leaveK(end);
    body = <div style={{ ...box, gap: 34 * u, opacity: 1 - out }}>
      {p.benefits.slice(0, 3).map((b, i) => { const at = T.benefits + 0.15 + i * 1.1, k = enterK(t, at, P);
        return <div key={i} style={{ display: "flex", alignItems: "center", gap: 28 * u, opacity: clamp((t - at) / 0.12), transform: `translateX(${(1 - clamp(k)) * -60 * u}px)` }}>
          <div style={{ flex: "none", width: 84 * u, height: 84 * u, borderRadius: 99, background: C, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: DISPLAY, fontSize: 44 * u, color: "#111" }}>{i + 1}</div>
          <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: (tall ? 64 : 56) * u, lineHeight: 1.1, color: ink }}>{b}</div>
        </div>; })}
    </div>;
  } else if (phase === "proof" && p.proof) {
    const k = enterK(t, T.proof, P), out = leaveK(T.cta), r = p.proof.rating;
    body = <div style={{ ...box, opacity: (1 - out) * clamp(k * 2), transform: `translateY(${(1 - clamp(k)) * 30 * u}px)` }}>
      {r != null && <div style={{ display: "flex", gap: 12 * u, marginBottom: 26 * u }}>{Array.from({ length: 5 }, (_, i) => { const fill = clamp(r - i) * EASE.out(clamp((t - T.proof - 0.2 - i * 0.12) / 0.3));
        return <div key={i} style={{ position: "relative", width: 76 * u, height: 76 * u }}><div style={{ position: "absolute", inset: 0, color: dark ? "#2b2f3a" : "#dcdcdc", fontSize: 76 * u, lineHeight: 1 }}>★</div>
          <div style={{ position: "absolute", inset: 0, width: `${fill * 100}%`, overflow: "hidden", color: "#ffc531", fontSize: 76 * u, lineHeight: 1 }}>★</div></div>; })}
        {p.proof.count && <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 36 * u, color: dim, alignSelf: "center", marginLeft: 12 * u }}>{r} · {p.proof.count}</div>}</div>}
      {p.proof.quote && <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: (tall ? 66 : 58) * u, lineHeight: 1.15, color: ink }}>“{p.proof.quote}”</div>}
      {p.proof.source && <div style={{ fontFamily: INTER, fontWeight: 600, fontSize: 34 * u, color: dim, marginTop: 20 * u }}>— {p.proof.source}</div>}
    </div>;
  } else {
    const k = enterK(t, T.cta, P), pulse = 1 + 0.035 * Math.sin((t - T.cta) * 5) * clamp((t - T.cta - 0.8) / 0.3);
    body = <AbsoluteFill style={{ background: C, opacity: clamp((t - T.cta) / 0.18) }}>
      <div style={{ ...box, alignItems: "center", textAlign: "center" }}>
        <div style={{ fontFamily: DISPLAY, fontSize: (tall ? 104 : 92) * u, lineHeight: 1.04, color: "#111", transform: `scale(${0.9 + 0.1 * clamp(k, 0, 1.1)})` }}>{p.product}</div>
        {p.offer && <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 46 * u, color: "#111", marginTop: 22 * u, opacity: clamp((t - T.cta - 0.3) / 0.25) }}>{p.offer}</div>}
        <div style={{ marginTop: 44 * u, padding: `${24 * u}px ${54 * u}px`, borderRadius: 99, background: "#111", color: "#fff", fontFamily: INTER, fontWeight: 800, fontSize: 46 * u, transform: `scale(${pulse * clamp(enterK(t, T.cta + 0.45, persona("playful")), 0, 1.1)})` }}>{p.cta}</div>
      </div>
    </AbsoluteFill>;
  }
  // idle life: each phase pushes in slowly and the light drifts, so no beat is a frozen card
  const ps = phase === "hook" ? T.hook : phase === "product" ? T.product : phase === "benefits" ? T.benefits : phase === "proof" ? T.proof : T.cta;
  const pe = phase === "hook" ? T.product : phase === "product" ? T.benefits : phase === "benefits" ? (p.proof ? T.proof : T.cta) : phase === "proof" ? T.cta : AD_LEN;
  const push = 1 + 0.05 * EASE.inOut(clamp((t - ps) / (pe - ps))), gx = 30 + 25 * Math.sin(t * 0.6), gy = 25 + 15 * Math.cos(t * 0.45);
  return <AbsoluteFill style={{ background: `radial-gradient(ellipse at ${gx}% ${gy}%, ${mixOklch(bg, C, dark ? 0.2 : 0.12)}, ${bg})` }}>
    <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: "40% 45%" }}>{body}</AbsoluteFill></AbsoluteFill>;
};

export const DEMO_AD: AdProps = { hook: "Your desk lamp is lying to you.", hookType: "claim", product: "Halo Desk Light", tagline: "A fictional lamp for this demo",
  benefits: ["Warm in the evening, cool at noon", "One touch, no app", "Folds flat into a bag"], cta: "See how it works", offer: "Demo offer text", icon: "bulb", color: "#ffb02e" };
