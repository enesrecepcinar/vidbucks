// VidbucksPromo4: "the edit is the product". Each chapter TURNS INTO the capability it shows, and the transitions are made
// of that capability: a glass studio measures a film and splits it into its shots; one scene is re-born in six media,
// each entered through its own medium (ink line, torn paper, riso plates, pixel grid, iso lift, scan line); a glass editor
// cuts the filler words, ripples the timeline and reframes 16:9 -> 9:16 on the speaker; a chat bubble grows into a bar
// race whose leader becomes a #1 countdown, which a whiteboard hand ticks off; glass gauges pass the gates; a liquid-glass
// logo. New here: real frosted glass (backdrop-filter over a moving mesh), 3D depth, SVG refraction, style-native wipes.
import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fInter } from "@remotion/google-fonts/Inter";
import { loadFont as fArchivo } from "@remotion/google-fonts/ArchivoBlack";
import { loadFont as fMono } from "@remotion/google-fonts/JetBrainsMono";
import { EASE, clamp, enterK, persona, mixOklch } from "../motion";
import { TransitionStage, TKind } from "../transitions";
import { MediaSceneDemo, Medium } from "../media/MediaScene";
import { DataRace, DEMO_RACE } from "../data/DataRace";
import { Countdown, DEMO_COUNT } from "../list/Countdown";
import { Whiteboard, WbCfg } from "../media/Whiteboard";
import { DEMO_LOGO } from "../logo/LogoReveal";

const INTER = fInter("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin"] }).fontFamily;
const BLACK = fArchivo("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
const MONO = fMono("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily;
export const PROMO4_LEN = 36;
const LEAD = 0.5;
const K = { bg: "#07080d", ink: "#f6f7fb", dim: "rgba(246,247,251,.62)", acc: "#ffb02e", blue: "#5b8cff", violet: "#9b6bff", pink: "#ff5fa2", teal: "#2fd3c0", red: "#ff5a36" };
const PL = persona("playful"), CF = persona("confident");
const seg = (t: number, a: number, d: number) => clamp((t - a) / d);
const useT = () => { const f = useCurrentFrame(), { fps } = useVideoConfig(); return f / fps - LEAD; };
const useU = () => { const { width: W, height: H } = useVideoConfig(); return { W, H, u: Math.min(W, H) / 1080, v: H > W }; };

/* ------------------------------------------------------------------ glass building blocks ------------------------------------------------------------------ */
/** a living mesh gradient: four big soft colour fields drifting (the light the glass refracts) */
const Mesh: React.FC<{ t: number; hues?: string[]; dark?: number }> = ({ t, hues = [K.violet, K.blue, K.pink, K.teal], dark = 0.35 }) => {
  const { W, H } = useU();
  return (
    <AbsoluteFill style={{ background: K.bg, overflow: "hidden" }}>
      {hues.map((c, i) => { const x = W * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 1.7))), y = H * (0.2 + 0.6 * (0.5 + 0.5 * Math.cos(t * 0.65 + i * 2.3))), r = Math.max(W, H) * (0.36 + 0.06 * Math.sin(t * 0.5 + i));
        return <div key={i} style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: c, opacity: 0.55, filter: `blur(${Math.max(W, H) * 0.09}px)` }} />; })}
      <AbsoluteFill style={{ background: `rgba(7,8,13,${dark})` }} />
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.06, mixBlendMode: "overlay" }}><filter id="mg"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={Math.floor(t * 12) % 20} /></filter><rect width="100%" height="100%" filter="url(#mg)" /></svg>
    </AbsoluteFill>
  );
};
/** frosted glass: blurs what is behind it, a thin bright rim, a top highlight */
const Glass: React.FC<{ style?: React.CSSProperties; r?: number; children?: React.ReactNode; tint?: number }> = ({ style, r = 28, children, tint = 0.1 }) => {
  const { u } = useU();
  return (
    <div style={{ position: "absolute", borderRadius: r * u, background: `linear-gradient(160deg, rgba(255,255,255,${tint + 0.08}), rgba(255,255,255,${tint * 0.4}))`, backdropFilter: `blur(${28 * u}px) saturate(1.7)`, WebkitBackdropFilter: `blur(${28 * u}px) saturate(1.7)`,
      border: `${1.5 * u}px solid rgba(255,255,255,.28)`, boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,.35), inset 0 ${1.5 * u}px 0 rgba(255,255,255,.45)`, overflow: "hidden", ...style }}>{children}</div>
  );
};
const Pill: React.FC<{ x: number; y: number; text: string; k?: number; color?: string; size?: number }> = ({ x, y, text, k = 1, color = K.ink, size = 26 }) => {
  const { u } = useU();
  return <Glass r={99} style={{ left: x, top: y, padding: `${10 * u}px ${22 * u}px`, opacity: clamp(k * 2), transform: `translateY(${(1 - EASE.out(clamp(k))) * 20 * u}px) scale(${0.9 + 0.1 * EASE.out(clamp(k))})` }}>
    <span style={{ fontFamily: INTER, fontWeight: 700, fontSize: size * u, color, whiteSpace: "nowrap" }}>{text}</span></Glass>;
};
const Vid: React.FC<{ src: string; from?: number; style?: React.CSSProperties; fit?: "cover" | "contain" }> = ({ src, from = 0, style, fit = "cover" }) => {
  const { fps } = useVideoConfig();
  return <Sequence from={Math.round((from + LEAD) * fps)} layout="none"><OffthreadVideo src={staticFile(`promo/clips/${src}.mp4`)} muted style={{ width: "100%", height: "100%", objectFit: fit, ...style }} /></Sequence>;
};

/* ------------------------------------------------------------------ 1. glass studio: measure a film (0-5) ------------------------------------------------------------------ */
const SHOTS6 = ["h_bunker", "h_culluk", "h_enfl", "h_fifties", "h_nova", "h_petek"];
const Studio1: React.FC = () => {
  const t = useT(), { W, H, u, v } = useU();
  const win = clamp(enterK(t, 0.1, CF, 0.7), 0, 1.05), ww = v ? W * 0.88 : W * 0.66, wh = v ? H * 0.5 : H * 0.66, wx = (W - ww) / 2, wy = v ? H * 0.16 : (H - wh) / 2 - 20 * u;
  const drop = clamp(enterK(t, 0.9, PL, 0.55), 0, 1.15), split = EASE.inOut(seg(t, 2.5, 0.7)), scan = seg(t, 1.5, 0.9);
  const zx = wx + ww * 0.08, zy = wy + 90 * u, zw = ww * 0.84, zh = wh - 190 * u;
  const push = EASE.in(seg(t, 4.2, 0.8)), card0 = { x: zx, y: zy + zh * 0.62 };
  return (
    <AbsoluteFill style={{ perspective: 1800 * u }}>
      <Mesh t={t} />
      <AbsoluteFill style={{ transform: `translateZ(${push * 900 * u}px)`, transformOrigin: `${(card0.x + 60 * u) / W * 100}% ${(card0.y + 40 * u) / H * 100}%` }}>
        <Glass style={{ left: wx, top: wy, width: ww, height: wh, opacity: clamp(win * 2), transform: `translateY(${(1 - Math.min(1, win)) * 120 * u}px) rotateX(${(1 - Math.min(1, win)) * 18}deg)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 * u, padding: `${22 * u}px ${28 * u}px` }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => <div key={c} style={{ width: 16 * u, height: 16 * u, borderRadius: 99, background: c }} />)}
            <div style={{ marginLeft: 14 * u, fontFamily: MONO, fontSize: 24 * u, color: K.dim }}>vidbucks · new film</div>
          </div>
        </Glass>
        {/* drop zone */}
        <div style={{ position: "absolute", left: zx, top: zy, width: zw, height: zh * (1 - 0.45 * split), borderRadius: 22 * u, border: `${3 * u}px dashed rgba(255,255,255,${0.35 * (1 - drop)})`, opacity: clamp(win * 2) }}>
          {drop < 0.2 && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: INTER, fontWeight: 700, fontSize: 34 * u, color: K.dim }}>drop a reference</div>}
        </div>
        {/* the reference film lands, gets scanned */}
        {t > 0.85 && split < 1 && <div style={{ position: "absolute", left: zx + zw * 0.1, top: zy + 10 * u, width: zw * 0.8, height: (zh - 20 * u) * (1 - 0.45 * split), borderRadius: 18 * u, overflow: "hidden", boxShadow: `0 ${30 * u}px ${60 * u}px rgba(0,0,0,.5)`,
          transform: `translate(${(1 - Math.min(1, drop)) * W * 0.4}px, ${(1 - Math.min(1, drop)) * -H * 0.4}px) rotate(${(1 - Math.min(1, drop)) * 18}deg) scale(${1 - 0.4 * split})`, opacity: 1 - split }}>
          <Vid src="ref_galata" from={0.85} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${scan * 100}%`, width: 6 * u, background: "#fff", boxShadow: `0 0 ${40 * u}px ${12 * u}px rgba(155,107,255,.8)`, opacity: scan > 0 && scan < 1 ? 1 : 0 }} />
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${scan * 100}%`, background: "rgba(155,107,255,.12)" }} />
        </div>}
        {/* the film splits into its shots along a timeline */}
        {SHOTS6.map((s, i) => { const k = clamp(enterK(t, 2.5 + i * 0.07, PL, 0.5), 0, 1.1), cw = (zw - 50 * u) / 6, x = zx + 10 * u + i * (cw + 6 * u), y = zy + zh * 0.62;
          const fromX = zx + zw / 2 - cw / 2, fromY = zy + zh * 0.25;
          return split > 0 && <div key={s} style={{ position: "absolute", left: fromX + (x - fromX) * Math.min(1, k), top: fromY + (y - fromY) * Math.min(1, k), width: cw, height: cw * 9 / 16, borderRadius: 10 * u, overflow: "hidden", border: `${2 * u}px solid rgba(255,255,255,.5)`, transform: `scale(${0.6 + 0.4 * Math.min(1, k)}) rotate(${(1 - Math.min(1, k)) * (i - 2.5) * 8}deg)`, boxShadow: `0 ${12 * u}px ${30 * u}px rgba(0,0,0,.4)` }}>
            <Vid src={s} from={2.5} /></div>; })}
        {split > 0.3 && <div style={{ position: "absolute", left: zx + 10 * u, top: zy + zh * 0.62 - 26 * u, width: zw - 20 * u, height: 6 * u, borderRadius: 3 * u, background: "rgba(255,255,255,.18)" }}>
          {Array.from({ length: 5 }, (_, i) => <div key={i} style={{ position: "absolute", left: `${((i + 1) / 6) * 100}%`, top: -8 * u, width: 4 * u, height: 22 * u, background: K.acc, transform: `scaleY(${EASE.out(seg(t, 3.0 + i * 0.08, 0.2))})` }} />)}</div>}
        {[["6 shots", 3.2], ["117.5 BPM", 3.35], ["-15.9 LUFS", 3.5], ["dissolve 2.47 s", 3.65]].map(([txt, at], i) =>
          <Pill key={txt as string} x={v ? wx + (i % 2) * ww * 0.5 : wx + ww * 0.06 + i * ww * 0.23} y={v ? wy + wh + 30 * u + Math.floor(i / 2) * 80 * u : wy + wh + 26 * u} text={txt as string} k={seg(t, at as number, 0.3)} color={i === 0 ? K.acc : K.ink} />)}
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: v ? H * 0.06 : H * 0.045, textAlign: "center", fontFamily: BLACK, fontSize: (v ? 64 : 58) * u, color: K.ink, opacity: clamp(win * 2) * (1 - push), letterSpacing: 1 * u }}>
        {t < 2.4 ? "Drop a film you love." : <span>It reads <span style={{ color: K.acc }}>every shot.</span></span>}</div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 2. one scene, six media, each entered through its medium (5-14) ------------------------------------------------------------------ */
const MEDIA6: { m: Medium; name: string; via: "ink" | "tear" | "plates" | "pixel" | "lift" | "scan" }[] = [
  { m: "crosshatch", name: "Crosshatch ink", via: "ink" }, { m: "cut-paper", name: "Cut paper", via: "tear" }, { m: "riso", name: "Riso print", via: "plates" },
  { m: "pixel", name: "Pixel", via: "pixel" }, { m: "isometric", name: "Isometric", via: "lift" }, { m: "math", name: "Math stage", via: "scan" },
];
const STY = 1.5, SJ = 0.45;
const MediaShot: React.FC<{ i: number; lt: number }> = ({ i, lt }) => {
  const { fps } = useVideoConfig();
  // every medium plays the SAME beat (the house being drawn), so the viewer sees one scene change its skin
  return <AbsoluteFill style={{ transform: `scale(${1.03 + 0.03 * clamp(lt / STY)})` }}><Sequence from={-Math.round((0.3 - 0) * fps) + Math.round(0)} layout="none"><MediaSceneDemo medium={MEDIA6[i].m} captions={false} /></Sequence></AbsoluteFill>;
};
const Styles2: React.FC = () => {
  const t = useT(), { fps } = useVideoConfig(), { W, H, u, v } = useU();
  const idx = clamp(Math.floor((t + SJ / 2) / STY), 0, 5), start = (k: number) => k * STY;
  const shotAt = (k: number) => <Sequence from={Math.round((start(k) - SJ / 2 + LEAD - 0.6) * fps)} layout="none"><MediaShot i={k} lt={t - start(k)} /></Sequence>;
  const j = idx > 0 && t < start(idx) + SJ / 2 && t >= start(idx) - SJ / 2 ? idx : 0;
  let body: React.ReactNode = shotAt(idx);
  if (j) {
    const p = EASE.inOut(clamp((t - (start(j) - SJ / 2)) / SJ)), A = shotAt(j - 1), B = shotAt(j), via = MEDIA6[j].via;
    if (via === "tear") {   // a torn paper edge crosses the frame; B is the paper underneath
      const x = -0.15 + 1.3 * p, pts = Array.from({ length: 30 }, (_, n) => `${(x + 0.035 * Math.sin(n * 2.7) + 0.02 * Math.sin(n * 7.1)) * 100}% ${(n / 29) * 100}%`);
      body = <AbsoluteFill>{B}<AbsoluteFill style={{ clipPath: `polygon(${pts.join(", ")}, 100% 100%, 100% 0)`, filter: `drop-shadow(${-10 * u}px 0 ${12 * u}px rgba(0,0,0,.35))` }}>{A}</AbsoluteFill></AbsoluteFill>;
    } else if (via === "plates") {   // three ink plates slide in from different directions and lock into register
      const off = (1 - p) * 140 * u;
      body = <AbsoluteFill>{A && <AbsoluteFill style={{ opacity: 1 - p }}>{A}</AbsoluteFill>}
        <AbsoluteFill style={{ opacity: p, filter: "hue-rotate(150deg) saturate(1.6)", mixBlendMode: "multiply", transform: `translate(${-off}px, ${off * 0.4}px)` }}>{B}</AbsoluteFill>
        <AbsoluteFill style={{ opacity: p * 0.8, filter: "hue-rotate(300deg) saturate(1.8)", mixBlendMode: "multiply", transform: `translate(${off}px, ${-off * 0.3}px)` }}>{B}</AbsoluteFill>
        <AbsoluteFill style={{ opacity: p }}>{B}</AbsoluteFill></AbsoluteFill>;
    } else if (via === "pixel") {    // the picture steps down in resolution, the grid snaps, the pixel world steps up
      const g = Math.round(8 + 56 * Math.sin(Math.PI * p)), node = p < 0.5 ? A : B;
      body = <AbsoluteFill>{node}<AbsoluteFill style={{ backdropFilter: `blur(${Math.sin(Math.PI * p) * 14}px)`, backgroundImage: `linear-gradient(rgba(0,0,0,.35) 2px, transparent 2px), linear-gradient(90deg, rgba(0,0,0,.35) 2px, transparent 2px)`, backgroundSize: `${g * u}px ${g * u}px`, opacity: Math.sin(Math.PI * p) }} /></AbsoluteFill>;
    } else if (via === "lift") {     // the flat world tilts back into the isometric plane and sinks away
      body = <AbsoluteFill style={{ perspective: 1600 * u, background: "#fff" }}>{B}
        <AbsoluteFill style={{ transform: `rotateX(${p * 58}deg) rotateZ(${-p * 40}deg) scale(${1 - 0.55 * p}) translateY(${p * H * 0.5}px)`, opacity: 1 - EASE.in(clamp((p - 0.5) / 0.5)), boxShadow: `0 ${40 * u}px ${100 * u}px rgba(0,0,0,${0.5 * p})` }}>{A}</AbsoluteFill></AbsoluteFill>;
    } else if (via === "scan") {     // a glowing scan line sweeps down: the math stage is drawn behind it
      const y = p * 100;
      body = <AbsoluteFill>{A}<AbsoluteFill style={{ clipPath: `inset(0 0 ${100 - y}% 0)` }}>{B}</AbsoluteFill>
        <div style={{ position: "absolute", left: 0, right: 0, top: `${y}%`, height: 4 * u, background: "#f7d96f", boxShadow: `0 0 ${50 * u}px ${16 * u}px rgba(247,217,111,.6)` }} /></AbsoluteFill>;
    } else {                         // ink: a hand-drawn line writes across, the new world behind it
      body = <TransitionStage kind="diagonal" p={p} A={A} B={B} color="#2a2420" />;
    }
  }
  const cur = MEDIA6[idx];
  return (
    <AbsoluteFill>
      {body}
      {/* a glass rail of all six media; the current one lights up */}
      <Glass r={24} style={{ ...(v ? { left: W * 0.06, right: W * 0.06, top: H * 0.035, height: 84 * u, display: "flex", alignItems: "center", justifyContent: "space-around" } : { left: 40 * u, top: H * 0.18, width: 300 * u, padding: `${18 * u}px 0` }) }} tint={0.14}>
        {MEDIA6.map((m, k) => <div key={m.m} style={{ fontFamily: INTER, fontWeight: 700, fontSize: (v ? 20 : 26) * u, padding: v ? 0 : `${10 * u}px ${24 * u}px`, color: k === idx ? "#111" : "rgba(255,255,255,.85)", background: k === idx ? K.acc : "transparent", borderRadius: 12 * u, margin: v ? 0 : `0 ${12 * u}px`, ...(v ? { padding: `${6 * u}px ${10 * u}px` } : {}), transition: "none" }}>{v ? String(k + 1).padStart(2, "0") : m.name}</div>)}
      </Glass>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: v ? H * 0.24 : H * 0.06, display: "flex", justifyContent: "center" }}>
        <div style={{ padding: `${12 * u}px ${30 * u}px`, borderRadius: 99, background: "rgba(14,16,24,.78)", backdropFilter: `blur(${18 * u}px)`, border: `${1.5 * u}px solid rgba(255,255,255,.28)`, fontFamily: BLACK, fontSize: (v ? 48 : 46) * u, color: "#fff", boxShadow: `0 ${16 * u}px ${40 * u}px rgba(0,0,0,.35)` }}>
          One scene. <span style={{ color: K.acc }}>{cur.name}.</span></div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 3. the glass editor: cut, ripple, reframe (14-21) ------------------------------------------------------------------ */
const WORDS = [["So,", 1], ["um,", 0], ["it's", 1], ["eleven", 1], ["fifty", 1], ["two", 1], ["and,", 1], ["like,", 0], ["you're", 1], ["on", 1], ["the", 1], ["last", 1], ["train", 1], ["home.", 1]] as [string, number][];
const Editor3: React.FC = () => {
  const t = useT(), { W, H, u, v } = useU();
  const sheet = clamp(enterK(t, 0, CF, 0.6), 0, 1.05);
  const strike = EASE.inOut(seg(t, 1.4, 0.35)), collapse = EASE.inOut(seg(t, 1.8, 0.45)), reframe = EASE.inOut(seg(t, 2.9, 0.8)), cap = t > 3.9, broll = EASE.inOut(seg(t, 5.1, 0.5)) * (1 - EASE.inOut(seg(t, 6.2, 0.4)));
  // preview geometry: 16:9 box that narrows to 9:16 around the tracked character
  const pvW0 = v ? W * 0.86 : W * 0.5, pvH = v ? pvW0 * 9 / 16 * 1.0 : pvW0 * 9 / 16, pvW = pvW0 + (pvH * 9 / 16 - pvW0) * reframe, pvX = v ? (W - pvW) / 2 : W * 0.06 + (pvW0 - pvW) / 2, pvY = v ? H * 0.14 : H * 0.14;
  const trackX = 0.5 + 0.12 * Math.sin(t * 1.3);
  const capWords = ["YOU'RE", "ON THE", "LAST", "TRAIN"], ci = cap ? Math.min(3, Math.floor((t - 3.9) / 0.35)) : -1;
  return (
    <AbsoluteFill>
      <Mesh t={t + 14} hues={[K.blue, K.teal, K.violet, K.pink]} dark={0.45} />
      <AbsoluteFill style={{ transform: `translateY(${(1 - Math.min(1, sheet)) * H * 0.4}px)`, opacity: clamp(sheet * 2) }}>
        {/* preview */}
        <Glass r={20} style={{ left: pvX - 14 * u, top: pvY - 14 * u, width: pvW + 28 * u, height: pvH + 28 * u }} tint={0.06} />
        <div style={{ position: "absolute", left: pvX, top: pvY, width: pvW, height: pvH, borderRadius: 14 * u, overflow: "hidden", background: "#000" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: -(pvW0 - pvW) * trackX, width: pvW0 }}><Vid src="foot_bunker" from={-0.3} /></div>
          {broll > 0 && <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: pvH * 0.48 * broll, overflow: "hidden", borderBottom: `${3 * u}px solid rgba(255,255,255,.6)` }}><div style={{ position: "absolute", left: 0, right: 0, top: 0, height: pvH * 0.48 }}><Vid src="fifties_cars" from={5.1} /></div></div>}
          {reframe > 0.2 && <div style={{ position: "absolute", left: pvW * 0.18, top: pvH * 0.22, width: pvW * 0.64, height: pvH * 0.5, border: `${3 * u}px solid ${K.teal}`, borderRadius: 10 * u, opacity: (reframe - 0.2) * (1 - seg(t, 3.9, 0.3)) }}>
            <div style={{ position: "absolute", top: -34 * u, left: 0, fontFamily: MONO, fontWeight: 700, fontSize: 20 * u, color: K.teal }}>speaker tracked</div></div>}
          {cap && ci >= 0 && <div style={{ position: "absolute", left: 0, right: 0, top: pvH * 0.62, textAlign: "center" }}>
            <span style={{ fontFamily: BLACK, fontSize: Math.min(64 * u, pvW / 6), color: "#fff", background: "rgba(0,0,0,.6)", padding: `${4 * u}px ${12 * u}px`, borderRadius: 8 * u, display: "inline-block", transform: `scale(${1 + 0.25 * (1 - EASE.out(clamp(((t - 3.9) % 0.35) / 0.12)))})` }}>{capWords[ci]}</span></div>}
          {broll > 0.5 && <div style={{ position: "absolute", left: 10 * u, top: 10 * u, fontFamily: MONO, fontWeight: 700, fontSize: 18 * u, color: "#111", background: K.acc, padding: `${3 * u}px ${8 * u}px`, borderRadius: 6 * u }}>B-ROLL ON THE WORD</div>}
        </div>
        {/* transcript: filler words are struck and collapse */}
        <Glass r={20} style={{ ...(v ? { left: W * 0.07, right: W * 0.07, top: pvY + pvH + 40 * u } : { left: W * 0.6, right: W * 0.06, top: pvY }), padding: 26 * u }}>
          <div style={{ fontFamily: MONO, fontSize: 20 * u, color: K.dim, marginBottom: 12 * u }}>transcript · cut on the words</div>
          <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: (v ? 40 : 38) * u, lineHeight: 1.35, color: K.ink }}>
            {WORDS.map(([w, keep], i) => { const shown = t > 0.3 + i * 0.05, filler = !keep;
              return shown && <span key={i} style={{ display: "inline-block", marginRight: (filler ? 14 * (1 - collapse) : 14) * u, maxWidth: filler ? `${(1 - collapse) * 6}em` : undefined, overflow: "hidden", whiteSpace: "nowrap", verticalAlign: "bottom",
                color: filler ? K.red : K.ink, textDecoration: filler && strike > 0.5 ? "line-through" : "none", opacity: filler ? 1 - collapse : 1, background: filler && t > 1.1 ? `rgba(255,90,54,${0.25 * (1 - collapse)})` : "transparent", borderRadius: 6 * u }}>{w}</span>; })}
          </div>
        </Glass>
        {/* timeline: three red blocks close, the rest ripple left */}
        <Glass r={18} style={{ left: W * 0.06, right: W * 0.06, top: v ? H * 0.68 : H * 0.72, height: 100 * u, padding: 18 * u }}>
          <div style={{ position: "relative", height: "100%" }}>
            {(() => { const blocks = [3, 1, 4, 1, 3, 2, 1, 4, 3], cut = [1, 3, 6]; let x = 0; const tot = blocks.reduce((a, b) => a + b, 0);
              return blocks.map((b, i) => { const isCut = cut.includes(i), w = (b / tot) * (isCut ? 1 - collapse : 1), el = <div key={i} style={{ position: "absolute", left: `${x * 100}%`, width: `calc(${w * 100}% - ${4 * u}px)`, top: 0, bottom: 0, borderRadius: 8 * u, background: isCut ? `rgba(255,90,54,${0.9 * (1 - collapse)})` : mixOklch(K.blue, K.teal, (i % 3) / 3), opacity: isCut ? 1 - collapse * 0.5 : 0.9 }} />; x += w; return el; }); })()}
            <div style={{ position: "absolute", top: -8 * u, bottom: -8 * u, left: `${(seg(t, 0.4, 6.0)) * 100}%`, width: 3 * u, background: "#fff" }} />
          </div>
        </Glass>
        {[["fillers cut", 2.0, "#ff9e8a"], ["16:9 → 9:16", 3.0, K.teal], ["captions on the words", 3.95, K.acc]].map(([txt, at, c], i) => <Pill key={txt as string} x={v ? W * 0.07 + i * W * 0.3 : W * 0.6 + i * 0}
          y={v ? H * 0.62 : H * 0.14 + 300 * u + i * 70 * u} text={txt as string} k={seg(t, at as number, 0.3)} color={c as string} size={v ? 20 : 26} />)}
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: v ? H * 0.045 : H * 0.055, textAlign: "center", fontFamily: BLACK, fontSize: (v ? 60 : 50) * u, color: K.ink, opacity: clamp(sheet * 2) }}>Edits <span style={{ color: K.acc }}>your</span> footage too.</div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 4. format chain: chat -> race -> #1 -> whiteboard (21-29) ------------------------------------------------------------------ */
const Chain4: React.FC = () => {
  const t = useT(), { fps } = useVideoConfig(), { W, H, u, v } = useU();
  const phH = v ? H * 0.62 : H * 0.8, phW = phH * 9 / 19.5, phX = (W - phW) / 2, phY = (H - phH) / 2;
  const grow = EASE.inOut(seg(t, 2.2, 0.55)), barSweep = EASE.inOut(seg(t, 5.0, 0.45)), wbIn = EASE.inOut(seg(t, 6.3, 0.4));
  // the "Watch." bubble's rect -> the full frame
  const bx = phX + phW * 0.38, by = phY + phH * 0.52, bw = phW * 0.52, bh = 70 * u;
  const rx = bx + (0 - bx) * grow, ry = by + (0 - by) * grow, rw = bw + (W - bw) * grow, rh = bh + (H - bh) * grow, rr = 26 * u * (1 - grow);
  const bubble = (txt: string, me: boolean, at: number, y: number) => { const k = clamp(enterK(t, at, PL, 0.35), 0, 1.1); return t >= at && <div style={{ position: "absolute", top: y, ...(me ? { right: phW * 0.06 } : { left: phW * 0.06 }), maxWidth: phW * 0.8, padding: `${14 * u}px ${20 * u}px`, borderRadius: 26 * u, background: me ? K.blue : "rgba(255,255,255,.18)", backdropFilter: me ? undefined : `blur(${12 * u}px)`, color: "#fff", fontFamily: INTER, fontWeight: 600, fontSize: 30 * u, transform: `scale(${Math.min(1, k)})`, transformOrigin: me ? "bottom right" : "bottom left", opacity: clamp(k * 3) }}>{txt}</div>; };
  const wb: WbCfg = React.useMemo(() => ({ speed: 2600, items: [
    { kind: "line", P: [[W * 0.36, H * 0.48], [W * 0.46, H * 0.6], [W * 0.66, H * 0.3]], w: 22, color: "#2fb37a", at: 0.25 },
    { kind: "text", text: "done.", x: W * 0.42, y: H * 0.8, size: Math.min(W, H) * 0.12, color: "#1d1e22" } ] }), [W, H, v]);
  return (
    <AbsoluteFill>
      <Mesh t={t + 21} hues={[K.blue, K.violet, K.teal, K.pink]} />
      {/* glass phone with a two-line chat */}
      <AbsoluteFill style={{ opacity: 1 - grow * 0.9, transform: `scale(${1 + 0.2 * grow})` }}>
        <Glass r={54} style={{ left: phX, top: phY, width: phW, height: phH }} tint={0.12}>
          <div style={{ position: "absolute", top: 18 * u, left: "50%", width: 120 * u, height: 32 * u, marginLeft: -60 * u, borderRadius: 99, background: "rgba(0,0,0,.6)" }} />
          <div style={{ position: "absolute", top: 70 * u, left: 0, right: 0, textAlign: "center", fontFamily: INTER, fontWeight: 700, fontSize: 26 * u, color: K.ink }}>Vidbucks</div>
          {bubble("Can it make a bar chart race?", false, 0.3, phH * 0.3)}
          {t > 0.9 && t < 1.3 && <div style={{ position: "absolute", top: phH * 0.52, right: phW * 0.06, padding: `${14 * u}px ${22 * u}px`, borderRadius: 26 * u, background: "rgba(91,140,255,.5)", color: "#fff", fontSize: 30 * u }}>•••</div>}
          {bubble("Watch.", true, 1.3, phH * 0.52)}
        </Glass>
      </AbsoluteFill>
      {/* the bubble grows into the frame and becomes the data race */}
      {grow > 0 && wbIn < 1 && <div style={{ position: "absolute", left: rx, top: ry, width: rw, height: rh, borderRadius: rr, overflow: "hidden", background: K.blue }}>
        <div style={{ position: "absolute", left: -rx, top: -ry, width: W, height: H, opacity: clamp((grow - 0.3) / 0.4) }}>
          {barSweep < 1 ? <Sequence from={Math.round((LEAD + 2.2 - 3.0) * fps)} layout="none"><DataRace cfg={DEMO_RACE} /></Sequence>
            : <Sequence from={Math.round((LEAD + 5.45 - 13.5) * fps)} layout="none"><Countdown cfg={DEMO_COUNT} /></Sequence>}
        </div>
        {/* the leader bar stretches across and becomes the #1 */}
        {barSweep > 0 && barSweep < 1 && <div style={{ position: "absolute", left: 0, top: H * 0.2, height: H * 0.12, width: W * barSweep * 1.1, background: K.acc, borderRadius: `0 ${20 * u}px ${20 * u}px 0`, boxShadow: `0 0 ${60 * u}px rgba(255,176,46,.7)` }} />}
        {barSweep > 0 && barSweep < 1 && <AbsoluteFill style={{ background: K.acc, clipPath: `inset(${(1 - barSweep) * 50}% 0 ${(1 - barSweep) * 50}% 0)`, opacity: Math.sin(Math.PI * barSweep) }} />}
      </div>}
      {/* the whiteboard slides up like a card and the hand ticks it off */}
      {wbIn > 0 && <AbsoluteFill style={{ transform: `translateY(${(1 - wbIn) * H}px)`, boxShadow: `0 ${-30 * u}px ${80 * u}px rgba(0,0,0,${0.5 * (1 - wbIn)})`, borderRadius: 30 * u * (1 - wbIn), overflow: "hidden" }}>
        <Sequence from={Math.round((LEAD + 6.3) * fps)} layout="none"><Whiteboard cfg={wb} /></Sequence></AbsoluteFill>}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: v ? H * 0.22 : H * 0.05, display: "flex", justifyContent: "center", opacity: grow > 0.05 && grow < 0.95 ? 0 : 1 }}>
        <div style={{ padding: `${12 * u}px ${30 * u}px`, borderRadius: 99, background: t > 6.4 ? "rgba(20,22,30,.85)" : "rgba(255,255,255,.16)", backdropFilter: `blur(${20 * u}px)`, border: `${1.5 * u}px solid rgba(255,255,255,.3)`, fontFamily: BLACK, fontSize: (v ? 46 : 42) * u, color: "#fff", boxShadow: `0 ${20 * u}px ${50 * u}px rgba(0,0,0,.35)` }}>
          {t < 2.2 ? "Ask for a format." : t < 5.0 ? <span>A data race<span style={{ color: K.acc }}>.</span></span> : t < 6.3 ? <span>A countdown<span style={{ color: K.acc }}>.</span></span> : <span>A whiteboard<span style={{ color: K.acc }}>.</span></span>}</div></div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 5. glass gauges: the gates (29-32) ------------------------------------------------------------------ */
const Gauges5: React.FC = () => {
  const t = useT(), { W, H, u, v } = useU();
  const items = [{ name: "loudness", val: (k: number) => (-40 + 24.1 * k).toFixed(1), unit: "LUFS", c: K.acc }, { name: "sync", val: (k: number) => `+${(0.9 - 0.87 * k).toFixed(2)}`, unit: "s", c: K.teal }, { name: "text", val: (k: number) => String(Math.round(9 * (1 - k))), unit: "fails", c: K.blue }];
  const R = (v ? 150 : 170) * u;
  return (
    <AbsoluteFill>
      <Mesh t={t + 29} hues={[K.teal, K.blue, K.violet, K.acc]} />
      <div style={{ position: "absolute", left: 0, right: 0, top: v ? H * 0.08 : H * 0.08, textAlign: "center", fontFamily: BLACK, fontSize: (v ? 64 : 60) * u, color: K.ink }}>Gated <span style={{ color: K.acc }}>before</span> you see it.</div>
      {items.map((g, i) => { const k = EASE.out(seg(t, 0.25 + i * 0.2, 0.9)), pass = t > 0.9 + i * 0.5, cx = v ? W / 2 : W * (0.25 + 0.25 * i), cy = v ? H * (0.3 + 0.21 * i) : H * 0.55, st = clamp(enterK(t, 0.9 + i * 0.5, PL, 0.3), 0, 1.25);
        return <React.Fragment key={g.name}>
          <Glass r={999} style={{ left: cx - R, top: cy - R, width: 2 * R, height: 2 * R }} tint={0.1}>
            <svg width={2 * R} height={2 * R} style={{ position: "absolute", inset: 0 }}><circle cx={R} cy={R} r={R * 0.82} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth={12 * u} />
              <circle cx={R} cy={R} r={R * 0.82} fill="none" stroke={g.c} strokeWidth={12 * u} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - k * 0.8} transform={`rotate(-90 ${R} ${R})`} style={{ filter: `drop-shadow(0 0 ${10 * u}px ${g.c})` }} /></svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: MONO, color: K.ink }}>
              <div style={{ fontSize: 22 * u, color: K.dim, fontWeight: 700, letterSpacing: 2 * u }}>{g.name.toUpperCase()}</div>
              <div style={{ fontSize: 52 * u, fontWeight: 700 }}>{g.val(k)}<span style={{ fontSize: 24 * u, color: K.dim }}> {g.unit}</span></div></div>
          </Glass>
          {pass && <div style={{ position: "absolute", left: cx + R * 0.45, top: cy - R * 1.0, width: 70 * u, height: 70 * u, borderRadius: 99, background: "#2fb37a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: BLACK, fontSize: 40 * u, transform: `scale(${st})`, boxShadow: `0 0 ${30 * u}px rgba(47,179,122,.8)` }}>✓</div>}
        </React.Fragment>; })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 6. liquid-glass logo (32-36) ------------------------------------------------------------------ */
const Logo6: React.FC = () => {
  const t = useT(), { W, H, u, v } = useU();
  const settle = EASE.out(seg(t, 0, 1.6)), scale = (v ? 0.55 : 0.42) * Math.min(W, H) / 200, cx = W / 2, cy = H * (v ? 0.36 : 0.32), land = clamp(enterK(t, 0.05, PL, 0.6), 0, 1.15);
  const disp = 40 * (1 - settle) + 3, shine = seg(t, 1.6, 0.9);
  return (
    <AbsoluteFill>
      <Mesh t={t + 32} hues={[K.acc, K.pink, K.violet, K.blue]} dark={0.25} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="liquid" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency={0.012 + 0.004 * Math.sin(t * 2)} numOctaves={2} seed={3} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={disp} xChannelSelector="R" yChannelSelector="G" result="d" />
            <feGaussianBlur in="d" stdDeviation={2} result="b" />
            <feSpecularLighting in="b" surfaceScale={6} specularConstant={1.1} specularExponent={28} lightingColor="#ffffff" result="s"><fePointLight x={W * (0.3 + 0.4 * shine)} y={H * 0.1} z={600} /></feSpecularLighting>
            <feComposite in="s" in2="d" operator="in" result="sl" />
            <feMerge><feMergeNode in="d" /><feMergeNode in="sl" /></feMerge>
          </filter>
          <linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="rgba(255,255,255,.75)" /><stop offset="0.5" stopColor="rgba(255,255,255,.22)" /><stop offset="1" stopColor="rgba(255,255,255,.55)" /></linearGradient>
        </defs>
        <g filter="url(#liquid)" transform={`translate(${cx} ${cy}) scale(${scale * (0.6 + 0.4 * Math.min(1, land))}) translate(-100 -100)`} opacity={clamp(land * 2)}>
          {DEMO_LOGO.parts.map((p, i) => <path key={i} d={p.d} fill={i === 0 ? "url(#gl)" : "rgba(10,12,20,.75)"} stroke="rgba(255,255,255,.9)" strokeWidth={1.2} />)}
        </g>
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: cy + 120 * scale, textAlign: "center", fontFamily: BLACK, fontSize: (v ? 120 : 130) * u, letterSpacing: (14 - 10 * EASE.out(seg(t, 0.4, 0.8))) * u, color: "transparent",
        backgroundImage: `linear-gradient(100deg, rgba(255,255,255,.9) ${30 + 60 * shine - 20}%, #fff ${30 + 60 * shine}%, rgba(255,255,255,.75) ${30 + 60 * shine + 12}%)`, WebkitBackgroundClip: "text", backgroundClip: "text", opacity: EASE.out(seg(t, 0.4, 0.5)), filter: `drop-shadow(0 ${6 * u}px ${24 * u}px rgba(0,0,0,.35))` }}>Vidbucks</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: cy + 120 * scale + (v ? 150 : 160) * u, textAlign: "center", fontFamily: INTER, fontWeight: 600, fontSize: 38 * u, color: K.ink, opacity: EASE.out(seg(t, 1.0, 0.5)) }}>reference in. original out.</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * (v ? 0.7 : 0.88), display: "flex", justifyContent: "center", opacity: EASE.out(seg(t, 1.8, 0.4)) }}>
        <div style={{ padding: `${10 * u}px ${24 * u}px`, borderRadius: 99, background: "rgba(255,255,255,.14)", backdropFilter: `blur(${20 * u}px)`, border: `${1.5 * u}px solid rgba(255,255,255,.3)`, fontFamily: MONO, fontWeight: 500, fontSize: 24 * u, color: K.ink }}>open source · MIT · runs on your machine</div></div>
      <AbsoluteFill style={{ background: "#fff", opacity: Math.max(0, 1 - t / 0.25) * 0.5 }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ the edit ------------------------------------------------------------------ */
type Shot = { start: number; end: number; el: React.ReactNode };
const SHOTS: Shot[] = [{ start: 0, end: 5, el: <Studio1 /> }, { start: 5, end: 14, el: <Styles2 /> }, { start: 14, end: 21, el: <Editor3 /> }, { start: 21, end: 29, el: <Chain4 /> }, { start: 29, end: 32, el: <Gauges5 /> }, { start: 32, end: 36, el: <Logo6 /> }];
const JOINS: { kind: TKind; d: number; at?: [number, number] }[] = [{ kind: "luma", d: 0 }, { kind: "zoom", d: 0.55, at: [0.3, 0.7] }, { kind: "stack", d: 0.6 }, { kind: "blob", d: 0.55, at: [0.5, 0.45] }, { kind: "iris", d: 0.5, at: [0.52, 0.45] }, { kind: "flash", d: 0.4 }];
export const VidbucksPromo4: React.FC = () => {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), t = f / fps, F = (s: number) => Math.round(s * fps);
  const beat = 1 + 0.018 * Math.exp(-((t % 0.5) / 0.5) * 6);   // a soft push on every beat
  const cam = (i: number) => { const lt = t - SHOTS[i].start, still = i === 1 || i === 3; // the media and chain chapters move on their own
    return `perspective(2400px) rotateY(${still ? 0 : Math.sin(lt * 0.9 + i) * 3.2}deg) rotateX(${still ? 0 : Math.cos(lt * 0.7 + i) * 2.2}deg) scale(${(still ? 1 : 1.02 + 0.02 * Math.sin(lt * 0.6)) * beat}) translateX(${still ? 0 : Math.sin(lt * 0.5 + i) * 18}px)`; };
  const mount = (i: number) => <Sequence key={i} from={F(SHOTS[i].start - LEAD)} durationInFrames={F(SHOTS[i].end - SHOTS[i].start + 2 * LEAD)} layout="none"><AbsoluteFill style={{ transform: cam(i) }}>{SHOTS[i].el}</AbsoluteFill></Sequence>;
  const j = SHOTS.findIndex((s, i) => i > 0 && t >= s.start - JOINS[i].d / 2 && t < s.start + JOINS[i].d / 2);
  if (j > 0) { const J = JOINS[j]; return <AbsoluteFill style={{ background: K.bg }}><TransitionStage kind={J.kind} p={(t - (SHOTS[j].start - J.d / 2)) / J.d} at={J.at} A={mount(j - 1)} B={mount(j)} /></AbsoluteFill>; }
  const i = SHOTS.findIndex((s) => t >= s.start && t < s.end);
  return <AbsoluteFill style={{ background: K.bg }}>{mount(i < 0 ? SHOTS.length - 1 : i)}</AbsoluteFill>;
};
