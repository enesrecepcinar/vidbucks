// FootageEdit: the layer that goes over an edited cut (tools/footage.py render -> cut.mp4 + cut.json).
// The picture plays muted (its sound is muxed back by ffmpeg, never re-encoded by the renderer); on top: captions
// chunked from the cut's own word times, and word-pinned overlays (lower-third name card, section title, punch-in).
// Caption rules: one look for the whole video (dark box, thin light edge), >= 0.35 s per chunk (grow the chunk
// instead of flashing), a word lights on its own start, nothing over the lower-third, subtitles always on top.
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fInter } from "@remotion/google-fonts/Inter";
import { Card, type CardId } from "../cards/Cards";

const INTER = fInter("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] }).fontFamily;
type Word = { w: string; s: number; e: number; seg?: number };
type Overlay = { kind: "lower" | "title" | "punch" | "card" | "broll"; src?: string; fit?: "cover" | "contain"; mode?: "full" | "panel" | "split"; aspect?: number; in?: number; at: number; dur: number; text?: string; sub?: string; scale?: number; x?: number; y?: number; card?: CardId; style?: string; data?: Record<string, any>; itemTimes?: number[] };
export type FootageProps = { video: string; words: Word[]; duration: number; fps: number; size: [number, number]; captions: "bold" | "sentence" | "none"; overlays?: Overlay[]; accent?: string };

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const isVid = (s: string) => /\.(mp4|mov|webm|m4v)$/i.test(s);

/** a B-roll picture or clip: cover-fitted with a slow push (stills) or playing muted from its in-point (clips);
    a document or portrait picture is shown whole over a blurred copy of itself instead of being cropped */
const BrollMedia: React.FC<{ o: Overlay; t: number; fps: number; w: number; h: number }> = ({ o, t, fps, w, h }) => {
  const src = o.src!, k = clamp((t - o.at) / o.dur), whole = (o.fit === "contain" || (o.aspect ?? 1.5) < 1.15) && !isVid(src);
  const push = 1.04 + 0.1 * k, style: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: whole ? "contain" : "cover", transform: whole ? `scale(${0.98 + 0.04 * k})` : `scale(${push})` };
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#111" }}>
      {whole && <Img src={staticFile(src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(28px) brightness(.45)", transform: "scale(1.2)" }} />}
      {isVid(src) ? <Sequence from={Math.round(o.at * fps)} layout="none"><OffthreadVideo src={staticFile(src)} muted startFrom={Math.round((o.in ?? 0) * fps)} style={style} /></Sequence>
        : <Img src={staticFile(src)} style={style} />}
    </div>
  );
};
const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);

/** chunk words for captions: bold = 1-3 words, break on punctuation / pauses >= 0.3 s; sentence = 4-7 words */
export function chunk(words: Word[], mode: "bold" | "sentence") {
  const max = mode === "bold" ? 3 : 7, min = mode === "bold" ? 1 : 4, out: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1], gap = next ? next.s - w.e : 9, punct = /[.,!?;:]$/.test(w.w), newSeg = next && next.seg !== w.seg;
    if (cur.length >= max || gap >= 0.3 || newSeg || !next || (punct && cur.length >= min)) { out.push(cur); cur = []; }
  });
  // never flash a cue under 0.35 s: merge it into its neighbour
  for (let i = 0; i < out.length; i++) {
    const c = out[i], d = c[c.length - 1].e - c[0].s;
    if (d < 0.35 && i + 1 < out.length && out[i + 1].length < max + 1 && out[i + 1][0].seg === c[0].seg) { out[i + 1] = [...c, ...out[i + 1]]; out.splice(i, 1); i--; }
  }
  return out;
}

export const FootageEdit: React.FC<FootageProps> = ({ video, words, captions, overlays = [], accent = "#ffd84a" }) => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, u = Math.min(W, H) / 1080;
  const cues = React.useMemo(() => (captions === "none" ? [] : chunk(words, captions)), [words, captions]);
  const cue = cues.find((c, i) => t >= c[0].s - 0.05 && t < (cues[i + 1] ? Math.min(cues[i + 1][0].s - 0.05, c[c.length - 1].e + 0.6) : c[c.length - 1].e + 0.6));
  const punch = overlays.find((o) => o.kind === "punch" && t >= o.at && t < o.at + o.dur);
  const pk = punch ? Math.min(ease((t - punch.at) / 0.18), 1 - ease((t - punch.at - punch.dur + 0.18) / 0.18)) : 0;
  const zoom = 1 + (punch ? ((punch.scale ?? 1.25) - 1) * pk : 0);
  const lower = overlays.find((o) => o.kind === "lower" && t >= o.at && t < o.at + o.dur);
  const title = overlays.find((o) => o.kind === "title" && t >= o.at && t < o.at + o.dur);
  const ar = W / H, vertical = ar < 1.2, capY = H * (ar < 0.7 ? 0.70 : ar < 0.9 ? 0.76 : ar < 1.2 ? 0.80 : 0.84);   // 9:16 clear of the platform UI, 4:5, 1:1, 16:9
  const broll = overlays.find((o) => o.kind === "broll" && t >= o.at && t < o.at + o.dur);
  const bIn = broll ? Math.min(ease((t - broll.at) / 0.2), 1 - ease((t - broll.at - broll.dur + 0.16) / 0.16)) : 0;
  const split = broll?.mode === "split" ? bIn : 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `translateY(${split * H * 0.27}px) scale(${zoom})`, transformOrigin: `${(punch?.x ?? 0.5) * 100}% ${(punch?.y ?? 0.4) * 100}%` }}>
        <OffthreadVideo src={staticFile(video)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      {broll && broll.src && (broll.mode === "panel" ? (() => { const pw = vertical ? W - 120 * u : W * 0.36, ph = pw / Math.max(0.6, Math.min(1.9, broll.aspect ?? 1.5));
          return <div style={{ position: "absolute", width: pw, height: ph, ...(vertical ? { left: 60 * u, top: H * 0.09 } : { right: 70 * u, top: H * 0.14 }), borderRadius: 16 * u, overflow: "hidden", boxShadow: `0 ${18 * u}px ${50 * u}px rgba(0,0,0,.45)`, border: `${3 * u}px solid rgba(255,255,255,.7)`, opacity: bIn, transform: `translateY(${(1 - bIn) * 30 * u}px) scale(${0.96 + 0.04 * bIn})` }}><BrollMedia o={broll} t={t} fps={fps} w={pw} h={ph} /></div>; })()
        : broll.mode === "split" ? <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: H * 0.46, overflow: "hidden", opacity: Math.min(1, bIn * 1.5), borderBottom: `${4 * u}px solid rgba(0,0,0,.6)` }}><BrollMedia o={broll} t={t} fps={fps} w={W} h={H * 0.46} /></div>
        : <AbsoluteFill style={{ opacity: Math.min(1, bIn * 1.6) }}><BrollMedia o={broll} t={t} fps={fps} w={W} h={H} /></AbsoluteFill>)}
      {lower && (() => { const k = ease((t - lower.at) / 0.35), out = ease((t - lower.at - lower.dur + 0.3) / 0.3);
        return <div style={{ position: "absolute", left: 70 * u, bottom: H - capY + 40 * u, transform: `translateX(${(1 - k + out) * -60 * u}px)`, opacity: k * (1 - out), fontFamily: INTER }}>
          <div style={{ background: accent, color: "#111", fontWeight: 800, fontSize: 40 * u, padding: `${8 * u}px ${18 * u}px`, display: "inline-block" }}>{lower.text}</div>
          {lower.sub && <div style={{ background: "rgba(10,10,12,.86)", color: "#fff", fontWeight: 600, fontSize: 28 * u, padding: `${6 * u}px ${18 * u}px`, marginTop: 4 * u, display: "table" }}>{lower.sub}</div>}
        </div>; })()}
      {title && (() => { const k = ease((t - title.at) / 0.3), out = ease((t - title.at - title.dur + 0.25) / 0.25);
        return <AbsoluteFill style={{ background: `rgba(8,8,10,${0.72 * k * (1 - out)})`, alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 96 * u, color: "#fff", letterSpacing: 2 * u, opacity: k * (1 - out), transform: `scale(${0.94 + 0.06 * k})`, textAlign: "center", padding: `0 ${80 * u}px` }}>{title.text}</div>
        </AbsoluteFill>; })()}
      {overlays.filter((o) => o.kind === "card" && t >= o.at && t < o.at + o.dur).map((o, i) => <Card key={i} card={o.card ?? "label"} style={o.style ?? "ink-editorial"} t={t} at={o.at} dur={o.dur} data={o.data ?? {}} W={W} H={H} itemTimes={o.itemTimes} />)}
      {cue && !title && (
        <div style={{ position: "absolute", left: 0, right: 0, top: capY, display: "flex", justifyContent: "center" }}>
          <div style={{ background: "rgba(12,12,14,.82)", border: `${2 * u}px solid rgba(255,255,255,.35)`, borderRadius: 10 * u, padding: `${10 * u}px ${22 * u}px`, maxWidth: W * 0.84, textAlign: "center",
            fontFamily: INTER, fontWeight: 800, fontSize: (captions === "bold" ? (vertical ? 74 : 62) : 46) * u, lineHeight: 1.15, color: "#fff" }}>
            {cue.map((w, i) => { const on = t >= w.s - 0.02; const txt = captions === "bold" ? w.w.toUpperCase().replace(/[.,;:]$/, "") : w.w;
              return <span key={i} style={{ color: on ? (captions === "bold" && t < w.e ? accent : "#fff") : "rgba(255,255,255,.45)" }}>{txt}{i < cue.length - 1 ? " " : ""}</span>; })}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
