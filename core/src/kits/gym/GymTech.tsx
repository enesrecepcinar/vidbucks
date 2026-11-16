// Technical, light-theme version of the gym clip: full frame (no punch-ins), clean white infographic cards.
// Beats: title -> muscles (rep 1) -> live tempo bar (rep 2) -> bottom freeze with elbow angle, 0.5x slow motion with
// a live angle gauge, top freeze with range of motion (rep 3) -> form checklist (rep 4) -> set summary (rep 5).
// All numbers are approximate measurements taken from the footage itself (points marked by eye on key frames,
// tempo from frames sampled every 0.2 s); the cards say "≈".
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fInter } from "@remotion/google-fonts/Inter";

const INTER = fInter("normal", { weights: ["500", "700", "800", "900"], subsets: ["latin", "latin-ext"] }).fontFamily;
const INK = "#1c1f26", BLUE = "#2f6df6", ORANGE = "#ff7a1a", GREEN = "#1fa463", SRC = "gym/light1080.mp4";

type Piece = { kind: "play"; a: number; b: number; rate: number } | { kind: "still"; img: string; dur: number };
const PIECES: Piece[] = [
  { kind: "play", a: 0.0, b: 2.9, rate: 1 },       // rep 1: title + muscles
  { kind: "play", a: 3.0, b: 5.2, rate: 1 },       // rep 2: tempo bar
  { kind: "still", img: "gym/lf_5.9.jpg", dur: 1.7 }, // rep 3 bottom: angle
  { kind: "play", a: 5.9, b: 6.8, rate: 0.5 },     // rep 3 up in slow motion: live gauge
  { kind: "still", img: "gym/lf_6.8.jpg", dur: 1.8 }, // rep 3 top: angle + ROM
  { kind: "play", a: 8.9, b: 10.9, rate: 1 },      // rep 4: checklist
  { kind: "play", a: 11.4, b: 12.6, rate: 1 },     // rep 5
  { kind: "still", img: "gym/lf_12.6.jpg", dur: 2.3 }, // summary
];
const len = (p: Piece) => (p.kind === "play" ? (p.b - p.a) / p.rate : p.dur);
const ST: number[] = []; let acc = 0; for (const p of PIECES) { ST.push(acc); acc += len(p); }
export const TECH_DURATION = acc;
const at = (i: number, local: number) => { const p = PIECES[i] as Extract<Piece, { kind: "play" }>; return ST[i] + (local - p.a) / p.rate; };
export const TECH_TOPS = [at(0, 1.6), at(1, 4.0), ST[4], at(5, 9.8), at(6, 12.4)];

// joints marked on the key frames (1080x1920 frame pixels)
const BOTTOM = { s: [690, 990], e: [560, 1170], w: [435, 1260], deg: 160 };
const TOP = { s: [650, 890], e: [600, 1090], w: [515, 880], deg: 35 };

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ramp = (t: number, t0: number, d: number) => clamp((t - t0) / d);
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const win = (t: number, t0: number, t1: number, d = 0.25) => easeOut(ramp(t, t0, d)) * (1 - easeOut(ramp(t, t1 - d, d)));

const Card: React.FC<{ k: number; x: number; y: number; w: number; children: React.ReactNode; from?: "left" | "right" | "up" }> = ({ k, x, y, w, children, from = "up" }) => k <= 0 ? null : (
  <div style={{ position: "absolute", left: x, top: y, width: w, background: "rgba(255,255,255,.96)", borderRadius: 28, padding: "26px 30px", boxShadow: "0 18px 50px rgba(20,30,50,.22)", opacity: k,
    transform: from === "left" ? `translateX(${(1 - k) * -60}px)` : from === "right" ? `translateX(${(1 - k) * 60}px)` : `translateY(${(1 - k) * 40}px)`, fontFamily: INTER, color: INK }}>{children}</div>
);
const Label: React.FC<{ c?: string; children: React.ReactNode }> = ({ c = BLUE, children }) => <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: 3, color: c, marginBottom: 10 }}>{children}</div>;

/** joint lines + elbow arc on a freeze frame */
const Joints: React.FC<{ j: typeof BOTTOM; k: number; color: string }> = ({ j, k, color }) => {
  const [sx, sy] = j.s, [ex, ey] = j.e, [wx, wy] = j.w, r = 70;
  const a1 = Math.atan2(sy - ey, sx - ex), a2 = Math.atan2(wy - ey, wx - ex);
  let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const steps = 24, arc = Array.from({ length: steps + 1 }, (_, i) => { const a = a1 + d * (i / steps) * k; return `${ex + r * Math.cos(a)},${ey + r * Math.sin(a)}`; }).join(" ");
  const len1 = Math.hypot(sx - ex, sy - ey), len2 = Math.hypot(wx - ex, wy - ey);
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <line x1={ex} y1={ey} x2={ex + (sx - ex) * k} y2={ey + (sy - ey) * k} stroke="#fff" strokeWidth={14} strokeLinecap="round" />
      <line x1={ex} y1={ey} x2={ex + (wx - ex) * k} y2={ey + (wy - ey) * k} stroke="#fff" strokeWidth={14} strokeLinecap="round" />
      <line x1={ex} y1={ey} x2={ex + (sx - ex) * k} y2={ey + (sy - ey) * k} stroke={color} strokeWidth={7} strokeLinecap="round" strokeDasharray={`${len1} 1`} />
      <line x1={ex} y1={ey} x2={ex + (wx - ex) * k} y2={ey + (wy - ey) * k} stroke={color} strokeWidth={7} strokeLinecap="round" strokeDasharray={`${len2} 1`} />
      <polyline points={arc} fill="none" stroke={ORANGE} strokeWidth={8} strokeLinecap="round" />
      {[j.s, j.e, j.w].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={14 * k} fill="#fff" stroke={color} strokeWidth={6} />)}
    </svg>
  );
};

/** semicircle gauge 0..180 deg */
const Gauge: React.FC<{ deg: number; k: number }> = ({ deg, k }) => {
  const R = 120, cx = 150, cy = 140, a = Math.PI * (1 - deg / 180);
  return (
    <svg width={300} height={170}>
      <path d={`M${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" stroke="#e6e9f0" strokeWidth={22} strokeLinecap="round" />
      <path d={`M${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R * Math.cos(a)} ${cy - R * Math.sin(a)}`} fill="none" stroke={ORANGE} strokeWidth={22} strokeLinecap="round" opacity={k} />
      <line x1={cx} y1={cy} x2={cx + (R - 30) * Math.cos(a)} y2={cy - (R - 30) * Math.sin(a)} stroke={INK} strokeWidth={8} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={12} fill={INK} />
    </svg>
  );
};

export const GymTech: React.FC = () => {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), t = f / fps;
  let i = 0; for (let q = 0; q < PIECES.length; q++) if (t >= ST[q]) i = q;
  const full: React.CSSProperties = { position: "absolute", width: 1080, height: 1920, objectFit: "cover" };
  const reps = TECH_TOPS.filter((x) => t >= x - 0.05).length;
  // tempo bar during rep 2 (local phases: up 3.4-3.8, top 3.8-4.2, down 4.2-5.0)
  const L2 = (local: number) => at(1, local);
  const phases: [string, number, number, string][] = [["YUKARI", L2(3.4), L2(3.8), BLUE], ["TEPEDE", L2(3.8), L2(4.2), ORANGE], ["AŞAĞI", L2(4.2), L2(5.0), GREEN]];
  // live elbow angle during the slow-motion piece
  const slowK = ease(ramp(t, ST[3], len(PIECES[3])));
  const liveDeg = Math.round(BOTTOM.deg + (TOP.deg - BOTTOM.deg) * slowK);
  const endK = win(t, ST[7] + 0.2, TECH_DURATION + 1);
  return (
    <AbsoluteFill style={{ background: "#f4f6fa" }}>
      {PIECES.map((p, q) => (
        <Sequence key={q} from={Math.round(ST[q] * fps)} durationInFrames={Math.max(1, Math.round(len(p) * fps))}>
          {p.kind === "play" ? <OffthreadVideo src={staticFile(SRC)} startFrom={Math.round(p.a * fps)} playbackRate={p.rate} muted style={full} />
            : <Img src={staticFile(p.img)} style={{ ...full, filter: q === 7 ? `blur(${6 * endK}px) brightness(${1 + 0.08 * endK})` : undefined }} />}
        </Sequence>
      ))}
      {/* freeze-frame marker */}
      {PIECES[i].kind === "still" && i !== 7 && <div style={{ position: "absolute", left: 40, top: 150, fontFamily: INTER, fontWeight: 800, fontSize: 26, letterSpacing: 3, color: "#fff", background: INK, padding: "8px 16px", borderRadius: 10 }}>❚❚ DURDURULDU</div>}
      {PIECES[i].kind === "play" && (PIECES[i] as any).rate < 1 && <div style={{ position: "absolute", left: 40, top: 150, fontFamily: INTER, fontWeight: 800, fontSize: 26, letterSpacing: 3, color: "#fff", background: BLUE, padding: "8px 16px", borderRadius: 10 }}>0.5x AĞIR ÇEKİM</div>}

      {/* rep counter, top right */}
      {reps > 0 && i !== 7 && <div style={{ position: "absolute", right: 40, top: 140, fontFamily: INTER, background: "rgba(255,255,255,.95)", borderRadius: 20, padding: "12px 22px", boxShadow: "0 10px 30px rgba(20,30,50,.18)", textAlign: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: 3, color: "#7a8294" }}>TEKRAR</div>
        <div style={{ fontWeight: 900, fontSize: 56, color: INK, lineHeight: 1 }}>{reps}<span style={{ color: "#b4bac7", fontSize: 36 }}>/5</span></div>
      </div>}

      {/* title */}
      <Card k={win(t, 0.1, 1.55)} x={60} y={1380} w={960}>
        <Label>TEKNİK ANALİZ</Label>
        <div style={{ fontWeight: 900, fontSize: 68, lineHeight: 1.05 }}>Halatla Kablo<br />Hammer Curl</div>
      </Card>
      {/* muscles */}
      <Card k={win(t, 1.45, ST[1])} x={60} y={1330} w={960} from="left">
        <Label>ÇALIŞAN KASLAR</Label>
        <div style={{ display: "flex", gap: 26, alignItems: "center" }}>
          <svg width={210} height={170} viewBox="0 0 210 170">
            <path d="M30 30 Q 60 20 90 40 L 110 100 Q 100 120 80 118 L 50 70 Z" fill="#e6e9f0" stroke={INK} strokeWidth={4} />
            <path d="M60 46 Q 85 50 98 86 L 86 100 Z" fill={ORANGE} opacity={0.9} />
            <path d="M90 104 Q 130 96 180 60 L 192 76 Q 140 122 98 124 Z" fill="#e6e9f0" stroke={INK} strokeWidth={4} />
            <path d="M100 108 Q 140 100 178 70 L 184 78 Q 140 114 104 118 Z" fill={BLUE} opacity={0.9} />
          </svg>
          <div style={{ fontSize: 34, lineHeight: 1.45, fontWeight: 700 }}>
            <div><span style={{ color: ORANGE }}>●</span> Brakiyalis</div>
            <div><span style={{ color: BLUE }}>●</span> Brakiyoradiyalis</div>
            <div style={{ color: "#7a8294" }}>● Biseps (yardımcı)</div>
          </div>
        </div>
      </Card>
      {/* tempo bar */}
      <Card k={win(t, ST[1] + 0.1, ST[2])} x={60} y={1380} w={960}>
        <Label>TEMPO · BU TEKRAR</Label>
        <div style={{ display: "flex", gap: 10, height: 34, borderRadius: 17, overflow: "hidden", background: "#e6e9f0" }}>
          {phases.map(([n, a, b, c]) => <div key={n} style={{ flex: b - a, background: "#e6e9f0", position: "relative" }}><div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${ramp(t, a, b - a) * 100}%`, background: c }} /></div>)}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14, fontSize: 30, fontWeight: 800 }}>
          {phases.map(([n, a, b, c]) => <div key={n} style={{ flex: b - a, color: t >= a ? c : "#b4bac7" }}>{n}<div style={{ fontSize: 26, fontWeight: 700, color: "#7a8294" }}>≈{(b - a).toFixed(1).replace(".", ",")} sn</div></div>)}
        </div>
      </Card>
      {/* rep 3: bottom freeze */}
      {i === 2 && <Joints j={BOTTOM} k={easeOut(ramp(t, ST[2] + 0.1, 0.5))} color={BLUE} />}
      <Card k={win(t, ST[2] + 0.35, ST[3])} x={60} y={1420} w={600} from="left">
        <Label>DİPTE · DİRSEK AÇISI</Label>
        <div style={{ fontWeight: 900, fontSize: 84, lineHeight: 1 }}>≈{BOTTOM.deg}°</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: "#7a8294", marginTop: 8 }}>Kol neredeyse tam açık</div>
      </Card>
      {/* rep 3: slow motion live gauge */}
      <Card k={win(t, ST[3], ST[4] + 0.3)} x={60} y={1360} w={640} from="left">
        <Label>DİRSEK AÇISI</Label>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}><Gauge deg={liveDeg} k={1} /><div style={{ fontWeight: 900, fontSize: 84 }}>≈{liveDeg}°</div></div>
      </Card>
      {/* rep 3: top freeze */}
      {i === 4 && <Joints j={TOP} k={easeOut(ramp(t, ST[4] + 0.1, 0.5))} color={BLUE} />}
      <Card k={win(t, ST[4] + 0.35, ST[5])} x={60} y={1380} w={960}>
        <Label c={ORANGE}>TEPEDE · HAREKET AÇIKLIĞI</Label>
        <div style={{ display: "flex", alignItems: "baseline", gap: 26 }}>
          <div style={{ fontWeight: 900, fontSize: 84 }}>≈{TOP.deg}°</div>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#7a8294" }}>açıklık ≈{BOTTOM.deg - TOP.deg}°</div>
        </div>
      </Card>
      {/* rep 4: checklist */}
      <Card k={win(t, ST[5] + 0.1, ST[6] + 0.2)} x={60} y={1290} w={960} from="right">
        <Label c={GREEN}>FORM KONTROLÜ</Label>
        {["Avuçlar birbirine bakar (nötr tutuş)", "Dirsekler gövdeye yakın", "Gövde sabit, salınım yok", "İniş kontrollü"].map((s, q) => { const u = easeOut(ramp(t, ST[5] + 0.3 + q * 0.3, 0.25)); return (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34, fontWeight: 700, margin: "8px 0", opacity: u, transform: `translateX(${(1 - u) * 30}px)` }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: GREEN, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900 }}>✓</div>{s}</div>); })}
      </Card>
      {/* summary */}
      <Card k={endK} x={60} y={560} w={960}>
        <Label>SET ÖZETİ</Label>
        <div style={{ fontWeight: 900, fontSize: 62, lineHeight: 1.1, marginBottom: 18 }}>5 tekrar · halat · alt makara</div>
        {[["Yukarı", "≈0,5 sn", BLUE], ["Tepede bekleme", "≈0,6 sn", ORANGE], ["Aşağı", "≈0,75 sn", GREEN], ["Hareket açıklığı", `≈${BOTTOM.deg - TOP.deg}°`, INK]].map(([a, b, c]) => (
          <div key={a} style={{ display: "flex", justifyContent: "space-between", fontSize: 36, fontWeight: 700, padding: "12px 0", borderTop: "2px solid #eef0f5" }}><span style={{ color: "#5b6375" }}>{a}</span><span style={{ color: c, fontWeight: 900 }}>{b}</span></div>))}
        <div style={{ fontSize: 24, fontWeight: 600, color: "#9aa1b0", marginTop: 10 }}>Değerler videodan yaklaşık ölçülmüştür.</div>
      </Card>
      <Card k={win(t, ST[7] + 0.9, TECH_DURATION + 1)} x={60} y={1420} w={960}>
        <div style={{ fontWeight: 900, fontSize: 44, textAlign: "center" }}>Kaydet, bir sonraki kol gününde dene.</div>
      </Card>
    </AbsoluteFill>
  );
};
