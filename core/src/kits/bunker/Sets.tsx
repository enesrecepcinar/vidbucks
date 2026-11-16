// Painted-comic sets drawn in code, all 1920x1080 and all animatable: night train carriage, metro station, a
// ground cross-section, the phone close-up and the blast-wave diagram. Thick ink outlines, flat colour with painted
// shading (gradients), soft light blooms. Every light, door, crack and particle is a parameter.
import React from "react";
import { BANG, C, HAND, INK, clamp, ease, lerp, ramp, rnd } from "./ink";

const OL = { stroke: INK, strokeWidth: 6, strokeLinejoin: "round" as const };

// ------------------------------------------------------------------ night train carriage
export const TrainCar: React.FC<{ t: number; door?: number; light?: number; clock?: string }> = ({ t, door = 0, light = 1, clock = "23:52" }) => {
  const r = rnd(7);
  const streaks = Array.from({ length: 26 }, (_, i) => ({ y: 160 + r() * 330, w: 60 + r() * 260, c: ["#ffcf6b", "#ff9b54", "#9fd6ff", "#ffe9a8", "#f76b6b"][i % 5], sp: 900 + r() * 900, o: r() * 2400 }));
  const win = (x: number, w: number, id: string) => (
    <g key={id}>
      <clipPath id={`w${id}`}><rect x={x} y={150} width={w} height={360} rx={34} /></clipPath>
      <g clipPath={`url(#w${id})`}>
        <rect x={x} y={150} width={w} height={360} fill="url(#night)" />
        {/* far city: dark blocks with windows, slow parallax */}
        {Array.from({ length: 9 }, (_, k) => { const bx = ((k * 230 - t * 160) % 2070 + 2070) % 2070 - 150, bh = 120 + ((k * 73) % 140);
          return <g key={k}><rect x={bx} y={510 - bh} width={150} height={bh} fill="#1a2234" />{Array.from({ length: 6 }, (_, q) => <rect key={q} x={bx + 18 + (q % 3) * 42} y={510 - bh + 20 + Math.floor(q / 3) * 38} width={18} height={14} fill="#ffd27a" opacity={(k + q) % 3 ? 0.75 : 0.15} />)}</g>; })}
        {/* near lights: fast blurred streaks */}
        {streaks.map((s, k) => { const sx = (((s.o - t * s.sp) % 2400) + 2400) % 2400 - 300; return <rect key={k} x={sx} y={s.y} width={s.w} height={5} rx={3} fill={s.c} opacity={0.85} filter="url(#softS)" />; })}
        <rect x={x} y={150} width={w} height={360} fill="url(#glass)" />
      </g>
      <rect x={x} y={150} width={w} height={360} rx={34} fill="none" stroke="#c9ccc8" strokeWidth={18} />
      <rect x={x - 9} y={141} width={w + 18} height={378} rx={42} fill="none" {...OL} />
      <rect x={x + 9} y={159} width={w - 18} height={342} rx={26} fill="none" stroke={INK} strokeWidth={3} />
    </g>
  );
  const dx = door * 190;
  return (
    <g>
      <defs>
        <linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d1424" /><stop offset="1" stopColor="#24324f" /></linearGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".10" /><stop offset=".4" stopColor="#fff" stopOpacity="0" /><stop offset=".55" stopColor="#fff" stopOpacity=".07" /><stop offset=".6" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#efe8d6" /><stop offset="1" stopColor="#d7cdb6" /></linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5d5650" /><stop offset="1" stopColor="#3b3632" /></linearGradient>
        <linearGradient id="seat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a8288" /><stop offset="1" stopColor="#245a5e" /></linearGradient>
        <linearGradient id="chrome" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8d9395" /><stop offset=".4" stopColor="#f2f4f4" /><stop offset="1" stopColor="#7c8284" /></linearGradient>
        <pattern id="stripe" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="url(#seat)" /><path d="M0 40 L40 0" stroke="#2c6b70" strokeWidth="6" /></pattern>
      </defs>
      <rect width={1920} height={1080} fill="url(#wall)" />
      {/* ceiling + light strips */}
      <path d="M0 0 H1920 V110 Q 960 140 0 110 Z" fill="#cfc6b1" {...OL} />
      {[260, 960, 1660].map((lx) => <g key={lx}><rect x={lx - 230} y={44} width={460} height={34} rx={17} fill="#fffdf2" {...OL} opacity={0.6 + 0.4 * light} /><ellipse cx={lx} cy={150} rx={420} ry={150} fill="#fff6d8" opacity={0.28 * light} filter="url(#glowf)" /></g>)}
      {/* ad cards above the windows (our own fictional ads) */}
      {[["SLEEP IS A SUPERPOWER", "#ffcf6b", 160], ["MERIDIAN LINE · NIGHT SERVICE", "#9fd6ff", 760]].map(([txt, col, ax]) => <g key={txt as string}><rect x={ax as number} y={84} width={420} height={44} rx={6} fill={col as string} {...OL} strokeWidth={4} /><text x={(ax as number) + 210} y={115} textAnchor="middle" fontFamily={BANG} fontSize={26} fill={INK} letterSpacing={1.5}>{txt}</text></g>)}
      {win(110, 520, "a")}{win(700, 520, "b")}
      {/* door with sliding panels; the platform shows behind */}
      <g>
        <rect x={1300} y={130} width={420} height={780} fill="#2a2f35" {...OL} />
        <rect x={1306} y={136} width={408} height={768} fill="url(#tiles)" opacity={door > 0 ? 1 : 0} />
        {door > 0 && <rect x={1306} y={136} width={408} height={768} fill="#fff8e0" opacity={0.25} />}
        {[0, 1].map((k) => { const px = k ? 1510 + dx : 1300 - dx; return (
          <g key={k}><rect x={px} y={130} width={210} height={780} fill="#8a96a1" {...OL} /><rect x={px + 30} y={190} width={150} height={300} rx={20} fill="url(#night)" {...OL} strokeWidth={5} /><rect x={px + (k ? 8 : 182)} y={560} width={18} height={130} rx={9} fill="#5b6670" {...OL} strokeWidth={4} /></g>); })}
        <rect x={1380} y={20} width={260} height={64} rx={8} fill="#111" {...OL} />
        <text x={1510} y={66} textAnchor="middle" fontFamily="monospace" fontWeight={700} fontSize={36} fill="#ff4a3a" letterSpacing={3} style={{ filter: "drop-shadow(0 0 6px #ff3020)" }}>{clock}</text>
      </g>
      {/* bench: back cushion, seat, frame */}
      <rect x={60} y={560} width={1200} height={150} rx={30} fill="url(#stripe)" {...OL} />
      <rect x={40} y={700} width={1240} height={64} rx={24} fill="url(#seat)" {...OL} />
      <rect x={60} y={764} width={1200} height={40} fill="#3e3a36" {...OL} />
      {/* floor */}
      <rect x={0} y={804} width={1920} height={276} fill="url(#floor)" />
      <path d="M0 804 H1920" {...OL} />
      {[0, 1, 2, 3, 4, 5].map((k) => <path key={k} d={`M${-200 + k * 420} 1080 L ${200 + k * 300} 804`} stroke="#4a4440" strokeWidth={4} />)}
      {/* poles */}
      {[650, 1270].map((px) => <g key={px}><rect x={px - 11} y={110} width={22} height={694} fill="url(#chrome)" {...OL} strokeWidth={4} /></g>)}
      <rect x={0} y={130} width={1300} height={16} rx={8} fill="url(#chrome)" {...OL} strokeWidth={4} />
      {[200, 420, 860, 1080].map((hx) => <g key={hx}><path d={`M${hx} 146 L ${hx} 182`} stroke={INK} strokeWidth={4} /><circle cx={hx} cy={196} r={14} fill="none" stroke="#e8e3d8" strokeWidth={8} /><circle cx={hx} cy={196} r={14} fill="none" stroke={INK} strokeWidth={3} /></g>)}
      <rect width={1920} height={1080} fill="#0b1020" opacity={(1 - light) * 0.75} />
    </g>
  );
};

// ------------------------------------------------------------------ metro station (side view across the tracks)
export const Station: React.FC<{ t: number; flash?: number; dark?: number; red?: number; cracks?: number; tunnelGlow?: number; pan?: number }> = ({ t, flash = 0, dark = 0, red = 0, cracks = 0, tunnelGlow = 0, pan = 0 }) => {
  const lampOn = 1 - dark;
  const crackPaths = ["M720 96 l 40 60 l -18 40 l 52 66 l -10 54", "M1180 110 l -30 70 l 44 30 l -20 80", "M300 340 l 60 30 l -10 50 l 70 40", "M1500 300 l -50 40 l 20 60 l -60 50 l 30 60"];
  return (
    <g>
      <defs>
        <linearGradient id="stCeil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a3f45" /><stop offset="1" stopColor="#5a6068" /></linearGradient>
        <linearGradient id="pit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b1a19" /><stop offset="1" stopColor="#2d2b28" /></linearGradient>
        <linearGradient id="plat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a39d93" /><stop offset="1" stopColor="#7c776f" /></linearGradient>
        <radialGradient id="tun" cx="50%" cy="55%" r="60%"><stop offset="0" stopColor="#050505" /><stop offset="1" stopColor="#1d1c1b" /></radialGradient>
        <radialGradient id="tunW" cx="50%" cy="55%" r="55%"><stop offset="0" stopColor="#ffffff" /><stop offset=".6" stopColor="#fff6d6" /><stop offset="1" stopColor="#ffe08a" stopOpacity="0" /></radialGradient>
      </defs>
      <g transform={`translate(${-pan} 0)`}>
        <rect x={-400} y={0} width={4200} height={760} fill="url(#tiles)" />
        <rect x={-400} y={0} width={4200} height={110} fill="url(#stCeil)" />
        <path d="M-400 110 H3800" {...OL} />
        {/* station name band with roundel (fictional station) */}
        <rect x={-400} y={250} width={4200} height={86} fill="#1f4e8c" {...OL} />
        {[520, 1620, 2720].map((nx) => <g key={nx}><circle cx={nx} cy={293} r={70} fill="#fff" {...OL} /><circle cx={nx} cy={293} r={70} fill="none" stroke="#d6362b" strokeWidth={22} /><rect x={nx - 170} y={268} width={340} height={50} rx={8} fill="#1f4e8c" {...OL} strokeWidth={5} /><text x={nx} y={306} textAnchor="middle" fontFamily={BANG} fontSize={42} fill="#fff" letterSpacing={4}>MERIDIAN</text></g>)}
        {/* posters */}
        {[[860, "#ffcf6b", "LATE NIGHT JAZZ"], [1200, "#f28b6b", "MIND THE GAP"], [2060, "#9fd6ff", "LAST TRAIN 00:10"], [2760, "#b7e08a", "NIGHT OWL CAFE"]].map(([px, col, txt]) => <g key={txt as string}><rect x={px as number} y={420} width={220} height={290} fill={col as string} {...OL} /><rect x={(px as number) + 20} y={444} width={180} height={150} fill="#fff" opacity={0.55} /><text x={(px as number) + 110} y={660} textAnchor="middle" fontFamily={BANG} fontSize={30} fill={INK}>{txt}</text></g>)}
        {/* tunnel mouth (left) */}
        <path d="M-400 760 V 330 Q -110 200 180 330 V 760 Z" fill="#6c6a66" {...OL} />
        <path d="M-360 760 V 360 Q -110 250 140 360 V 760 Z" fill="url(#tun)" {...OL} />
        {tunnelGlow > 0 && <path d="M-360 760 V 360 Q -110 250 140 360 V 760 Z" fill="url(#tunW)" opacity={tunnelGlow} />}
        {tunnelGlow > 0 && <ellipse cx={-110} cy={560} rx={520 * (0.6 + tunnelGlow)} ry={420 * (0.6 + tunnelGlow)} fill="#fff8de" opacity={0.7 * tunnelGlow} filter="url(#glowf)" />}
        {/* lamps */}
        {[300, 900, 1500, 2100, 2700, 3300].map((lx, k) => { const on = lampOn * (dark > 0 && dark < 1 ? (Math.sin(t * 40 + k) > 0 ? 1 : 0.2) : 1);
          return <g key={lx}><rect x={lx - 120} y={110} width={240} height={30} rx={8} fill={on > 0.5 ? "#fffbe8" : "#6c6a60"} {...OL} strokeWidth={5} /><ellipse cx={lx} cy={260} rx={360} ry={220} fill="#fff4cc" opacity={0.3 * on} filter="url(#glowf)" /></g>; })}
        {/* cracks */}
        {cracks > 0 && crackPaths.map((d, k) => <path key={k} d={d} fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${clamp(cracks * 1.4 - k * 0.15)} 1`} />)}
        {/* track pit and platform */}
        <rect x={-400} y={760} width={4200} height={110} fill="url(#pit)" />
        <rect x={-400} y={800} width={4200} height={12} fill="#7d7a76" /><rect x={-400} y={840} width={4200} height={12} fill="#7d7a76" />
        <rect x={-400} y={870} width={4200} height={210} fill="url(#plat)" />
        <rect x={-400} y={870} width={4200} height={22} fill="#f2c230" {...OL} strokeWidth={5} />
        {Array.from({ length: 100 }, (_, k) => <circle key={k} cx={-380 + k * 42} cy={910} r={6} fill="#c8a42a" />)}
      </g>
      {/* global light states */}
      {flash > 0 && <rect width={1920} height={1080} fill="#fffaf0" opacity={flash} />}
      {red > 0 && <rect width={1920} height={1080} fill="#b0160e" opacity={0.55 * red} style={{ mixBlendMode: "multiply" }} />}
      {dark > 0 && <rect width={1920} height={1080} fill="#05070c" opacity={0.86 * dark} />}
      {red > 0 && <rect width={1920} height={1080} fill="#ff3a22" opacity={0.10 * red * (0.8 + 0.2 * Math.sin(t * 6))} />}
    </g>
  );
};

/** a foreground tiled pillar (in front of the actors) */
export const Pillar: React.FC<{ x: number; w?: number }> = ({ x, w = 150 }) => (
  <g>
    <rect x={x} y={-10} width={w} height={1100} fill="url(#tiles)" {...OL} />
    <rect x={x} y={-10} width={w * 0.32} height={1100} fill="#2a2f3a" opacity={0.22} />
    <rect x={x + w * 0.78} y={-10} width={w * 0.22} height={1100} fill="#fff" opacity={0.25} />
    <rect x={x - 10} y={250} width={w + 20} height={86} fill="#1f4e8c" {...OL} />
  </g>
);

// ------------------------------------------------------------------ ground cross-section with the station inside
export const Section: React.FC<{ t: number; label: number; rule: number }> = ({ t, label, rule }) => {
  const r = rnd(3);
  return (
    <g>
      <defs><linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b2340" /><stop offset="1" stopColor="#4a4a6a" /></linearGradient></defs>
      <rect width={1920} height={300} fill="url(#dusk)" />
      {Array.from({ length: 14 }, (_, k) => { const h = 70 + r() * 150; return <g key={k}><rect x={k * 140 - 10} y={300 - h} width={120} height={h} fill="#151a2a" {...OL} strokeWidth={4} />{Array.from({ length: 4 }, (_, q) => <rect key={q} x={k * 140 + 10 + (q % 2) * 50} y={300 - h + 16 + Math.floor(q / 2) * 34} width={20} height={14} fill="#ffd27a" opacity={0.7} />)}</g>; })}
      <rect y={300} width={1920} height={200} fill="#7a5537" {...OL} />
      {Array.from({ length: 60 }, (_, k) => <ellipse key={k} cx={r() * 1920} cy={320 + r() * 170} rx={6 + r() * 12} ry={4 + r() * 6} fill="#5e3f27" />)}
      <rect y={500} width={1920} height={180} fill="#6b6660" {...OL} />
      {Array.from({ length: 30 }, (_, k) => <path key={k} d={`M${r() * 1920} ${520 + r() * 140} l ${20 + r() * 40} ${-10 + r() * 20}`} stroke="#4f4b46" strokeWidth={4} />)}
      <rect x={260} y={680} width={1400} height={50} fill="#a9a59d" {...OL} />
      <rect x={260} y={730} width={1400} height={250} fill="url(#tiles)" {...OL} />
      <rect x={260} y={930} width={1400} height={50} fill="#8d8a84" {...OL} />
      <rect y={980} width={1920} height={100} fill="#6b6660" {...OL} />
      {/* stair shaft from the street to the platform */}
      <path d="M180 300 L 320 300 L 520 930 L 380 930 Z" fill="#c9c4b8" {...OL} />
      {Array.from({ length: 14 }, (_, k) => <path key={k} d={`M${200 + k * 22} ${330 + k * 45} h 120`} stroke={INK} strokeWidth={3.5} />)}
      <rect x={170} y={260} width={160} height={42} rx={6} fill="#1f4e8c" {...OL} strokeWidth={4} /><text x={250} y={290} textAnchor="middle" fontFamily={BANG} fontSize={26} fill="#fff">METRO</text>
      {/* labels */}
      {[[1500, 400, "EARTH", 0], [1500, 590, "ROCK", 0.15], [1180, 705, "CONCRETE", 0.3]].map(([lx, ly, txt, d]) => { const k = ramp(label, d as number, 0.25); return k > 0 &&
        <g key={txt as string} opacity={k} transform={`translate(${lx} ${ly}) scale(${0.8 + 0.2 * k})`}><rect x={-120} y={-34} width={240} height={60} rx={8} fill="#fff" {...OL} strokeWidth={4} /><text x={0} y={10} textAnchor="middle" fontFamily={BANG} fontSize={38} fill={INK} letterSpacing={2}>{txt}</text></g>; })}
      {rule > 0 && <g opacity={rule}>
        <path d={`M1760 ${lerp(300, 700, 0)} L 1760 ${lerp(300, 720, ease(rule))}`} stroke="#ffd84a" strokeWidth={22} strokeLinecap="round" />
        <path d={`M1720 ${lerp(300, 720, ease(rule)) - 30} l 40 50 l 40 -50`} fill="none" stroke="#ffd84a" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
        <path d={`M1760 300 L 1760 ${lerp(300, 720, ease(rule))}`} stroke={INK} strokeWidth={4} fill="none" opacity={0.6} />
      </g>}
    </g>
  );
};

// ------------------------------------------------------------------ the alert on the phone, close up
export const PhoneClose: React.FC<{ t: number; t0: number; words: number[]; f: number }> = ({ t, t0, words, f }) => {
  const shake = t - t0 < 3.6 ? Math.sin(f * 2.3) * 5 * (Math.floor(f / 6) % 3 ? 1 : 0) : 0, k = ramp(t, t0, 0.35);
  const lines: [string, number, number][] = [["EMERGENCY ALERT", words[0], 52], ["TAKE SHELTER NOW", words[2], 58], ["THIS IS NOT A DRILL", words[5], 44]];
  const pulse = 0.6 + 0.4 * Math.sin(t * 9);
  return (
    <g transform={`translate(${shake} ${lerp(140, 0, ease(k))})`}>
      <ellipse cx={1010} cy={540} rx={620} ry={560} fill="#ff2a1a" opacity={0.35 * pulse} filter="url(#glowf)" />
      {/* sleeve + mitten hand */}
      <path d="M1530 1240 L 1290 930 L 1450 860 L 1710 1180 Z" fill={C.jacket} {...OL} />
      <path d="M1320 960 L 1450 890" stroke={C.jacketShade} strokeWidth={30} strokeLinecap="round" />
      <g transform="rotate(-6 1000 560)">
        <rect x={720} y={120} width={560} height={960} rx={70} fill="#16161a" {...OL} strokeWidth={9} />
        <rect x={752} y={170} width={496} height={860} rx={40} fill="#c41e14" />
        <rect x={752} y={170} width={496} height={860} rx={40} fill="#ff4a2e" opacity={0.35 * pulse} />
        <rect x={930} y={140} width={140} height={22} rx={11} fill="#000" />
        <g transform="translate(1000 330)"><path d="M0 -80 L 78 60 L -78 60 Z" fill="#ffd84a" {...OL} /><rect x={-8} y={-30} width={16} height={56} rx={7} fill={INK} /><circle cx={0} cy={44} r={9} fill={INK} /></g>
        {lines.map(([txt, at, sz], i) => { const u = ramp(t, at - 0.05, 0.22); return u > 0 && <text key={i} x={1000} y={540 + i * 150} textAnchor="middle" fontFamily={BANG} fontSize={sz * (0.85 + 0.15 * u)} fill={i === 1 ? "#fff" : "#ffe9e0"} opacity={u} letterSpacing={2}>{txt}</text>; })}
      </g>
      <circle cx={1300} cy={930} r={120} fill={C.skin} {...OL} strokeWidth={8} />
      <path d="M1230 870 q 30 -40 70 -10" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
    </g>
  );
};

// ------------------------------------------------------------------ light first, then the wave (diagram panel)
export const WavePanel: React.FC<{ t: number; tLight: number; tWave: number; tRule: number }> = ({ t, tLight, tWave, tRule }) => {
  const lk = ramp(t, tLight, 0.25), wk = clamp((t - tWave) / 5.2), X0 = 240, X1 = 1680, km = (X1 - X0) / 3;
  const front = X0 + (X1 - X0) * wk, secs = Math.min(9, wk * 9);
  return (
    <g>
      <rect width={1920} height={1080} fill={C.paper} />
      <rect x={70} y={70} width={1780} height={940} rx={18} fill="none" {...OL} strokeWidth={8} />
      <path d="M120 760 H1800" {...OL} strokeWidth={7} />
      {/* blast */}
      <g transform={`translate(${X0} 640)`}>
        {Array.from({ length: 14 }, (_, k) => <path key={k} d={`M0 0 L ${Math.cos(k * 0.449) * 150} ${Math.sin(k * 0.449) * 150}`} stroke="#ffcf3a" strokeWidth={14} strokeLinecap="round" opacity={0.9} />)}
        <circle r={86} fill="#fff6c8" {...OL} /><circle r={52} fill="#fffef6" />
      </g>
      {/* the light: arrives at once */}
      {lk > 0 && <g opacity={lk}><path d={`M${X0 + 110} 600 L ${lerp(X0 + 110, X1 - 70, ease(lk))} 600`} stroke="#ffcf3a" strokeWidth={16} strokeLinecap="round" /><text x={(X0 + X1) / 2} y={570} textAnchor="middle" fontFamily={BANG} fontSize={52} fill={INK}>LIGHT: INSTANT</text></g>}
      {/* the wave: travels */}
      {wk > 0 && [0, 1, 2].map((k) => <path key={k} d={`M${front - k * 34} 470 Q ${front + 60 - k * 34} 615 ${front - k * 34} 760`} fill="none" stroke="#d6362b" strokeWidth={14 - k * 4} strokeLinecap="round" opacity={1 - k * 0.3} />)}
      {/* km ticks with seconds */}
      {[1, 2, 3].map((n) => { const x = X0 + km * n, on = front >= x - 2; return <g key={n}><path d={`M${x} 745 v 32`} {...OL} strokeWidth={6} /><text x={x} y={830} textAnchor="middle" fontFamily={BANG} fontSize={44} fill={INK}>{n} KM</text>{on && <text x={x} y={890} textAnchor="middle" fontFamily={BANG} fontSize={50} fill="#d6362b">{n * 3} S</text>}</g>; })}
      {/* stopwatch */}
      <g transform="translate(1640 220)"><circle r={92} fill="#fff" {...OL} strokeWidth={8} /><rect x={-16} y={-122} width={32} height={30} rx={6} fill={INK} /><path d={`M0 0 L ${Math.sin(secs / 9 * 2 * Math.PI) * 70} ${-Math.cos(secs / 9 * 2 * Math.PI) * 70}`} stroke="#d6362b" strokeWidth={8} strokeLinecap="round" /><text y={40} textAnchor="middle" fontFamily={BANG} fontSize={44} fill={INK}>{secs.toFixed(1)}s</text></g>
      {tRule > 0 && ramp(t, tRule, 0.3) > 0 && <g transform={`translate(960 230) rotate(-3) scale(${0.6 + 0.4 * Math.min(1, ramp(t, tRule, 0.3) * 1.3)})`}><rect x={-400} y={-70} width={800} height={130} rx={14} fill="#ffd84a" {...OL} strokeWidth={8} /><text y={30} textAnchor="middle" fontFamily={BANG} fontSize={84} fill={INK} letterSpacing={3}>≈ 1 KM EVERY 3 S</text></g>}
      <text x={X1 - 20} y={720} textAnchor="middle" fontFamily={HAND} fontSize={40} fill={INK}>you</text>
    </g>
  );
};

/** falling dust: deterministic particles from the ceiling */
export const Dust: React.FC<{ t: number; t0: number; n?: number }> = ({ t, t0, n = 90 }) => {
  const r = rnd(11);
  return <g>{Array.from({ length: n }, (_, k) => { const x = r() * 1920, d = r() * 2.2, sp = 260 + r() * 420, sz = 2 + r() * 5, tt = t - t0 - d; if (tt < 0) return null; const y = 110 + tt * sp; if (y > 1100) return null;
    return <circle key={k} cx={x + Math.sin(tt * 3 + k) * 14} cy={y} r={sz} fill="#cbbfa8" opacity={0.85} />; })}
    {[600, 1150, 1500].map((x, k) => { const u = ramp(t, t0 + k * 0.3, 1.4); return u > 0 && u < 1 && <path key={k} d={`M${x} 110 Q ${x + 30} ${110 + u * 500} ${x - 20} ${110 + u * 900}`} stroke="#d9cfba" strokeWidth={22 * (1 - u) + 4} fill="none" opacity={0.6 * (1 - u)} />; })}</g>;
};
