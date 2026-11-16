#!/usr/bin/env python
"""media_cues.py - the sound of a media film, from its edit: every beat that enters the picture gets the hit its medium makes.

  python tools/media_cues.py --edit public/multi/<name>/edit.json --timing videos/<name>/timing.json --out videos/<name>/cues.json
  python tools/sfx_synth.py --cues videos/<name>/cues.json --duration <s> --out videos/<name>/sfx.wav
  python tools/mix_film.py --voice narration.wav --sfx sfx.wav [--music pulse.wav] --out mix.m4a

One sound per meaningful hit, never a bed of noise: an icon arriving (pencil scratch on ink and sketchbook, paper on cut paper,
a plate sliding on riso, a chime on pixel, a snap on isometric, a tick on the math stage); a number counting (ticks, then a
thunk; a year stamps); a title (marker / paper / stamp ...); the second half of a comparison (whoosh for "becomes", a small
impact for "versus"); each list row (a tap); a change of medium (whoosh). Times come from the same word times the picture
uses, so a re-timed voice re-times the sound. Cues closer than 0.12 s to a louder one are dropped (no flams)."""
import argparse, json, pathlib

ENTRY = {"crosshatch": ("pencil", 0.45, 0.55), "sketchbook": ("pencil", 0.5, 0.8), "cut-paper": ("paper", 0.55, 0.45), "riso": ("slide", 0.5, 0.45),
         "pixel": ("glock", 0.45, None), "isometric": ("snap", 0.5, None), "math": ("tick", 0.4, None)}
TITLE = {"crosshatch": "marker", "sketchbook": "marker", "cut-paper": "paper", "riso": "stamp", "pixel": "glock", "isometric": "click", "math": "chime"}
ROW = {"pixel": "glock", "math": "tick"}

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--edit", required=True); ap.add_argument("--timing", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--gain", type=float, default=1.0, help="scale every cue (the mix sets the final level)")
a = ap.parse_args()
E = json.loads(pathlib.Path(a.edit).read_text()); T = json.loads(pathlib.Path(a.timing).read_text())
L = {l["id"]: l for l in T["lines"]}


def word_t(line, wi):
    l = L[line]; W = l.get("words") or []
    return W[wi][1] if wi is not None and wi < len(W) else l["start"]


cues = []
def cue(kind, t, gain, dur=None): cues.append({"kind": kind, "t": round(max(0.0, t), 3), "gain": round(gain * a.gain, 3), **({"dur": dur} if dur else {})})

for si, sg in enumerate(E["segments"]):
    if si and sg.get("transition", {}) and (sg.get("transition") or {}).get("kind", "cut") != "cut": cue("whoosh", sg["start"] - 0.15, 0.5, 0.6)
    if sg.get("renderer") != "media" or not sg.get("data"): continue
    m = sg["data"]["medium"]; ek, eg, ed = ENTRY.get(m, ("pop", 0.5, None))
    for b in sg["data"]["beats"]:
        t0 = word_t(b["line"], b.get("w")) - 0.1
        if t0 < sg["start"] - 0.05 or t0 > sg["end"]: continue
        k = b["kind"]
        if k == "number":
            big = str(b.get("big", "")); stamp = ":" in big or (big.isdigit() and len(big) == 4 and big[:2] in ("18", "19", "20"))
            if stamp: cue("stamp", t0 + 0.05, 0.6)
            else: cue("ticks", t0, 0.35, 0.9); cue("thunk", t0 + 0.9, 0.55)
        elif k == "title": cue(TITLE.get(m, "pop"), t0 + 0.05, 0.45)
        elif k in ("object", "compare", "list"):
            if k != "list" or b.get("icon"): cue(ek, t0, eg, ed)
            if k == "compare":
                t2 = word_t(b["line"], b.get("w2")) - 0.05
                cue("whoosh" if b.get("link") == "to" else "impact", t2 - 0.25, 0.4 if b.get("link") == "to" else 0.35, 0.5 if b.get("link") == "to" else None)
                cue(ek, t2, eg, ed)
            for r in b.get("items", []): cue(ROW.get(m, "tap"), word_t(b["line"], r.get("w")) - 0.05, 0.4)

# no flams: a cue within 0.12 s of a louder one goes
cues.sort(key=lambda c: c["t"]); kept = []
for c in cues:
    if kept and c["t"] - kept[-1]["t"] < 0.12:
        if c["gain"] > kept[-1]["gain"]: kept[-1] = c
        continue
    kept.append(c)
pathlib.Path(a.out).write_text(json.dumps(kept, indent=0))
from collections import Counter
print(f"cues: {len(kept)} -> {a.out}  " + ", ".join(f"{k} {n}" for k, n in Counter(c['kind'] for c in kept).most_common()))
