// ChatStory: a text-message thread that plays as a drip (tools/chat_story.py makes the timed file; this only draws it).
// A generic messenger look of our own (no app's logo, name or exact chrome): header with an initial avatar and a live
// status ("typing…"), bubbles that rise from their own corner, a typing indicator before each received message, a
// composer that types each sent message before it goes, tapback reactions, a read receipt, and an auto-scroll that keeps
// the newest bubble in view. 9:16 keeps the whole screen inside the platform-safe area; 16:9 shows it as a phone panel.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as fInter } from "@remotion/google-fonts/Inter";
import { persona, PersonaName, enterK, EASE, clamp } from "../motion";

const INTER = fInter("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin", "latin-ext"] }).fontFamily;
export type ChatMsg = { from: "me" | "them" | "system"; text: string; at: number; typingAt?: number; typeFrom?: number; reaction?: string; reactAt?: number };
export type ChatCfg = { title?: string; contact: { name: string; color?: string }; theme?: "night" | "day"; accent?: "blue" | "green" | "violet"; motion?: PersonaName; messages: ChatMsg[]; duration: number };

const THEMES = {
  night: { bg1: "#0b0d12", bg2: "#1a1f2b", panel: "#14161b", head: "#1b1e25", them: "#2a2d35", themInk: "#f1f2f4", ink: "#f1f2f4", dim: "#8b909b", field: "#22252d", line: "#262a32" },
  day: { bg1: "#dfe5ee", bg2: "#f6f1ea", panel: "#f7f8fa", head: "#ffffff", them: "#e5e7eb", themInk: "#121417", ink: "#121417", dim: "#6b7280", field: "#eceef1", line: "#e3e5e8" },
};
const ACCENT = { blue: "#2f7cf6", green: "#1fa463", violet: "#7b5cff" };

/** greedy word wrap with the real font metrics (canvas measureText), so heights and auto-scroll are exact */
let ctx: CanvasRenderingContext2D | null = null;
function wrap(text: string, font: string, maxW: number): string[] {
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  ctx!.font = font; const out: string[] = []; let line = "";
  for (const w of text.split(/\s+/)) {
    const tryL = line ? `${line} ${w}` : w;
    if (ctx!.measureText(tryL).width <= maxW || !line) line = tryL; else { out.push(line); line = w; }
  }
  if (line) out.push(line); return out;
}

export const ChatStory: React.FC<{ cfg: ChatCfg }> = ({ cfg }) => {
  const f = useCurrentFrame(), { fps, width: W, height: H } = useVideoConfig(), t = f / fps, vertical = H > W;
  const T = THEMES[cfg.theme ?? "night"], A = ACCENT[cfg.accent ?? "blue"], P = persona(cfg.motion ?? "snappy");
  // the phone screen: 9:16 stays clear of the platform UI (bottom ~20 %, right rail); 16:9 = a centred phone panel
  const PH = vertical ? H * 0.74 : H * 0.9, PW = vertical ? W * 0.84 : PH * 0.56, PX = vertical ? W * 0.06 : W * 0.1, PY = vertical ? H * 0.055 : H * 0.05;
  const q = PW / 900, fs = 50 * q, lh = fs * 1.25, padX = 26 * q, padY = 16 * q, maxW = PW * 0.78 - 2 * padX, font = `500 ${fs}px ${INTER}`;
  const headH = 120 * q, compH = 110 * q, viewH = PH - headH - compH;

  // layout of everything visible now (bubbles + a typing indicator), top to bottom
  const msgs = cfg.messages;
  const blocks = React.useMemo(() => msgs.map((m, i) => {
    const lines = m.from === "system" ? [m.text] : wrap(m.text, font, maxW);
    const h = m.from === "system" ? fs * 1.6 : lines.length * lh + 2 * padY;
    const gap = i === 0 ? 0 : msgs[i - 1].from === m.from ? 8 * q : 24 * q;
    return { m, lines, h, gap, last: msgs[i + 1]?.from !== m.from };
  }), [msgs, font, maxW, fs, lh, padY, q]);
  const typingH = lh + 2 * padY;
  const heightAt = (time: number) => {   // content height once everything up to `time` is on screen
    let y = 0;
    blocks.forEach((b) => { if (time >= b.m.at) y += b.gap + b.h; else if (b.m.from === "them" && b.m.typingAt != null && time >= b.m.typingAt) y += 24 * q + typingH; });
    return y + 30 * q;
  };
  // auto-scroll: each event eases the view to its new bottom in 0.35 s
  const events = msgs.flatMap((m) => [m.at, ...(m.typingAt != null ? [m.typingAt] : [])]).sort((x, y) => x - y);
  const target = (time: number) => Math.max(0, heightAt(time) - viewH);
  const lastE = [...events].reverse().find((e) => e <= t) ?? 0;
  const scroll = target(lastE - 0.001) + (target(lastE) - target(lastE - 0.001)) * EASE.out(clamp((t - lastE) / 0.35));

  const typingNow = msgs.find((m) => m.from === "them" && m.typingAt != null && t >= m.typingAt && t < m.at);
  const composing = msgs.find((m) => m.from === "me" && m.typeFrom != null && t >= m.typeFrom && t < m.at + 0.05);
  const lastMe = [...msgs].reverse().find((m) => m.from === "me" && t >= m.at);
  const readShown = lastMe && msgs.some((m) => m.from === "them" && (m.typingAt ?? m.at) > lastMe.at && t >= (m.typingAt ?? m.at));

  let y = 0;
  const rows: React.ReactNode[] = [];
  blocks.forEach((b, i) => {
    const m = b.m;
    if (t < m.at) {
      if (m === typingNow) {   // the three-dot indicator, where the bubble will be
        y += 24 * q; const k = enterK(t, m.typingAt!, P);
        rows.push(<div key={`t${i}`} style={{ position: "absolute", top: y, left: 18 * q, height: typingH, width: 120 * q, borderRadius: 26 * q, background: T.them, opacity: clamp(k * 2), transform: `scale(${0.8 + 0.2 * clamp(k)})`, transformOrigin: "bottom left", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 * q }}>
          {[0, 1, 2].map((d) => <div key={d} style={{ width: 13 * q, height: 13 * q, borderRadius: 99, background: T.dim, transform: `translateY(${-6 * q * Math.max(0, Math.sin((t - m.typingAt!) * 9 - d * 0.9))}px)` }} />)}
        </div>);
        y += typingH;
      }
      return;
    }
    y += b.gap;
    const k = enterK(t, m.at, P), o = clamp((t - m.at) / (P.enter * 0.5)), me = m.from === "me";
    if (m.from === "system") {
      rows.push(<div key={i} style={{ position: "absolute", top: y, left: 0, right: 0, textAlign: "center", fontFamily: INTER, fontWeight: 600, fontSize: fs * 0.7, color: T.dim, opacity: o }}>{m.text}</div>);
    } else {
      const r = 30 * q, tail = b.last ? 6 * q : r;
      rows.push(<div key={i} style={{ position: "absolute", top: y, ...(me ? { right: 18 * q } : { left: 18 * q }), maxWidth: PW * 0.78, padding: `${padY}px ${padX}px`,
        background: me ? A : T.them, color: me ? "#fff" : T.themInk, fontFamily: INTER, fontWeight: 500, fontSize: fs, lineHeight: `${lh}px`,
        borderRadius: me ? `${r}px ${r}px ${tail}px ${r}px` : `${r}px ${r}px ${r}px ${tail}px`, opacity: o,
        transform: `translateY(${(1 - k) * 26 * q}px) scale(${P.scaleFrom + (1 - P.scaleFrom) * k})`, transformOrigin: me ? "bottom right" : "bottom left" }}>
        {b.lines.map((l, j) => <div key={j} style={{ whiteSpace: "nowrap" }}>{l}</div>)}
        {m.reaction && m.reactAt != null && t >= m.reactAt && (() => { const rk = enterK(t, m.reactAt, persona("playful"));
          return <div style={{ position: "absolute", top: -26 * q, ...(me ? { left: -22 * q } : { right: -22 * q }), width: 72 * q, height: 72 * q, borderRadius: 99, background: T.head, border: `${3 * q}px solid ${T.panel}`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 * q, transform: `scale(${clamp(rk, 0, 1.3)})` }}>{m.reaction}</div>; })()}
      </div>);
      if (me && m === lastMe && readShown) rows.push(<div key={`r${i}`} style={{ position: "absolute", top: y + b.h + 4 * q, right: 26 * q, fontFamily: INTER, fontWeight: 600, fontSize: fs * 0.55, color: T.dim }}>Read</div>);
    }
    y += b.h;
  });

  const titleK = cfg.title ? 1 - EASE.in(clamp((t - 1.5) / 0.4)) : 0;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${T.bg1}, ${T.bg2})` }}>
      <div style={{ position: "absolute", left: PX, top: PY, width: PW, height: PH, opacity: 1 - titleK, borderRadius: 48 * q, overflow: "hidden", background: T.panel, boxShadow: `0 ${30 * q}px ${80 * q}px rgba(0,0,0,.35)`, border: `${2 * q}px solid ${T.line}` }}>
        {/* header */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: headH, background: T.head, borderBottom: `${2 * q}px solid ${T.line}`, display: "flex", alignItems: "center", gap: 20 * q, padding: `0 ${28 * q}px` }}>
          <div style={{ width: 72 * q, height: 72 * q, borderRadius: 99, background: cfg.contact.color ?? "#e8875b", color: "#fff", fontFamily: INTER, fontWeight: 800, fontSize: 34 * q, display: "flex", alignItems: "center", justifyContent: "center" }}>{cfg.contact.name.slice(0, 1).toUpperCase()}</div>
          <div style={{ fontFamily: INTER }}>
            <div style={{ fontWeight: 700, fontSize: 36 * q, color: T.ink }}>{cfg.contact.name}</div>
            <div style={{ fontWeight: 600, fontSize: 24 * q, color: typingNow ? A : T.dim }}>{typingNow ? "typing…" : "online"}</div>
          </div>
        </div>
        {/* thread */}
        <div style={{ position: "absolute", left: 0, right: 0, top: headH, height: viewH, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 26 * q - scroll }}>{rows}</div>
        </div>
        {/* composer */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: compH, background: T.head, borderTop: `${2 * q}px solid ${T.line}`, display: "flex", alignItems: "center", gap: 16 * q, padding: `0 ${22 * q}px` }}>
          <div style={{ flex: 1, height: 70 * q, borderRadius: 40 * q, background: T.field, display: "flex", alignItems: "center", padding: `0 ${26 * q}px`, fontFamily: INTER, fontWeight: 500, fontSize: fs * 0.8, color: composing ? T.ink : T.dim, overflow: "hidden", whiteSpace: "nowrap" }}>
            {composing ? (() => { const n = Math.round(composing.text.length * clamp((t - composing.typeFrom!) / Math.max(0.01, composing.at - composing.typeFrom!))); const s = composing.text.slice(0, n); return <span>{s.length > 30 ? "…" + s.slice(-30) : s}<span style={{ opacity: Math.floor(t * 3) % 2 ? 0 : 1, color: A }}>|</span></span>; })() : "Message"}
          </div>
          <div style={{ width: 70 * q, height: 70 * q, borderRadius: 99, background: composing ? A : T.field, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${composing && t > composing.at - 0.12 ? 0.88 : 1})` }}>
            <div style={{ width: 0, height: 0, borderTop: `${13 * q}px solid transparent`, borderBottom: `${13 * q}px solid transparent`, borderLeft: `${22 * q}px solid ${composing ? "#fff" : T.dim}`, marginLeft: 6 * q }} />
          </div>
        </div>
      </div>
      {!vertical && (() => { const cur = [...msgs].reverse().find((m) => m.from !== "system" && t >= m.at); if (!cur) return null;
        const k = enterK(t, cur.at, P), me = cur.from === "me", u = W / 1920;
        return <div style={{ position: "absolute", left: PX + PW + 110 * u, right: 100 * u, top: H * 0.4, fontFamily: INTER, opacity: clamp((t - cur.at) / 0.2), transform: `translateY(${(1 - clamp(k)) * 30 * u}px)` }}>
          <div style={{ fontWeight: 700, fontSize: 30 * u, letterSpacing: 2 * u, color: me ? A : cfg.contact.color ?? "#e8875b", textTransform: "uppercase" }}>{me ? "You" : cfg.contact.name}</div>
          <div style={{ fontWeight: 800, fontSize: (cur.text.length > 40 ? 64 : 84) * u, lineHeight: 1.12, color: "#fff", marginTop: 18 * u }}>{cur.text}</div>
        </div>; })()}
      {cfg.title && titleK > 0 && (
        <AbsoluteFill style={{ background: `rgba(8,9,12,${0.97 * titleK})`, alignItems: "center", justifyContent: "center", padding: 80 * q }}>
          <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: (vertical ? 92 : 80) * (W / 1080) * (vertical ? 1 : 0.8), lineHeight: 1.1, color: "#fff", textAlign: "center", opacity: titleK, transform: `scale(${0.96 + 0.04 * EASE.out(clamp(t / 0.5))})`, maxWidth: W * 0.8 }}>{cfg.title}</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/** default props for the studio (a real thread comes from tools/chat_story.py plan ... --out chat.timed.json) */
export const DEMO_CHAT: ChatCfg = { contact: { name: "Alex" }, theme: "night", accent: "blue", duration: 7, messages: [
  { from: "them", text: "You up?", typingAt: 0.4, at: 1.3 }, { from: "me", text: "Barely. What happened?", typeFrom: 2.0, at: 3.4 },
  { from: "them", text: "Look outside. Now.", typingAt: 4.0, at: 5.2, reaction: "‼️", reactAt: 5.8 } ] };
