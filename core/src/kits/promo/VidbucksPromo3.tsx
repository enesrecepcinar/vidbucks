// VidbucksPromo3: the flowing cut. Same material as v2, but every join BLENDS (shots overlap by up to 0.6 s through
// src/kits/transitions.tsx) and no two joins in a row speak the same language: zoom-through, split strips, tile cover,
// ink blot, glitch, wave, colour bars between scenes; push / iris / diagonal / stack / flip / wave between the type blocks;
// whip / spin / luma / flash / blob / ... between the reel clips. The camera keeps one direction of travel through each
// join, so the cut reads as one continuous move. Every shot starts LEAD s before its slot so it can be half-way in.
import React from "react";
import { AbsoluteFill, Sequence, staticFile, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fInter } from "@remotion/google-fonts/Inter";
import { loadFont as fArchivo } from "@remotion/google-fonts/ArchivoBlack";
import { loadFont as fMono } from "@remotion/google-fonts/JetBrainsMono";
import { EASE, clamp, enterK, persona, mixOklch, speedRamp } from "../motion";
import { TransitionStage, TKind } from "../transitions";
import { C, Studio, KITS, KIT_START } from "./VidbucksPromo";
import { hash, pulse, chroma, FLASH, REEL, BLOCKS, GATES2 } from "./VidbucksPromo2";
import { LogoReveal, DEMO_LOGO } from "../logo/LogoReveal";

const INTER = fInter("normal", { weights: ["500", "700", "800"], subsets: ["latin"] }).fontFamily;
const BLACK = fArchivo("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
const MONO = fMono("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily;
export const PROMO3_LEN = 30;
const LEAD = 0.5;                                   // every shot is mounted LEAD s early, so a join can show it half-way in
const SN = persona("snappy"), PL = persona("playful");
const seg = (t: number, a: number, d: number) => clamp((t - a) / d);
/** local scene time (seconds from the shot's slot start; negative while it is still coming in) */
const useT = () => { const f = useCurrentFrame(), { fps } = useVideoConfig(); return f / fps - LEAD; };
const Video: React.FC<{ src: string; from: number; scale?: number; origin?: string }> = ({ src, from, scale = 1, origin = "50% 50%" }) => {
  const { fps } = useVideoConfig();
  return <Sequence from={Math.round((from + LEAD) * fps)} layout="none"><AbsoluteFill style={{ overflow: "hidden" }}>
    <OffthreadVideo src={staticFile(`promo/clips/${src}.mp4`)} muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})`, transformOrigin: origin }} /></AbsoluteFill></Sequence>;
};

/* ------------------------------------------------------------------ 1. hook: one continuous push through eight films ------------------------------------------------------------------ */
const Hook: React.FC = () => {
  const t = useT(), { width: W, height: H } = useVideoConfig(), u = Math.min(W, H) / 1080;
  const i = clamp(Math.floor(t / 0.25), 0, 7), lt = t - i * 0.25;
  // the zoom never resets: each clip starts at the scale the previous one reached, so eight cuts read as one dolly
  const z = 1.0 + 0.09 * i + 0.09 * clamp(lt / 0.25), rot = Math.sin(t * 2.2) * 1.5;
  return (
    <AbsoluteFill style={{ background: "#000", transform: `rotate(${rot}deg) scale(1.04)` }}>
      {FLASH.map((s, j) => j === i && <Video key={s} src={s} from={j * 0.25} scale={z} origin={`${50 + (j % 2 ? 6 : -6)}% 50%`} />)}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,.6))" }} />
      {t >= 1.0 && <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.5 - 95 * u, height: 190 * u, background: "#000", transform: `scaleY(${EASE.out(seg(t, 1.0, 0.15))})` }} />}
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.5 - 70 * u, textAlign: "center", fontFamily: BLACK, fontSize: 120 * u, lineHeight: `${140 * u}px`, color: t < 1.5 ? "#fff" : C.acc, letterSpacing: (6 + 20 * (1 - EASE.out(seg(t, t < 1.5 ? 1.0 : 1.5, 0.4)))) * u, textShadow: chroma(1 - seg(t, t < 1.5 ? 1.0 : 1.5, 0.12), u), opacity: t >= 1.0 ? 1 : 0 }}>{t < 1.5 ? "MADE" : "WITH"}</div>
      <div style={{ position: "absolute", left: 40 * u, bottom: 40 * u, fontFamily: MONO, fontSize: 26 * u, color: "#fff", opacity: 0.8 }}>{String(i + 1).padStart(2, "0")} / 08 · films made with this package</div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 2. wordmark (no exit: the join does it) ------------------------------------------------------------------ */
const Mark3: React.FC = () => {
  const t = useT(), { width: W, height: H } = useVideoConfig(), u = Math.min(W, H) / 1080, vertical = H > W, size = (vertical ? 138 : 230) * u;
  const glitch = t > 0 && t < 0.3 ? 1 - t / 0.3 : t > 1.0 && t < 1.12 ? 1 : 0, slices = 7, drift = t * 18 * u;
  return (
    <AbsoluteFill>
      <Studio t={t + 2} />
      {Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2 + t * 0.4, d = EASE.out(seg(t, 0, 0.8)) * (vertical ? 520 : 760) * u, s = (1 - seg(t, 0.4, 1.4)) * 26 * u;
        return <div key={i} style={{ position: "absolute", left: W / 2 + Math.cos(a) * d - s / 2, top: H / 2 + Math.sin(a) * d * 0.6 - s / 2, width: s, height: s, borderRadius: i % 3 ? 99 : 4 * u, background: [C.acc, C.blue, C.red, C.green][i % 4] }} />; })}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", transform: `translateX(${-drift}px) scale(${pulse(t, 0.05) * (1 + 0.04 * t)})` }}>
        <div style={{ position: "relative", fontFamily: BLACK, fontSize: size, lineHeight: 1, color: C.ink, height: size * 1.05 }}>
          {Array.from({ length: slices }, (_, s_) => { const off = glitch ? (hash(s_ * 7 + Math.floor(t * 30)) - 0.5) * 120 * u * glitch : 0;
            return <div key={s_} style={{ position: "absolute", left: 0, top: 0, whiteSpace: "nowrap", clipPath: `inset(${(s_ / slices) * 100}% 0 ${100 - ((s_ + 1) / slices) * 100}% 0)`, transform: `translateX(calc(-50% + ${off}px))`, textShadow: chroma(glitch, u) }}><span style={{ color: C.acc }}>V</span>IDBUCKS</div>; })}
        </div>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 40 * u, color: C.acc, marginTop: 36 * u }}>{"reference in. original out.".slice(0, Math.floor(27 * seg(t, 0.35, 0.7)))}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 3. colour blocks, each join a different move ------------------------------------------------------------------ */
const BLOCK_T: TKind[] = ["push", "iris", "diagonal", "stack", "flip", "wave"];
const Block: React.FC<{ i: number; lt: number }> = ({ i, lt }) => {
  const { width: W, height: H } = useVideoConfig(), u = Math.min(W, H) / 1080, vertical = H > W, B = BLOCKS[i], dir = i % 2 ? 1 : -1;
  const fs = Math.min((vertical ? 300 : 360) * u, W * 0.86 / (B.w.length * 0.78));
  return (
    <AbsoluteFill style={{ background: B.bg }}>
      <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(${dir * 45}deg, ${mixOklch(B.bg, B.ink, 0.08)} 0 ${30 * u}px, transparent ${30 * u}px ${60 * u}px)`, backgroundPosition: `${lt * 220 * dir}px 0` }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: BLACK, fontSize: fs, lineHeight: 1, color: B.ink, transform: `scale(${1.12 - 0.12 * EASE.out(clamp(lt / 0.45))}) translateX(${dir * lt * 40 * u}px)`, letterSpacing: (12 * (1 - EASE.out(clamp(lt / 0.4)))) * u }}>{B.w}</div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 50 * u, top: 50 * u, fontFamily: MONO, fontWeight: 700, fontSize: 28 * u, color: B.ink, opacity: 0.7 }}>{String(i + 1).padStart(2, "0")}</div>
      <div style={{ position: "absolute", right: 60 * u, bottom: vertical ? H * 0.22 : 60 * u, width: 160 * u, height: 160 * u, border: `${8 * u}px solid ${B.ink}`, borderRadius: i % 2 ? 99 : 18 * u, transform: `rotate(${lt * 180}deg) scale(${EASE.out(clamp(lt / 0.25))})`, opacity: 0.85 }} />
    </AbsoluteFill>
  );
};
const Kinetic3: React.FC = () => {
  const t = useT(), D = 0.2;                       // 0.2 s blended joins between blocks
  const i = BLOCKS.reduce((a, b, j) => (t >= b.at - D / 2 ? j : a), 0), B = BLOCKS[i];
  const joinOf = (j: number) => BLOCKS[j] && t >= BLOCKS[j].at - D / 2 && t < BLOCKS[j].at + D / 2;
  if (i > 0 && joinOf(i)) {
    const p = (t - (B.at - D / 2)) / D;
    return <TransitionStage kind={BLOCK_T[(i - 1) % BLOCK_T.length]} p={p} dir={i % 2 ? 1 : -1} A={<Block i={i - 1} lt={t - BLOCKS[i - 1].at} />} B={<Block i={i} lt={t - B.at} />} color={B.ink} />;
  }
  return <Block i={Math.max(0, i)} lt={t - B.at} />;
};

/* ------------------------------------------------------------------ 4. analysis (no exit) ------------------------------------------------------------------ */
const Analysis3: React.FC = () => {
  const real = useT(), { width: W, height: H } = useVideoConfig(), u = Math.min(W, H) / 1080, vertical = H > W;
  const t = speedRamp(Math.max(0, real), 1.6, { runIn: 0.35, out: 0.45, slow: 0.25 });
  const slam = clamp(enterK(t, 0, SN, 0.3), 0, 1.1), zoom = 1 + 1.6 * EASE.inOut(seg(t, 1.3, 1.3));
  const pw = vertical ? W * 0.9 : W * 0.8, ph = vertical ? H * 0.5 : H * 0.62, play = seg(t, 0.15, 1.1);
  const num = (a: number, b: number, k: number, d = 1) => (a + (b - a) * EASE.out(k)).toFixed(d);
  return (
    <AbsoluteFill>
      <Studio t={real + 7} tint={C.blue} />
      <AbsoluteFill style={{ transform: `scale(${zoom * pulse(Math.max(0, real), 0.03)})`, transformOrigin: "50% 56%" }}>
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
      <div style={{ position: "absolute", left: 0, right: 0, top: vertical ? H * 0.12 : H * 0.07, textAlign: "center", fontFamily: BLACK, fontSize: (vertical ? 70 : 64) * u, color: C.ink, textShadow: chroma(1 - seg(real, 0, 0.15), u), opacity: 1 - seg(real, 1.4, 0.4) }}>MEASURED<span style={{ color: C.acc }}>, </span>NOT GUESSED</div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 5. reel: 14 films + phones, every join different ------------------------------------------------------------------ */
const REEL_T: TKind[] = ["whip", "spin", "luma", "diagonal", "flash", "push", "blob", "glitch", "wave", "iris", "stack", "flip", "zoom", "bars"];
const SLOT = 0.43, RD = 0.18, PH_AT = 3.0, PH_LEN = 1.0;
type RShot = { kind: "clip"; i: number; start: number; end: number } | { kind: "phones"; start: number; end: number };
const rshots: RShot[] = (() => { const out: RShot[] = []; let t = 0;
  REEL.forEach((_, i) => { if (Math.abs(t - PH_AT) < SLOT / 2 || (t >= PH_AT && !out.some((s) => s.kind === "phones"))) { out.push({ kind: "phones", start: t, end: t + PH_LEN }); t += PH_LEN; } out.push({ kind: "clip", i, start: t, end: t + SLOT }); t += SLOT; });
  return out; })();
const PhonesShot: React.FC<{ lt: number }> = ({ lt }) => {
  const { width: W, height: H } = useVideoConfig(), u = Math.min(W, H) / 1080, vertical = H > W;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${mixOklch(C.bg2, C.acc, 0.22)}, ${C.bg})` }}>
      {["v_chat", "v_count", "v_ad"].map((p, j) => { const ph = vertical ? H * 0.5 : H * 0.78, pw = ph * 9 / 16, x = W / 2 + (j - 1) * (pw + 40 * u) - pw / 2, kk = clamp(enterK(lt, j * 0.08, PL, 0.35), 0, 1.1);
        return <div key={p} style={{ position: "absolute", left: x, top: (H - ph) / 2 + (1 - Math.min(1, kk)) * H * 0.4 + Math.sin(lt * 3 + j) * 8 * u, width: pw, height: ph, borderRadius: 36 * u, overflow: "hidden", border: `${8 * u}px solid #1d2029`, boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,.6)`, transform: `rotate(${(j - 1) * 4}deg)` }}>
          <OffthreadVideo src={staticFile(`promo/clips/${p}.mp4`)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>; })}
      <div style={{ position: "absolute", left: 0, right: 0, top: vertical ? H * 0.12 : H * 0.03, textAlign: "center", fontFamily: BLACK, fontSize: 56 * u, color: C.ink }}>9:16 <span style={{ color: C.acc }}>too.</span></div>
    </AbsoluteFill>
  );
};
const ClipShot: React.FC<{ i: number; lt: number }> = ({ i, lt }) => {
  const { width: W, height: H } = useVideoConfig(), u = Math.min(W, H) / 1080, vertical = H > W;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${1.05 + 0.1 * clamp(lt / 0.8)}) translateX(${(i % 2 ? 1 : -1) * lt * 30 * u}px)` }}>
        <OffthreadVideo src={staticFile(`promo/clips/${REEL[i][0]}.mp4`)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,.65), transparent 22%)" }} />
      <div style={{ position: "absolute", left: 50 * u, top: vertical ? H * 0.06 : 44 * u, display: "flex", alignItems: "center", gap: 18 * u }}>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 30 * u, color: C.bg, background: C.acc, padding: `${6 * u}px ${12 * u}px`, borderRadius: 8 * u }}>{String(i + 1).padStart(2, "0")}</div>
        <div style={{ fontFamily: BLACK, fontSize: (vertical ? 54 : 50) * u, color: "#fff", transform: `translateY(${(1 - EASE.out(clamp(lt / 0.15))) * 30 * u}px)`, opacity: clamp(lt / 0.08 + 0.3), textShadow: "0 3px 12px rgba(0,0,0,.6)" }}>{REEL[i][1]}</div>
      </div>
      <div style={{ position: "absolute", right: 50 * u, top: vertical ? H * 0.11 : 52 * u, fontFamily: MONO, fontWeight: 700, fontSize: 26 * u, color: "#fff", opacity: 0.85 }}>REAL RENDERS · NO STOCK</div>
    </AbsoluteFill>
  );
};
/** each reel shot's video must start at its own first visible frame: Sequence per shot keeps OffthreadVideo in sync */
const RShotEl: React.FC<{ s: RShot; t: number }> = ({ s, t }) => {
  const { fps } = useVideoConfig(), from = Math.round((s.start - RD / 2 + LEAD) * fps);
  return <Sequence from={from} layout="none">{s.kind === "phones" ? <PhonesShot lt={t - s.start} /> : <ClipShot i={s.i} lt={t - s.start} />}</Sequence>;
};
const Reel3: React.FC = () => {
  const t = useT();
  const j = rshots.findIndex((s, k) => k > 0 && t >= s.start - RD / 2 && t < s.start + RD / 2);
  if (j > 0) return <TransitionStage kind={REEL_T[(j - 1) % REEL_T.length]} p={(t - (rshots[j].start - RD / 2)) / RD} dir={j % 2 ? 1 : -1} A={<RShotEl s={rshots[j - 1]} t={t} />} B={<RShotEl s={rshots[j]} t={t} />} />;
  const s = rshots.find((x) => t >= x.start - RD / 2 && t < x.end + RD / 2) ?? rshots[rshots.length - 1];
  return <RShotEl s={s} t={t} />;
};

/* ------------------------------------------------------------------ 6. bento (no exit) ------------------------------------------------------------------ */
const Bento3: React.FC = () => {
  const t = useT(), { fps, width: W, height: H } = useVideoConfig(), u = Math.min(W, H) / 1080, vertical = H > W;
  const cols = vertical ? 2 : 3, rows = vertical ? 3 : 2, gap = 22 * u, top0 = H * 0.14, bot0 = vertical ? H * 0.2 : H * 0.06, ar = W / H;
  const cw = (W * 0.92 - gap * (cols - 1)) / cols, chF = (H - top0 - bot0 - gap * (rows - 1)) / rows, cell = Math.min(cw, chF * ar), ch = cell / ar;
  const ox = (W - (cell * cols + gap * (cols - 1))) / 2, oy = top0, order2 = [4, 2, 0, 5, 3, 1], sh = EASE.inOut(seg(t, 1.9, 0.6));
  return (
    <AbsoluteFill>
      <Studio t={t + 17} tint={C.green} />
      <div style={{ position: "absolute", left: 0, right: 0, top: vertical ? H * 0.05 : H * 0.03, textAlign: "center", fontFamily: BLACK, fontSize: (vertical ? 58 : 52) * u, color: C.ink }}>One package<span style={{ color: C.acc }}>.</span> Every format<span style={{ color: C.acc }}>.</span></div>
      <AbsoluteFill style={{ transform: `rotate(${Math.sin(t * 1.2) * 2.5}deg) scale(${pulse(Math.max(0, t), 0.025) * (1 + 0.05 * t)})`, transformOrigin: "50% 55%" }}>
        {KITS.map((k, i) => {
          const at = i * 0.15, pk = clamp(enterK(t, at, PL, 0.35), 0, 1.15), pos = (p: number) => [ox + (p % cols) * (cell + gap), oy + Math.floor(p / cols) * (ch + gap)];
          const [x1, y1] = pos(i), [x2, y2] = pos(order2.indexOf(i)), x = x1 + (x2 - x1) * sh, y = y1 + (y2 - y1) * sh - Math.sin(Math.PI * sh) * 60 * u * (i % 2 ? 1 : -1);
          return (
            <div key={k.label} style={{ position: "absolute", left: x, top: y, width: cell, height: ch, transform: `scale(${0.5 + 0.5 * Math.min(1, pk)}) rotate(${(1 - Math.min(1, pk)) * (i % 2 ? 12 : -12)}deg)`, opacity: clamp((t - at) / 0.08), borderRadius: 20 * u, overflow: "hidden", border: `${3 * u}px solid rgba(255,255,255,.14)`, boxShadow: `0 ${18 * u}px ${44 * u}px rgba(0,0,0,.5)` }}>
              <div style={{ width: W, height: H, transform: `scale(${cell / W})`, transformOrigin: "0 0", position: "relative" }}>
                <Sequence from={-Math.round(KIT_START[i] * fps) + Math.round((at + LEAD) * fps)} layout="none">{k.el}</Sequence>
              </div>
              <div style={{ position: "absolute", left: 12 * u, bottom: 12 * u, padding: `${5 * u}px ${12 * u}px`, borderRadius: 99, background: "rgba(10,11,15,.85)", fontFamily: INTER, fontWeight: 800, fontSize: 20 * u, color: k.color }}>{k.label}</div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 7. gates (no exit) ------------------------------------------------------------------ */
const STAMP = [0.75, 1.25, 1.75];
const Gates3: React.FC = () => {
  const t = useT(), f = useCurrentFrame(), { width: W, height: H } = useVideoConfig(), u = Math.min(W, H) / 1080, vertical = H > W;
  const hit = STAMP.reduce((a, s) => (t >= s ? Math.max(a, 1 - clamp((t - s) / 0.2)) : a), 0), shake = hit * 14 * u, w0 = vertical ? W * 0.86 : W * 0.6;
  return (
    <AbsoluteFill>
      <Studio t={t + 21} tint={C.green} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 22 * u, transform: `translate(${(hash(f) - 0.5) * shake}px, ${(hash(f + 9) - 0.5) * shake}px) scale(${pulse(Math.max(0, t), 0.02) * (1 + 0.03 * t)})` }}>
        <div style={{ fontFamily: BLACK, fontSize: (vertical ? 76 : 104) * u, lineHeight: 1.05, maxWidth: W * 0.88, textAlign: "center", color: C.ink, marginBottom: 20 * u, textShadow: chroma(hit, u) }}>
          {["EVERY", "OUTPUT", "GATED."].map((w, i) => { const k = clamp(enterK(t, i * 0.12, SN, 0.25), 0, 1.1); return <span key={w} style={{ display: "inline-block", marginRight: 24 * u, transform: `translateY(${(1 - Math.min(1, k)) * 60 * u}px)`, opacity: clamp((t - i * 0.12) / 0.05), color: i === 2 ? C.acc : C.ink }}>{w}</span>; })}
        </div>
        {GATES2.map(([n, v], i) => { const s = STAMP[i], st = clamp(enterK(t, s, PL, 0.25), 0, 1.3), rowK = clamp(enterK(t, s - 0.3, SN, 0.25), 0, 1.05);
          return <div key={n} style={{ width: w0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${20 * u}px ${28 * u}px`, borderRadius: 18 * u, background: "rgba(255,255,255,.06)", opacity: clamp((t - s + 0.3) / 0.1), transform: `translateX(${(1 - Math.min(1, rowK)) * (i % 2 ? 80 : -80) * u}px)` }}>
            <div><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 40 * u, color: C.ink }}>{n}.py</div><div style={{ fontFamily: INTER, fontSize: 24 * u, color: C.dim }}>{v}</div></div>
            <div style={{ fontFamily: BLACK, fontSize: 48 * u, color: C.bg, background: C.green, padding: `${8 * u}px ${24 * u}px`, borderRadius: 14 * u, transform: `scale(${t >= s ? st : 0}) rotate(${(1 - Math.min(1, st)) * -18}deg)` }}>PASS</div>
          </div>; })}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff", opacity: hit * 0.22 }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 8. logo ------------------------------------------------------------------ */
const Logo3: React.FC = () => {
  const t = useT(), { fps, width: W, height: H } = useVideoConfig(), u = Math.min(W, H) / 1080, land = 1.5, hit = t >= land ? 1 - clamp((t - land) / 0.3) : 0;
  return (
    <AbsoluteFill style={{ transform: `scale(${pulse(Math.max(0, t), 0.02)})` }}>
      <Sequence from={Math.round(LEAD * fps)} layout="none"><LogoReveal logo={{ ...DEMO_LOGO, style: "assemble" }} bg={C.bg} ink={C.ink} accent={C.acc} /></Sequence>
      {t < 0 && <AbsoluteFill style={{ background: C.bg }} />}
      {[0, 1, 2, 3].map((i) => { const k = seg(t, land - 0.1 + i * 0.05, 0.5); return k > 0 && k < 1 && <div key={i} style={{ position: "absolute", left: -W * 0.3 + W * 1.6 * EASE.inOut(k), top: H * (0.2 + 0.18 * i), width: W * 0.4, height: (6 + 6 * (i % 2)) * u, background: `linear-gradient(90deg, transparent, ${[C.acc, C.blue, C.red, C.green][i]}, transparent)`, transform: "skewX(-30deg)" }} />; })}
      <AbsoluteFill style={{ background: "#fff", opacity: hit * 0.4 }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: H * (H > W ? 0.22 : 0.08), textAlign: "center", fontFamily: MONO, fontWeight: 500, fontSize: 30 * u, color: C.dim, opacity: EASE.out(seg(t, 2.6, 0.4)) }}>open source · MIT · runs on your machine</div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ the edit: shots + joins ------------------------------------------------------------------ */
type Shot = { start: number; end: number; el: React.ReactNode };
const SHOTS: Shot[] = [
  { start: 0, end: 2, el: <Hook /> }, { start: 2, end: 4, el: <Mark3 /> }, { start: 4, end: 7, el: <Kinetic3 /> }, { start: 7, end: 10, el: <Analysis3 /> },
  { start: 10, end: 17.02, el: <Reel3 /> }, { start: 17.02, end: 21, el: <Bento3 /> }, { start: 21, end: 24.5, el: <Gates3 /> }, { start: 24.5, end: 30, el: <Logo3 /> },
];
// the join INTO shot i (i >= 1): kind, duration, direction, focus point; no two neighbours share a language
export const JOINS: { kind: TKind; d: number; dir?: 1 | -1; at?: [number, number] }[] = [
  { kind: "luma", d: 0 }, { kind: "zoom", d: 0.5, at: [0.5, 0.5] }, { kind: "split", d: 0.5 }, { kind: "tiles", d: 0.6 }, { kind: "blob", d: 0.5, at: [0.5, 0.6] },
  { kind: "glitch", d: 0.35 }, { kind: "wave", d: 0.55 }, { kind: "bars", d: 0.6 },
];
export const VidbucksPromo3: React.FC = () => {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), t = f / fps, F = (s: number) => Math.round(s * fps);
  const mount = (i: number) => <Sequence key={i} from={F(SHOTS[i].start - LEAD)} durationInFrames={F(SHOTS[i].end - SHOTS[i].start + 2 * LEAD)} layout="none">{SHOTS[i].el}</Sequence>;
  const j = SHOTS.findIndex((s, i) => i > 0 && JOINS[i].d > 0 && t >= s.start - JOINS[i].d / 2 && t < s.start + JOINS[i].d / 2);
  if (j > 0) { const J = JOINS[j]; return <AbsoluteFill style={{ background: C.bg }}><TransitionStage kind={J.kind} p={(t - (SHOTS[j].start - J.d / 2)) / J.d} dir={J.dir ?? 1} at={J.at} A={mount(j - 1)} B={mount(j)} /></AbsoluteFill>; }
  const i = SHOTS.findIndex((s) => t >= s.start && t < s.end);
  return <AbsoluteFill style={{ background: C.bg }}>{mount(i < 0 ? SHOTS.length - 1 : i)}</AbsoluteFill>;
};
