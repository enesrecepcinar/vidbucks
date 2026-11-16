// motion.ts - ONE motion language for every kit. Pick one personality per film and every entrance, exit, stagger, label,
// camera push and overshoot follows it (mixing personalities inside one piece is the commonest cause of "inconsistent").
//
// Personalities (two axes: calm <-> kinetic, soft <-> sharp):
//   calm       calm + soft     long sine eases, generous holds          (editorial, wellness, reflective documentary)
//   premium    calm + sharp    decelerating curve, no overshoot          (luxury, fintech, serious or financial content)
//   confident  middle          clean ease-out, a whisper of overshoot    (default for explainers, product, corporate)
//   playful    kinetic + soft  springy back-ease, 10-20 % overshoot      (illustration, kids, lifestyle, humour)
//   snappy     kinetic + sharp short expo-out, hard landings              (hype, sports, games, fast shorts)
// Rules the helpers enforce (docs/motion-rules.md 23-30): enter = ease-out, exit = ease-in at about half the time, move =
// ease-in-out; duration grows with distance; a group's stagger is capped so the whole reveal stays under ~0.8 s; attached
// parts (labels, shadows) settle 40-120 ms after the body (secondary motion); at most a third of a group moves at once;
// colour transitions go through OKLCH, never raw sRGB (blue -> yellow must not pass through grey).

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));

/** a CSS-style cubic-bezier as a function of progress 0..1 (Newton on x, then y) */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (s: number) => ((ax * s + bx) * s + cx) * s, Y = (s: number) => ((ay * s + by) * s + cy) * s, dX = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  return (x: number) => {
    x = clamp(x); if (x === 0 || x === 1) return x;
    let s = x; for (let i = 0; i < 6; i++) { const e = X(s) - x, d = dX(s); if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break; s -= e / d; }
    return Y(clamp(s));
  };
}
export const EASE = {
  out: bezier(0.16, 1, 0.3, 1),        // enter / land: arrives with energy, settles gently
  in: bezier(0.7, 0, 0.84, 0),         // exit: starts gently, leaves fast
  inOut: bezier(0.65, 0, 0.35, 1),     // a move that stays on screen
  premium: bezier(0.4, 0, 0.2, 1),     // decelerate, no overshoot
  sine: (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x)),
  expo: (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(x))),
  back: (s = 1.7) => (x: number) => { x = clamp(x); const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); },
  linear: (x: number) => clamp(x),     // loops only (spinners, marquees, a boiling line): never a discrete event
};

export type PersonaName = "calm" | "premium" | "confident" | "playful" | "snappy";
export type Persona = {
  name: PersonaName;
  enter: number; exit: number; move: number;          // seconds for a hero-sized element (scaled by distance via dur())
  ease: "out" | "back" | "sine" | "premium" | "expo"; overshoot: number;   // overshoot 0 = none; back-ease strength otherwise
  stagger: number;                                    // seconds between siblings (capped by staggerAt)
  lag: number;                                        // secondary motion: attached parts settle this much later
  travel: number; scaleFrom: number;                  // entrance travel as a fraction of min(w, h); starting scale
  push: number; drift: number;                        // camera: push-in per beat (0.07 = 7 %), sideways drift (fraction of width)
  hold: number;                                       // minimum stillness after a beat lands (s)
  anticipation: number;                               // a counter-move before the action (s); 0 = none
};
export const PERSONA: Record<PersonaName, Persona> = {
  calm:      { name: "calm",      enter: 0.6,  exit: 0.3,  move: 1.2, ease: "sine",    overshoot: 0,   stagger: 0.14, lag: 0.12, travel: 0.02,  scaleFrom: 0.98, push: 0.05, drift: 0.010, hold: 0.5,  anticipation: 0 },
  premium:   { name: "premium",   enter: 0.5,  exit: 0.25, move: 1.0, ease: "premium", overshoot: 0,   stagger: 0.08, lag: 0.08, travel: 0.022, scaleFrom: 0.96, push: 0.04, drift: 0.006, hold: 0.4,  anticipation: 0 },
  confident: { name: "confident", enter: 0.35, exit: 0.18, move: 0.8, ease: "out",     overshoot: 0,   stagger: 0.08, lag: 0.08, travel: 0.03,  scaleFrom: 0.94, push: 0.07, drift: 0.012, hold: 0.3,  anticipation: 0 },
  playful:   { name: "playful",   enter: 0.4,  exit: 0.16, move: 0.7, ease: "back",    overshoot: 2.2, stagger: 0.09, lag: 0.1,  travel: 0.05,  scaleFrom: 0.6,  push: 0.07, drift: 0.015, hold: 0.25, anticipation: 0.08 },
  snappy:    { name: "snappy",    enter: 0.22, exit: 0.12, move: 0.45, ease: "expo",   overshoot: 1.2, stagger: 0.06, lag: 0.05, travel: 0.04,  scaleFrom: 0.85, push: 0.09, drift: 0.02,  hold: 0.15, anticipation: 0.06 },
};
export const persona = (p?: PersonaName | Persona): Persona => (typeof p === "object" ? p : PERSONA[p ?? "confident"] ?? PERSONA.confident);

/** the personality's entrance curve (0..1, may overshoot past 1 for back-eases) */
export function easeIn(P: Persona) {
  return P.ease === "back" ? EASE.back(P.overshoot || 1.7) : P.ease === "sine" ? EASE.sine : P.ease === "premium" ? EASE.premium : P.ease === "expo" ? EASE.expo : EASE.out;
}
/** duration scales with travel: a 20 px nudge and an 800 px slide must not share a duration (perceived speed stays even) */
export const dur = (P: Persona, distanceFrac = P.travel) => P.enter * clamp(0.75 + 2.5 * Math.sqrt(distanceFrac), 0.75, 2.2);

/** entrance progress at time t for something that starts at `at` (overshoot allowed); exit progress k>1 not clamped below */
export function enterK(t: number, at: number, P: Persona, d = P.enter) {
  const x = (t - at) / d; if (x <= 0) return 0;
  const k = easeIn(P)(x);
  if (P.anticipation > 0) { const a = (t - at) / P.anticipation; if (a < 1) return -0.04 * Math.sin(Math.PI * a); }   // dip before the pop
  return k;
}
export const exitK = (t: number, end: number, P: Persona) => EASE.in(clamp((t - (end - P.exit)) / P.exit));   // 0 until it leaves, 1 gone

/** a composed entrance: opacity + travel + scale together (a lone fade looks cheap); `from` is the direction it comes from */
export function entrance(t: number, at: number, P: Persona, u: number, from: "below" | "left" | "right" | "above" | "none" = "below") {
  const k = enterK(t, at, P), o = clamp(((t - at) / (P.enter * 0.6)));
  const dist = P.travel * u * 1080 * (1 - k), dx = from === "left" ? -dist : from === "right" ? dist : 0, dy = from === "below" ? dist : from === "above" ? -dist : 0;
  return { opacity: o, dx, dy, scale: P.scaleFrom + (1 - P.scaleFrom) * k, k };
}
/** sibling i of n starts at base + i * stagger, with the whole reveal capped at ~0.8 s (dense groups get tighter offsets) */
export const staggerAt = (base: number, i: number, n: number, P: Persona, cap = 0.8) => base + i * Math.min(P.stagger, cap / Math.max(1, n - 1));
/** secondary motion: the label / shadow / attached part of something that starts at `at` */
export const secondary = (at: number, P: Persona, rank = 1) => at + P.lag * rank;
/** 1/3 rule: with n siblings, how many may be in motion at once */
export const maxMoving = (n: number) => Math.max(1, Math.ceil(n / 3));

/** speed ramp: scene time for real time t, slowing to `slow` x speed around an impact at `hit` (raised-cosine in and out),
    then running slightly fast for the same span to pay the lost time back, so the scene is in sync with the sound again by
    hit + out + (runIn + out). Feed the result to every animation of that scene instead of t. */
export function speedRamp(t: number, hit: number, o: { runIn?: number; out?: number; slow?: number } = {}) {
  const a = o.runIn ?? 0.3, b = o.out ?? 0.4, s = o.slow ?? 0.25, k = 1 - s, c = a + b, lost = k * (a + b) / 2, g = (2 * lost) / c;
  const I = (x: number, len: number) => len * (x / 2 - Math.sin(Math.PI * x) / (2 * Math.PI));       // integral of the rising half-cosine bump
  const t0 = hit - a, t1 = hit + b, t2 = t1 + c;
  if (t <= t0) return t;
  if (t <= hit) return t - k * I((t - t0) / a, a);
  if (t <= t1) { const y = (t - hit) / b; return t - k * (a / 2) - k * (b * y - I(y, b)); }         // falling bump = 1 - rising
  if (t <= t2) { const z = (t - t1) / c, pay = z <= 0.5 ? I(2 * z, c / 2) : c / 4 + (c / 2) * (2 * z - 1) - I(2 * z - 1, c / 2); return t - lost + g * pay; }
  return t;
}

/* ---------------------------------------------------------------- colour in OKLCH ---------------------------------------------------------------- */
const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
function oklab(hex: string) {
  const [r, g, b] = hexRgb(hex).map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromOklab([L, A, B]: number[]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return "#" + rgb.map((c) => Math.round(clamp(toSrgb(c)) * 255).toString(16).padStart(2, "0")).join("");
}
/** colour between a and b at k, interpolated in OKLCH (hue along the short way): vivid midpoints, no grey or mud */
export function mixOklch(a: string, b: string, k: number) {
  const [L1, A1, B1] = oklab(a), [L2, A2, B2] = oklab(b);
  const C1 = Math.hypot(A1, B1), C2 = Math.hypot(A2, B2); let h1 = Math.atan2(B1, A1), h2 = Math.atan2(B2, A2);
  if (C1 < 1e-4) h1 = h2; if (C2 < 1e-4) h2 = h1;                       // a grey end borrows the other hue
  let dh = h2 - h1; if (dh > Math.PI) dh -= 2 * Math.PI; if (dh < -Math.PI) dh += 2 * Math.PI;
  const L = L1 + (L2 - L1) * k, C = C1 + (C2 - C1) * k, h = h1 + dh * k;
  return fromOklab([L, C * Math.cos(h), C * Math.sin(h)]);
}

/** a default personality per drawing medium (a brief's tone overrides it) */
export const MEDIUM_PERSONA: Record<string, PersonaName> = { crosshatch: "calm", sketchbook: "calm", "cut-paper": "playful", riso: "confident", pixel: "snappy", isometric: "premium", math: "premium" };
/** a brief's tone word -> personality */
export function personaForTone(tone?: string): PersonaName | undefined {
  const t = (tone ?? "").toLowerCase();
  if (/serious|finan|luxury|premium|ciddi|lüks|finans/.test(t)) return "premium";
  if (/calm|reflect|wellness|sad|sakin|hüzün|duygu/.test(t)) return "calm";
  if (/fun|kids|play|humou?r|eğlen|çocuk|komik/.test(t)) return "playful";
  if (/hype|sport|game|fast|energy|enerji|hızlı|oyun/.test(t)) return "snappy";
  if (/pro|corporate|explain|product|kurumsal|ürün|anlat/.test(t)) return "confident";
  return undefined;
}
