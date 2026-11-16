#!/usr/bin/env python
"""align_script.py - forced alignment: OUR script's words placed on the narration (no transcription guesswork).

  python tools/align_script.py --script videos/x/script.txt --audio videos/x/narration.wav --out videos/x/timing.json [--lang en] [--lead 0.3] [--model small]

Whisper transcription writes numbers as digits, mishears names and drifts when its words differ from the script;
kit_timing then has to guess which heard word belongs to which written one. Forced alignment (stable-ts) skips the
guessing: it decodes the audio against the exact script text, so every written word gets its own start/end, spelled
numbers included. Output is the same timing.json the kits read (times on the video timeline = audio + lead).
script.txt: one narration line per paragraph (blank line between), or one per line."""
import argparse, json, pathlib, re, subprocess

ap = argparse.ArgumentParser()
ap.add_argument("--script", required=True); ap.add_argument("--audio", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--lang", default="en"); ap.add_argument("--lead", type=float, default=0.0); ap.add_argument("--tail", type=float, default=1.0)
ap.add_argument("--model", default="small")
a = ap.parse_args()

raw = pathlib.Path(a.script).read_text(encoding="utf-8")
paras = [p.strip().replace("\n", " ") for p in re.split(r"\n\s*\n", raw) if p.strip()]
if len(paras) == 1: paras = [l.strip() for l in raw.splitlines() if l.strip()]
counts = [len(p.split()) for p in paras]

import stable_whisper
try:
    model = stable_whisper.load_faster_whisper(a.model, device="cpu", compute_type="int8")
except Exception:                                   # openai-whisper backend as a fallback
    model = stable_whisper.load_model(a.model)
res = model.align(a.audio, " ".join(paras), language=a.lang)
words = [w for seg in res.segments for w in seg.words]

# stable-ts keeps the text's own tokens; map them back to script words (it may split "drive-in" or glue punctuation)
toks = [w.word.strip() for w in words]
script_words = " ".join(paras).split()
out_words, j, buf, t0 = [], 0, "", None
norm = lambda s: re.sub(r"\W", "", s.lower())
for w, tok in zip(words, toks):
    if not tok: continue
    if t0 is None: t0 = w.start
    buf += tok
    if j < len(script_words) and norm(buf) == norm(script_words[j]):
        out_words.append([script_words[j], round(t0 + a.lead, 3), round(w.end + a.lead, 3)]); j += 1; buf, t0 = "", None
    elif j < len(script_words) and len(norm(buf)) > len(norm(script_words[j])):   # tokenisation mismatch: take it as one word
        out_words.append([script_words[j], round(t0 + a.lead, 3), round(w.end + a.lead, 3)]); j += 1; buf, t0 = "", None
if len(out_words) != len(script_words):
    print(f"WARN aligned {len(out_words)} of {len(script_words)} words; missing ones get interpolated times")
    while len(out_words) < len(script_words):
        last = out_words[-1][2] if out_words else a.lead
        out_words.append([script_words[len(out_words)], last, last + 0.2])

dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.audio], capture_output=True, text=True).stdout.strip())
lines, k = [], 0
for i, (p, n) in enumerate(zip(paras, counts)):
    ws = out_words[k:k + n]; k += n
    lines.append({"id": i + 1, "text": p, "start": ws[0][1], "end": ws[-1][2], "words": ws})
json.dump({"duration": round(dur + a.lead + a.tail, 3), "lead": a.lead, "lang": a.lang, "aligner": "forced", "lines": lines}, open(a.out, "w"), indent=1, ensure_ascii=False)
print(f"timing: {a.out}  ({len(lines)} lines, {len(out_words)} words, {dur + a.lead + a.tail:.2f}s)")
for L in lines: print(f"  {L['id']:>3} {L['start']:7.2f}-{L['end']:7.2f}  {L['text'][:60]}")
