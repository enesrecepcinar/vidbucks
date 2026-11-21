#!/usr/bin/env python
"""archive_build.py - turn an ArchiveDoc film plan into render props and sound cues, timed to the narration.

  python tools/archive_build.py videos/x/archive.json --timing videos/x/timing.json --out videos/x/props.json --cues videos/x/cues.json [--audio x/mix.m4a] [--size 1080x1920]

archive.json = { "shots": [ {kind, line?: <timing line id>, dur?, src?, ...}, ... ], "trans"?: 0.6 }.
Shots that name a `line` start on it (shared rules in shot_timing.py). Media must exist in public/ (checked here) and
must be licensed (CC0 / PD / CC BY / CC BY-SA / Pexels / Pixabay, credited in credits.json); `credit` puts a small source
tag on the shot. Cues: soft whoosh on dissolves, low hit on dips to black, paper on prints and documents, stamp on a
document stamp, typewriter keys on memo lines, ticks on counting numbers and bars, a pencil on the map route,
a soft pop on date tags. Then sfx_synth.py and mix_film.py as for every kit."""
import argparse, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from shot_timing import fit_shots

ap = argparse.ArgumentParser()
ap.add_argument("plan"); ap.add_argument("--timing"); ap.add_argument("--out", required=True); ap.add_argument("--cues")
ap.add_argument("--audio"); ap.add_argument("--size"); ap.add_argument("--public", default=str(pathlib.Path(__file__).resolve().parent.parent / "public"))
a = ap.parse_args()
plan = json.loads(pathlib.Path(a.plan).read_text())
shots = fit_shots(plan["shots"], a.timing)
pub = pathlib.Path(a.public)
missing = [p for s in shots for p in [s.get("src"), s.get("bg"), s.get("mapSrc"), (s.get("locator") or {}).get("mapSrc"), *[it.get("src") for it in s.get("items", []) if isinstance(it, dict)]] if p and not (pub / p).exists()]
if missing: sys.exit("missing media in public/: " + ", ".join(sorted(set(missing))))

cfg = {k: v for k, v in plan.items() if k != "shots"}
cfg["shots"] = shots
if a.audio: cfg["audio"] = a.audio
props = {"cfg": cfg}
if a.size: w, h = a.size.lower().split("x"); props["size"] = [int(w), int(h)]
pathlib.Path(a.out).write_text(json.dumps(props, indent=1, ensure_ascii=False))
print(f"{len(shots)} shots, {sum(s['dur'] for s in shots):.2f}s -> {a.out}")

if a.cues:
    cues, T = [], 0.0
    def c(kind, t, gain=0.5, dur=None): cues.append({"kind": kind, "t": round(max(0, t), 3), "gain": gain, **({"dur": round(dur, 3)} if dur else {})})
    for i, s in enumerate(shots):
        k, d, tr = s["kind"], s["dur"], (s.get("in", "cut") if i else "cut")
        if tr == "dissolve": c("whoosh", T - 0.2, 0.2, 0.6)
        elif tr == "black": c("thud", T, 0.35)
        if s.get("date"): c("pop", T + 0.4, 0.25)
        if s.get("locator"): c("pop", T + 0.5, 0.25)
        if k == "print": c("paper", T + 0.05, 0.35)
        elif k == "chapter": c("swell", T, 0.3, 1.2)
        elif k == "number": c("ticks", T + 0.1, 0.3, 1.1); c("impact", T + 1.2, 0.35)
        elif k == "doc":
            c("paper", T, 0.4)
            for j in range(len(s.get("lines", []))): c("keys", T + 0.4 + j * 0.25, 0.3, 0.22)
            if s.get("stamp"): c("stamp", T + 1.4, 0.55)
        elif k == "table": c("paper", T, 0.3); c("marker", T + 1.2, 0.3, 0.5)
        elif k == "bars":
            for j in range(len(s.get("items", []))): c("swell", T + 0.4 + j * 0.3, 0.2, 0.8)
        elif k == "calendar": c("ticks", T + 0.4, 0.3, 1.6); c("pop", T + 2.1, 0.4)
        elif k == "map":
            for rt in s.get("routes", []) + ([{"at": 0.8, "dur": 1.8}] if s.get("route") else []): c("whoosh", T + rt.get("at", 0.8), 0.3, rt.get("dur", 2)); c("pop", T + rt.get("at", 0.8) + rt.get("dur", 2), 0.3)
            for pn in s.get("pinsAt", []): c("pop", T + pn.get("at", 0.5), 0.3)
            for z in s.get("zones", []): c("swell", T + z.get("at", 0.5), 0.3, 1.0)
            cams = s.get("cam", [])
            for a0, b0 in zip(cams, cams[1:]):
                if abs(b0.get("z", 1) - a0.get("z", 1)) > 0.5: c("whoosh", T + a0["t"], 0.2, b0["t"] - a0["t"])
        elif k == "montage":
            n = max(1, len(s.get("items", [])))
            for j in range(1, n): c("shutter" if s.get("flash") else "thud", T + j * d / n, 0.3)
        elif k == "split":
            for j in range(len(s.get("items", []))): c("slide", T + j * 0.35, 0.3)
        elif k == "compare": c("paper", T + 0.2, 0.3); c("paper", T + 0.6, 0.3)
        elif k == "place": c("swell", T, 0.3, 1.5)
        elif k == "quote": c("swell", T + 0.2, 0.2, 1.0)
        T += d
    cues.sort(key=lambda x: x["t"])
    pathlib.Path(a.cues).write_text(json.dumps(cues, indent=0))
    from collections import Counter
    print(f"{len(cues)} cues -> {a.cues}", dict(Counter(x['kind'] for x in cues)))
