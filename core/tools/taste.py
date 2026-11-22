#!/usr/bin/env python3
"""taste.py - the user's standing corrections as rules that run, not prose.

A note that should hold for every video becomes a line in `knowledge/taste.json` (a video folder can add its own
`taste.json`, passed to quality_gate with --taste). Each rule:
  {"id": "short-slug", "text": "the user's words or the rule in one line", "check": "<name>", "values": {...},
   "severity": "WARN" | "FAIL" (default WARN), "profiles": ["vlog", ...] (optional), "since": "YYYY-MM-DD", "from": "where it came from"}

Measured checks (they read quality_gate's report):
  loudness         {"lufs": -16, "tol": 1.0}         integrated loudness within tol of lufs
  still_share      {"max": 0.5}                      share of near-still moments
  cuts_per_min     {"min": 6, "max": 40}             cut rate range
  shot_length      {"max": 8.0, "min": 0.3}          every shot inside the range (seconds)
  silence          {"max": 1.2}                      no silence longer than max seconds
  hook             {"min": 5.0}                      picture change in the first 2 s
  no_burned_text   {}                                no OCR text found in the picture
  duration         {"min": 600, "max": 900}          seconds
Any other check name, or "look", is a rule a person (or the agent looking at stills) checks: it is listed under
"A human must still check" in the report, so it is met on every draft instead of being remembered.

Rules are defaults the user set; the user can change or drop them at any time (edit the file, or ask).

  python tools/taste.py list                 # every rule and how it is checked
  python tools/taste.py add --id ID --text "..." [--check NAME --values '{"max": 8}'] [--severity WARN] [--from "note"]
"""
import argparse, datetime, json, pathlib, sys

CORE = pathlib.Path(__file__).resolve().parents[1]
GLOBAL = CORE.parent / "knowledge" / "taste.json"


def load(extra=()):
    rules = []
    for f in [GLOBAL, *map(pathlib.Path, extra or [])]:
        if f.exists():
            d = json.loads(f.read_text(encoding="utf-8"))
            rules += d.get("rules", d) if isinstance(d, dict) else d
    return rules


def _range(v, lo, hi):
    return (lo is None or v >= lo) and (hi is None or v <= hi)


def evaluate(R, rules):
    """(severity, check, msg, fix, t) for every measured rule the report breaks."""
    out, prof = [], R.get("profile")
    for r in rules:
        if r.get("profiles") and prof and prof not in r["profiles"]: continue
        c, v, sev = r.get("check", "look"), r.get("values", {}), r.get("severity", "WARN")
        tag, fix = f"taste:{r.get('id', c)}", r["text"]
        if c == "loudness" and R.get("loudness", {}).get("lufs") is not None:
            L = R["loudness"]["lufs"]
            if abs(L - v.get("lufs", -16)) > v.get("tol", 1.0): out.append((sev, tag, f"loudness {L} LUFS, rule says {v.get('lufs', -16)}", fix, None))
        elif c == "still_share" and R.get("life"):
            x = R["life"]["still_share"]
            if x > v.get("max", 1): out.append((sev, tag, f"still share {x:.0%} > {v['max']:.0%}", fix, None))
        elif c == "cuts_per_min" and R.get("cuts_per_min") is not None:
            x = R["cuts_per_min"]
            if not _range(x, v.get("min"), v.get("max")): out.append((sev, tag, f"{x} cuts/min outside {v.get('min')}-{v.get('max')}", fix, None))
        elif c == "shot_length" and R.get("shot_lens"):
            t = 0.0
            for L in R["shot_lens"]:
                if not _range(L, v.get("min"), v.get("max")):
                    out.append((sev, tag, f"shot at {t:.1f} s lasts {L:.1f} s (rule {v.get('min', '-')}-{v.get('max', '-')} s)", fix, t))
                t += L
        elif c == "silence" and R.get("silences") is not None:
            for s, e in R["silences"]:
                if e - s > v.get("max", 1.2): out.append((sev, tag, f"silence {s:.1f}-{e:.1f} s", fix, s))
        elif c == "hook" and R.get("hook") is not None:
            if R["hook"] < v.get("min", 0): out.append((sev, tag, f"hook change {R['hook']} < {v['min']}", fix, 0.0))
        elif c == "no_burned_text" and R.get("burned_text"):
            out.append((sev, tag, f"{len(R['burned_text'])} text span(s) found in the picture", fix, R["burned_text"][0]["start"]))
        elif c == "duration" and R.get("streams"):
            d = R["streams"]["format"]
            if not _range(d, v.get("min"), v.get("max")): out.append((sev, tag, f"duration {d:.0f} s outside {v.get('min')}-{v.get('max')} s", fix, None))
    return out


MEASURED = {"loudness", "still_share", "cuts_per_min", "shot_length", "silence", "hook", "no_burned_text", "duration"}


def look_rules(rules):
    return [f"taste:{r.get('id')}: {r['text']}" for r in rules if r.get("check", "look") not in MEASURED]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    sp.add_parser("list")
    p = sp.add_parser("add"); p.add_argument("--id", required=True); p.add_argument("--text", required=True)
    p.add_argument("--check", default="look"); p.add_argument("--values", default="{}"); p.add_argument("--severity", default="WARN")
    p.add_argument("--from", dest="src", default=""); p.add_argument("--file", default=str(GLOBAL))
    a = ap.parse_args()
    if a.cmd == "list":
        for r in load():
            how = "measured" if r.get("check", "look") in MEASURED else "looked at"
            print(f"{r.get('id'):28} {how:9} {r.get('check', 'look'):14} {r['text']}")
        return
    f = pathlib.Path(a.file); d = json.loads(f.read_text()) if f.exists() else {"rules": []}
    d["rules"] = [r for r in d["rules"] if r.get("id") != a.id] + [{"id": a.id, "text": a.text, "check": a.check, "values": json.loads(a.values),
                  "severity": a.severity, "since": datetime.date.today().isoformat(), "from": a.src}]
    f.write_text(json.dumps(d, indent=1, ensure_ascii=False) + "\n"); print(f"{a.id}: saved in {f}")


if __name__ == "__main__":
    main()
