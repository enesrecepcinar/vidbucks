#!/usr/bin/env python3
"""defects.py - exact defects a measure finds, no model: flashing past the safe limit, clipped or flat-topped audio,
audio dropouts. Used by quality_gate.py; runs alone too.

  python tools/defects.py out/video.mp4            # prints the findings, exit 0 (findings are information)
  python tools/defects.py out/video.mp4 --json d.json

flash     The general-flash rule (WCAG 2.3.1, three flashes): a flash is a pair of opposite brightness swings of at least
          0.10 relative luminance where the darker side is under 0.80, over a large area (one of four quadrants, about a
          quarter of the frame). More than 3 flashes in any one second -> FAIL: it can trigger seizures in viewers with
          photosensitive epilepsy, and platforms flag it. Slow it, shrink it or lower its contrast.
clip      a run of 3+ samples at full scale (|x| >= 0.999), or 4+ identical samples at |x| >= 0.05 (a flat top a hard
          clamp leaves); counted per second, a second with 3+ runs is a finding.
dropout   the sound falls from level (>= -45 dBFS) to digital silence (< -80 dBFS) within one 10 ms step and comes back
          within two steps to within 10 dB of where it was, 50 ms to 3 s later. A pause that fades is not one.
"""
import argparse, json, subprocess, sys
import numpy as np


def luma_quadrants(path, fps=24):
    """Per frame, the mean relative luminance (0..1, linearised) of the four quadrants."""
    w, h = 64, 36
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"fps={fps},scale={w}:{h},format=gray", "-f", "rawvideo", "-"],
                         capture_output=True, timeout=1800).stdout
    n = len(raw) // (w * h)
    g = np.frombuffer(raw[: n * w * h], np.uint8).reshape(n, h, w).astype(np.float32) / 255.0
    lin = np.where(g <= 0.04045, g / 12.92, ((g + 0.055) / 1.055) ** 2.4)
    q = [lin[:, :h // 2, :w // 2], lin[:, :h // 2, w // 2:], lin[:, h // 2:, :w // 2], lin[:, h // 2:, w // 2:]]
    return np.stack([x.mean((1, 2)) for x in q], 1), fps


def swings(L, step=0.10, dark=0.80):
    """Frame indices where a brightness swing of >= step completes (extremum tracking: a swing counts once it reverses
    by step from the last peak or trough, and the darker side is under `dark`)."""
    out, d = [], 0
    if len(L) == 0: return out
    lo = hi = float(L[0]); ext = float(L[0])
    for i, v in enumerate(map(float, L)):
        if d == 0:
            lo, hi = min(lo, v), max(hi, v)
            if v - lo >= step and lo < dark: d, ext = 1, v; out.append(i)
            elif hi - v >= step and v < dark: d, ext = -1, v; out.append(i)
        elif d == 1:
            if v > ext: ext = v
            elif ext - v >= step and v < dark: d, ext = -1, v; out.append(i)
        else:
            if v < ext: ext = v
            elif v - ext >= step and ext < dark: d, ext = 1, v; out.append(i)
    return out


def flashes(path):
    Q, fps = luma_quadrants(path)
    found = []
    for k in range(Q.shape[1]):
        s = np.array(swings(Q[:, k]))
        if len(s) < 7: continue
        # more than 3 flashes = 7+ swings inside one second
        for j in range(len(s) - 6):
            if s[j + 6] - s[j] < fps:
                found.append(round(s[j] / fps, 2))
    found = sorted(set(found))
    spans = []                                      # merge into spans
    for t in found:
        if spans and t - spans[-1][1] <= 1.0: spans[-1][1] = t
        else: spans.append([t, t])
    return [[a, b + 1.0] for a, b in spans]


def pcm(path, rate=48000):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "2", "-ar", str(rate), "-f", "f32le", "-"],
                         capture_output=True, timeout=1800).stdout
    x = np.frombuffer(raw, np.float32)
    return x.reshape(-1, 2) if len(x) % 2 == 0 else x[:-1].reshape(-1, 2), rate


def runs(mask, min_len):
    """Start indices of runs of True of at least min_len."""
    if not mask.any(): return np.array([], int)
    d = np.diff(np.concatenate([[0], mask.astype(np.int8), [0]]))
    st, en = np.where(d == 1)[0], np.where(d == -1)[0]
    return st[(en - st) >= min_len]


def clipping(x, rate):
    secs = {}
    for c in range(x.shape[1]):
        ch = x[:, c]
        full = runs(np.abs(ch) >= 0.999, 3)
        same = np.concatenate([[False], np.diff(ch) == 0]) & (np.abs(ch) >= 0.05)
        flat = runs(same, 3)                        # 3 equal steps = 4 identical samples
        for i in np.concatenate([full, flat]): secs[int(i // rate)] = secs.get(int(i // rate), 0) + 1
    return sorted(s for s, n in secs.items() if n >= 3)


def dropouts(x, rate):
    m = np.abs(x).max(1)
    hop = rate // 100
    n = len(m) // hop
    if n < 3: return []
    rms = np.sqrt((m[: n * hop].reshape(n, hop) ** 2).mean(1) + 1e-12)
    db = 20 * np.log10(rms + 1e-12)
    out = []
    i = 1
    while i < n - 1:
        if db[i - 1] >= -45 and db[i] < -80:
            before = db[i - 1]
            for j in range(i + 5, min(n, i + 300)):          # 50 ms .. 3 s later
                if db[j] >= -80:
                    if db[j] >= before - 10 or (j + 1 < n and db[j + 1] >= before - 10): out.append([round(i / 100, 2), round(j / 100, 2)])
                    i = j; break
        i += 1
    return out


def find(path, video=True, audio=True):
    R = {"flash": [], "clip_seconds": [], "dropouts": []}
    if video: R["flash"] = flashes(path)
    if audio:
        x, rate = pcm(path)
        if len(x):
            R["clip_seconds"] = clipping(x, rate)
            R["dropouts"] = dropouts(x, rate)
    return R


def findings(R):
    """(severity, check, msg, fix, t) rows for quality_gate."""
    rows = []
    for a, b in R["flash"]:
        rows.append(("FAIL", "flash", f"more than 3 flashes a second {a:.1f}-{b:.1f} s (WCAG 2.3.1)", "slow the strobe, shrink it under a quarter of the frame or lower its contrast", a))
    cs = R["clip_seconds"]
    if cs:
        rows.append(("WARN", "audio", f"clipped / flat-topped audio in {len(cs)} s (first at {cs[0]} s)", "lower the gain before the limiter; use a true-peak limiter instead of a hard clamp", float(cs[0])))
    for a, b in R["dropouts"][:10]:
        rows.append(("WARN", "audio", f"audio dropout {a:.2f}-{b:.2f} s (sound cuts to digital silence and returns)", "re-render the mix; check the join or the clip edge there", a))
    return rows


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video"); ap.add_argument("--json"); ap.add_argument("--no-audio", action="store_true"); ap.add_argument("--no-video", action="store_true")
    a = ap.parse_args()
    R = find(a.video, not a.no_video, not a.no_audio)
    for row in findings(R): print(f"{row[0]} {row[1]}: {row[2]} -> {row[3]}")
    if not findings(R): print("no flash, clipping or dropout found")
    if a.json: json.dump(R, open(a.json, "w"), indent=1)
