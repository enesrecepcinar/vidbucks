#!/usr/bin/env python
"""chat_story.py - a text-message story as data -> a timed thread (+ optional voices) -> sound cues, for the ChatStory kit.

  python tools/chat_story.py plan videos/<n>/chat.json --out public/chat/<n>/chat.timed.json [--cues videos/<n>/cues.json]
         [--tts --voices am_michael,af_heart --audio public/chat/<n>/voices.wav] [--pace 1.0]

chat.json: {"title"?: "...", "contact": {"name": "Sam"}, "theme": "night" | "day", "accent": "blue" | "green" | "violet",
  "motion"?: "snappy", "messages": [{"from": "me" | "them" | "system", "text": "...", "typing"?: s, "delay"?: s, "reaction"?: "❤️"}]}

The thread plays as a drip, one message at a time: a read-gap after each bubble (reading time of the previous one, 25 chars/s,
0.4-2.0 s), a typing indicator before every received message (0.6-2.0 s by length; set "typing" to stretch a payoff), and
the composer types every sent message before it goes (14 chars/s, max 1.8 s). With --tts each message is also spoken (one
Kokoro voice per side) and the thread waits for the voice; the timed file gets "voice": [start, end] per message and the
audio is one wav on the video timeline. Everything after this (picture, cues) reads the timed file, so they cannot drift.
Fictional only: never put real people's messages or names in a chat story."""
import argparse, json, pathlib, sys

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
sp = ap.add_subparsers(dest="cmd", required=True)
p = sp.add_parser("plan"); p.add_argument("chat"); p.add_argument("--out", required=True); p.add_argument("--cues")
p.add_argument("--tts", action="store_true"); p.add_argument("--voices", default="am_michael,af_heart"); p.add_argument("--audio")
p.add_argument("--pace", type=float, default=1.0, help="> 1 = faster thread (all gaps divided by it)")
a = ap.parse_args()

C = json.loads(pathlib.Path(a.chat).read_text())
clamp = lambda x, lo, hi: max(lo, min(hi, x))
SR = 24000
voices = {}
if a.tts:
    import numpy as np, soundfile as sf
    from kokoro import KPipeline
    pipe = KPipeline(lang_code="a")
    vme, vthem = a.voices.split(",")
    def speak(text, voice):
        parts = [au for _, _, au in pipe(text, voice=voice, speed=1.05)]
        return np.concatenate([x.numpy() if hasattr(x, "numpy") else x for x in parts]) if parts else np.zeros(1)

cursor = 0.4 + (1.6 if C.get("title") else 0.0)          # a title card first, if there is one
out, prev, track = [], None, []
for i, m in enumerate(C["messages"]):
    frm, text = m.get("from", "them"), m["text"]
    read = clamp(len(prev["text"]) / 25, 0.4, 2.0) if prev else 0.3
    cursor += (m.get("delay", read)) / a.pace
    e = {**m, "from": frm}
    if frm == "them":
        typ = m.get("typing", clamp(len(text) / 22, 0.6, 2.0)) / a.pace
        e["typingAt"] = round(cursor, 3); cursor += typ
    elif frm == "me":
        typ = clamp(len(text) / 14, 0.5, 1.8) / a.pace
        e["typeFrom"] = round(cursor, 3); cursor += typ
    e["at"] = round(cursor, 3)
    if a.tts and frm in ("me", "them"):
        au = speak(text, vme if frm == "me" else vthem); d = len(au) / SR
        e["voice"] = [round(cursor + 0.05, 3), round(cursor + 0.05 + d, 3)]; track.append((cursor + 0.05, au))
        cursor += 0.05 + d + 0.15
    else:
        cursor += 0.25
    if m.get("reaction"): e["reactAt"] = round(e["at"] + 0.6, 3)
    out.append(e); prev = m
duration = round(cursor + 2.0, 2)
T = {k: v for k, v in C.items() if k != "messages"}; T.update({"messages": out, "duration": duration})
if a.tts:
    import numpy as np, soundfile as sf
    buf = np.zeros(int((duration + 1) * SR), np.float32)
    for t0, au in track:
        i0 = int(t0 * SR); buf[i0:i0 + len(au)] += au[: len(buf) - i0]
    ap_ = pathlib.Path(a.audio or pathlib.Path(a.out).with_name("voices.wav")); ap_.parent.mkdir(parents=True, exist_ok=True)
    sf.write(ap_, buf[: int(duration * SR)], SR); T["audio"] = ap_.name
pathlib.Path(a.out).parent.mkdir(parents=True, exist_ok=True)
pathlib.Path(a.out).write_text(json.dumps(T, ensure_ascii=False, indent=1))
print(f"chat: {len(out)} messages, {duration:.1f} s -> {a.out}" + (f" (+ voices {T['audio']})" if a.tts else ""))

if a.cues:   # one sound per visible action: composer keys, send, receive, reaction
    cues = []
    for e in out:
        if e["from"] == "me":
            cues.append({"kind": "ticks", "t": e["typeFrom"], "gain": 0.22, "dur": round(e["at"] - e["typeFrom"], 2)})
            cues.append({"kind": "pop", "t": e["at"], "gain": 0.5})
        elif e["from"] == "them":
            cues.append({"kind": "glock", "t": e["at"], "gain": 0.4})
        else:
            cues.append({"kind": "tap", "t": e["at"], "gain": 0.3})
        if e.get("reactAt"): cues.append({"kind": "chime", "t": e["reactAt"], "gain": 0.3})
    pathlib.Path(a.cues).write_text(json.dumps(cues, indent=0)); print(f"cues: {len(cues)} -> {a.cues}")
