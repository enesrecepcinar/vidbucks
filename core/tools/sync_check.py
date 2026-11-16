#!/usr/bin/env python
"""sync_check.py - the sound is the master clock: prove that timing, narration and render agree before anyone watches.

  python tools/sync_check.py --timing videos/x/timing.json --audio videos/x/narration.wav [--lead 0.3] [--video out/x.mp4]

Checkpoints (FAIL blocks delivery, WARN needs a look):
  1 total      timing.duration vs the narration length (+ lead): within 0.5 s, and no line ends after the audio
  2 onset      the first spoken word in timing.json vs where speech really starts in the audio: within 0.15 s
               (catches a missing/extra lead, a renderer that delays AAC, a re-voiced file with a new head silence)
  3 order      line and word times only move forward and stay inside their lines; no line overlaps the next
  4 tail       the last line ends before the audio's last speech + 0.3 s (a cut-off or a stale timing file)
  5 render     (with --video) picture and sound streams of the delivered file match each other within 2 frames,
               and the file is as long as the timing (within 0.5 s)
Exit 1 on any FAIL. Run it after every re-voice, re-time or re-render."""
import argparse, json, pathlib, subprocess, sys
import numpy as np

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--timing", required=True); ap.add_argument("--audio", required=True); ap.add_argument("--video")
ap.add_argument("--lead", type=float, help="seconds the narration is delayed on the video timeline (default: timing.json lead)")
a = ap.parse_args()
T = json.loads(pathlib.Path(a.timing).read_text()); lead = a.lead if a.lead is not None else float(T.get("lead", 0.0))
rows = []
def add(sev, check, msg): rows.append((sev, check, msg))

def probe(path, stream):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", stream, "-show_entries", "stream=duration:format=duration", "-of", "json", path], capture_output=True, text=True)
    j = json.loads(r.stdout or "{}"); s = j.get("streams") or [{}]
    d = s[0].get("duration") or (j.get("format") or {}).get("duration")
    return float(d) if d else None

SR = 16000
y = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", a.audio, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout, np.float32)
adur = len(y) / SR
hop = int(0.01 * SR); rms = np.array([np.sqrt((y[i:i + hop] ** 2).mean() + 1e-12) for i in range(0, len(y) - hop, hop)])
db = 20 * np.log10(rms + 1e-9); ref = np.percentile(db, 95)
speech = db > ref - 30                                       # 10 ms frames within 30 dB of the loud speech
runs = np.convolve(speech.astype(int), np.ones(8, int), "same") >= 6   # >= 60 ms of sound = speech, not a click
on = (np.argmax(runs) * 0.01) if runs.any() else None
off = ((len(runs) - np.argmax(runs[::-1])) * 0.01) if runs.any() else None

lines = T.get("lines", [])
# 1 total
if abs(T.get("duration", 0) - (adur + lead)) > 0.5 and T.get("duration", 0) < adur + lead:
    add("FAIL", "total", f"timing says {T.get('duration')} s but the narration (+ lead {lead}) is {adur + lead:.2f} s: the picture would end before the voice")
elif abs(T.get("duration", 0) - (adur + lead)) > 1.5:
    add("WARN", "total", f"timing {T.get('duration')} s vs narration + lead {adur + lead:.2f} s (a long tail is fine if it is on purpose)")
else:
    add("OK", "total", f"timing {T.get('duration')} s, narration + lead {adur + lead:.2f} s")
late = [l["id"] for l in lines if l["end"] > adur + lead + 0.3]
if late: add("FAIL", "total", f"lines end after the audio: {late}")
# 2 onset
first = next((l["words"][0][1] for l in lines if l.get("words")), lines[0]["start"] if lines else None)
if on is not None and first is not None:
    dt = first - (on + lead)
    add("OK" if abs(dt) <= 0.15 else "FAIL", "onset", f"first word at {first:.2f} s on the timeline, speech starts at {on + lead:.2f} s (offset {dt:+.2f} s)" + ("" if abs(dt) <= 0.15 else ": wrong lead, a delayed audio track or a stale timing file"))
# 3 order
bad = []
for i, l in enumerate(lines):
    if l["end"] < l["start"]: bad.append(f"line {l['id']} ends before it starts")
    if i and l["start"] < lines[i - 1]["end"] - 0.05: bad.append(f"line {l['id']} starts {lines[i - 1]['end'] - l['start']:.2f} s before line {lines[i - 1]['id']} ends")
    W = l.get("words") or []
    if any(W[k][1] < W[k - 1][1] - 1e-3 for k in range(1, len(W))): bad.append(f"line {l['id']} words go backwards")
    if W and (W[0][1] < l["start"] - 0.05 or W[-1][2] > l["end"] + 0.05): bad.append(f"line {l['id']} words outside the line")
add("FAIL" if bad else "OK", "order", "; ".join(bad[:5]) if bad else f"{len(lines)} lines, times move forward")
# 4 tail
if off is not None and lines:
    dt = lines[-1]["end"] - (off + lead)
    add("OK" if dt <= 0.3 and dt >= -1.0 else "WARN", "tail", f"last line ends {lines[-1]['end']:.2f} s, last speech {off + lead:.2f} s ({dt:+.2f} s)")
# 5 render
if a.video:
    v, s = probe(a.video, "v:0"), probe(a.video, "a:0")
    fr = 1 / 30
    if v is None or s is None: add("FAIL", "render", f"missing stream: video {v}, audio {s}")
    else:
        add("OK" if abs(v - s) <= 2 * fr else "FAIL", "render", f"picture {v:.3f} s, sound {s:.3f} s ({(v - s) * 1000:+.0f} ms)")
        add("OK" if abs(v - T.get("duration", v)) <= 0.5 else "WARN", "render", f"file {v:.2f} s vs timing {T.get('duration')} s")
n = {k: sum(1 for r in rows if r[0] == k) for k in ("FAIL", "WARN")}
print(f"SYNC {'FAIL' if n['FAIL'] else 'PASS'}  fail={n['FAIL']} warn={n['WARN']}")
for sev, c, m in rows: print(f"  {sev:4} {c:7} {m}")
sys.exit(1 if n["FAIL"] else 0)
