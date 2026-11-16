#!/usr/bin/env python
"""beatmap.py - the beat grid of a music track, and big moments snapped onto it.

  python tools/beatmap.py analyze <track> [--out beats.json] [--start 0] [--dur 60] [--bpm 70-180 | --bpm 104]
  python tools/beatmap.py snap --beats beats.json --events events.json [--out snapped.json]

analyze writes: bpm, period, offset (first beat), beats[], downbeats[] (bar starts, 4/4), hits[] (the strongest onsets:
where the big moments go), loudest (the loudest 100 ms), quiet[] (drops: >= 0.3 s far below the median level) and
intensity[] every 0.1 s (0.45 onset + 0.25 brightness contrast + 0.20 loudness + 0.10 bass, each 0-1) for placing
reveals on cues. Method (numpy + ffmpeg only): spectral-flux onset strength -> tempo by autocorrelation with a prior
around 120 BPM -> period and phase by an onset comb -> bar phase by low-band energy. Constant tempo is assumed (most
library, pop and electronic music); if you know the BPM pass --bpm 104 and only the phase is searched.

snap moves each event onto the beat grid or a hit when one is close enough: events.json is [{"id", "t", "size": "big" |
"small"}]; big moments (cards, B-roll, cuts) may move <= 0.15 s, small entrances <= 0.10 s; a hit wins over a plain
beat inside the window, a downbeat over an off-beat. Events never move when nothing is near (the words win)."""
import argparse, json, subprocess, sys
import numpy as np

SR, HOP, NFFT = 22050, 512, 2048
FPS = SR / HOP

def load(path, start=0.0, dur=None):
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{start}", "-i", str(path)] + (["-t", f"{dur}"] if dur else []) + ["-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32)

def stft_mag(y):
    n = 1 + max(0, (len(y) - NFFT) // HOP); win = np.hanning(NFFT).astype(np.float32)
    frames = np.lib.stride_tricks.as_strided(y, shape=(n, NFFT), strides=(y.strides[0] * HOP, y.strides[0]))
    return np.abs(np.fft.rfft(frames * win, axis=1))

def analyze(y, bpm_range=(70, 180), bpm_fixed=None):
    M = stft_mag(y); L = np.log1p(M * 10); freqs = np.fft.rfftfreq(NFFT, 1 / SR)
    flux = np.r_[0, np.maximum(0, np.diff(L, axis=0)).sum(axis=1)]
    low = np.r_[0, np.maximum(0, np.diff(L[:, freqs < 150], axis=0)).sum(axis=1)]
    on = flux - np.convolve(flux, np.ones(16) / 16, "same"); on = np.maximum(0, on); on /= (on.max() + 1e-9)
    # tempo: autocorrelation with a log-normal prior around 120 BPM
    if bpm_fixed: cands = [bpm_fixed]
    else:
        ac = np.correlate(on, on, "full")[len(on) - 1:]
        lags = np.arange(len(ac)); bpm = 60 * FPS / np.maximum(lags, 1)
        ok = (bpm >= bpm_range[0]) & (bpm <= bpm_range[1])
        w = ac * np.exp(-0.5 * (np.log2(bpm / 120) / 0.9) ** 2) * ok
        top = np.argsort(w)[::-1][:6]; cands = sorted({round(float(bpm[i]), 1) for i in top if ok[i]})
    best = (-1, None, None)
    t_on = np.arange(len(on)) / FPS
    for b0 in cands:                                  # refine period +-3 % and phase with an onset comb
        for b in np.linspace(b0 * 0.97, b0 * 1.03, 61) if not bpm_fixed else [b0]:
            P = 60 / b; ph = np.linspace(0, P, 48, endpoint=False)
            for p in ph:
                idx = np.round((np.arange(p, t_on[-1], P)) * FPS).astype(int); idx = idx[idx < len(on)]
                sc = on[idx].mean() if len(idx) else 0
                if sc > best[0]: best = (sc, b, p)
    strength, bpm_v, phase = best; P = 60 / bpm_v
    # phase, precisely: the STFT smears attacks by tens of ms and echoes can win the comb; re-align the grid to a
    # 1 ms attack envelope (rectified, smoothed 5 ms, positive slope) within a quarter beat, weighting low frequencies
    import numpy as np_
    lo = np.convolve(y, np.ones(40) / 40, "same")                     # crude low-pass keeps kicks, drops hats/echo tails
    dec = SR // 1000; rate = SR / dec                                  # the envelope's real rate (not exactly 1000 Hz)
    env = np.sqrt(np.convolve(lo ** 2 + 0.1 * y ** 2, np.ones(int(0.02 * SR)) / int(0.02 * SR), "same"))[::dec]   # 20 ms RMS: longer than a bass cycle, so it does not ripple
    att = np.maximum(0, np.diff(env, prepend=env[0]))
    best2 = (-1, phase)
    for q in np.arange(0, P, 0.002):                                  # the whole period: the coarse phase may sit on an echo
        idx = np.round(np.arange(q % P, len(att) / rate, P) * rate).astype(int); idx = idx[idx < len(att)]
        sc = sum(att[max(0, i - 3):i + 4].max() for i in idx) / max(1, len(idx))
        if sc > best2[0]: best2 = (sc, q % P)
    phase = best2[1]
    beats = np.arange(phase, len(y) / SR, P)
    # bar phase: which of 4 beat offsets carries the most low-band energy
    lb = [np.mean([low[min(len(low) - 1, int(t * FPS))] for t in beats[k::4]]) if len(beats[k::4]) else 0 for k in range(4)]
    k0 = int(np.argmax(lb)); downbeats = beats[k0::4]
    # hits: strongest onset peaks, at least 0.5 s apart
    pk = [i for i in range(2, len(on) - 2) if on[i] == on[max(0, i - 6):i + 7].max() and on[i] > on.mean() + 2 * on.std()]
    pk.sort(key=lambda i: -on[i]); hits = []
    for i in pk:
        if all(abs(i / FPS - h) >= 0.5 for h in hits): hits.append(i / FPS)
        if len(hits) >= max(4, int(len(y) / SR / 4)): break
    # loudness per 100 ms, loudest moment, quiet drops
    n = int(0.1 * SR); k = len(y) // n; rms = np.array([np.sqrt((y[i * n:(i + 1) * n] ** 2).mean()) + 1e-9 for i in range(k)]); db = 20 * np.log10(rms)
    med = np.median(db); quiet, run = [], None
    for i, v in enumerate(db):
        if v < med - 12:
            run = i if run is None else run
        else:
            if run is not None and (i - run) * 0.1 >= 0.3: quiet.append([round(run * 0.1, 2), round(i * 0.1, 2)])
            run = None
    # intensity every 0.1 s
    def per(x):
        m = int(0.1 * FPS); return np.array([x[i * m:(i + 1) * m].mean() if len(x[i * m:(i + 1) * m]) else 0 for i in range(k)])
    bright = per(M[:, freqs > 2000].sum(axis=1) / (M.sum(axis=1) + 1e-9)); bass = per(M[:, freqs < 150].sum(axis=1)); onk = per(on)
    nz = lambda x: (x - x.min()) / (x.max() - x.min() + 1e-9)
    inten = 0.45 * nz(onk) + 0.25 * nz(bright) + 0.20 * nz(db) + 0.10 * nz(bass)
    return {"confidence": "high" if strength >= 0.45 else "medium" if strength >= 0.3 else "low (weak or irregular pulse: check by ear or pass --bpm)", "bpm": round(bpm_v, 2), "period": round(P, 4), "offset": round(phase, 3), "rhythm_strength": round(float(strength), 3),
            "beats": [round(float(t), 3) for t in beats], "downbeats": [round(float(t), 3) for t in downbeats], "hits": [round(h, 3) for h in sorted(hits)],
            "loudest": round(float(np.argmax(db)) * 0.1, 2), "quiet": quiet, "intensity": [round(float(v), 3) for v in inten]}

def snap(B, events):
    beats, downs, hits = np.array(B["beats"]), set(B["downbeats"]), np.array(B.get("hits", []))
    out = []
    for e in events:
        tol = 0.15 if e.get("size", "big") == "big" else 0.10; t = e["t"]; opts = []
        for h in hits:
            if abs(h - t) <= tol: opts.append((0, abs(h - t), h, "hit"))
        for b in beats:
            if abs(b - t) <= tol: opts.append((1 if b in downs else 2, abs(b - t), b, "downbeat" if b in downs else "beat"))
        if opts:
            _, d, nt, kind = min(opts); out.append({**e, "t": round(float(nt), 3), "moved": round(float(nt - t), 3), "on": kind})
        else: out.append({**e, "moved": 0.0, "on": None})
    return out

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter); sp = ap.add_subparsers(dest="cmd", required=True)
    p = sp.add_parser("analyze"); p.add_argument("track"); p.add_argument("--out"); p.add_argument("--start", type=float, default=0); p.add_argument("--dur", type=float); p.add_argument("--bpm", default="70-180")
    p = sp.add_parser("snap"); p.add_argument("--beats", required=True); p.add_argument("--events", required=True); p.add_argument("--out")
    a = ap.parse_args()
    if a.cmd == "analyze":
        y = load(a.track, a.start, a.dur)
        fixed = float(a.bpm) if "-" not in a.bpm else None; rng = tuple(map(float, a.bpm.split("-"))) if "-" in a.bpm else (70, 180)
        R = analyze(y, rng, fixed); R.update({"track": str(a.track), "start": a.start, "duration": round(len(y) / SR, 2)})
        if a.out: json.dump(R, open(a.out, "w"), indent=1)
        print(f"[{R['confidence'].split(' ')[0]}] bpm {R['bpm']} (period {R['period']}s, first beat {R['offset']}s, strength {R['rhythm_strength']}), {len(R['beats'])} beats, {len(R['downbeats'])} bars, {len(R['hits'])} hits, loudest {R['loudest']}s, {len(R['quiet'])} quiet drops")
    else:
        B = json.load(open(a.beats)); E = json.load(open(a.events)); S = snap(B, E)
        if a.out: json.dump(S, open(a.out, "w"), indent=1)
        for s in S: print(f"  {s.get('id', '?'):>8}  {s['t'] - s['moved']:7.2f} -> {s['t']:7.2f}  ({s['on'] or 'stays'})")

if __name__ == "__main__":
    main()
