// The serial's rigged character, drawn in the comic-ink style: round head, mustard beanie (his symbol), olive jacket,
// stick limbs with mitten hands and shoes. Pose angles come from the engine's FK rig (engine/Figure: degrees from
// straight down, positive toward +x, absolute per segment). The face is fully animatable: eyes, brows, mouth, look,
// blink, sweat. Extras (`passenger`) reuse the rig with other colours and no beanie.
import React from "react";
import { joints, type Pose } from "../../engine/Figure";
import { C, INK } from "./ink";

export type Face = { eyes?: "dot" | "wide" | "closed" | "squint" | "shut"; brow?: number; mouth?: "flat" | "smile" | "o" | "grit" | "frown" | "open" | "wobble"; look?: [number, number]; sweat?: number; blink?: boolean };
type P = { x: number; y: number };

export const Hero: React.FC<{
  x: number; y: number; s?: number; pose: Pose; face?: Face; f: number; facing?: 1 | -1; head?: number; hold?: "phone" | null; glow?: number; armsOver?: boolean;
  look?: { hair?: string; beanie?: string | null; jacket?: string; jacketShade?: string; pants?: string; skin?: string };
}> = ({ x, y, s = 1, pose, face = {}, f, facing = 1, head = 0, hold = null, glow = 0, look = {}, armsOver = false }) => {
  const j = joints(pose), drop = pose.drop ?? 0;
  const O: P = { x: 0, y: drop };
  const at = (p: P) => ({ x: O.x + p.x, y: O.y + p.y });
  const line = (...pts: P[]) => "M" + pts.map((p) => { const q = at(p); return `${q.x.toFixed(1)} ${q.y.toFixed(1)}`; }).join(" L");
  const skin = look.skin ?? C.skin, jacket = look.jacket ?? C.jacket, jShade = look.jacketShade ?? C.jacketShade, pants = look.pants ?? C.pants;
  const R = 62, sh = at(j.sh), hip = at(j.hip);
  const hc = at({ x: j.sh.x + Math.sin((pose.torso * Math.PI) / 180) * (R + 10), y: j.sh.y - Math.cos((pose.torso * Math.PI) / 180) * (R + 10) });
  const shoe = (k: P, ft: P, back: boolean) => { const a = at(ft), b = at(k), ang = Math.atan2(a.y - b.y, a.x - b.x) * 180 / Math.PI - 90;
    return <g transform={`translate(${a.x} ${a.y}) rotate(${ang})`}><path d="M-10 -6 Q -12 10 4 10 L 26 10 Q 32 2 22 -4 Z" fill={back ? "#2a201c" : C.shoe} stroke={INK} strokeWidth={4} strokeLinejoin="round" /></g>; };
  const hand = (p: P, back: boolean) => { const a = at(p); return <circle cx={a.x} cy={a.y} r={10} fill={back ? C.skinShade : skin} stroke={INK} strokeWidth={4.5} />; };
  const limb = (pts: P[], back: boolean, w = 13, colr?: string) => (<>
    <path d={line(...pts)} stroke={INK} strokeWidth={w + 6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d={line(...pts)} stroke={colr ?? (back ? "#3d342f" : INK)} strokeWidth={w - 2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={colr ? 1 : 0} />
  </>);
  // face
  const blinkNow = face.blink !== false && (f % 104 > 99);
  const eyes = blinkNow && face.eyes !== "wide" ? "closed" : face.eyes ?? "dot";
  const [lx, ly] = face.look ?? [0, 0], brow = face.brow ?? 0;
  const ex = [-15, 15], ey = -4;
  const eye = (cx: number, i: number) => {
    if (eyes === "closed") return <path key={i} d={`M${cx - 9} ${ey + 2} q 9 7 18 0`} stroke={INK} strokeWidth={4.5} fill="none" strokeLinecap="round" />;
    if (eyes === "shut") return <path key={i} d={`M${cx - 10} ${ey - 3} l 10 5 l 10 -5`} stroke={INK} strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" transform={i ? `scale(-1 1) translate(${-2 * cx} 0)` : undefined} />;
    if (eyes === "squint") return <path key={i} d={`M${cx - 9} ${ey} l 18 0`} stroke={INK} strokeWidth={5} strokeLinecap="round" />;
    if (eyes === "wide") return <g key={i}><ellipse cx={cx} cy={ey} rx={11} ry={13} fill="#fff" stroke={INK} strokeWidth={4} /><circle cx={cx + lx * 4} cy={ey + ly * 4} r={4.2} fill={INK} /></g>;
    return <ellipse key={i} cx={cx + lx * 3} cy={ey + ly * 3} rx={4.6} ry={6} fill={INK} />;
  };
  const mouths: Record<string, string> = {
    flat: "M-10 22 L 10 22", smile: "M-12 18 Q 0 30 12 18", frown: "M-11 27 Q 0 17 11 27", o: "M0 16 a 6 8 0 1 0 0.1 0 z",
    grit: "M-14 18 L 14 18 L 14 28 L -14 28 Z", open: "M-12 17 Q 0 40 12 17 Z", wobble: `M-13 24 q 4.5 -${4 + (f % 4)} 9 0 q 4.5 ${4 + (f % 4)} 9 0 q 4 -4 8 0`,
  };
  const m = face.mouth ?? "flat";
  const beanie = look.beanie === undefined ? C.beanie : look.beanie;
  return (
    <g transform={`translate(${x} ${y}) scale(${facing * s} ${s})`}>
      <ellipse cx={0} cy={O.y + 160 - drop} rx={70} ry={13} fill="#000" opacity={0.22} filter="url(#softS)" />
      {/* back limbs */}
      {limb([j.hip, j.lKnee, j.lFoot], true, 15)}{shoe(j.lKnee, j.lFoot, true)}
      {limb([j.sh, j.lElbow, j.lHand], true, 13)}{hand(j.lHand, true)}
      {/* torso: jacket with a zip line and a shaded side */}
      <path d={`M${hip.x} ${hip.y} L${sh.x} ${sh.y}`} stroke={INK} strokeWidth={50} strokeLinecap="round" />
      <path d={`M${hip.x} ${hip.y} L${sh.x} ${sh.y}`} stroke={jacket} strokeWidth={39} strokeLinecap="round" />
      <path d={`M${hip.x + 8} ${hip.y} L${sh.x + 8} ${sh.y + 4}`} stroke={jShade} strokeWidth={14} strokeLinecap="round" opacity={0.9} />
      <path d={`M${(hip.x + sh.x) / 2 - 2} ${hip.y - 4} L${sh.x - 2} ${sh.y + 14}`} stroke={INK} strokeWidth={2.5} opacity={0.55} />
      <path d={`M${hip.x - 22} ${hip.y + 6} L${hip.x + 22} ${hip.y + 6}`} stroke={pants} strokeWidth={14} strokeLinecap="round" />
      {/* front limbs */}
      {limb([j.hip, j.rKnee, j.rFoot], false, 15)}{shoe(j.rKnee, j.rFoot, false)}
      {hold === "phone" && (() => { const a = at(j.rHand); return (
        <g transform={`translate(${a.x} ${a.y}) rotate(-12)`}>
          {glow > 0 && <ellipse cx={0} cy={-30} rx={90} ry={110} fill={C.glow} opacity={0.35 * glow} filter="url(#glowf)" />}
          <rect x={-17} y={-62} width={34} height={60} rx={6} fill="#1a1a1e" stroke={INK} strokeWidth={4} />
          <rect x={-13} y={-57} width={26} height={48} rx={3} fill={glow > 0 ? (glow > 1 ? C.alert : C.glow) : "#2c3440"} />
        </g>); })()}
      {!armsOver && <>{limb([j.sh, j.rElbow, j.rHand], false, 13)}{hand(j.rHand, false)}</>}
      {/* head */}
      <g transform={`rotate(${head} ${hc.x} ${hc.y + R})`}>
        <circle cx={hc.x} cy={hc.y} r={R} fill={skin} stroke={INK} strokeWidth={6} />
        <path d={`M${hc.x + R * 0.2} ${hc.y + R * 0.95} A ${R} ${R} 0 0 0 ${hc.x + R * 0.95} ${hc.y + R * 0.25} Q ${hc.x + R * 0.55} ${hc.y + R * 0.75} ${hc.x + R * 0.2} ${hc.y + R * 0.95} Z`} fill={C.skinShade} />
        {glow > 0 && <circle cx={hc.x} cy={hc.y} r={R - 3} fill={glow > 1 ? C.alert : C.glow} opacity={0.22 * Math.min(1, glow)} />}
        {/* hair tufts under the beanie (or a full mop for passengers) */}
        {beanie ? <path d={`M${hc.x - R * 0.98} ${hc.y - R * 0.3} q 6 -16 18 -14 q -2 12 8 14 q 4 -14 16 -16 q -2 12 10 12`} fill={look.hair ?? C.hair} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          : <path d={`M${hc.x - R * 0.98} ${hc.y - R * 0.05} Q ${hc.x - R} ${hc.y - R * 1.15} ${hc.x + R * 0.1} ${hc.y - R * 1.06} Q ${hc.x + R * 1.05} ${hc.y - R * 1.0} ${hc.x + R * 0.98} ${hc.y - R * 0.2} Q ${hc.x + R * 0.4} ${hc.y - R * 0.62} ${hc.x - R * 0.98} ${hc.y - R * 0.05} Z`} fill={look.hair ?? C.hair} stroke={INK} strokeWidth={5} strokeLinejoin="round" />}
        {beanie && <g>
          <path d={`M${hc.x - R * 1.02} ${hc.y - R * 0.5} Q ${hc.x - R * 0.98} ${hc.y - R * 1.5} ${hc.x + R * 0.05} ${hc.y - R * 1.44} Q ${hc.x + R * 1.04} ${hc.y - R * 1.38} ${hc.x + R * 1.02} ${hc.y - R * 0.5} Z`} fill={beanie} stroke={INK} strokeWidth={5.5} strokeLinejoin="round" />
          <path d={`M${hc.x + R * 0.3} ${hc.y - R * 1.28} Q ${hc.x + R * 0.95} ${hc.y - R * 1.1} ${hc.x + R * 0.96} ${hc.y - R * 0.62}`} stroke={C.beanieShade} strokeWidth={12} fill="none" strokeLinecap="round" opacity={0.8} />
          <rect x={hc.x - R * 1.12} y={hc.y - R * 0.8} width={R * 2.24} height={R * 0.38} rx={R * 0.18} fill={beanie} stroke={INK} strokeWidth={5.5} />
          {[-0.7, -0.35, 0, 0.35, 0.7].map((u) => <path key={u} d={`M${hc.x + u * R} ${hc.y - R * 0.76} l 0 ${R * 0.3}`} stroke={C.beanieShade} strokeWidth={3.5} />)}
          <circle cx={hc.x - R * 0.05} cy={hc.y - R * 1.5} r={R * 0.18} fill={beanie} stroke={INK} strokeWidth={5} />
        </g>}
        <g transform={`translate(${hc.x + 4} ${hc.y + 12}) scale(1.25)`}>
          {ex.map((cx, i) => eye(cx, i))}
          {(eyes !== "closed" || brow !== 0) && <path d={`M-26 ${-24 - brow * 2} L -6 ${-20 + brow * 5} M 26 ${-24 - brow * 2} L 6 ${-20 + brow * 5}`} stroke={INK} strokeWidth={5} strokeLinecap="round" />}
          <path d={mouths[m]} stroke={INK} strokeWidth={4.5} fill={m === "o" || m === "open" || m === "grit" ? "#4a2420" : "none"} strokeLinecap="round" strokeLinejoin="round" />
          {m === "grit" && <path d="M-14 23 L 14 23 M -5 18 L -5 28 M 5 18 L 5 28" stroke="#f4efe6" strokeWidth={2.5} />}
        </g>
        {(face.sweat ?? 0) > 0 && <path d={`M${hc.x + R * 0.95} ${hc.y - R * 0.55 + (face.sweat ?? 0) * 18} q 9 16 0 22 q -9 -6 0 -22 z`} fill={C.sweat} stroke={INK} strokeWidth={3.5} />}
      </g>
      {armsOver && <>{limb([j.sh, j.lElbow, j.lHand], false, 13)}{hand(j.lHand, false)}{limb([j.sh, j.rElbow, j.rHand], false, 13)}{hand(j.rHand, false)}</>}
    </g>
  );
};

/** extra poses this serial needs on top of the engine's set */
export const MORE: Record<string, Pose> = {
  seatDoze: { torso: -6, lArm: [30, 92], rArm: [36, 96], lLeg: [84, 6], rLeg: [88, 8] },
  seatUp: { torso: 4, lArm: [20, 60], rArm: [42, 130], lLeg: [84, 4], rLeg: [88, 6] },
  seatPhone: { torso: 10, lArm: [24, 100], rArm: [34, 150], lLeg: [84, 4], rLeg: [88, 6] },
  standPhone: { torso: 4, lArm: [-12, -6], rArm: [30, 150], lLeg: [-7, -3], rLeg: [7, 3] },
  brace: { torso: 26, lArm: [-30, 40], rArm: [40, 110], lLeg: [-20, -10], rLeg: [30, 14] },
  cover: { torso: 50, lArm: [118, 178], rArm: [130, 194], lLeg: [82, 2], rLeg: [4, -88], drop: 76 },
  rise: { torso: 14, lArm: [-6, 10], rArm: [10, 26], lLeg: [-8, -4], rLeg: [8, 4] },
};
