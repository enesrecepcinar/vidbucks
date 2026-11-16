// Energetic 9:16 edit of a gym set (cable rope hammer curl): five reps from one locked-off phone shot, with speed
// ramps (0.5x on reps 3 and 5 from the 60 fps source), a punch-in + flash + shake on every rep top, framing changes
// between reps, a rep counter, three form cues and a freeze-frame ending. Source: public/gym/graded.mp4 (graded,
// trimmed copy; local time = source time - 3.8 s).
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fAnton } from "@remotion/google-fonts/Anton";
import { loadFont as fInter } from "@remotion/google-fonts/Inter";

const ANTON = fAnton("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] }).fontFamily;
const INTER = fInter("normal", { weights: ["800", "900"], subsets: ["latin", "latin-ext"] }).fontFamily;
const ACC = "#FFD23F";
const GYM_SRC = "gym/graded1080.mp4";

/** a piece of the source played at `rate`; `base` = framing [scale, cx, cy] while it plays */
type Seg = { a: number; b: number; rate: number; base: [number, number, number] };
const SEGS: Seg[] = [
  { a: 0.75, b: 2.7, rate: 1, base: [1.18, 0.53, 0.56] },
  { a: 3.2, b: 5.2, rate: 1, base: [1.42, 0.55, 0.5] },
  { a: 6.1, b: 6.4, rate: 1, base: [1.25, 0.54, 0.52] },
  { a: 6.4, b: 7.2, rate: 0.5, base: [1.25, 0.54, 0.52] },
  { a: 7.2, b: 7.8, rate: 1.25, base: [1.25, 0.54, 0.52] },
  { a: 8.9, b: 10.9, rate: 1, base: [1.12, 0.53, 0.58] },
  { a: 11.4, b: 11.8, rate: 1, base: [1.38, 0.55, 0.5] },
  { a: 11.8, b: 12.6, rate: 0.5, base: [1.38, 0.55, 0.5] },
];
const TOPS = [1.6, 4.0, 6.8, 9.8, 12.4];          // rep tops, local source time
const FREEZE = 0.95;                               // seconds of freeze frame at the end

// output timeline
const starts: number[] = []; let acc = 0;
for (const s of SEGS) { starts.push(acc); acc += (s.b - s.a) / s.rate; }
export const GYM_DURATION = acc + FREEZE;
const toOut = (src: number) => { for (let i = 0; i < SEGS.length; i++) { const s = SEGS[i]; if (src >= s.a && src <= s.b) return starts[i] + (src - s.a) / s.rate; } return -1; };
export const TOP_OUT = TOPS.map(toOut);
export const CUT_OUT = starts.filter((_, i) => i > 0 && SEGS[i].a !== SEGS[i - 1].b);   // real cuts (not speed changes)

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ramp = (t: number, t0: number, d: number) => clamp((t - t0) / d);
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const back = (x: number, s = 2.2) => { x = clamp(x); const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };

const CUES: { text: string; t0: number; t1: number }[] = [
  { text: "DİRSEKLER SABİT", t0: starts[1] + 0.15, t1: starts[2] - 0.1 },
  { text: "TEPEDE SIK", t0: starts[2] + 0.1, t1: starts[5] - 0.1 },
  { text: "YAVAŞ İNDİR", t0: TOP_OUT[3] + 0.15, t1: starts[6] - 0.05 },
];

export const GymEdit: React.FC = () => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps;
  let i = 0; for (let k = 0; k < SEGS.length; k++) if (t >= starts[k]) i = k;
  const frozen = t >= acc;
  // framing: the segment's base, a punch-in on each rep top that eases back, a beat of shake
  const [bs, bx, by] = SEGS[Math.min(i, SEGS.length - 1)].base;
  let s = bs, cx = bx, cy = by, shake = 0, flash = 0;
  for (const tt of TOP_OUT) {
    const inK = easeOut(ramp(t, tt - 0.12, 0.12)), outK = easeOut(ramp(t, tt + 0.35, 0.7)), k = inK * (1 - outK);
    s += 0.32 * k; cx += (0.56 - cx) * k * 0.8; cy += (0.4 - cy) * k * 0.8;
    shake += Math.max(0, 1 - Math.abs(t - tt) / 0.22); flash = Math.max(flash, 1 - clamp(Math.abs(t - tt) / 0.05));
  }
  for (const ct of CUT_OUT) flash = Math.max(flash, 0.35 * (1 - clamp(Math.abs(t - ct) / 0.05)));
  if (frozen) { const k = easeOut(ramp(t, acc, 0.6)); s = lerp(s, 1.55, k); cx = lerp(cx, 0.55, k); cy = lerp(cy, 0.42, k); }
  const sx = shake * Math.sin(f * 2.7) * 14, sy = shake * Math.cos(f * 3.3) * 10;
  // keep the picture covering the frame
  const half = 0.5 / s; cx = clamp(cx, half, 1 - half); cy = clamp(cy, half, 1 - half);
  const tx = (0.5 - cx) * W * s + sx, ty = (0.5 - cy) * H * s + sy;
  const pic: React.CSSProperties = { position: "absolute", width: W, height: H, objectFit: "cover", transform: `translate(${tx}px, ${ty}px) scale(${s})`, transformOrigin: "50% 50%" };

  // counter
  const done = TOP_OUT.filter((x) => t >= x - 0.05).length, lastTop = TOP_OUT[done - 1] ?? 0, pop = done ? back(ramp(t, lastTop - 0.05, 0.25)) : 0;
  const titleK = easeOut(ramp(t, 0.05, 0.3)) * (1 - easeOut(ramp(t, starts[1] - 0.45, 0.3)));
  const endK = frozen ? easeOut(ramp(t, acc + 0.1, 0.3)) : 0;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {SEGS.map((sg, k) => (
        <Sequence key={k} from={Math.round(starts[k] * fps)} durationInFrames={Math.max(1, Math.round(((sg.b - sg.a) / sg.rate) * fps))}>
          <OffthreadVideo src={staticFile(GYM_SRC)} startFrom={Math.round(sg.a * fps)} playbackRate={sg.rate} muted style={pic} />
        </Sequence>
      ))}
      {frozen && <Img src={staticFile("gym/freeze.jpg")} style={{ ...pic, filter: `saturate(${1 - 0.35 * endK}) brightness(${1 - 0.3 * endK})` }} />}
      {/* vignette + grain-like top/bottom shade for text */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,.55) 100%)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,.45) 0%, transparent 22%, transparent 70%, rgba(0,0,0,.35) 100%)" }} />
      {flash > 0 && <AbsoluteFill style={{ background: "#fff", opacity: 0.32 * flash, mixBlendMode: "screen" }} />}

      {/* title */}
      {titleK > 0 && <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.16, textAlign: "center", opacity: titleK, transform: `translateY(${(1 - titleK) * -40}px)` }}>
        <div style={{ fontFamily: INTER, fontWeight: 900, fontSize: 52, letterSpacing: 6, color: "#fff", textShadow: "0 4px 18px rgba(0,0,0,.7)" }}>HALATLA KABLO</div>
        <div style={{ fontFamily: ANTON, fontSize: 150, lineHeight: 1, color: ACC, transform: `scale(${back(ramp(t, 0.12, 0.35))})`, textShadow: "0 6px 26px rgba(0,0,0,.75)" }}>HAMMER CURL</div>
      </div>}

      {/* rep counter: big number + progress */}
      {done > 0 && !frozen && <div style={{ position: "absolute", left: 70, top: H * 0.38, textAlign: "left" }}>
        <div style={{ fontFamily: ANTON, fontSize: 230, lineHeight: 0.9, color: "#fff", transform: `scale(${pop})`, transformOrigin: "0% 50%", textShadow: "0 8px 30px rgba(0,0,0,.8)" }}>{done}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>{TOP_OUT.map((_, k) => <div key={k} style={{ width: 26, height: 26, borderRadius: 13, background: k < done ? ACC : "rgba(255,255,255,.28)", border: "3px solid rgba(0,0,0,.4)" }} />)}</div>
        <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 30, letterSpacing: 4, color: "rgba(255,255,255,.85)", marginTop: 10 }}>TEKRAR</div>
      </div>}

      {/* form cues */}
      {CUES.map((c, k) => { const u = easeOut(ramp(t, c.t0, 0.22)) * (1 - easeOut(ramp(t, c.t1 - 0.2, 0.2))); return u > 0 && (
        <div key={k} style={{ position: "absolute", left: 0, right: 0, top: H * 0.7, display: "flex", justifyContent: "center", opacity: u, transform: `translateY(${(1 - u) * 30}px) scale(${0.9 + 0.1 * u})` }}>
          <div style={{ fontFamily: INTER, fontWeight: 900, fontSize: 64, letterSpacing: 2, color: "#111", background: ACC, padding: "14px 34px", borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}>{c.text}</div>
        </div>); })}
      {/* slow-motion tag */}
      {SEGS[i].rate < 1 && !frozen && <div style={{ position: "absolute", right: 60, top: H * 0.14, fontFamily: INTER, fontWeight: 900, fontSize: 40, color: "#fff", background: "rgba(0,0,0,.45)", padding: "8px 18px", borderRadius: 10, letterSpacing: 3 }}>0.5x</div>}

      {/* ending */}
      {endK > 0 && <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.17, textAlign: "center", opacity: endK }}>
        <div style={{ fontFamily: ANTON, fontSize: 210, lineHeight: 1, color: ACC, transform: `scale(${back(ramp(t, acc + 0.1, 0.35))})`, textShadow: "0 8px 30px rgba(0,0,0,.8)" }}>5 TEKRAR</div>
        <div style={{ fontFamily: INTER, fontWeight: 900, fontSize: 58, letterSpacing: 6, color: "#fff", marginTop: 26, opacity: ramp(t, acc + 0.35, 0.25) }}>KAYDET • SALONDA DENE</div>
      </div>}
    </AbsoluteFill>
  );
};
function lerp(a: number, b: number, k: number) { return a + (b - a) * k; }
