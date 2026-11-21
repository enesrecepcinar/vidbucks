#!/usr/bin/env python
"""storm_build.py - turn a StormWorld film plan into render props and sound cues, timed to the narration.

  python tools/storm_build.py videos/x/storm.json --timing videos/x/timing.json --out videos/x/props.json --cues videos/x/cues.json [--audio x/mix.m4a]
  python tools/storm_build.py videos/x/storm.json --out videos/x/props.json --cues videos/x/cues.json          # durations as written

storm.json = { "shots": [ {kind, line?: <timing line id>, dur?, ...}, ... ], "trans"?: 0.5 }.
With --timing every shot that names a `line` starts on that line's start; a shot without a line continues from the previous one
and needs a `dur`. The first shot starts at 0, the last one runs to the end of the timing. Shots stretched below 1.2 s fail
(a shot must be readable); a shot that names lines out of order fails.
Every picture event that makes a sound becomes a cue (iris/slide whoosh, shutter on flash and viewfinder, polaroid pop and
pencil caption, notebook paper and pencil, annotation pops, counter ticks, thunder on lightning, riser on a descending
funnel, quake rumble, volcano and meteor booms, wave whoosh, scale blips, waffle ticks, newspaper slam, map marker, TV static).
Then: python tools/sfx_synth.py --cues cues.json --duration <s> --out sfx.wav, and mix_film.py for voice + music + sfx."""
import argparse, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from shot_timing import fit_shots

ap = argparse.ArgumentParser()
ap.add_argument("plan"); ap.add_argument("--timing"); ap.add_argument("--out", required=True); ap.add_argument("--cues")
ap.add_argument("--audio", help="narration or mix inside public/, written into props as cfg.audio")
ap.add_argument("--size", help="WxH, e.g. 1080x1920")
a = ap.parse_args()
plan = json.loads(pathlib.Path(a.plan).read_text())
shots = plan["shots"]

fit_shots(shots, a.timing)

cfg = {k: v for k, v in plan.items() if k != "shots"}
cfg["shots"] = shots
if a.audio: cfg["audio"] = a.audio
props = {"cfg": cfg}
if a.size: w, h = a.size.lower().split("x"); props["size"] = [int(w), int(h)]
pathlib.Path(a.out).write_text(json.dumps(props, indent=1, ensure_ascii=False))
length = sum(s["dur"] for s in shots)
print(f"{len(shots)} shots, {length:.2f}s -> {a.out}")

if a.cues:
    cues, T = [], 0.0
    def c(kind, t, gain=0.5, dur=None): cues.append({"kind": kind, "t": round(t, 3), "gain": gain, **({"dur": round(dur, 3)} if dur else {})})
    for i, s in enumerate(shots):
        k, d = s["kind"], s["dur"]
        tr = s.get("in", "cut") if i else "cut"
        if tr == "iris": c("whoosh", T - 0.1, 0.45, 0.6)
        elif tr == "slide": c("paper", T, 0.55); c("whoosh", T - 0.05, 0.3, 0.5)
        elif tr == "flash": c("shutter", T, 0.7)
        if k == "scene":
            for tw in ([s["tornado"]] if s.get("tornado") else []) + s.get("tornadoes", []):
                life = tw.get("life") or {}
                if life.get("descend"): c("riser", T + life.get("at", 0), 0.35, life["descend"]); c("thud", T + life.get("at", 0) + life["descend"], 0.5)
            for lt in s.get("lightning", []): c("boom", T + lt, 0.55)
            for n in s.get("notes", []): c("pop" if n["kind"] != "measure" else "zip", T + n["t"], 0.4)
            if s.get("counter"): c("ticks", T + s["counter"]["t"], 0.35, 1.4)
            for e in s.get("events", []):
                at = T + e.get("at", 0)
                if e["kind"] == "quake": c("subdrop", at, 0.7); c("boom", at + 0.1, 0.5)
                elif e["kind"] == "volcano": c("boom", at, 0.65)
                elif e["kind"] == "meteor": c("whoosh", at, 0.5, 1.6); c("impact", at + 1.6, 0.7)
                elif e["kind"] == "wave": c("whoosh", at, 0.5, e.get("ramp", 3))
            if s.get("place"): c("pop", T + 0.4, 0.3)
        elif k == "viewfinder": c("click", T + 0.2, 0.3); c("shutter", T + s.get("flashAt", d - 0.3), 0.7)
        elif k == "polaroid": c("pop", T + 0.1, 0.45); c("pencil", T + 1.2, 0.35, min(2.0, len(s.get("caption", "")) * 0.07)); c("whoosh", T + d - 0.7, 0.45, 0.6)
        elif k == "notebook":
            c("paper", T, 0.4)
            if s.get("sketch"): c("pencil", T + 0.8, 0.45, 1.6)
            if s.get("sketch", {}).get("label"): c("pencil", T + 2.5, 0.35, len(s["sketch"]["label"]) * 0.07)
            if s.get("write"): c("pencil", T + 1.2, 0.35, len(s["write"]) * 0.07)
            if s.get("photo"): c("pop", T + 0.9, 0.4)
            for j in s.get("checks", []): c("tick", T + 1 + j * 0.3, 0.35)
        elif k == "scale":
            for j in range(len(s.get("items", []))): c("blip", T + 0.3 + j * 0.12, 0.25)
            c("impact", T + 0.6 + len(s.get("items", [])) * 0.12, 0.45)
        elif k == "waffle": c("ticks", T + 0.3, 0.3, 1.4); c("blipup", T + 1.8, 0.4)
        elif k == "panel": c("whoosh", T, 0.35, 0.6); c("click", T + 0.3, 0.3)
        elif k == "diagram": c("swell", T + 0.4, 0.3, 2.0)
        elif k == "newspaper": c("whoosh", T, 0.4, 0.8); c("thud", T + 0.85, 0.55)
        elif k == "map": c("marker", T + 0.6, 0.35, max(1.0, d - 1.5))
        elif k == "tv": c("glitch", T, 0.35)
        elif k == "card": c("paper", T + 0.2, 0.4)
        elif k == "number": c("ticks", T, 0.3, 1.1); c("impact", T + 1.1, 0.45)
        T += d
    cues = sorted([x for x in cues if x["t"] >= 0], key=lambda x: x["t"])
    pathlib.Path(a.cues).write_text(json.dumps(cues, indent=0))
    from collections import Counter
    print(f"{len(cues)} cues -> {a.cues}", dict(Counter(x['kind'] for x in cues)))
