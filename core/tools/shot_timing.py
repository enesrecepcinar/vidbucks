"""shot_timing.py - shared by the shot-list kits (StormWorld, ArchiveDoc): fit shot durations to narration lines.

fit_shots(shots, timing_path): every shot that names a `line` starts on that line's start; a shot without a line keeps its
`dur` and pushes the next start; the first shot starts at 0 and the last runs to the timing's end. Exits with a clear
message on unknown or out-of-order lines and on shots shorter than `min_dur`. Removes the `line` keys."""
import json, pathlib, sys


def fit_shots(shots, timing_path=None, min_dur=1.2):
    if timing_path:
        tm = json.loads(pathlib.Path(timing_path).read_text())
        start = {ln["id"]: ln["start"] for ln in tm["lines"]}
        total, prev = tm["duration"], 0.0
        for i, s in enumerate(shots):
            if i > 0 and "line" in s:
                if s["line"] not in start: sys.exit(f"shot {i}: line {s['line']} is not in the timing")
                if start[s["line"]] < prev - 1e-6: sys.exit(f"shot {i}: line {s['line']} starts before an earlier shot's line")
                prev = start[s["line"]]
            elif i > 0 and "dur" not in s: sys.exit(f"shot {i}: give it a `line` or a `dur`")
        t = 0.0
        for i, s in enumerate(shots):
            nxt = next((start[shots[j]["line"]] for j in range(i + 1, len(shots)) if "line" in shots[j]), None)
            fixed = 0.0
            for k in range(i + 1, len(shots)):
                if "line" in shots[k]: break
                fixed += shots[k]["dur"]
            end = (nxt if nxt is not None else total) - fixed
            if "line" in s or i == 0: s["dur"] = round(max(0.0, end - t), 3)
            if s["dur"] < min_dur: sys.exit(f"shot {i} ({s['kind']}) is only {s['dur']:.2f}s long: merge it or move its line")
            t += s["dur"]
    for s in shots:
        s.pop("line", None)
        if "dur" not in s: sys.exit(f"a {s['kind']} shot has no dur")
    return shots
