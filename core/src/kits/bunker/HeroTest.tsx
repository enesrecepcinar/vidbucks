import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { getPose, POSES } from "../../engine/Figure";
import { Hero, MORE } from "./Hero";
import { Defs } from "./ink";
export const HeroTest: React.FC = () => {
  const f = useCurrentFrame();
  const items: [string, any, any][] = [["idle", POSES.idle, { eyes: "dot", mouth: "flat" }], ["run", getPose("run", f), { eyes: "wide", mouth: "grit", brow: -1, sweat: 1 }], ["seatDoze", MORE.seatDoze, { eyes: "closed", mouth: "o" }], ["standPhone", MORE.standPhone, { eyes: "wide", mouth: "o", brow: -1 }], ["cover", MORE.cover, { eyes: "shut", mouth: "grit" }]];
  return <AbsoluteFill style={{ background: "#d9cdb4" }}><svg width={1920} height={1080}><Defs f={f} />
    {items.map(([n, p, fc], i) => <g key={n} filter="url(#boil)"><Hero x={220 + i * 370} y={620} s={1.2} pose={p} face={fc} f={f} hold={n === "standPhone" ? "phone" : null} glow={n === "standPhone" ? 1 : 0} look={i === 3 ? { beanie: null, jacket: "#7a5b8c" } : {}} /></g>)}
  </svg></AbsoluteFill>;
};
