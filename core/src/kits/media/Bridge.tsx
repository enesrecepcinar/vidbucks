// MorphBridge: the shape-morph join between two worlds. The old world closes into a window shaped like one of its objects
// (the mug), that object - alone on blank paper - turns into an object of the next world (the sun), and the new world
// opens out of a window shaped like it. One continuous shape carries the eye across the cut, which is why it reads as
// story, not as an effect. Rules: both bridge objects at least ~200 px at the boundary (pull push-ins back first); morph
// on the style's blank sheet, never on a blend of two walls (mud); colour goes through OKLCH; budget it (0.9-1.4 s, at
// most three in a short piece).
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Pt, SceneC, path, byAngle, ellipse, Ink, SceneHatch, SceneSketch } from "./Media";
import { EASE, clamp, mixOklch } from "../motion";

const centroid = (P: Pt[]): Pt => [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length];
/** how far a window must be scaled about its centre to cover the whole frame */
function coverK(P: Pt[], W: number, H: number) {
  const c = centroid(P), R = byAngle(P, 64).map(([x, y]) => Math.hypot(x - c[0], y - c[1])), rmin = Math.max(4, Math.min(...R));
  const far = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(x - c[0], y - c[1])));
  return (far / rmin) * 1.05;
}
const scaleAbout = (P: Pt[], c: Pt, k: number): Pt[] => P.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k]);

export type BridgeEnd = { P: Pt[]; color: string };
/** k: 0..1 across the bridge. 0-0.38 close on A's object, 0.38-0.62 morph on paper, 0.62-1 open from B's object */
export const MorphBridge: React.FC<{ A: SceneC; Bs: SceneC; tA: number; tB: number; f: number; k: number; from: BridgeEnd; to: BridgeEnd; paper?: string; ink?: string }> =
  ({ A, Bs, tA, tB, f, k, from, to, paper = "#efe5cf", ink = "#2a2420" }) => {
    const { width: W, height: H } = useVideoConfig(), B = Math.floor(f / 2);
    const P0 = byAngle(from.P, 96), P1 = byAngle(to.P, 96), c0 = centroid(P0), c1 = centroid(P1);
    let win: Pt[] | null = null, showB = false, u = 0;
    if (k < 0.38) win = scaleAbout(P0, c0, 1 + (coverK(P0, W, H) - 1) * (1 - EASE.inOut(k / 0.38)));                 // A closes into its object
    else if (k < 0.62) u = EASE.inOut((k - 0.38) / 0.24);                                                                   // the object becomes the other
    else { win = scaleAbout(P1, c1, 1 + (coverK(P1, W, H) - 1) * EASE.inOut((k - 0.62) / 0.38)); showB = true; u = 1; }  // B opens from its object
    const shape: Pt[] = P0.map((p, i) => [p[0] + (P1[i][0] - p[0]) * u, p[1] + (P1[i][1] - p[1]) * u]);
    const id = `mb-${Math.round(k * 1000)}`;
    return (
      <AbsoluteFill style={{ background: paper }}>
        {win && <>
          <svg width="0" height="0" style={{ position: "absolute" }}><defs><clipPath id={id} clipPathUnits="userSpaceOnUse"><path d={path(win, true)} /></clipPath></defs></svg>
          <AbsoluteFill style={{ clipPath: `url(#${id})` }}>{showB ? <Bs t={tB} f={f} /> : <A t={tA} f={f} />}</AbsoluteFill>
        </>}
        <svg viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {!win && <path d={path(shape, true)} fill={mixOklch(from.color, to.color, u)} />}
          <Ink P={win ?? shape} closed B={B} w={win ? 5 : 7} color={ink} amt={2} />
        </svg>
      </AbsoluteFill>
    );
  };

/** demo: the crosshatch desk closes on its red mug, the mug becomes the sketchbook sun, the sketchbook opens from it */
export const MorphDemo: React.FC = () => {
  const A = SceneHatch, Bs = SceneSketch;
  const f = useCurrentFrame(), { fps } = useVideoConfig(), t = f / fps, start = 1.6, len = 1.3, k = clamp((t - start) / len);
  const mug: Pt[] = [[820, 560], [1040, 560], [1022, 820], [838, 820]], sun = ellipse(960, 560, 230, 230, 60);
  if (t < start) return <A t={t + 1.8} f={f} />;
  if (k >= 1) return <Bs t={t - start - len + 2.6} f={f} />;   // B starts where its bridge object (the sun) is finished
  return <MorphBridge A={A} Bs={Bs} tA={start + 1.8} tB={2.6} f={f} k={k} from={{ P: mug, color: "#d4382c" }} to={{ P: sun, color: "#d97757" }} />;
};
