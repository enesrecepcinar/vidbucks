// VidbucksPromo: a 30 s motion-design promo for Vidbucks, built from its own kits. 120 BPM (a beat = 0.5 s): every slam,
// word swap, tile pop and stamp lands on the grid. Scenes: wordmark slam -> kinetic type -> the analysis UI (numbers from the
// real self-test) -> a bento wall of live kits -> the gates -> the logo. Responsive: 16:9 and 9:16 from one composition.
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fInter } from "@remotion/google-fonts/Inter";
import { loadFont as fArchivo } from "@remotion/google-fonts/ArchivoBlack";
import { loadFont as fMono } from "@remotion/google-fonts/JetBrainsMono";
import { EASE, clamp, enterK, persona, mixOklch } from "../motion";
import { MediaSceneDemo } from "../media/MediaScene";
import { ChatStory, DEMO_CHAT } from "../chat/ChatStory";
import { DataRace, DEMO_RACE } from "../data/DataRace";
import { Countdown, DEMO_COUNT } from "../list/Countdown";
import { Whiteboard, DEMO_WB } from "../media/Whiteboard";
import { LogoReveal, DEMO_LOGO } from "../logo/LogoReveal";

const INTER = fInter("normal", { weights: ["500", "700", "800"], subsets: ["latin"] }).fontFamily;
const BLACK = fArchivo("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
const MONO = fMono("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily;
export const C = { bg: "#0b0c10", bg2: "#14161d", ink: "#f4f5f7", dim: "#8c93a1", acc: "#ffb02e", blue: "#4f8cff", red: "#ff5a36", green: "#2ec4a0", line: "rgba(255,255,255,.08)" };
export const PROMO_LEN = 30;
export const SC = { intro: 0, type: 3.5, ui: 7.5, bento: 11.5, gates: 19.5, logo: 24.5 };   // scene starts (s)
const P = persona("confident"), SN = persona("snappy");
const seg = (t: number, a: number, d: number) => clamp((t - a) / d);

/** the frame every scene sits in: dark studio, faint grid, grain, vignette */
export const Studio: React.FC<{ t: number; tint?: string }> = ({ t, tint = C.acc }) => {
  const { width: W, height: H } = useVideoConfig(), g = 80 * Math.min(W, H) / 1080, off = (t * 12) % g;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at ${45 + 8 * Math.sin(t * 0.4)}% 40%, ${mixOklch(C.bg2, tint, 0.1)}, ${C.bg} 70%)` }}>
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`, backgroundSize: `${g}px ${g}px`, backgroundPosition: `${off}px ${off}px`, opacity: 0.6 }} />
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.07, mixBlendMode: "overlay" }}>
        <filter id="pg"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={Math.floor(t * 12) % 30} /></filter><rect width="100%" height="100%" filter="url(#pg)" />
      </svg>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 1. wordmark slam (0-3.5) ------------------------------------------------------------------ */
const Intro: React.FC = () => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, u = Math.min(W, H) / 1080, vertical = H > W;
  const drop = clamp(enterK(t, 0, persona("playful"), 0.45), 0, 1.2), dotY = -H * 0.6 * (1 - drop), squash = t > 0.38 && t < 0.55 ? 1 - 0.25 * Math.sin(Math.PI * seg(t, 0.38, 0.17)) : 1;
  const burst = EASE.out(seg(t, 0.5, 0.45)), R = Math.hypot(W, H) * burst;
  const word = "VIDBUCKS".split(""), size = (vertical ? 138 : 230) * u;   // 8 heavy letters must fit 9:16 width
  const sub = "reference in. original out.", typed = Math.floor(sub.length * seg(t, 1.6, 0.9));
  const bars = seg(t, 3.0, 0.5);
  return (
    <AbsoluteFill>
      <Studio t={t} />
      {burst < 1 && <div style={{ position: "absolute", left: W / 2 - 40 * u, top: H / 2 - 40 * u + dotY, width: 80 * u, height: 80 * u * squash, borderRadius: 99, background: C.acc, transform: `scale(${1 + 20 * burst})`, opacity: 1 - burst }} />}
      {burst > 0 && burst < 1 && <div style={{ position: "absolute", left: W / 2 - R, top: H / 2 - R, width: 2 * R, height: 2 * R, borderRadius: "50%", border: `${6 * u}px solid ${C.acc}`, opacity: 1 - burst }} />}
      {/* orbiting geometry */}
      {[0, 1, 2].map((i) => { const a = t * (0.6 + i * 0.25) + i * 2.1, r = (vertical ? 420 : 640) * u, k = seg(t, 1.0 + i * 0.25, 0.5);
        return <div key={i} style={{ position: "absolute", left: W / 2 + Math.cos(a) * r - 20 * u, top: H / 2 + Math.sin(a) * r * 0.55 - 20 * u, width: 40 * u, height: 40 * u, border: `${4 * u}px solid ${[C.blue, C.red, C.green][i]}`, borderRadius: i === 1 ? 99 : 6 * u, transform: `rotate(${t * 90}deg) scale(${EASE.out(k)})` }} />; })}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div style={{ display: "flex", fontFamily: BLACK, fontSize: size, lineHeight: 1, color: C.ink, letterSpacing: -2 * u }}>
          {word.map((ch, i) => { const at = 0.62 + i * 0.0625, k = clamp(enterK(t, at, SN, 0.3), 0, 1.15);
            return <span key={i} style={{ display: "inline-block", opacity: clamp((t - at) / 0.05), transform: `translateY(${(1 - Math.min(1, k)) * -60 * u}px) scale(${1 + 0.6 * (1 - Math.min(1, k))})`, color: i === 0 ? C.acc : C.ink }}>{ch}</span>; })}
        </div>
        <div style={{ height: 8 * u, width: size * 5.4 * EASE.inOut(seg(t, 1.2, 0.5)), background: C.acc, marginTop: 18 * u, borderRadius: 4 * u }} />
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 40 * u, color: C.dim, marginTop: 30 * u, height: 50 * u }}>{sub.slice(0, typed)}<span style={{ opacity: Math.floor(t * 4) % 2 ? 0 : 1, color: C.acc }}>_</span></div>
      </AbsoluteFill>
      {/* exit: five bars wipe up on the beat */}
      {bars > 0 && [C.acc, C.red, C.blue, C.green, C.ink].map((c, i) => { const k = EASE.inOut(clamp(bars * 1.6 - i * 0.12)); return <div key={i} style={{ position: "absolute", left: (W / 5) * i, width: W / 5 + 2, bottom: 0, height: H * k, background: c }} />; })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 2. kinetic type (3.5-7.5) ------------------------------------------------------------------ */
const WORDS: { w: string; at: number; inv?: boolean }[] = [
  { w: "SHOW IT", at: 0 }, { w: "A VIDEO", at: 0.5 }, { w: "YOU LOVE.", at: 1.0 },
  { w: "GET", at: 2.0, inv: true }, { w: "AN ORIGINAL", at: 2.5, inv: true }, { w: "ONE.", at: 3.0, inv: true },
];
const Kinetic: React.FC = () => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, u = Math.min(W, H) / 1080, vertical = H > W;
  const inv = t >= 2.0, bg = inv ? C.acc : C.bg, ink = inv ? C.bg : C.ink;
  const cur = [...WORDS].reverse().find((w) => t >= w.at) ?? WORDS[0], idx = WORDS.indexOf(cur), group = idx < 3 ? WORDS.slice(0, 3) : WORDS.slice(3);
  const flip = inv ? EASE.out(seg(t, 2.0, 0.3)) : 0, iris = seg(t, 3.55, 0.45);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {!inv ? <Studio t={t + 3.5} /> : <AbsoluteFill style={{ background: bg, clipPath: `circle(${flip * 120}% at 50% 55%)` }} />}
      <AbsoluteFill style={{ alignItems: vertical ? "center" : "flex-start", justifyContent: "center", flexDirection: "column", padding: `0 ${vertical ? 60 : 160}px` }}>
        {group.map((w, i) => { const on = t >= w.at, k = clamp(enterK(t, w.at, SN, 0.28), 0, 1.1), isCur = w === cur;
          return (
            <div key={w.w} style={{ overflow: "hidden", height: (vertical ? 136 : 190) * u }}>
              <div style={{ fontFamily: BLACK, fontSize: (vertical ? 118 : 170) * u, lineHeight: 1.08, color: isCur ? (inv ? ink : C.acc) : mixOklch(ink, bg, 0.35), whiteSpace: "nowrap",
                transform: `translateY(${on ? (1 - Math.min(1, k)) * 190 * u : 190 * u}px) skewX(${on ? (1 - Math.min(1, k)) * -12 : 0}deg)` }}>{w.w}{i === group.length - 1 && <span style={{ color: inv ? C.bg : C.acc }}>{""}</span>}</div>
            </div>
          ); })}
      </AbsoluteFill>
      {/* a rotating outlined square and a dot grid keep the frame alive */}
      <div style={{ position: "absolute", right: vertical ? W * 0.1 : W * 0.1, top: vertical ? H * 0.12 : H * 0.2, width: 220 * u, height: 220 * u, border: `${6 * u}px solid ${inv ? C.bg : C.acc}`, transform: `rotate(${t * 60}deg) scale(${0.8 + 0.2 * Math.sin(t * 4)})`, borderRadius: 24 * u, opacity: 0.9 }} />
      <div style={{ position: "absolute", right: vertical ? W * 0.08 : W * 0.06, bottom: vertical ? H * 0.24 : H * 0.12, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16 * u }}>
        {Array.from({ length: 24 }, (_, i) => <div key={i} style={{ width: 12 * u, height: 12 * u, borderRadius: 99, background: inv ? C.bg : C.dim, opacity: 0.3 + 0.7 * clamp(Math.sin(t * 6 - i * 0.4)) }} />)}
      </div>
      {iris > 0 && <AbsoluteFill style={{ background: C.bg, clipPath: `circle(${EASE.inOut(iris) * 120}% at 50% 50%)` }} />}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 3. analysis UI (7.5-11.5) ------------------------------------------------------------------ */
const CUTS = [0.06, 0.13, 0.17, 0.26, 0.31, 0.38, 0.42, 0.5, 0.57, 0.61, 0.69, 0.74, 0.8, 0.86, 0.91, 0.96];
const AnalysisUI: React.FC = () => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, u = Math.min(W, H) / 1080, vertical = H > W;
  const pw = vertical ? W * 0.88 : W * 0.8, ph = vertical ? H * 0.6 : H * 0.66, px = (W - pw) / 2, py = vertical ? H * 0.14 : (H - ph) / 2;
  const tilt = (1 - EASE.out(seg(t, 0, 0.8))) * 25, pk = EASE.out(seg(t, 0, 0.6)), out = EASE.in(seg(t, 3.6, 0.4));
  const ph1 = seg(t, 0.4, 1.4), play = ph1;
  const stats = [["BPM", "117.5", "truth 120"], ["LUFS", "-15.9", "truth -16.0"], ["DISSOLVE", "2.47 s", "truth 2.5 s"], ["SELF-TEST", "12/12", "analysers checked"]];
  const pal = ["#2b2f3a", "#d4382c", "#f0c55a", "#4f8cff", "#f4ecd9"];
  return (
    <AbsoluteFill>
      <Studio t={t + 7.5} tint={C.blue} />
      <div style={{ position: "absolute", left: px, top: py, width: pw, height: ph, perspective: 1600 * u }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 28 * u, background: "rgba(20,22,29,.86)", border: `${2 * u}px solid rgba(255,255,255,.16)`, boxShadow: `0 ${40 * u}px ${120 * u}px rgba(0,0,0,.6), 0 0 ${80 * u}px ${mixOklch(C.blue, C.bg, 0.75)}`,
          transform: `rotateX(${tilt}deg) scale(${(0.9 + 0.1 * pk) * (1 - 0.3 * out)})`, opacity: pk * (1 - out), overflow: "hidden", fontFamily: INTER }}>
          {/* title bar */}
          <div style={{ height: 70 * u, display: "flex", alignItems: "center", gap: 14 * u, padding: `0 ${28 * u}px`, borderBottom: `${2 * u}px solid rgba(255,255,255,.07)` }}>
            {[C.red, C.acc, C.green].map((c) => <div key={c} style={{ width: 16 * u, height: 16 * u, borderRadius: 99, background: c }} />)}
            <div style={{ fontFamily: MONO, fontSize: 24 * u, color: C.dim, marginLeft: 16 * u }}>analyze_reference.py --file reference.mp4</div>
          </div>
          <div style={{ padding: `${30 * u}px ${36 * u}px`, display: "flex", flexDirection: "column", gap: 26 * u }}>
            {/* timeline with cut ticks */}
            <div>
              <div style={{ fontSize: 22 * u, fontWeight: 700, color: C.dim, letterSpacing: 2 * u, marginBottom: 12 * u }}>CUTS</div>
              <div style={{ position: "relative", height: 80 * u, borderRadius: 12 * u, background: "rgba(255,255,255,.05)", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${play * 100}%`, background: `linear-gradient(90deg, transparent, ${mixOklch(C.blue, C.bg, 0.6)})` }} />
                {CUTS.filter((c) => c <= play).map((c) => <div key={c} style={{ position: "absolute", left: `${c * 100}%`, top: 8 * u, bottom: 8 * u, width: 4 * u, borderRadius: 2 * u, background: C.acc, transform: `scaleY(${EASE.out(clamp((play - c) * 12))})` }} />)}
                <div style={{ position: "absolute", left: `${play * 100}%`, top: 0, bottom: 0, width: 3 * u, background: "#fff" }} />
              </div>
            </div>
            {/* waveform */}
            <div style={{ display: "flex", alignItems: "center", gap: 5 * u, height: (vertical ? 200 : 190) * u }}>
              {Array.from({ length: vertical ? 48 : 90 }, (_, i) => { const v = 0.25 + 0.75 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23 + t * 3)), on = i / (vertical ? 48 : 90) <= play;
                return <div key={i} style={{ flex: 1, height: `${v * 100}%`, borderRadius: 3 * u, background: on ? (i % 8 === 0 ? C.acc : C.blue) : "rgba(255,255,255,.1)" }} />; })}
            </div>
            {/* palette + stats */}
            <div style={{ display: "flex", gap: 22 * u, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 10 * u, alignItems: "center", marginRight: 10 * u }}>
                {pal.map((c, i) => { const k = clamp(enterK(t, 1.6 + i * 0.1, persona("playful"), 0.3), 0, 1.2); return <div key={c} style={{ width: 72 * u, height: 72 * u, borderRadius: 12 * u, background: c, border: `${2 * u}px solid rgba(255,255,255,.15)`, transform: `scale(${k})` }} />; })}
              </div>
              {stats.map(([lab, val, note], i) => { const at = 2.0 + i * 0.5, k = clamp(enterK(t, at, P), 0, 1.05);
                return <div key={lab} style={{ padding: `${18 * u}px ${28 * u}px`, borderRadius: 18 * u, background: "rgba(255,255,255,.06)", opacity: clamp((t - at) / 0.15), transform: `translateY(${(1 - Math.min(1, k)) * 24 * u}px)` }}>
                  <div style={{ fontSize: 18 * u, fontWeight: 700, letterSpacing: 2 * u, color: C.dim }}>{lab}</div>
                  <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: (vertical ? 46 : 56) * u, color: i === 3 ? C.green : C.ink }}>{val}</div>
                  <div style={{ fontSize: 16 * u, color: C.dim }}>{note}</div>
                </div>; })}
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: px, top: vertical ? py + ph + 40 * u : py - 70 * u, fontFamily: BLACK, fontSize: (vertical ? 64 : 48) * u, color: C.ink, opacity: pk * (1 - out) }}>Measured<span style={{ color: C.acc }}>.</span> Not guessed<span style={{ color: C.acc }}>.</span></div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 4. bento wall of live kits (11.5-19.5) ------------------------------------------------------------------ */
export const KITS: { label: string; el: React.ReactNode; color: string }[] = [
  { label: "Cut paper", el: <MediaSceneDemo medium="cut-paper" />, color: C.acc },
  { label: "Chat story", el: <ChatStory cfg={DEMO_CHAT} />, color: C.blue },
  { label: "Data race", el: <DataRace cfg={DEMO_RACE} />, color: C.green },
  { label: "Countdown", el: <Countdown cfg={DEMO_COUNT} />, color: C.red },
  { label: "Whiteboard", el: <Whiteboard cfg={DEMO_WB} />, color: C.ink },
  { label: "Riso print", el: <MediaSceneDemo medium="riso" />, color: "#dc44a0" },
];
export const KIT_START = [2.0, 3.0, 1.5, 4.0, 1.0, 2.5];   // where in each kit's own timeline the tile starts (a busy moment)
const Bento: React.FC = () => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, u = Math.min(W, H) / 1080, vertical = H > W;
  const cols = vertical ? 2 : 3, rows = vertical ? 3 : 2, gap = 24 * u, mx = vertical ? W * 0.06 : W * 0.05, my = vertical ? H * 0.1 : H * 0.12;
  const top0 = vertical ? H * 0.15 : my, bot0 = vertical ? H * 0.2 : my;   // 9:16: below the title, above the platform UI
  const cw = (W - 2 * mx - gap * (cols - 1)) / cols, chFree = (H - top0 - bot0 - gap * (rows - 1)) / rows, ar = W / H;
  const cell = Math.min(cw, chFree * ar), ch = cell / ar;                         // tiles keep the frame's aspect (the kits render full size, scaled)
  const ox = (W - (cell * cols + gap * (cols - 1))) / 2, oy = vertical ? top0 : (H - (ch * rows + gap * (rows - 1))) / 2 + 20 * u;
  const feat = EASE.inOut(seg(t, 4.0, 0.6)) * (1 - EASE.inOut(seg(t, 6.0, 0.5))), out = EASE.in(seg(t, 7.5, 0.5));
  return (
    <AbsoluteFill>
      <Studio t={t + 11.5} tint={C.green} />
      <div style={{ position: "absolute", left: vertical ? W * 0.06 : ox, right: vertical ? W * 0.06 : undefined, top: vertical ? H * 0.05 : oy - 80 * u, fontFamily: BLACK, fontSize: (vertical ? 56 : 46) * u, lineHeight: 1.1, color: C.ink, opacity: EASE.out(seg(t, 0, 0.4)) * (1 - out) }}>One package<span style={{ color: C.acc }}>.</span> Every format<span style={{ color: C.acc }}>.</span></div>
      {KITS.map((k, i) => {
        const at = i * 0.5, pk = clamp(enterK(t, at, persona("playful"), 0.4), 0, 1.15), c = i % cols, r = Math.floor(i / cols);
        let x = ox + c * (cell + gap), y = oy + r * (ch + gap), s = 1, op = clamp((t - at) / 0.1);
        if (i === 3) { const fx = (W - cell * 2) / 2, fy = (H - ch * 2) / 2; x += (fx - x) * feat; y += (fy - y) * feat; s = 1 + feat; }   // the countdown tile takes the stage for two beats
        else op *= 1 - 0.5 * feat;
        const fly = out * (i % 2 ? 1 : -1) * W * 0.7;
        return (
          <div key={k.label} style={{ position: "absolute", left: x + fly, top: y, width: cell, height: ch, transform: `scale(${s * (0.6 + 0.4 * Math.min(1, pk))})`, transformOrigin: "0 0", opacity: op, zIndex: i === 3 ? 5 : 1 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 22 * u, overflow: "hidden", border: `${3 * u}px solid rgba(255,255,255,.12)`, boxShadow: `0 ${20 * u}px ${50 * u}px rgba(0,0,0,.45)` }}>
              <div style={{ width: W, height: H, transform: `scale(${cell / W})`, transformOrigin: "0 0", position: "relative" }}>
                <Sequence from={-Math.round(KIT_START[i] * fps) + Math.round(at * fps)} layout="none">{k.el}</Sequence>
              </div>
            </div>
            <div style={{ position: "absolute", left: 14 * u, bottom: 14 * u, padding: `${6 * u}px ${14 * u}px`, borderRadius: 99, background: "rgba(10,11,15,.82)", fontFamily: INTER, fontWeight: 700, fontSize: 20 * u, color: k.color, opacity: clamp((t - at - 0.15) / 0.2) }}>{k.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 5. gates (19.5-24.5) ------------------------------------------------------------------ */
const GATES: [string, string][] = [["quality_gate", "fail 0 · -16.0 LUFS"], ["text_check", "fail 0 · contrast >= 3:1"], ["sync_check", "onset +0.03 s"]];
const Gates: React.FC = () => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, u = Math.min(W, H) / 1080, vertical = H > W;
  const conv = EASE.in(seg(t, 4.4, 0.5)), w0 = vertical ? W * 0.84 : W * 0.56;
  return (
    <AbsoluteFill>
      <Studio t={t + 19.5} tint={C.green} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 26 * u, transform: `scale(${1 - 0.9 * conv})`, opacity: 1 - conv }}>
        <div style={{ fontFamily: BLACK, fontSize: (vertical ? 92 : 96) * u, color: C.ink, lineHeight: 1.05, textAlign: "center", marginBottom: 20 * u }}>
          {["Every", "output", "gated."].map((w, i) => { const k = clamp(enterK(t, 0.1 + i * 0.25, SN, 0.3), 0, 1.1); return <span key={w} style={{ display: "inline-block", marginRight: 26 * u, opacity: clamp((t - 0.1 - i * 0.25) / 0.06), transform: `translateY(${(1 - Math.min(1, k)) * 50 * u}px)`, color: i === 2 ? C.acc : C.ink }}>{w}</span>; })}
        </div>
        {GATES.map(([name, num], i) => { const at = 1.5 + i * 0.5, k = clamp(enterK(t, at - 0.35, P), 0, 1.05), st = clamp(enterK(t, at, persona("playful"), 0.3), 0, 1.25);
          return <div key={name} style={{ width: w0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${22 * u}px ${30 * u}px`, borderRadius: 20 * u, background: "rgba(255,255,255,.06)", border: `${2 * u}px solid rgba(255,255,255,.08)`, opacity: clamp((t - at + 0.35) / 0.15), transform: `translateX(${(1 - Math.min(1, k)) * -60 * u}px)` }}>
            <div><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: (vertical ? 40 : 38) * u, color: C.ink }}>{name}.py</div><div style={{ fontFamily: INTER, fontSize: 24 * u, color: C.dim }}>{num}</div></div>
            <div style={{ fontFamily: BLACK, fontSize: 44 * u, color: C.bg, background: C.green, padding: `${8 * u}px ${22 * u}px`, borderRadius: 14 * u, transform: `scale(${st}) rotate(${(1 - Math.min(1, st)) * -14}deg)`, opacity: clamp((t - at) / 0.05) }}>PASS</div>
          </div>; })}
      </AbsoluteFill>
      {conv > 0 && <div style={{ position: "absolute", left: W / 2 - 40 * u, top: H / 2 - 40 * u, width: 80 * u, height: 80 * u, borderRadius: 99, background: C.acc, transform: `scale(${EASE.out(conv)})` }} />}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 6. logo (24.5-30) ------------------------------------------------------------------ */
const Logo: React.FC = () => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, u = Math.min(W, H) / 1080;
  return (
    <AbsoluteFill>
      <LogoReveal logo={DEMO_LOGO} bg={C.bg} ink={C.ink} accent={C.acc} />
      {/* while the mark draws: two accent rings turn and open around it, so the first beat of the logo is never a still */}
      {[0, 1].map((i) => { const k = seg(t, 0.1 + i * 0.3, 1.8), r = Math.min(W, H) * (0.26 + 0.06 * i) * (0.85 + 0.15 * EASE.out(k));
        return <div key={i} style={{ position: "absolute", left: W / 2 - r, top: H * 0.42 - r, width: 2 * r, height: 2 * r, borderRadius: "50%", border: `${(4 - i) * u}px dashed ${i ? C.blue : C.acc}`,
          transform: `rotate(${(i ? -1 : 1) * t * 70}deg)`, opacity: 0.8 * EASE.out(k) * (1 - EASE.in(seg(t, 1.7, 0.5))) }} />; })}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: H * (H > W ? 0.22 : 0.08), textAlign: "center", fontFamily: MONO, fontWeight: 500, fontSize: 30 * u, color: C.dim, opacity: EASE.out(seg(t, 3.0, 0.5)) }}>open source · MIT · runs on your machine</div>
    </AbsoluteFill>
  );
};

export const VidbucksPromo: React.FC = () => {
  const { fps } = useVideoConfig(), F = (s: number) => Math.round(s * fps);
  const scenes: [number, number, React.ReactNode][] = [[SC.intro, SC.type, <Intro />], [SC.type, SC.ui, <Kinetic />], [SC.ui, SC.bento, <AnalysisUI />], [SC.bento, SC.gates, <Bento />], [SC.gates, SC.logo, <Gates />], [SC.logo, PROMO_LEN, <Logo />]];
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {scenes.map(([a, b, el], i) => <Sequence key={i} from={F(a)} durationInFrames={F(b - a)} name={`scene ${i + 1}`}>{el}</Sequence>)}
    </AbsoluteFill>
  );
};
