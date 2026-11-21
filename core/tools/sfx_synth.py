#!/usr/bin/env python
"""sfx_synth.py - every sound effect from a cue list: a real CC0 sample when the packs are installed, else synthesised (noise + partials).

  python tools/sfx_synth.py --cues videos/x/cues.json --duration 63.2 --out videos/x/sfx.wav

Kinds: pop (print/card lands) · slide (paper, string) · whoosh (camera move, route) · marker (highlighter) · pencil ·
tick · ticks (counter rolling) · snip · click · stamp · impact (title/number thump) · boom (big reveal) · heartbeat ·
glitch · subdrop · zap · reverse (swell into a hit) · whip (short pan) · tapestop ·
riser · snap (a block landing on the beat) · thunk (numeral) · knife (cut) · glock (a rule note) · tap · paper · chime.
Writes 48 kHz stereo at full level; tools/mix_film.py sets the level under the voice.

Real samples: when CC0 packs are installed (tools/sfx_packs.py install sfx-kit uisfx opus), every cue whose kind has a
sample plays a real recording instead, placed on the pack's sync point (a hit's transient on the cue time; a riser's
arrival on t + dur), with takes rotating so repeats differ; kinds without a sample are synthesised as before. Extra
kinds that only exist as samples (success, fail, msgin, msgout, braam, sting, coin, applause, ring, ...) fall back to the
nearest synth sound. Per cue: "sample": "<id>" picks one, "synth": true forces synthesis. --synth-only ignores the packs,
--ui-theme glass|zen|... prefers that uisfx theme for interface kinds. The sources used are written to <out>.sources.json."""
import argparse, json, math, pathlib
import numpy as np, soundfile as sf

SR = 48000
ap = argparse.ArgumentParser(); ap.add_argument("--cues", required=True); ap.add_argument("--duration", type=float, required=True); ap.add_argument("--out", required=True)
ap.add_argument("--synth-only", action="store_true"); ap.add_argument("--ui-theme")
a = ap.parse_args()
rng = np.random.default_rng(11)


def env(n, at=0.002, dec=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(at, 1e-4)) * np.exp(-t / dec)


def noise(d): return rng.standard_normal(int(d * SR))
def hp(x): return np.diff(np.concatenate([[0], x]))
def lp(x, k=8): return np.convolve(x, np.ones(k) / k, "same")
def sine(f, d, ph=0): t = np.arange(int(d * SR)) / SR; return np.sin(2 * np.pi * f * t + ph)
def sweep(f0, f1, d): n = int(d * SR); f = np.linspace(f0, f1, n); return np.sin(2 * np.pi * np.cumsum(f) / SR)


def make(kind, dur=None):
    if kind == "pop": return 0.6 * lp(noise(0.12), 3) * env(int(.12 * SR), .001, .02) + 0.5 * sine(180, .12) * env(int(.12 * SR), .001, .03)
    if kind == "slide": d = dur or .45; n = int(d * SR); return lp(noise(d), 12) * np.hanning(n) * 0.8
    if kind == "whoosh": d = dur or .8; n = int(d * SR); x = lp(noise(d), 20); return x * np.hanning(n) ** 1.5 * 1.4
    if kind in ("marker", "pencil"):
        d = dur or .5; n = int(d * SR); x = hp(noise(d)) if kind == "pencil" else lp(noise(d), 4)
        return x * np.hanning(n) * (0.35 + 0.15 * np.sin(np.arange(n) / SR * 2 * np.pi * 9)) * (0.5 if kind == "pencil" else 0.6)
    if kind in ("tick", "click", "snip", "tap"): return hp(noise(.03)) * env(int(.03 * SR), .0005, .006) * (1.2 if kind == "snip" else 0.9)
    if kind == "ticks":
        d = dur or 1.0; out = np.zeros(int(d * SR) + SR // 10); k = 0
        for t in np.linspace(0, d, max(4, int(d * 14))): seg = make("tick"); i = int(t * SR); out[i:i + len(seg)] += seg * (0.6 + 0.4 * (k % 2)); k += 1
        return out
    if kind == "stamp": n = int(.35 * SR); return 0.9 * lp(noise(.35), 6) * env(n, .001, .05) + 0.9 * sine(70, .35) * env(n, .001, .09)
    if kind in ("impact", "thunk"):
        n = int(.6 * SR); t = np.arange(n) / SR; f = 45 + 80 * np.exp(-t / .05)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .001, .16 if kind == "impact" else .1) * 1.1
    if kind == "boom": n = int(2.2 * SR); t = np.arange(n) / SR; f = 32 + 40 * np.exp(-t / .2); return (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * lp(noise(2.2), 40)) * env(n, .005, .7)
    if kind == "heartbeat":
        out = np.zeros(int(.6 * SR))
        for off, g in ((0, 1), (.22, .7)): s = make("thunk") * g; i = int(off * SR); out[i:i + len(s)] += s[: len(out) - i]
        return out * 0.8
    if kind == "riser": d = dur or 1.2; n = int(d * SR); return (0.5 * sweep(200, 1400, d) * 0.15 + lp(noise(d), 6) * 0.5) * np.linspace(0, 1, n) ** 2
    if kind == "snap": n = int(.08 * SR); return hp(noise(.08)) * env(n, .0005, .008) + 0.4 * sine(1800, .08) * env(n, .0005, .01)
    if kind == "knife": d = .3; n = int(d * SR); return hp(noise(d)) * np.linspace(.2, 1, n) * env(n, .2, .05) * 0.6
    if kind == "glock": n = int(1.5 * SR); return (sine(1175, 1.5) + .3 * sine(1175 * 2.76, 1.5) + .1 * sine(1175 * 5.4, 1.5)) * env(n, .001, .6) * 0.5
    if kind == "paper": d = .3; return lp(noise(d), 5) * env(int(d * SR), .01, .08) * 0.6
    if kind == "key": n = int(.05 * SR); return (hp(noise(.05)) * 0.9 + 0.5 * sine(2400, .05)) * env(n, .0004, .007)                      # typewriter key
    if kind == "keys":
        d = dur or 1.0; out = np.zeros(int(d * SR) + SR // 10)
        for t in np.cumsum(0.06 + 0.07 * rng.random(int(d / 0.095))): 
            if t < d: seg = make("key"); i = int(t * SR); out[i:i + len(seg)] += seg * (0.6 + 0.4 * rng.random())
        return out
    if kind == "shutter": a = make("snap"); out = np.zeros(int(.16 * SR)); out[: len(a)] += a; i = int(.07 * SR); out[i:i + len(a)] += a[: len(out) - i] * 0.8; return out   # camera shutter
    if kind == "blip": n = int(.09 * SR); return sine(1320, .09) * env(n, .002, .02) * 0.5                                                 # interface blip
    if kind == "blipup": n = int(.16 * SR); return sweep(700, 1700, .16) * env(n, .002, .05) * 0.45
    if kind == "bell": n = int(2.0 * SR); return (sine(660, 2.0) + .6 * sine(660 * 2.4, 2.0) + .25 * sine(660 * 3.9, 2.0)) * env(n, .002, .8) * 0.35
    if kind == "projector": d = dur or .9; n = int(d * SR); t = np.arange(n) / SR; return (hp(noise(d)) * (0.5 + 0.5 * (np.sin(2 * np.pi * 18 * t) > 0.6))) * np.hanning(n) * 0.5   # film gate rattle
    if kind == "swell": d = dur or 1.4; n = int(d * SR); return (sine(110, d) + .5 * sine(165, d) + .3 * sine(220, d)) * np.hanning(n) * 0.5       # warm pad swell
    if kind == "thud": n = int(.25 * SR); return (sine(95, .25) + 0.5 * lp(noise(.25), 10)) * env(n, .001, .05)                              # object set down
    if kind == "zip": d = .22; return sweep(300, 2600, d) * 0.25 * np.hanning(int(d * SR)) + hp(noise(d)) * 0.2 * np.hanning(int(d * SR))     # fast pass
    if kind == "boing": n = int(.5 * SR); t = np.arange(n) / SR; return np.sin(2 * np.pi * np.cumsum(180 + 120 * np.sin(2 * np.pi * 9 * t) * np.exp(-t / .2)) / SR) * env(n, .002, .15) * 0.6
    if kind == "chalk": d = dur or .5; n = int(d * SR); return hp(lp(noise(d), 2)) * np.hanning(n) * (0.5 + 0.5 * (rng.random(n) > 0.4)) * 0.7
    if kind == "chime": n = int(1.2 * SR); return (sine(880, 1.2) + .5 * sine(1320, 1.2)) * env(n, .002, .5) * 0.4
    if kind == "glitch":                                   # digital crackle: short bit-crushed noise bursts at random gaps
        d = dur or .28; n = int(d * SR); out = np.zeros(n); i = 0
        while i < n:
            L = int(rng.uniform(.008, .03) * SR); seg_ = np.sign(noise(L / SR)) * rng.uniform(.3, .9)
            seg_ = np.repeat(seg_[::int(rng.integers(4, 16))], int(rng.integers(4, 16)))[:L]; out[i:i + len(seg_)] += seg_[: n - i]; i += L + int(rng.uniform(.004, .02) * SR)
        return out * env(n, .001, d * .6) * 0.45
    if kind == "subdrop": n = int(1.1 * SR); t = np.arange(n) / SR; f = 30 + 90 * np.exp(-t / .25); return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .003, .5) * 1.1   # deep falling bass
    if kind == "zap": d = .35; n = int(d * SR); return sweep(2400, 180, d) * env(n, .001, .12) * 0.35 + hp(noise(d)) * env(n, .001, .03) * 0.2       # laser sweep down
    if kind == "reverse": d = dur or .9; n = int(d * SR); x = (lp(noise(d), 3) * 0.7 + 0.5 * sweep(300, 900, d) * 0.4) * np.exp(-np.arange(n)[::-1] / SR / (d * .35)); return x * np.linspace(0, 1, n) ** 1.5   # reversed swell into a hit
    if kind == "whip": d = .18; n = int(d * SR); return (hp(noise(d)) * 0.7 + sweep(900, 3000, d) * 0.2) * np.sin(np.linspace(0, np.pi, n)) ** 3 * 1.2   # short whip pan
    if kind == "tapestop": d = .6; n = int(d * SR); t = np.arange(n) / SR; f = 420 * (1 - t / d) ** 2 + 30; return (np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.6 + lp(noise(d), 8) * 0.2) * np.linspace(1, 0, n)   # tape stopping
    return np.zeros(1)


FALLBACK = {"success": "chime", "fanfare": "chime", "sparkle": "chime", "sting": "chime", "stinglong": "swell", "fail": "thud", "error": "thud",
            "msgin": "blip", "msgout": "blipup", "notify": "blip", "braam": "boom", "hit": "impact", "coin": "blip", "cash": "bell",
            "ring": "bell", "alarm": "bell", "doorbell": "bell", "clock": "ticks", "countdown": "ticks", "toggle": "click", "swipe": "slide",
            "faller": "subdrop", "highlight": "marker", "scribble": "pencil", "erase": "paper", "pageturn": "paper", "appear": "pop",
            "flip": "paper", "morph": "swell", "grow": "blipup", "shrink": "zap", "zoomin": "whoosh", "zoomout": "whoosh", "spin": "whip",
            "chart": "blipup", "progress": "ticks", "scan": "ticks", "powerup": "blipup", "powerdown": "zap", "static": "glitch",
            "latch": "click", "switch": "click", "ratchet": "ticks", "passby": "whoosh", "stinger": "whoosh", "tension": "riser"}
CONTINUOUS = {"marker", "pencil", "chalk", "keys", "ticks", "scribble", "highlight", "projector", "progress", "scan", "static", "clock"}
DUR_FIT = CONTINUOUS | {"riser", "reverse", "whoosh", "faller", "swell", "tension", "zip"}
PACKDIR = pathlib.Path(__file__).resolve().parent.parent / "public"
INDEX = PACKDIR / "audio-lib" / "packs" / "index.json"
LIBX = [] if a.synth_only or not INDEX.exists() else json.loads(INDEX.read_text())
try:
    import importlib.util as _iu; _sp = _iu.spec_from_file_location("sfx_packs", pathlib.Path(__file__).with_name("sfx_packs.py")); _m = _iu.module_from_spec(_sp); _sp.loader.exec_module(_m)
    ORDER = _m.SFXKIT_KINDS
except Exception: ORDER = {}
_used, _cache = {}, {}


def candidates(kind):
    kit = sorted([e for e in LIBX if e["pack"] == "sfx-kit" and kind in e["kinds"]], key=lambda e: ORDER.get(kind, []).index(e["id"][4:]) if e["id"][4:] in ORDER.get(kind, []) else 99)
    opus = [e for e in LIBX if e["pack"] == "opus" and kind in e["kinds"]]
    ui = [e for e in LIBX if e["pack"] == "uisfx" and kind in e["kinds"] and e.get("theme") == (a.ui_theme or "minimal")]
    if a.ui_theme and ui: return ui + kit + opus
    return kit + opus + ui if (kit or opus) else ui


def choose(c):
    if c.get("synth"): return None
    if c.get("sample"): return next((e for e in LIBX if e["id"] == c["sample"]), None)
    cs = candidates(c["kind"])
    if not cs: return None
    if c.get("dur") and c["kind"] in DUR_FIT:
        cs = sorted(cs, key=lambda e: abs(e["duration"] - c["dur"]) if c["kind"] not in CONTINUOUS else (e["duration"] < c["dur"] * 0.6, abs(e["duration"] - c["dur"])))[:2]
    else: cs = cs[:3]
    n = _used.get(c["kind"], 0); _used[c["kind"]] = n + 1
    return cs[n % len(cs)]


def load(e):
    if e["id"] not in _cache:
        x, sr = sf.read(str(PACKDIR / e["file"]), always_2d=True)
        if x.shape[1] == 1: x = np.repeat(x, 2, axis=1)
        if sr != SR:
            from scipy.signal import resample_poly
            g = math.gcd(SR, sr); x = resample_poly(x, SR // g, sr // g, axis=0)
        _cache[e["id"]] = x[:, :2]
    return _cache[e["id"]]


def tile(x, d):
    """repeat a continuous sound (drawing, typing, ticking) to length d with 30 ms crossfades"""
    n, f = int(d * SR), int(0.03 * SR)
    if len(x) >= n: return x[:n]
    out = x.copy()
    while len(out) < n:
        r = np.linspace(0, 1, f)[:, None]; out[-f:] = out[-f:] * (1 - r) + x[:f] * r; out = np.concatenate([out, x[f:]])
    return out[:n]


cues = json.loads(pathlib.Path(a.cues).read_text())
buf = np.zeros((int((a.duration + 3) * SR), 2)); used = []
for c in cues:
    e = choose(c) if LIBX else None
    pan = c.get("pan", rng.uniform(-0.25, 0.25)); L, R = math.cos((pan + 1) * math.pi / 4) * 1.41, math.sin((pan + 1) * math.pi / 4) * 1.41
    if e is not None:
        s = load(e); sync = e.get("sync", {}).get("at", 0) or 0
        if c["kind"] in CONTINUOUS and c.get("dur"): s = tile(s, c["dur"]); sync = 0
        if c.get("dur") and c["kind"] in CONTINUOUS:
            k = min(len(s), int(0.04 * SR)); s = s.copy(); s[-k:] *= np.linspace(1, 0, k)[:, None]
        start = c["t"] + ((c.get("dur") or sync) - sync if e.get("sync", {}).get("meets") == "arrival" else -sync)
        s = s / (np.abs(s).max() + 1e-9) * min(1.0, c.get("gain", 0.6)); i = int(round(start * SR))
        if i < 0: s = s[-i:]; i = 0
        if i >= len(buf) or not len(s): continue
        s = s[: len(buf) - i]; buf[i:i + len(s), 0] += s[:, 0] * L; buf[i:i + len(s), 1] += s[:, 1] * R
        used.append({"t": c["t"], "kind": c["kind"], "sample": e["id"], "license": e["license"], "source": e["source"]})
        continue
    kind = FALLBACK.get(c["kind"], c["kind"])   # sample-only kinds fall back to the nearest synth sound
    s = make(kind, c.get("dur")); s = s / (np.abs(s).max() + 1e-9) * min(1.0, c.get("gain", 0.6))
    i = int(c["t"] * SR)
    if i >= len(buf) or i < 0: continue
    s = s[: len(buf) - i]; buf[i:i + len(s), 0] += s * L; buf[i:i + len(s), 1] += s * R
    used.append({"t": c["t"], "kind": c["kind"], "sample": None, "synth": kind})
buf = buf[: int(a.duration * SR)]
buf /= max(1.0, np.abs(buf).max() / 0.95)
sf.write(a.out, buf.astype(np.float32), SR)
real = sum(1 for u in used if u["sample"])
pathlib.Path(str(a.out) + ".sources.json").write_text(json.dumps({"license_note": "pack samples are CC0 (no attribution required); synth sounds are our own", "cues": used}, indent=1))
print(f"sfx: {a.out} ({len(cues)} cues, {a.duration:.1f}s; {real} real samples, {len(used) - real} synthesised)")
