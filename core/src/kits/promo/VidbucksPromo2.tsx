// VidbucksPromo2: the fast cut. Same 30 s and 120 BPM as v1, but cut on halves and quarters, a camera that pulses on every
// beat, whips with motion blur, glitch slices on the hits, and real footage from films Vidbucks made (core/public/promo/clips,
// cut from core/out/films and exports). Scenes: flash montage -> glitch wordmark -> colour-block kinetic type -> analysis
// panel with a ramped zoom -> a reel of 14 productions + three phones -> shuffling bento of live kits -> stamped gates -> logo.
import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fInter } from "@remotion/google-fonts/Inter";
import { loadFont as fArchivo } from "@remotion/google-fonts/ArchivoBlack";
import { loadFont as fMono } from "@remotion/google-fonts/JetBrainsMono";
import { EASE, clamp, enterK, persona, mixOklch, speedRamp } from "../motion";
import { C, Studio, KITS, KIT_START } from "./VidbucksPromo";
import { LogoReveal, DEMO_LOGO } from "../logo/LogoReveal";

const INTER = fInter("normal", { weights: ["500", "700", "800"], subsets: ["latin"] }).fontFamily;
const BLACK = fArchivo("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
const MONO = fMono("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily;
export const PROMO2_LEN = 30;
export const S2 = { flash: 0, mark: 2, type: 4, ui: 7, reel: 10, bento: 17, gates: 21, logo: 24.5 };
const SN = persona("snappy"), PL = persona("playful");
const seg = (t: number, a: number, d: number) => clamp((t - a) / d);
export const hash = (n: number) => { const s = Math.sin(n * 127.1 + 31.7) * 43758.5453; return s - Math.floor(s); };
/** a camera pulse on every beat: a quick push that decays (the whole film breathes with the track) */
export const pulse = (t: number, amt = 0.035, beat = 0.5) => 1 + amt * Math.exp(-((t % beat) / beat) * 6);
/** chromatic text: red and cyan ghosts that open on a hit and close fast */
export const chroma = (k: number, u: number) => (k > 0.01 ? `${-6 * k * u}px 0 0 rgba(255,40,80,.85), ${6 * k * u}px 0 0 rgba(40,220,255,.85)` : "none");

export const Clip: React.FC<{ src: string; scale?: number; x?: number; y?: number; blur?: number; style?: React.CSSProperties }> = ({ src, scale = 1, x = 0, y = 0, blur = 0, style }) => (
  <AbsoluteFill style={{ overflow: "hidden", ...style }}>
    <OffthreadVideo src={staticFile(`promo/clips/${src}.mp4`)} muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: `translate(${x}px, ${y}px) scale(${scale})`, filter: blur ? `blur(${blur}px)` : undefined }} />
  </AbsoluteFill>
);

/* ------------------------------------------------------------------ A. flash montage (0-2) ------------------------------------------------------------------ */
export const FLASH = ["h_bunker", "h_culluk", "h_enfl", "h_fifties", "h_kehribar", "h_nova", "h_petek", "h_deprem"];
const Flash: React.FC = () => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, u = Math.min(W, H) / 1080, i = Math.min(7, Math.floor(t / 0.25)), lt = t - i * 0.25;
  const k = EASE.out(clamp(lt / 0.25)), rot = (i % 2 ? 1 : -1) * 2 * (1 - k), ch = 1 - clamp(lt / 0.08);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {FLASH.map((s, j) => j === i && <Sequence key={s} from={Math.round(j * 0.25 * fps)} layout="none"><Clip src={s} scale={1.18 - 0.12 * k} style={{ transform: `rotate(${rot}deg)` }} /></Sequence>)}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,.55), transparent 30%, transparent 70%, rgba(0,0,0,.6))` }} />
      <AbsoluteFill style={{ background: "#fff", opacity: 0.55 * clamp(1 - lt / 0.06) }} />
      {t >= 1.0 && <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.5 - 95 * u, height: 190 * u, background: "#000", transform: `scaleY(${EASE.out(seg(t, 1.0, 0.12))})` }} />}
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.5 - 70 * u, textAlign: "center", fontFamily: BLACK, fontSize: 120 * u, lineHeight: `${140 * u}px`, color: t < 1.5 ? "#fff" : C.acc, letterSpacing: 6 * u, textShadow: chroma(ch, u), opacity: t >= 1.0 ? 1 : 0, transform: `scale(${t >= 1 ? 1 + 0.15 * (1 - EASE.out(seg(t, t < 1.5 ? 1.0 : 1.5, 0.25))) : 1})` }}>
        {t < 1.5 ? "MADE" : "WITH"}</div>
      <div style={{ position: "absolute", left: 40 * u, bottom: 40 * u, fontFamily: MONO, fontSize: 26 * u, color: "#fff", opacity: 0.8 }}>{String(i + 1).padStart(2, "0")} / 08 · films made with this package</div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ B. glitch wordmark (2-4) ------------------------------------------------------------------ */
const Mark: React.FC = () => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, u = Math.min(W, H) / 1080, vertical = H > W;
  const size = (vertical ? 138 : 230) * u, glitch = t < 0.3 ? 1 - t / 0.3 : t > 1.0 && t < 1.12 ? 1 : 0;
  const whip = EASE.in(seg(t, 1.72, 0.28)), sc = pulse(t, 0.05);
  const slices = 7;
  return (
    <AbsoluteFill>
      <Studio t={t + 2} />
      {Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2, d = EASE.out(seg(t, 0, 0.8)) * (vertical ? 520 : 760) * u, s = (1 - seg(t, 0.4, 1.2)) * 26 * u;
        return <div key={i} style={{ position: "absolute", left: W / 2 + Math.cos(a) * d - s / 2, top: H / 2 + Math.sin(a) * d * 0.6 - s / 2, width: s, height: s, borderRadius: i % 3 ? 99 : 4 * u, background: [C.acc, C.blue, C.red, C.green][i % 4] }} />; })}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", transform: `translateX(${-whip * W * 1.1}px) scale(${sc})`, filter: whip > 0 ? `blur(${whip * 30}px)` : undefined }}>
        <div style={{ position: "relative", fontFamily: BLACK, fontSize: size, lineHeight: 1, color: C.ink, height: size * 1.05 }}>
          {Array.from({ length: slices }, (_, s_) => { const off = glitch ? (hash(s_ * 7 + Math.floor(t * 30)) - 0.5) * 120 * u * glitch : 0;
            return <div key={s_} style={{ position: "absolute", left: 0, top: 0, whiteSpace: "nowrap", clipPath: `inset(${(s_ / slices) * 100}% 0 ${100 - ((s_ + 1) / slices) * 100}% 0)`, transform: `translateX(calc(-50% + ${off}px))`, textShadow: chroma(glitch, u) }}>
              <span style={{ color: C.acc }}>V</span>IDBUCKS</div>; })}
        </div>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 40 * u, color: C.acc, marginTop: 36 * u }}>{"reference in. original out.".slice(0, Math.floor(27 * seg(t, 0.35, 0.7)))}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ C. colour-block kinetic type (4-7) ------------------------------------------------------------------ */
export const BLOCKS: { w: string; at: number; bg: string; ink: string }[] = [
  { w: "MEASURE", at: 0, bg: C.blue, ink: "#fff" }, { w: "ANY", at: 0.5, bg: C.bg, ink: C.ink }, { w: "VIDEO", at: 0.75, bg: C.acc, ink: C.bg },
  { w: "BUILD", at: 1.25, bg: C.red, ink: "#fff" }, { w: "AN", at: 1.75, bg: C.bg, ink: C.acc }, { w: "ORIGINAL", at: 2.0, bg: C.green, ink: C.bg }, { w: "ONE.", at: 2.5, bg: C.ink, ink: C.bg },
];
const Kinetic2: React.FC = () => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, u = Math.min(W, H) / 1080, vertical = H > W;
  const i = BLOCKS.reduce((a, b, j) => (t >= b.at ? j : a), 0), B = BLOCKS[i], lt = t - B.at, dir = i % 2 ? 1 : -1;
  const inK = EASE.out(clamp(lt / 0.16)), blur = (1 - inK) * 24, maxW = W * 0.86, fs = Math.min((vertical ? 300 : 360) * u, maxW / (B.w.length * 0.78));
  const prev = BLOCKS[i - 1];
  return (
    <AbsoluteFill style={{ background: prev ? prev.bg : C.bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: B.bg, transform: `translateX(${dir * (1 - inK) * W}px)` }}>
        {/* moving stripes behind the word */}
        <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(${dir * 45}deg, ${mixOklch(B.bg, B.ink, 0.08)} 0 ${30 * u}px, transparent ${30 * u}px ${60 * u}px)`, backgroundPosition: `${t * 200 * dir}px 0` }} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: BLACK, fontSize: fs, lineHeight: 1, color: B.ink, transform: `scale(${(1.25 - 0.25 * EASE.out(clamp(lt / 0.3))) * pulse(t, 0.04, 0.25)}) rotate(${dir * (1 - inK) * 6}deg)`, filter: blur > 0.5 ? `blur(${blur}px)` : undefined, textShadow: chroma(1 - clamp(lt / 0.1), u) }}>{B.w}</div>
        </AbsoluteFill>
        <div style={{ position: "absolute", left: 50 * u, top: 50 * u, fontFamily: MONO, fontWeight: 700, fontSize: 28 * u, color: B.ink, opacity: 0.7 }}>{String(i + 1).padStart(2, "0")}</div>
        <div style={{ position: "absolute", right: 60 * u, bottom: vertical ? H * 0.22 : 60 * u, width: 160 * u, height: 160 * u, border: `${8 * u}px solid ${B.ink}`, borderRadius: i % 2 ? 99 : 18 * u, transform: `rotate(${t * 180}deg) scale(${EASE.out(clamp(lt / 0.2))})`, opacity: 0.85 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ D. analysis with a ramped zoom (7-10) ------------------------------------------------------------------ */
const Analysis2: React.FC = () => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), real = f / fps, u = Math.min(W, H) / 1080, vertical = H > W;
  const t = speedRamp(real, 1.6, { runIn: 0.35, out: 0.45, slow: 0.25 });             // slow-motion into the zoom, then catch up
  const slam = clamp(enterK(t, 0, SN, 0.3), 0, 1.1), zoom = 1 + 1.4 * EASE.inOut(seg(t, 1.3, 0.8)), out = seg(t, 2.6, 0.4);
  const pw = vertical ? W * 0.9 : W * 0.8, ph = vertical ? H * 0.5 : H * 0.62, play = seg(t, 0.15, 1.1);
  const num = (a: number, b: number, k: number, d = 1) => (a + (b - a) * EASE.out(k)).toFixed(d);
  return (
    <AbsoluteFill>
      <Studio t={real + 7} tint={C.blue} />
      <AbsoluteFill style={{ transform: `scale(${zoom * pulse(real, 0.03)})`, transformOrigin: "50% 52%", filter: out > 0 ? `blur(${out * 20}px)` : undefined, opacity: 1 - out }}>
        <div style={{ position: "absolute", left: (W - pw) / 2, top: (H - ph) / 2, width: pw, height: ph, borderRadius: 28 * u, background: "rgba(20,22,29,.9)", border: `${2 * u}px solid rgba(255,255,255,.16)`,
          boxShadow: `0 0 ${90 * u}px ${mixOklch(C.blue, C.bg, 0.7)}`, transform: `perspective(${1400 * u}px) rotateX(${(1 - Math.min(1, slam)) * 40}deg) scale(${0.7 + 0.3 * Math.min(1, slam)})`, padding: 34 * u, display: "flex", flexDirection: "column", gap: 24 * u, fontFamily: INTER }}>
          <div style={{ fontFamily: MONO, fontSize: 26 * u, color: C.dim }}>$ analyze_reference.py --file reference.mp4</div>
          <div style={{ position: "relative", height: 70 * u, borderRadius: 12 * u, background: "rgba(255,255,255,.05)", overflow: "hidden" }}>
            {Array.from({ length: 22 }, (_, i) => { const x = (i + 0.5) / 22 + (hash(i) - 0.5) * 0.03; return x <= play && <div key={i} style={{ position: "absolute", left: `${x * 100}%`, top: 8 * u, bottom: 8 * u, width: 5 * u, background: C.acc, borderRadius: 3 * u }} />; })}
            <div style={{ position: "absolute", left: `${play * 100}%`, top: 0, bottom: 0, width: 4 * u, background: "#fff", boxShadow: `0 0 ${20 * u}px #fff` }} />
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 * u }}>
            {Array.from({ length: vertical ? 40 : 70 }, (_, i) => { const v = 0.2 + 0.8 * Math.abs(Math.sin(i * 0.61 + real * 9) * Math.cos(i * 0.17)); return <div key={i} style={{ flex: 1, height: `${v * 100}%`, borderRadius: 4 * u, background: i % 7 === 0 ? C.acc : C.blue, opacity: i / 70 <= play + 0.05 ? 1 : 0.15 }} />; })}
          </div>
          <div style={{ display: "flex", gap: 18 * u, fontFamily: MONO, fontWeight: 700, color: C.ink, fontSize: (vertical ? 40 : 52) * u }}>
            <div>{num(60, 117.5, seg(t, 0.4, 0.9))}<span style={{ fontSize: "0.45em", color: C.dim }}> BPM</span></div>
            <div>{num(-40, -15.9, seg(t, 0.55, 0.9))}<span style={{ fontSize: "0.45em", color: C.dim }}> LUFS</span></div>
            <div style={{ color: C.green }}>{Math.round(12 * EASE.out(seg(t, 0.7, 0.9)))}/12<span style={{ fontSize: "0.45em", color: C.dim }}> self-test</span></div>
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: vertical ? H * 0.12 : H * 0.07, textAlign: "center", fontFamily: BLACK, fontSize: (vertical ? 70 : 64) * u, color: C.ink, textShadow: chroma(1 - seg(real, 0, 0.15), u), opacity: 1 - out }}>MEASURED<span style={{ color: C.acc }}>, </span>NOT GUESSED</div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ E. the reel: our real productions (10-17) ------------------------------------------------------------------ */
export const REEL: [string, string][] = [["bunker_train", "Animated story"], ["culluk_km", "Data cards"], ["fifties_cars", "Archive listicle"], ["galata_board", "Cork-board documentary"],
  ["kahve_pour", "Photo story"], ["kedi_race", "Kinetic type"], ["nova_watch", "Product promo"], ["petek_hex", "Science short"], ["deprem_drops", "Icon guide"],
  ["curie_map", "Map route"], ["bunker_alert", "Character scene"], ["enflasyon", "Explainer"], ["kedi_cats", "Versus card"], ["galata_67m", "Big number"]];
const PHONES = ["v_chat", "v_count", "v_ad"], PH_AT = 3.0, PH_LEN = 1.0;   // the 9:16 moment inside the reel
const Reel: React.FC = () => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, u = Math.min(W, H) / 1080, vertical = H > W;
  const slot = (x: number) => (x < PH_AT ? x : x < PH_AT + PH_LEN ? -1 : x - PH_LEN);   // reel time without the phone moment
  const rt = slot(t), i = rt < 0 ? -1 : Math.min(REEL.length - 1, Math.floor(rt / 0.43)), lt = rt < 0 ? 0 : rt - i * 0.43;
  const kind = i % 4, k = EASE.out(clamp(lt / 0.18));
  const tr: React.CSSProperties = kind === 0 ? { transform: `translateX(${(1 - k) * W * 0.6}px)`, filter: k < 1 ? `blur(${(1 - k) * 22}px)` : undefined }
    : kind === 1 ? { transform: `scale(${1.6 - 0.6 * k})`, opacity: k }
    : kind === 2 ? { clipPath: `inset(${(1 - k) * 50}% 0 ${(1 - k) * 50}% 0)` }
    : { clipPath: `circle(${k * 75}% at 50% 50%)` };
  const phoneK = seg(t, PH_AT, 0.25), phoneOut = seg(t, PH_AT + PH_LEN - 0.15, 0.15);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {i >= 0 && REEL.map(([src], j) => (j === i || j === i - 1) && (
        <Sequence key={src} from={Math.round((j * 0.43 + (j * 0.43 >= PH_AT ? PH_LEN : 0)) * fps)} layout="none">
          <AbsoluteFill style={j === i ? tr : undefined}>
            <Clip src={src} scale={1.04 + 0.08 * clamp((rt - j * 0.43) / 0.6)} />
          </AbsoluteFill>
        </Sequence>
      ))}
      {i >= 0 && <>
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,.65), transparent 22%)" }} />
        <div style={{ position: "absolute", left: 50 * u, top: vertical ? H * 0.06 : 44 * u, display: "flex", alignItems: "center", gap: 18 * u }}>   {/* top-left: the clips carry their own captions at the bottom */}
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 30 * u, color: C.bg, background: C.acc, padding: `${6 * u}px ${12 * u}px`, borderRadius: 8 * u }}>{String(i + 1).padStart(2, "0")}</div>
          <div style={{ fontFamily: BLACK, fontSize: (vertical ? 54 : 50) * u, color: "#fff", transform: `translateY(${(1 - EASE.out(clamp(lt / 0.15))) * 30 * u}px)`, opacity: clamp(lt / 0.08), textShadow: "0 3px 12px rgba(0,0,0,.6)" }}>{REEL[i][1]}</div>
        </div>
        <div style={{ position: "absolute", right: 50 * u, top: vertical ? H * 0.11 : 52 * u, fontFamily: MONO, fontWeight: 700, fontSize: 26 * u, color: "#fff", opacity: 0.85 }}>REAL RENDERS · NO STOCK</div>
      </>}
      {/* 9:16 moment: three phones slide up with the vertical kits */}
      {phoneK > 0 && phoneOut < 1 && <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${mixOklch(C.bg2, C.acc, 0.2)}, ${C.bg})`, opacity: 1 - phoneOut }}>
        {PHONES.map((p, j) => { const pw = vertical ? W * 0.3 : H * 0.42, ph = pw * 16 / 9 > H * 0.8 ? H * 0.8 : pw * 16 / 9, pww = ph * 9 / 16, x = W / 2 + (j - 1) * (pww + 40 * u) - pww / 2, kk = clamp(enterK(t, PH_AT + j * 0.08, PL, 0.35), 0, 1.1);
          return <div key={p} style={{ position: "absolute", left: x, top: (H - ph) / 2 + (1 - Math.min(1, kk)) * H * 0.6, width: pww, height: ph, borderRadius: 36 * u, overflow: "hidden", border: `${8 * u}px solid #1d2029`, boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,.6)`, transform: `rotate(${(j - 1) * 4}deg)` }}>
            <Sequence from={Math.round(PH_AT * fps)} layout="none"><Clip src={p} /></Sequence></div>; })}
        <div style={{ position: "absolute", left: 0, right: 0, top: vertical ? H * 0.06 : H * 0.03, textAlign: "center", fontFamily: BLACK, fontSize: 56 * u, color: C.ink }}>9:16 <span style={{ color: C.acc }}>too.</span></div>
      </AbsoluteFill>}
      <AbsoluteFill style={{ background: "#fff", opacity: i >= 0 && kind === 1 ? 0.35 * (1 - clamp(lt / 0.07)) : 0 }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ F. shuffling bento of live kits (17-21) ------------------------------------------------------------------ */
const Bento2: React.FC = () => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, u = Math.min(W, H) / 1080, vertical = H > W;
  const cols = vertical ? 2 : 3, rows = vertical ? 3 : 2, gap = 22 * u, top0 = vertical ? H * 0.14 : H * 0.14, bot0 = vertical ? H * 0.2 : H * 0.06, ar = W / H;
  const cw = (W * 0.92 - gap * (cols - 1)) / cols, chF = (H - top0 - bot0 - gap * (rows - 1)) / rows, cell = Math.min(cw, chF * ar), ch = cell / ar;
  const ox = (W - (cell * cols + gap * (cols - 1))) / 2, oy = top0;
  const order1 = [0, 1, 2, 3, 4, 5], order2 = [4, 2, 0, 5, 3, 1], sh = EASE.inOut(seg(t, 1.9, 0.5)), dive = EASE.in(seg(t, 3.4, 0.6));
  const camRot = Math.sin(t * 1.2) * 2.5 * (1 - dive);
  return (
    <AbsoluteFill>
      <Studio t={t + 17} tint={C.green} />
      <div style={{ position: "absolute", left: 0, right: 0, top: vertical ? H * 0.05 : H * 0.03, textAlign: "center", fontFamily: BLACK, fontSize: (vertical ? 58 : 52) * u, color: C.ink, opacity: 1 - dive }}>One package<span style={{ color: C.acc }}>.</span> Every format<span style={{ color: C.acc }}>.</span></div>
      <AbsoluteFill style={{ transform: `rotate(${camRot}deg) scale(${pulse(t, 0.025) * (1 + 3 * dive)})`, transformOrigin: "50% 55%", opacity: 1 - seg(t, 3.75, 0.25) }}>
        {KITS.map((k, i) => {
          const at = i * 0.15, pk = clamp(enterK(t, at, PL, 0.35), 0, 1.15);
          const p1 = order1.indexOf(i), p2 = order2.indexOf(i), pos = (p: number) => [ox + (p % cols) * (cell + gap), oy + Math.floor(p / cols) * (ch + gap)];
          const [x1, y1] = pos(p1), [x2, y2] = pos(p2), x = x1 + (x2 - x1) * sh, y = y1 + (y2 - y1) * sh - Math.sin(Math.PI * sh) * 60 * u * (i % 2 ? 1 : -1);
          return (
            <div key={k.label} style={{ position: "absolute", left: x, top: y, width: cell, height: ch, transform: `scale(${0.5 + 0.5 * Math.min(1, pk)}) rotate(${(1 - Math.min(1, pk)) * (i % 2 ? 12 : -12)}deg)`, opacity: clamp((t - at) / 0.08), borderRadius: 20 * u, overflow: "hidden", border: `${3 * u}px solid rgba(255,255,255,.14)`, boxShadow: `0 ${18 * u}px ${44 * u}px rgba(0,0,0,.5)` }}>
              <div style={{ width: W, height: H, transform: `scale(${cell / W})`, transformOrigin: "0 0", position: "relative" }}>
                <Sequence from={-Math.round(KIT_START[i] * fps) + Math.round(at * fps)} layout="none">{k.el}</Sequence>
              </div>
              <div style={{ position: "absolute", left: 12 * u, bottom: 12 * u, padding: `${5 * u}px ${12 * u}px`, borderRadius: 99, background: "rgba(10,11,15,.85)", fontFamily: INTER, fontWeight: 800, fontSize: 20 * u, color: k.color }}>{k.label}</div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ G. stamped gates (21-24.5) ------------------------------------------------------------------ */
export const GATES2: [string, string][] = [["quality_gate", "fail 0 · -16.0 LUFS"], ["text_check", "fail 0 · contrast ok"], ["sync_check", "onset +0.03 s"]];
const STAMP = [0.75, 1.25, 1.75];
const Gates2: React.FC = () => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, u = Math.min(W, H) / 1080, vertical = H > W;
  const hit = STAMP.reduce((a, s) => Math.max(a, 1 - clamp((t - s) / 0.2) * (t >= s ? 1 : 0) - (t < s ? 1 : 0)), 0);
  const shake = hit * 14 * u, sx = (hash(f) - 0.5) * shake, sy = (hash(f + 9) - 0.5) * shake;
  const col = EASE.in(seg(t, 3.0, 0.5)), w0 = vertical ? W * 0.86 : W * 0.6;
  return (
    <AbsoluteFill>
      <Studio t={t + 21} tint={C.green} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 22 * u, transform: `translate(${sx}px, ${sy}px) scale(${(1 - 0.92 * col) * pulse(t, 0.02)})`, opacity: 1 - col }}>
        <div style={{ fontFamily: BLACK, fontSize: (vertical ? 76 : 104) * u, lineHeight: 1.05, maxWidth: W * 0.88, textAlign: "center", color: C.ink, marginBottom: 20 * u, textShadow: chroma(hit, u) }}>   {/* 9:16: wraps inside the frame */}
          {["EVERY", "OUTPUT", "GATED."].map((w, i) => { const k = clamp(enterK(t, i * 0.12, SN, 0.25), 0, 1.1); return <span key={w} style={{ display: "inline-block", marginRight: 24 * u, transform: `translateY(${(1 - Math.min(1, k)) * 60 * u}px)`, opacity: clamp((t - i * 0.12) / 0.05), color: i === 2 ? C.acc : C.ink }}>{w}</span>; })}
        </div>
        {GATES2.map(([n, v], i) => { const s = STAMP[i], st = clamp(enterK(t, s, PL, 0.25), 0, 1.3), rowK = clamp(enterK(t, s - 0.3, SN, 0.25), 0, 1.05);
          return <div key={n} style={{ width: w0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${20 * u}px ${28 * u}px`, borderRadius: 18 * u, background: t >= s ? mixOklch(C.bg2, C.green, 0.12 * (1 - clamp((t - s) / 0.5)) + 0.04) : "rgba(255,255,255,.06)", opacity: clamp((t - s + 0.3) / 0.1), transform: `translateX(${(1 - Math.min(1, rowK)) * (i % 2 ? 80 : -80) * u}px)` }}>
            <div><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: (vertical ? 40 : 40) * u, color: C.ink }}>{n}.py</div><div style={{ fontFamily: INTER, fontSize: 24 * u, color: C.dim }}>{v}</div></div>
            <div style={{ fontFamily: BLACK, fontSize: 48 * u, color: C.bg, background: C.green, padding: `${8 * u}px ${24 * u}px`, borderRadius: 14 * u, transform: `scale(${t >= s ? st : 0}) rotate(${(1 - Math.min(1, st)) * -18}deg)` }}>PASS</div>
          </div>; })}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff", opacity: hit * 0.25 }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ H. logo (24.5-30) ------------------------------------------------------------------ */
const Logo2: React.FC = () => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, u = Math.min(W, H) / 1080;
  const land = 1.5, hit = t >= land ? 1 - clamp((t - land) / 0.3) : 0;
  return (
    <AbsoluteFill style={{ transform: `scale(${pulse(t, 0.02)})` }}>
      <LogoReveal logo={{ ...DEMO_LOGO, style: "assemble" }} bg={C.bg} ink={C.ink} accent={C.acc} />
      {/* light streaks that sweep through on the land */}
      {[0, 1, 2, 3].map((i) => { const k = seg(t, land - 0.1 + i * 0.05, 0.5); return k > 0 && k < 1 && <div key={i} style={{ position: "absolute", left: -W * 0.3 + W * 1.6 * EASE.inOut(k), top: H * (0.2 + 0.18 * i), width: W * 0.4, height: (6 + 6 * (i % 2)) * u, background: `linear-gradient(90deg, transparent, ${[C.acc, C.blue, C.red, C.green][i]}, transparent)`, transform: "skewX(-30deg)" }} />; })}
      <AbsoluteFill style={{ background: "#fff", opacity: hit * 0.4 }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: H * (H > W ? 0.22 : 0.08), textAlign: "center", fontFamily: MONO, fontWeight: 500, fontSize: 30 * u, color: C.dim, opacity: EASE.out(seg(t, 2.6, 0.4)) }}>open source · MIT · runs on your machine</div>
    </AbsoluteFill>
  );
};

export const VidbucksPromo2: React.FC = () => {
  const { fps } = useVideoConfig(), F = (s: number) => Math.round(s * fps);
  const sc: [number, number, React.ReactNode][] = [[S2.flash, S2.mark, <Flash />], [S2.mark, S2.type, <Mark />], [S2.type, S2.ui, <Kinetic2 />], [S2.ui, S2.reel, <Analysis2 />],
    [S2.reel, S2.bento, <Reel />], [S2.bento, S2.gates, <Bento2 />], [S2.gates, S2.logo, <Gates2 />], [S2.logo, PROMO2_LEN, <Logo2 />]];
  return <AbsoluteFill style={{ background: C.bg }}>{sc.map(([a, b, el], i) => <Sequence key={i} from={F(a)} durationInFrames={F(b - a)} name={`scene ${i + 1}`}>{el}</Sequence>)}</AbsoluteFill>;
};
