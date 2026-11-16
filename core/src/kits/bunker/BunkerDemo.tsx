// 60-second animated demo of the second-person survival serial: the same painted-comic look and writing pattern as
// the studied channel, but everything MOVES: the character dozes, startles, runs, dives and rises; lights stream,
// doors slide, the tunnel flashes, the station shakes. Every event is pinned to a narrator word (timing.json).
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { getPose, lerpPose, type Pose } from "../../engine/Figure";
import timing from "../../../public/films/bunker/timing.json";
import { Hero, MORE, type Face } from "./Hero";
import { BANG, C, Caption, Defs, Finish, HAND, INK, Sfx, back, clamp, ease, easeOut, lerp, ramp } from "./ink";
import { Dust, PhoneClose, Pillar, Section, Station, TrainCar, WavePanel } from "./Sets";

type TL = { id: number; text: string; start: number; end: number; words: [string, number, number][] };
const LINES = (timing as unknown as { lines: TL[] }).lines;
const L = (id: number) => LINES[id - 1].start;
const W = (id: number, i: number) => LINES[id - 1].words[Math.min(i, LINES[id - 1].words.length - 1)][1];
export const BUNKER_DURATION = (timing as unknown as { duration: number }).duration;

const PASS = [
  { x: 1010, look: { beanie: null, hair: "#5a3a22", jacket: "#7a5b8c", jacketShade: "#5e4470", skin: "#f2d6b8" } },
  { x: 1190, look: { beanie: null, hair: "#1e1e1e", jacket: "#3f6f8f", jacketShade: "#2d5470", skin: "#8a5a3c" } },
];

/** camera: scale about a point, plus shake */
const Cam: React.FC<{ s: number; cx: number; cy: number; rot?: number; shake?: number; f: number; children: React.ReactNode }> = ({ s, cx, cy, rot = 0, shake = 0, f, children }) => {
  const sx = shake * (Math.sin(f * 1.9) * 0.7 + Math.sin(f * 3.7) * 0.3) * 22, sy = shake * (Math.cos(f * 2.3) * 0.7 + Math.sin(f * 4.1) * 0.3) * 16;
  return <g transform={`translate(${960 + sx} ${540 + sy}) rotate(${rot}) scale(${s}) translate(${-cx} ${-cy})`}>{children}</g>;
};

const Bubble: React.FC<{ x: number; y: number; k: number; pop: number; f: number }> = ({ x, y, k, pop, f }) => {
  if (k <= 0 || pop >= 1) return null;
  const sc = back(k, 1.8) * (1 + pop * 0.6), o = 1 - pop;
  return (
    <g transform={`translate(${x} ${y}) scale(${sc})`} opacity={o}>
      {[[-150, 190, 14], [-110, 150, 22]].map(([dx, dy, r], i) => <circle key={i} cx={dx} cy={dy} r={r} fill="#fff" stroke={INK} strokeWidth={5} />)}
      <path d="M-170 0 Q -190 -110 -60 -120 Q 0 -190 90 -120 Q 210 -120 190 0 Q 210 110 80 110 Q 0 160 -80 110 Q -200 110 -170 0 Z" fill="#fff" stroke={INK} strokeWidth={6} />
      <g transform={`translate(-95 -8) scale(0.8) rotate(${Math.sin(f * 0.2) * 4})`}><path d="M-50 0 Q -60 -60 0 -62 Q 60 -64 58 -6 Q 64 44 4 46 Q -58 50 -50 0 Z" fill="#f4a7b4" stroke={INK} strokeWidth={5} /><path d="M-30 -30 q 20 10 4 30 M 10 -44 q -6 30 20 40 M 30 10 q -24 4 -30 28" stroke="#c9667a" strokeWidth={5} fill="none" strokeLinecap="round" /></g>
      <text x={88} y={18} textAnchor="middle" fontFamily={HAND} fontSize={40} fill={INK}>it's fine</text>
    </g>
  );
};

const zzz = (t: number, x: number, y: number) => [0, 1, 2].map((k) => { const u = ((t * 0.55 + k / 3) % 1); return <text key={k} x={x + u * 60} y={y - u * 130} fontFamily={BANG} fontSize={38 + u * 30} fill={INK} opacity={Math.sin(u * Math.PI)}>Z</text>; });

export const BunkerDemo: React.FC = () => {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), t = f / fps;
  let scene: React.ReactNode = null;

  // ---- 1 + 2 + 4 + 5: the carriage ------------------------------------------------------------------------
  if (t < L(3) - 0.15 || (t >= L(4) - 0.1 && t < L(6) - 0.15)) {
    const s2 = L(2), startle = W(2, 6) + 0.1, inS4 = t >= L(4) - 0.1, inS5 = t >= L(5) - 0.1;
    const phoneOn = (k: number) => ramp(t, W(2, 2) + k * 0.28, 0.08);
    const jolt = t >= startle && !inS4 ? Math.max(0, Math.sin(clamp((t - startle) / 0.35) * Math.PI)) * 34 : 0;
    // hero: seated doze -> startle -> standing with the phone -> shakes it off -> runs to the door
    let pose: Pose = MORE.seatDoze, face: Face = { eyes: "closed", mouth: "o", blink: false }, hx = 520, hy = 610, head = 0, hold: "phone" | null = null, glow = 0, facing: 1 | -1 = 1;
    if (!inS4) {
      head = t < startle ? 12 + Math.sin(t * 2.2) * 7 : 0;
      if (t >= startle) { pose = lerpPose(MORE.seatDoze, MORE.seatUp, easeOut(ramp(t, startle, 0.25))); face = { eyes: "wide", mouth: "o", brow: -1, sweat: ramp(t, startle + 0.4, 0.5) }; }
    } else {
      const standK = easeOut(ramp(t, L(4) - 0.1, 0.4));
      pose = lerpPose(MORE.seatPhone, MORE.standPhone, standK); hy = lerp(610, 640, standK); hx = lerp(520, 760, standK); hold = "phone"; glow = 1;
      face = { eyes: "wide", mouth: "flat", brow: -0.5, look: [0.3, 0.2] };
      if (t > W(4, 9)) face = { eyes: "dot", mouth: "smile", brow: 0.4, look: [0.4, 0.3] };    // "everything is fine"
      if (inS5) {
        const shakeHead = ramp(t, W(5, 1), 0.6);
        head = shakeHead > 0 && shakeHead < 1 ? Math.sin(shakeHead * Math.PI * 5) * 14 : 0;
        face = { eyes: shakeHead > 0 ? "squint" : "wide", mouth: "grit", brow: 1 };
        if (t > W(5, 4)) { hold = null; glow = 0; face = { eyes: "wide", mouth: "grit", brow: 1, sweat: 1 }; pose = lerpPose(MORE.standPhone, MORE.brace, easeOut(ramp(t, W(5, 4), 0.3))); }
        const runT0 = W(5, 10) - 0.15;
        if (t > runT0) { const rk = t - runT0; pose = getPose("run", f); hx = 760 + rk * 520; hy = 640; face = { eyes: "wide", mouth: "grit", brow: 1, sweat: 1 }; }
      }
    }
    const door = inS5 ? ease(ramp(t, W(5, 6), 0.7)) : 0;
    const camS = !inS4 ? lerp(1.12, 1.42, ease(clamp(t / 7))) * (1 + (t > startle ? 0.06 * easeOut(ramp(t, startle, 0.2)) : 0)) : inS5 ? lerp(1.3, 1.12, ease(ramp(t, L(5), 1.2))) : lerp(1.22, 1.34, ease(ramp(t, L(4), 7)));
    const camX = !inS4 ? lerp(860, 700, ease(clamp(t / 7))) : inS5 ? lerp(800, 1180, ease(ramp(t, W(5, 6), 2.2))) : lerp(900, 820, ease(ramp(t, L(4), 7)));
    const camY = !inS4 ? lerp(560, 540, ease(clamp(t / 7))) : 520;
    const sway = Math.sin(t * 1.3) * 0.35;
    scene = (
      <Cam s={camS} cx={camX} cy={camY} rot={sway} f={f}>
        <TrainCar t={t} door={door} clock={t < 3 ? "23:51" : "23:52"} light={1} />
        {PASS.map((p, k) => {
          const on = t >= s2 ? phoneOn(k) : 0, stand = inS4;
          const pp = stand ? MORE.seatPhone : on > 0 ? MORE.seatPhone : MORE.seatDoze;
          const fc: Face = on > 0 ? { eyes: "wide", mouth: k ? "o" : "flat", brow: -0.6, look: [0.3, 0.3] } : { eyes: "closed", mouth: "flat", blink: false };
          return <g key={k} filter="url(#boil)"><Hero x={p.x} y={610 - (stand ? 0 : 0)} s={0.92} pose={pp} face={fc} f={f + k * 37} head={on > 0 ? 6 : 10 + Math.sin(t * 1.7 + k) * 5} hold={on > 0 ? "phone" : null} glow={on} look={p.look} /></g>;
        })}
        {t >= s2 && !inS4 && PASS.map((p, k) => { const u = ramp(t, W(2, 2) + k * 0.28, 0.6); return u > 0 && u < 1 && [0, 1, 2].map((q) => <circle key={`${k}${q}`} cx={p.x + 40} cy={480} r={30 + q * 30 + u * 60} fill="none" stroke={C.glow} strokeWidth={6} opacity={(1 - u) * (1 - q * 0.25)} />); })}
        <g filter="url(#boil)"><Hero x={hx} y={hy - jolt} s={1} pose={pose} face={face} f={f} head={head} hold={hold} glow={glow} facing={facing} /></g>
        {t < startle && t > 0.6 && zzz(t, hx + 70, hy - 280)}
        {t >= startle && !inS4 && <g transform={`translate(${hx + 10} ${hy - 340}) scale(${back(ramp(t, startle, 0.3), 2.4)})`}><text x={-30} y={0} fontFamily={BANG} fontSize={120} fill="#d6362b" stroke={INK} strokeWidth={6} paintOrder="stroke">?!</text></g>}
        {inS4 && <Caption x={560} y={250} text="NORMALCY BIAS" k={ramp(t, W(4, 7) - 0.05, 0.3)} size={70} />}
        {inS4 && <Bubble x={1060} y={300} k={ramp(t, W(4, 10), 0.35)} pop={inS5 ? ramp(t, W(5, 3), 0.25) : 0} f={f} />}
        {inS5 && <Sfx x={1510} y={420} text="WHOOSH" k={ramp(t, W(5, 6), 0.3) * (1 - ramp(t, W(5, 8) + 0.3, 0.3))} size={80} rot={-6} />}
      </Cam>
    );
  }
  // ---- 3: the alert ----------------------------------------------------------------------------------------
  else if (t < L(4) - 0.1) {
    scene = (<>
      <g filter="url(#soft)" opacity={0.6}><TrainCar t={t} /></g>
      <rect width={1920} height={1080} fill="#120808" opacity={0.55} />
      <PhoneClose t={t} t0={L(3) - 0.15} words={[W(3, 0), W(3, 1), W(3, 2), W(3, 3), W(3, 4), W(3, 5)]} f={f} />
      <Sfx x={420} y={300} text="BZZZT" k={ramp(t, L(3) - 0.1, 0.3) * (1 - ramp(t, L(3) + 1.6, 0.4))} size={110} rot={-12} />
    </>);
  }
  // ---- 6: down is good (cross-section) ---------------------------------------------------------------------
  else if (t < L(7) - 0.1) {
    const t0 = L(6) - 0.15, u = clamp((t - t0) / 3.2), z = lerp(2.6, 1.0, ease(clamp((t - t0 - 0.4) / 2.4)));
    const pathK = clamp((t - t0) / 3.0), px = lerp(250, 470, pathK), py = lerp(300, 900, pathK);
    const runX = t - t0 > 3.0 ? 470 + (t - t0 - 3.0) * 160 : px, runY = t - t0 > 3.0 ? 900 : py;
    scene = (
      <Cam s={z} cx={lerp(runX, 960, ease(clamp((t - t0 - 0.4) / 2.4)))} cy={lerp(runY - 80, 540, ease(clamp((t - t0 - 0.4) / 2.4)))} f={f}>
        <Section t={t} label={ramp(t, W(6, 5) - 0.1, 1)} rule={ramp(t, W(6, 11) - 0.2, 0.6)} />
        <g filter="url(#boil)"><Hero x={runX} y={runY - 52} s={0.36} pose={getPose("run", f)} face={{ eyes: "wide", mouth: "grit", brow: 1 }} f={f} /></g>
        <Caption x={960} y={150} text="MORE ABOVE YOU = BETTER ODDS" k={ramp(t, W(6, 11) - 0.05, 0.3)} size={58} />
        {u < 0 ? null : null}
      </Cam>
    );
  }
  // ---- 7: the flash behind you ----------------------------------------------------------------------------
  else if (t < L(8) - 0.1) {
    const t0 = L(7) - 0.15, white = W(7, 6) - 0.3, glow = ease(ramp(t, white, 0.6)), wash = ramp(t, white + 0.2, 0.15) * (1 - ramp(t, white + 0.45, 0.7));
    const hx = 520 + (t - t0) * 230, shut = t > W(7, 7) - 0.1;
    const shadowLen = 520 * glow;
    scene = (
      <Cam s={1.2} cx={hx + 160} cy={560} f={f} shake={glow * 0.15}>
        <Station t={t} tunnelGlow={glow} pan={0} />
        {glow > 0 && <path d={`M${hx - 20} 868 L ${hx + 40} 868 L ${hx + 40 + shadowLen} 890 L ${hx - 20 + shadowLen} 900 Z`} fill="#1a120c" opacity={0.55 * glow} filter="url(#softS)" />}
        <g filter="url(#boil)"><Hero x={hx} y={700} s={1.05} pose={getPose("run", f)} face={shut ? { eyes: "shut", mouth: "grit", brow: 1, sweat: 1 } : { eyes: "wide", mouth: "grit", brow: 1 }} f={f} /></g>
        {[2100, 3000].map((px) => <Pillar key={px} x={px - (t - t0) * 60} />)}
        {wash > 0 && <rect x={-200} y={-200} width={2600} height={1500} fill="#fffaf0" opacity={0.9 * wash} />}
        <Caption x={hx + 120} y={260} text="DON'T LOOK BACK!" k={ramp(t, W(7, 7) - 0.05, 0.3)} size={80} rot={-4} fill="#ff6b4a" color="#fff" />
        {t > W(7, 14) - 0.1 && <g transform={`translate(${hx + 330} 470) scale(${back(ramp(t, W(7, 14) - 0.1, 0.3), 2)})`}><ellipse rx={90} ry={52} fill="#fff" stroke={INK} strokeWidth={7} /><circle r={30} fill="#3a6fb0" stroke={INK} strokeWidth={5} /><circle r={13} fill={INK} />{Array.from({ length: 8 }, (_, k) => <path key={k} d={`M${Math.cos(k * 0.785) * 110} ${Math.sin(k * 0.785) * 76} l ${Math.cos(k * 0.785) * 40} ${Math.sin(k * 0.785) * 28}`} stroke="#ffcf3a" strokeWidth={10} strokeLinecap="round" />)}</g>}
      </Cam>
    );
  }
  // ---- 8: light first, then the wave ----------------------------------------------------------------------
  else if (t < L(9) - 0.1) {
    const k = easeOut(ramp(t, L(8) - 0.15, 0.4));
    scene = <g transform={`translate(${(1 - k) * 1920} 0)`}><WavePanel t={t} tLight={W(8, 0) - 0.05} tWave={W(8, 4)} tRule={W(8, 13)} /></g>;
  }
  // ---- 9, 10, 11: count, dive, the shake, the red light ---------------------------------------------------
  else {
    const t9 = L(9) - 0.15, dive = W(9, 5) - 0.05, land = dive + 0.55, inS10 = t >= L(10) - 0.1, inS11 = t >= L(11) - 0.15;
    const pil = 1180;
    let hx = 300 + (t - t9) * 330, hy = 700, pose: Pose = getPose("run", f), face: Face = { eyes: "wide", mouth: "grit", brow: 1, sweat: 1 }, over = false;
    if (t >= dive) { const u = clamp((t - dive) / 0.55); hx = lerp(300 + (dive - t9) * 330, pil - 210, ease(u)); hy = 700 - Math.sin(u * Math.PI) * 120 + u * 0; pose = lerpPose(MORE.brace, MORE.cover, ease(u)); face = { eyes: "shut", mouth: "grit", brow: 1 }; over = u > 0.6; }
    if (t >= land) { hx = pil - 210; hy = 700; pose = MORE.cover; over = true; face = { eyes: "shut", mouth: "grit", brow: 1, sweat: 1 }; }
    const shakeK = inS10 ? Math.max(0, 1 - (t - W(10, 2)) / 3.2) * (t > W(10, 2) ? 1 : 0) : 0;
    const tremble = inS10 && !inS11 ? Math.sin(f * 2.1) * 3 : 0;
    const die = inS10 ? ramp(t, W(10, 11) - 0.05, 0.12) : 0, flick = W(10, 13), redK = ramp(t, W(10, 17) - 0.1, 0.5);
    let dark = die; if (t > flick && t < flick + 0.8) dark = Math.sin((t - flick) * 47) > 0.2 ? 0.2 : 1; if (t >= flick + 0.8) dark = 0.15;
    const red = t >= flick ? Math.max(redK, 0.6) : 0;
    if (inS11) { const rk = ease(ramp(t, L(11) + 0.1, 1.6)); pose = lerpPose(MORE.cover, MORE.rise, rk); over = rk < 0.4; face = rk < 0.5 ? { eyes: "shut", mouth: "grit", brow: 1 } : { eyes: "dot", mouth: "frown", brow: -0.8, look: [Math.sin((t - L(11)) * 1.6) * 0.8, 0], sweat: 1 }; if (t > W(11, 7)) face = { eyes: "dot", mouth: "flat", brow: 1.2, look: [0.6, 0.2], sweat: 1 }; }
    const camS = inS11 ? lerp(1.15, 1.75, ease(ramp(t, W(11, 5), 2.2))) : inS10 ? 1.12 : lerp(1.0, 1.12, ease(clamp((t - t9) / 4)));
    const camX = inS11 ? lerp(pil - 220, pil - 200, ease(ramp(t, W(11, 5), 2.2))) : inS10 ? pil - 160 : lerp(760, pil - 200, ease(clamp((t - t9) / 3.5)));
    const camY = inS11 ? lerp(600, 520, ease(ramp(t, W(11, 5), 2.2))) : 600;
    const flashAmb = !inS10 ? ramp(t, t9, 2) * 0.25 : 0;
    const nums = !inS10 ? [[W(9, 2), "9"], [W(9, 3), "8"]].map(([at, n], k) => { const u = ramp(t, (at as number) - 0.05, 0.25), out = 1 - ramp(t, (at as number) + 0.65, 0.2); return u > 0 && out > 0 ? <text key={k} x={960 + (k ? 170 : -170)} y={430} textAnchor="middle" fontFamily={BANG} fontSize={360 * back(u, 2.6)} fill="#d6362b" stroke={INK} strokeWidth={14} paintOrder="stroke" opacity={out}>{n}</text> : null; }) : null;
    scene = (<>
      <Cam s={camS} cx={camX} cy={camY} f={f} shake={shakeK * 1.3}>
        <Station t={t} dark={inS10 ? dark : 0} red={red} cracks={inS10 ? ramp(t, W(10, 3), 1.6) : 0} tunnelGlow={!inS10 ? 0.6 : 0} />
        <g filter="url(#boil)" transform={`translate(${tremble} 0)`}><Hero x={hx} y={hy} s={1.05} pose={pose} face={face} f={f} armsOver={over} /></g>
        <Pillar x={pil} w={170} />
        {inS10 && t > W(10, 4) - 0.1 && <Dust t={t} t0={W(10, 4) - 0.2} />}
      </Cam>
      {nums}
      {inS10 && !inS11 && <Sfx x={960} y={300} text="KRRRAKOOOM" k={ramp(t, W(10, 2) - 0.05, 0.3) * (1 - ramp(t, W(10, 2) + 1.6, 0.5))} size={150} rot={-5} fill="#ff8a3a" />}
    </>);
    if (flashAmb > 0) scene = <>{scene}<rect width={1920} height={1080} fill="#fff6e0" opacity={flashAmb} /></>;
  }

  // end card: the serial's mark
  const endK = ramp(t, BUNKER_DURATION - 1.6, 0.4);
  return (
    <AbsoluteFill style={{ background: "#120d0a" }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080">
        <Defs f={f} />
        {scene}
        <Finish />
        {endK > 0 && <g opacity={endK}>
          <rect width={1920} height={1080} fill="#0c0806" opacity={0.55} />
          <text x={960} y={560} textAnchor="middle" fontFamily={BANG} fontSize={170} fill={C.beanie} stroke={INK} strokeWidth={10} paintOrder="stroke" letterSpacing={8}>LAST TRAIN</text>
          <text x={1710} y={140} textAnchor="end" fontFamily={HAND} fontSize={84} fill="#fff" transform="rotate(-4 1710 140)">Part 1</text>
        </g>}
      </svg>
    </AbsoluteFill>
  );
};
