#!/usr/bin/env python
"""text_check.py - every piece of text on screen, measured: cut by the frame edge, overlapping other text, outside the
safe area / under the phone UI, or too low in contrast to read. Works on any render (reads the MP4, not the code).

  python tools/text_check.py out/x.mp4 [--every 0.5] [--out out/x.textcheck] [--ui auto|none|shorts] [--json]

How: frames every --every s -> Apple Vision OCR boxes (quality_gate's ocr_mac) -> per box:
  CUT       the box touches the frame edge (text running off screen)                        -> FAIL
  OVERLAP   two different texts' boxes intersect                                            -> FAIL
  CONTRAST  WCAG contrast between the text's ink and its ground < 3:1 (FAIL < 2:1)            -> WARN / FAIL
  GARBLED   (--lang en) the OCR reads two or more long non-words: overlapping or broken text  -> WARN
  SAFE      outside the 4 % title-safe margin, or (9:16) inside the platform UI zones (bottom 18 %, right 14 %) -> WARN
Findings that persist over consecutive samples are merged into one span. Writes report.json and flagged.jpg (each
flagged frame with the boxes drawn: red = FAIL, orange = WARN). A model looking at thumbnails misses a cropped label;
this does not. Exit 1 on any FAIL.
Text that belongs to the world (a station sign, a word in an archive photo) can be allowed with --ignore "MERIDIAN,VEWS"
or --ignore-span 57-59; allowed findings stay in report.json as OK, so the exception is visible."""
import argparse, json, os, pathlib, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from quality_gate import ocr_binary

ap = argparse.ArgumentParser(); ap.add_argument("video"); ap.add_argument("--every", type=float, default=0.5); ap.add_argument("--out")
ap.add_argument("--ui", default="auto", choices=["auto", "none", "shorts"]); ap.add_argument("--json", action="store_true"); ap.add_argument("--lang", default="en"); ap.add_argument("--ignore", default="", help="comma list of in-world texts to allow (signs, photos), case-insensitive substrings"); ap.add_argument("--ignore-span", action="append", default=[], help="a-b seconds where crowded/edge text is deliberate"); ap.add_argument("--min-conf", type=float, default=0.5)
a = ap.parse_args()
V = pathlib.Path(a.video); OUT = pathlib.Path(a.out or str(V.with_suffix("")) + ".textcheck"); OUT.mkdir(parents=True, exist_ok=True)
exe = ocr_binary()
if not exe: raise SystemExit("text_check needs Apple Vision OCR (macOS + swiftc)")

WORDS = set()
if a.lang == "en" and os.path.exists("/usr/share/dict/words"):
    WORDS = {w.strip().lower() for w in open("/usr/share/dict/words")}
def garbled(txt):
    import re
    toks = [t for t in re.findall(r"[A-Za-z']+", txt) if len(t) >= 5]
    if not WORDS or len(toks) < 2: return False
    stem = lambda w: [w, w.rstrip("s"), re.sub(r"(ed|ing|es|'s)$", "", w)]
    unknown = [t for t in toks if not any(x in WORDS for x in stem(t.lower()))]
    return len(unknown) >= 2 and len(unknown) / len(toks) >= 0.6

def lum(rgb):
    c = rgb / 255.0; c = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]

def contrast(img, box):
    """ink vs ground inside the text box: split the box's luminance in two (Otsu), the smaller cluster is the ink"""
    H, W = img.shape[:2]; x, y, w, h = box
    x0, x1 = int(x * W), int((x + w) * W); y0, y1 = int((1 - y - h) * H), int((1 - y) * H)
    pad = int(0.15 * (y1 - y0)); crop = img[max(0, y0 - pad):min(H, y1 + pad), max(0, x0 - pad):min(W, x1 + pad)]
    if crop.size < 30: return None
    L = lum(crop.astype(np.float32)).ravel(); best, thr = -1, None
    for t in np.quantile(L, np.linspace(0.05, 0.95, 19)):
        a_, b_ = L[L <= t], L[L > t]
        if len(a_) < 5 or len(b_) < 5: continue
        v = len(a_) * len(b_) * (a_.mean() - b_.mean()) ** 2
        if v > best: best, thr = v, t
    if thr is None: return 1.0
    a_, b_ = L[L <= thr], L[L > thr]
    ink, ground = (a_, b_) if len(a_) < len(b_) else (b_, a_)
    li, lg = np.percentile(ink, 50), np.percentile(ground, 50); hi, lo = max(li, lg), min(li, lg)
    return float((hi + 0.05) / (lo + 0.05))

with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(["ffmpeg", "-v", "error", "-i", str(V), "-vf", f"fps=1/{a.every},scale=1280:-2", os.path.join(tmp, "f%05d.png")], check=True)
    files = sorted(os.listdir(tmp)); res = subprocess.run([exe] + [os.path.join(tmp, f) for f in files], capture_output=True, text=True).stdout
    frames = {}
    for line in res.splitlines():
        try: o = json.loads(line)
        except Exception: continue
        frames[os.path.basename(o["file"])] = o["texts"]
    W0, H0 = Image.open(os.path.join(tmp, files[0])).size; vertical = H0 > W0
    ui = (a.ui == "shorts") or (a.ui == "auto" and vertical)
    issues, flagged = [], []
    for k, f in enumerate(files):
        t = round(k * a.every + a.every / 2, 2); img = np.asarray(Image.open(os.path.join(tmp, f)).convert("RGB"))
        boxes = [b for b in frames.get(f, []) if b["conf"] >= a.min_conf and len(b["text"].strip()) >= 2]
        found = []
        for i, b in enumerate(boxes):
            x, y, w, h = b["box"]; txt = b["text"].strip()
            if x < 0.004 or x + w > 0.996 or y < 0.004 or y + h > 0.996: found.append(("FAIL", "CUT", txt, b["box"], "text touches the frame edge"))
            elif x < 0.04 or x + w > 0.96 or y < 0.04 or y + h > 0.96: found.append(("WARN", "SAFE", txt, b["box"], "outside the 4 % title-safe margin"))
            if ui and (y < 0.18 or x + w > 0.86) and len(txt) > 3: found.append(("WARN", "SAFE", txt, b["box"], "under the phone UI (bottom 18 % / right 14 %)"))
            if garbled(txt): found.append(("WARN", "GARBLED", txt, b["box"], "reads as non-words: overlapping or broken text?"))
            c = contrast(img, b["box"])
            if c is not None and c < 3.0: found.append(("FAIL" if c < 2.0 else "WARN", "CONTRAST", txt, b["box"], f"contrast {c:.1f}:1 (needs 3:1, ideally 4.5:1)"))
            for j in range(i + 1, len(boxes)):
                x2, y2, w2, h2 = boxes[j]["box"]
                ix = max(0, min(x + w, x2 + w2) - max(x, x2)); iy = max(0, min(y + h, y2 + h2) - max(y, y2))
                if ix * iy > 0.15 * min(w * h, w2 * h2) and iy >= 0.5 * min(h, h2) and abs((y + h / 2) - (y2 + h2 / 2)) < 0.45 * min(h, h2) and boxes[j]["text"].strip() != txt:   # stacked lines of one block touch; real overlaps share the height
                    found.append(("FAIL", "OVERLAP", f"{txt} / {boxes[j]['text'].strip()}", b["box"], "two texts overlap"))
        for sev, kind, txt, box, why in found:
            last = next((s for s in reversed(issues) if s["kind"] == kind and s["text"] == txt and t - s["end"] <= a.every * 1.6), None)
            if last: last["end"] = t
            else: issues.append({"sev": sev, "kind": kind, "text": txt, "start": t, "end": t, "box": [round(v, 3) for v in box], "why": why})
        if found:
            im = Image.fromarray(img).copy(); d = ImageDraw.Draw(im)
            for sev, kind, txt, (x, y, w, h), why in found:
                d.rectangle([x * W0, (1 - y - h) * H0, (x + w) * W0, (1 - y) * H0], outline="red" if sev == "FAIL" else "orange", width=4)
                d.text((x * W0 + 4, (1 - y - h) * H0 - 14), kind, fill="red" if sev == "FAIL" else "orange")
            d.rectangle([0, 0, 120, 22], fill="black"); d.text((6, 4), f"{t:.1f}s", fill="yellow"); flagged.append(im.resize((640, int(640 * H0 / W0))))
    if flagged:
        cols = 3; tw, th = flagged[0].size; sheet = Image.new("RGB", (cols * tw, -(-len(flagged[:24]) // cols) * th), "black")
        for i, im in enumerate(flagged[:24]): sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
        sheet.save(OUT / "flagged.jpg", quality=82)

# deliberate exceptions (in-world text in a set or photo, a planned storm of words): kept in the report, never FAIL
ign = [w.strip().lower() for w in a.ignore.split(",") if w.strip()]; spans = [tuple(map(float, x.split("-"))) for x in a.ignore_span]
for s_ in issues:
    if any(w in s_["text"].lower() for w in ign) or any(lo <= s_["start"] and s_["end"] <= hi for lo, hi in spans):
        s_["sev"] = "OK"; s_["why"] += " (allowed: --ignore)"
# transitions are not defects: a contrast or edge problem seen for under a second is an entrance/exit -> WARN
for s_ in issues:
    if s_["kind"] in ("CONTRAST", "CUT") and s_["sev"] == "FAIL" and s_["end"] - s_["start"] < 1.0 - 1e-6:
        s_["sev"] = "WARN"; s_["why"] += " (under 1 s: probably an entrance/exit; look)"
fails = [s for s in issues if s["sev"] == "FAIL"]; warns = [s for s in issues if s["sev"] == "WARN"]
json.dump({"video": str(V), "samples": len(files), "every": a.every, "fails": len(fails), "warns": len(warns), "issues": issues}, open(OUT / "report.json", "w"), indent=1, ensure_ascii=False)
print(f"TEXT {'FAIL' if fails else 'PASS'}  fail={len(fails)} warn={len(warns)}  ({len(files)} frames every {a.every}s)" + (f"  -> {OUT}/flagged.jpg" if issues else ""))
for s in sorted([i for i in issues if i["sev"] != "OK"], key=lambda s: (s["sev"] != "FAIL", s["start"]))[:25]:
    print(f"  {s['sev']:4} {s['kind']:8} {s['start']:6.1f}-{s['end']:6.1f}s  '{s['text'][:40]}'  {s['why']}")
sys.exit(1 if fails else 0)
