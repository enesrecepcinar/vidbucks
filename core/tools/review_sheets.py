#!/usr/bin/env python
"""review_sheets.py - the sheets to LOOK at before calling a render done (and to compare it with a reference).

  python tools/review_sheets.py out/x.mp4 [--ref ref.mp4] [--out out/x.review] [--max-cuts 14]

Writes into --out (default <video>.review/):
  contact.jpg   2 frames a second, the whole piece at a glance
  cuts.jpg      every detected cut as a strip: 3 frames before | the cut frame | 3 after (catches one-frame
                empty panels, captions flashing over the wrong shot, a jump the eye misses on single stills)
  first.jpg     the first 2.5 s at 0.1 s steps (the hook decides; nothing may cover a face or stall)
  phone.jpg     1 frame a second at 360 px wide: is every word readable on a phone?
  pairs.jpg     (--ref) REFERENCE | OURS at the same second, every second (proportions, palette, rhythm)
  stacked.mp4   (--ref) reference on TOP, ours BELOW, frame-locked, for checking timing by eye
Cuts are found by frame-difference spikes against the local median (robust to camera moves)."""
import argparse, json, pathlib, subprocess
import numpy as np
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument("video"); ap.add_argument("--ref"); ap.add_argument("--out"); ap.add_argument("--max-cuts", type=int, default=14)
a = ap.parse_args()
V = pathlib.Path(a.video); OUT = pathlib.Path(a.out or str(V.with_suffix("")) + ".review"); OUT.mkdir(parents=True, exist_ok=True)

def probe(p):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate:format=duration", "-of", "json", str(p)], capture_output=True, text=True).stdout)
    s = j["streams"][0]; n, d = s["r_frame_rate"].split("/"); return int(s["width"]), int(s["height"]), float(n) / float(d), float(j["format"]["duration"])

def frames(p, w, fps=None, start=0.0, dur=None):
    """decode to RGB arrays of width w (height keeps the aspect)"""
    W0, H0, f0, _ = probe(p); h = int(round(w * H0 / W0 / 2) * 2)
    vf = (f"fps={fps}," if fps else "") + f"scale={w}:{h}"
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{start}", "-i", str(p)] + (["-t", f"{dur}"] if dur else []) + ["-vf", vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    raw = subprocess.run(cmd, capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3), h

def label(im, txt):
    d = ImageDraw.Draw(im); d.rectangle([0, 0, 8 * len(txt) + 8, 16], fill="black"); d.text((4, 2), txt, fill="yellow"); return im

def grid(tiles, cols, gap=4, bg="black"):
    w, h = tiles[0].size; rows = -(-len(tiles) // cols)
    s = Image.new("RGB", (cols * (w + gap), rows * (h + gap)), bg)
    for i, t in enumerate(tiles): s.paste(t, ((i % cols) * (w + gap), (i // cols) * (h + gap)))
    return s

W, H, FPS, DUR = probe(V)
# contact: 2 fps
fr, _ = frames(V, 320, fps=2)
grid([label(Image.fromarray(f), f"{i / 2:.1f}s") for i, f in enumerate(fr)], 8).save(OUT / "contact.jpg", quality=82)
# phone: 1 fps at 360 px
fr, _ = frames(V, 360, fps=1)
grid([label(Image.fromarray(f), f"{i}s") for i, f in enumerate(fr)], 6, gap=8, bg="#222").save(OUT / "phone.jpg", quality=82)
# first 2.5 s at 0.1 s
fr, _ = frames(V, 320, fps=10, dur=2.5)
grid([label(Image.fromarray(f), f"{i / 10:.1f}s") for i, f in enumerate(fr)], 5).save(OUT / "first.jpg", quality=82)
# cuts: frame-difference spikes on every frame
small, _ = frames(V, 96)
g = small.mean(axis=3).astype(np.float32)
d = np.r_[0, np.abs(np.diff(g, axis=0)).mean(axis=(1, 2))]
cuts = []
for i in range(1, len(d)):
    lo, hi = max(1, i - 6), min(len(d), i + 7)
    loc = np.median(np.r_[d[lo:i], d[i + 1:hi]]) if hi - lo > 1 else 0
    if d[i] > 6 and d[i] > 3.5 * (loc + 0.5) and (not cuts or i - cuts[-1] > 3): cuts.append(i)
full, _ = frames(V, 200)
rows = []
for c in cuts[: a.max_cuts]:
    idx = [k for k in range(c - 3, c + 4) if 0 <= k < len(full)]
    tiles = [label(Image.fromarray(full[k]), ("CUT " if k == c else "") + f"{k / FPS:.2f}") for k in idx]
    rows.append(grid(tiles, 7, gap=2))
if rows:
    s = Image.new("RGB", (max(r.width for r in rows), sum(r.height + 10 for r in rows)), "#111"); y = 0
    for r in rows: s.paste(r, (0, y)); y += r.height + 10
    s.save(OUT / "cuts.jpg", quality=82)
report = {"video": str(V), "duration": round(DUR, 2), "fps": round(FPS, 3), "cuts": [round(c / FPS, 2) for c in cuts], "cuts_per_min": round(len(cuts) / DUR * 60, 1),
          "shot_median_s": round(float(np.median(np.diff([0] + [c / FPS for c in cuts] + [DUR]))), 2) if cuts else round(DUR, 2)}
# reference pairs + stacked sync video
if a.ref:
    R = pathlib.Path(a.ref); _, _, _, RD = probe(R); n = int(min(DUR, RD))
    rf, _ = frames(R, 320, fps=1); of, _ = frames(V, 320, fps=1)
    pairs = []
    for t in range(min(n, len(rf), len(of))):
        r, o = Image.fromarray(rf[t]), Image.fromarray(of[t])
        h = max(r.height, o.height); p = Image.new("RGB", (r.width + o.width + 6, h + 18), "white"); p.paste(r, (0, 18)); p.paste(o, (r.width + 6, 18))
        ImageDraw.Draw(p).text((4, 3), f"{t}s   REFERENCE | OURS", fill="black"); pairs.append(p)
    if pairs: grid(pairs, 4, gap=6, bg="#ddd").save(OUT / "pairs.jpg", quality=82)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(R), "-i", str(V), "-filter_complex",
                    "[0:v]scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:(ow-iw)/2:(oh-ih)/2,setsar=1[a];"
                    "[1:v]scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:(ow-iw)/2:(oh-ih)/2,setsar=1[b];[a][b]vstack=inputs=2:shortest=1[v]",
                    "-map", "[v]", "-map", "1:a?", "-c:v", "libx264", "-crf", "23", "-preset", "veryfast", "-c:a", "aac", "-shortest", str(OUT / "stacked.mp4")])
    report["reference"] = str(R)
json.dump(report, open(OUT / "review.json", "w"), indent=1)
print(f"review -> {OUT}/  contact, cuts ({len(cuts)} cuts, {report['cuts_per_min']}/min, median shot {report['shot_median_s']} s), first, phone" + (", pairs, stacked" if a.ref else ""))
