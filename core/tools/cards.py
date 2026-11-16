#!/usr/bin/env python
"""cards.py - the motion-graphic card library (core/styles/cards.json; components in src/kits/cards/Cards.tsx).

  python tools/cards.py list                       # styles (palette, type, motion) and cards (tier, purpose, slots)
  python tools/cards.py suggest --topic "tech review"  # styles whose `suits` match the topic words
  python tools/cards.py gallery [--out out/qa/cards_gallery.png]   # every card of every style on one sheet (LOOK at it)

Using a card: in a footage EDL overlay {"kind": "card", "card": "<id>", "style": "<style id>", "at": s | "word": "...",
"dur": s, "data": {slots}, "item_words": [...] (list cards: each item lands on its word)}. Tier 1 covers the frame
(stat, thesis, section, quote); tier 2 keeps the footage visible (label, list, lower, versus).
Adding a style: append to "styles" (palette bg/panel/fg/dim/accent[/accent2], fonts from FONT in shots/prims.tsx,
motion confident|snappy|calm|playful, texture grain|grid|glow|halftone, suits), run `gallery` and look."""
import argparse, json, pathlib, subprocess
C = pathlib.Path(__file__).resolve().parents[1]; R = json.loads((C / "styles/cards.json").read_text())
ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["list", "suggest", "gallery"]); ap.add_argument("--topic", default=""); ap.add_argument("--out", default="out/qa/cards_gallery.png")
a = ap.parse_args()
if a.cmd == "list":
    for s in R["styles"]: print(f"style {s['id']:14} {'dark ' if s['dark'] else 'light'} {s['fonts']['display']}/{s['fonts']['text']:9} motion={s['motion']:9} texture={s['texture']:8} suits={','.join(s['suits'])}")
    for c in R["cards"]: print(f"card  {c['id']:8} tier {c['tier']}  {c['purpose']}  slots={list(c['slots'])}")
elif a.cmd == "suggest":
    words = set(a.topic.lower().split())
    ranked = sorted(R["styles"], key=lambda s: -len(words & set(s["suits"])))
    for s in ranked: print(s["id"], len(words & set(s["suits"])), s["suits"])
else:
    subprocess.run(["npx", "remotion", "still", "src/index.ts", "CardGallery", a.out, "--frame", "0", "--scale", "0.6", "--log", "error"], cwd=C, check=True); print(a.out)
