#!/usr/bin/env python
"""footage.py - edit raw footage by its words: transcript in, cut list (EDL) out, one-pass render, verified.

  python tools/footage.py transcribe <videos_dir> [--lang en] [--model small]     # cached per source
  python tools/footage.py pack       <videos_dir> [--break 0.5]                   # edit/takes_packed.md (the reading view)
  python tools/footage.py tighten    <videos_dir> [--keep-gap 0.25] [--fillers] [--retakes]   # first-draft edit/edl.json
  python tools/footage.py render     <videos_dir> [--edl edit/edl.json] [--out edit/cut.mp4] [--preview] [--lufs -16]
  python tools/footage.py verify     <videos_dir> [--cut edit/cut.mp4]                         # words whole, duration, loudness
  python tools/footage.py finish     <videos_dir> [--captions sentence|bold|none] [--out edit/final.mp4]   # captions + overlays (Remotion), sound muxed back
  python tools/footage.py highlights <videos_dir> [--duration 45] [--aspect 9:16] [--count 1]   # long -> short: edit/highlights.md + edit/edl_short*.json
  (render/verify/finish take --edl / --cut to work on a short: render --edl edit/edl_short.json --out edit/short.mp4)
  python tools/footage.py broll      <videos_dir> [--cut edit/cut.mp4] [--density light|medium|heavy] [--mode auto|full|panel|split] [--era 1950s]
      -> edit/broll.json (slots anchored to words) + edit/broll_visuals.json for media_hunt:
         python tools/media_hunt.py hunt --visuals <dir>/edit/broll_visuals.json   (LOOK at every sheet)
         python tools/media_hunt.py pick --visuals <dir>/edit/broll_visuals.json --line <slot> --index <n>
      finish then lays every picked slot over the cut (full cutaway, side panel, or split on 9:16); unpicked slots are skipped
  Music: "music": {"src": "path/track.wav", "start": 0, "bpm": null, "snap": true, "music_db": -14} in the EDL -> finish
      maps its beats (tools/beatmap.py), moves cards / B-roll / titles onto the nearest beat or hit (<= 0.15 s; small
      panel cards <= 0.10 s) and mixes it under the voice (ducked, -16 LUFS).
Reframe: an EDL with "aspect": "9:16" (or 1:1, 4:5) crops every segment with a virtual camera that follows the
subject (faces via YuNet in core/models/yunet, else motion/detail): it holds inside a dead zone and pans no faster
than a camera operator would, so the vertical cut keeps the speaker in frame without jitter.

Layout (all outputs in <videos_dir>/edit/, sources untouched):
  transcripts/<name>.json   word times (faster-whisper, verbatim, cached by size+mtime)
  takes_packed.md           phrase lines "[start-end] text" per source; phrases break on silence >= 0.5 s
  edl.json                  {"sources": {"id": "path"}, "segments": [{"src", "start", "end", "beat"?, "why"?, "zoom"?}], "pad": [0.05, 0.08], "fade": 0.03, "jump_zoom": 1.1}
  cut.mp4 + cut.json        the render and its output-timeline words (captions and overlays read cut.json)
Rules the render enforces: every edge snaps to a word boundary (never inside a word), padded 30-200 ms but never
into a neighbouring word; 30 ms audio fades at every join; ONE encode for the whole cut (per-segment encodes drift
lip sync by a frame at some joins); captions/overlays are a later layer (Remotion FootageEdit), never baked here."""
import argparse, json, math, pathlib, re, subprocess, sys

VIDEO_EXT = {".mp4", ".mov", ".mkv", ".m4v", ".webm", ".avi"}
FILLERS = {"um", "uh", "erm", "uhm", "hmm", "mm", "ah", "eh", "ee", "ıı", "şey", "yani"}

def sh(cmd, **k): return subprocess.run(cmd, check=True, capture_output=True, text=True, **k)
def probe(p):
    j = json.loads(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", str(p)]).stdout)
    v = next((s for s in j["streams"] if s.get("codec_type") == "video"), {}); n, d = (v.get("r_frame_rate") or "30/1").split("/")
    return {"duration": float(j["format"]["duration"]), "w": v.get("width"), "h": v.get("height"), "fps": float(n) / float(d)}
def sources(vd): return sorted(p for p in vd.iterdir() if p.suffix.lower() in VIDEO_EXT and p.is_file())
def edit_dir(vd): d = vd / "edit"; d.mkdir(exist_ok=True); return d
def load_tr(vd, name): return json.loads((edit_dir(vd) / "transcripts" / f"{name}.json").read_text())
def norm(w): return re.sub(r"[^\w]", "", w.lower())

# ------------------------------------------------------------------ transcribe
def cmd_transcribe(a):
    vd = pathlib.Path(a.dir); td = edit_dir(vd) / "transcripts"; td.mkdir(exist_ok=True); model = None
    for src in sources(vd):
        out = td / f"{src.stem}.json"; st = src.stat()
        if out.exists():
            old = json.loads(out.read_text())
            if old.get("size") == st.st_size and old.get("mtime") == int(st.st_mtime): print("cached", src.name); continue
        wav = td / f"{src.stem}.16k.wav"
        sh(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000", str(wav)])
        if model is None:
            from faster_whisper import WhisperModel
            model = WhisperModel(a.model, device="cpu", compute_type="int8")
        segs, info = model.transcribe(str(wav), language=a.lang, word_timestamps=True, vad_filter=False, condition_on_previous_text=False,
                                      initial_prompt="Umm, uh, let me think, like, hmm. Okay, so, uh.")   # keeps fillers verbatim
        words = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3), "p": round(w.probability, 3)} for s in segs for w in s.words if w.word.strip()]
        wav.unlink(missing_ok=True)
        out.write_text(json.dumps({"source": src.name, "size": st.st_size, "mtime": int(st.st_mtime), "lang": info.language, **probe(src), "words": words}, ensure_ascii=False))
        print(f"transcribed {src.name}: {len(words)} words")

# ------------------------------------------------------------------ phrases + packed view
def phrases(words, brk):
    out, cur = [], []
    for w in words:
        if cur and w["s"] - cur[-1]["e"] >= brk: out.append(cur); cur = []
        cur.append(w)
    if cur: out.append(cur)
    return out

def cmd_pack(a):
    vd = pathlib.Path(a.dir); lines = ["# Packed transcripts (phrases break on silence >= %.2f s)\n" % a.brk]
    for src in sources(vd):
        T = load_tr(vd, src.stem); ph = phrases(T["words"], a.brk)
        lines.append(f"## {src.stem}  (duration {T['duration']:.1f}s, {len(ph)} phrases, {len(T['words'])} words)")
        for p in ph: lines.append(f"  [{p[0]['s']:07.2f}-{p[-1]['e']:07.2f}] " + " ".join(w["w"] for w in p))
        lines.append("")
    (edit_dir(vd) / "takes_packed.md").write_text("\n".join(lines)); print(edit_dir(vd) / "takes_packed.md")

# ------------------------------------------------------------------ first-draft EDL: keep phrases, drop dead air (and optionally fillers/retakes)
def cmd_tighten(a):
    vd = pathlib.Path(a.dir); segs, srcs = [], {}
    for src in sources(vd):
        T = load_tr(vd, src.stem); srcs[src.stem] = str(src.relative_to(edit_dir(vd).parent)) if src.is_relative_to(vd) else str(src)
        ph = phrases(T["words"], a.brk)
        if a.fillers:    # a filler phrase standing alone between silences goes; fillers inside a phrase stay (cutting them clips words)
            ph = [p for p in ph if not all(norm(w["w"]) in FILLERS for w in p)]
        if a.retakes:    # a phrase restarted with the same first words: keep the LAST take
            keep = []
            for p in ph:
                head = " ".join(norm(w["w"]) for w in p[:3])
                if keep and len(p) >= 3 and " ".join(norm(w["w"]) for w in keep[-1][:3]) == head: keep[-1] = p
                else: keep.append(p)
            ph = keep
        for p in ph: segs.append({"src": src.stem, "start": p[0]["s"], "end": p[-1]["e"], "quote": " ".join(w["w"] for w in p)[:80]})
    # merge phrases whose gap is already short (no point cutting there)
    merged = []
    for s in segs:
        if merged and merged[-1]["src"] == s["src"] and s["start"] - merged[-1]["end"] <= a.keep_gap: merged[-1]["end"] = s["end"]; merged[-1]["quote"] += " / " + s["quote"]
        else: merged.append(dict(s))
    edl = {"sources": srcs, "segments": merged, "pad": [0.05, 0.08], "fade": 0.03, "keep_gap": a.keep_gap, "jump_zoom": 1.1,
           "note": "first draft from silences; read takes_packed.md, reorder/drop segments by story beat, then render"}
    out = edit_dir(vd) / "edl.json"; out.write_text(json.dumps(edl, indent=1, ensure_ascii=False))
    total = sum(s["end"] - s["start"] for s in merged)
    print(f"{out}: {len(merged)} segments, ~{total:.1f}s kept")

# ------------------------------------------------------------------ picture/sound signals (shared by highlights and reframe)
def gray_frames(src, fps, w, start=0.0, dur=None):
    m = probe(src); h = int(round(w * m["h"] / m["w"] / 2) * 2)
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{start}", "-i", str(src)] + (["-t", f"{dur}"] if dur else []) + ["-vf", f"fps={fps},scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    import numpy as np
    raw = subprocess.run(cmd, capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)

def picture_cuts(src):
    import numpy as np
    f = gray_frames(src, 5, 96).mean(axis=3).astype(np.float32); d = np.r_[0, np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))]; cuts = []
    for i in range(1, len(d)):
        lo, hi = max(1, i - 6), min(len(d), i + 7); loc = np.median(np.r_[d[lo:i], d[i + 1:hi]])
        if d[i] > 8 and d[i] > 3.5 * (loc + 0.5) and (not cuts or i / 5 - cuts[-1] > 0.6): cuts.append(round(i / 5, 2))
    return cuts

def bin_scores(src, step=0.5):
    """per `step` seconds: motion, sharpness, darkness, loudness relative to the surrounding 20 s"""
    import numpy as np
    fr = gray_frames(src, 1 / step, 64).astype(np.float32); g = fr.mean(axis=3)
    motion = np.r_[0, np.abs(np.diff(g, axis=0)).mean(axis=(1, 2))]
    sharp = np.array([np.abs(np.diff(x, axis=0)).mean() + np.abs(np.diff(x, axis=1)).mean() for x in g])
    dark = (g.mean(axis=(1, 2)) < 35).astype(np.float32)
    pcm = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", str(src), "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], capture_output=True).stdout, np.int16).astype(np.float32)
    n = int(8000 * step); k = min(len(g), len(pcm) // n)
    db = np.array([20 * np.log10(np.sqrt((pcm[i * n:(i + 1) * n] ** 2).mean()) + 1) for i in range(k)])
    w = int(10 / step); rel = np.array([db[i] - np.median(db[max(0, i - w):i + w + 1]) for i in range(k)])
    z = lambda x: (x - x.mean()) / (x.std() + 1e-6)
    m = min(k, len(motion))
    return 0.35 * z(motion[:m]) + 0.35 * z(rel[:m]) + 0.2 * z(sharp[:m]) - 0.6 * dark[:m]

_YUNET = None
def faces(img):
    """[(cx, cy, size, score)] in pixels of img (RGB uint8), via YuNet when its model is present"""
    global _YUNET
    import cv2
    model = pathlib.Path(__file__).resolve().parents[1] / "models/yunet/face_detection_yunet_2023mar.onnx"
    if not model.exists(): return []
    h, w = img.shape[:2]
    if _YUNET is None: _YUNET = cv2.FaceDetectorYN_create(str(model), "", (w, h), 0.7)
    _YUNET.setInputSize((w, h)); _, det = _YUNET.detect(cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    return [] if det is None else [(d[0] + d[2] / 2, d[1] + d[3] / 2, max(d[2], d[3]), d[-1], (d[10], d[11], d[12], d[13]), (d[0], d[1], d[2], d[3])) for d in det]

def active_speaker(frames, fps, speech, sx, env=None):
    """who is talking, frame by frame, decided over the WHOLE segment (we work offline):
    1. faces are tracked by position; per frame each track gets a score = 0.5 * correlation of its mouth motion with
       the voice envelope over 2 s (the speaker's mouth moves with the syllables; a head turn or a nod does not)
       + 0.5 * its mouth motion minus head motion (capped); camera moves are cancelled by aligning the previous frame;
       frames without speech score 0
    2. scores are smoothed over a centred 1 s window
    3. Viterbi picks the speaker sequence: the score of the chosen face minus a cost for every switch
    4. no speaker shot shorter than 1.2 s (an editor does not cut for a cough or a nod)
    returns [(x_px or None, track_id or None)] per frame"""
    import numpy as np, cv2
    n = len(frames); tracks, prevg = [], None; N = int(2 * fps)
    for i, f in enumerate(frames):
        g = f.mean(axis=2).astype(np.float32); dets = faces(f); seen = set()
        if prevg is not None:
            (dx, dy), _ = cv2.phaseCorrelate(prevg, g)
            if abs(dx) + abs(dy) > 0.3: prevg = cv2.warpAffine(prevg, np.float32([[1, 0, dx], [0, 1, dy]]), (g.shape[1], g.shape[0]), borderMode=cv2.BORDER_REPLICATE)
        for d in dets:
            x, y, size = d[0], d[1], d[2]
            t = min((t for t in tracks if t["id"] not in seen and abs(t["x"][-1][1] - x) < 0.6 * size and abs(t["y"] - y) < 0.6 * size), key=lambda t: abs(t["x"][-1][1] - x), default=None)
            if t is None: t = {"id": len(tracks), "x": [], "y": y, "raw": {}}; tracks.append(t)
            t["x"].append((i, x)); t["y"] = y; seen.add(t["id"])
            if prevg is not None:
                rx, ry, lx, ly = d[4]; mw = max(6, abs(lx - rx) * 1.6); mx, my = (rx + lx) / 2, (ry + ly) / 2 + mw * 0.15; fx, fy, fw, fh = d[5]
                box = lambda x0, y0, x1, y1: (slice(max(0, int(y0)), max(1, int(y1))), slice(max(0, int(x0)), max(1, int(x1))))
                mb = box(mx - mw / 2, my - mw * 0.35, mx + mw / 2, my + mw * 0.45); eb = box(fx + fw * 0.15, fy + fh * 0.2, fx + fw * 0.85, fy + fh * 0.45)
                mouth = float(np.abs(g[mb] - prevg[mb]).mean()) if g[mb].size else 0.0
                head = float(np.abs(g[eb] - prevg[eb]).mean()) if g[eb].size else 0.0
                t["raw"][i] = max(0.0, mouth - head) if mouth > 1.2 * head + 0.5 else 0.0   # a turning head moves the mouth box too: count only motion concentrated in the mouth
        prevg = g
    if not tracks: return [(None, None)] * n
    T = len(tracks); S = np.full((T, n), -1.0)               # -1: face not visible in that frame
    for k, t in enumerate(tracks):
        frames_seen = sorted(set(i for i, _ in t["x"]))
        for i in frames_seen:
            if not speech[i]: S[k, i] = 0.0; continue
            r = t["raw"].get(i, 0.0); act = min(r, 3.0) / 3.0; c = 0.0
            if env is not None:
                h = [(t["raw"][j], env[j]) for j in range(max(0, i - N + 1), i + 1) if j in t["raw"] and j < len(env)]
                if len(h) >= 8:
                    a = np.array([q[0] for q in h]); b = np.array([q[1] for q in h])
                    if a.std() > 1e-6 and b.std() > 1e-6: c = max(0.0, float(np.corrcoef(a, b)[0, 1]))
            S[k, i] = 0.5 * c + 0.5 * act
    w = max(1, int(fps)); ker = np.ones(w) / w                 # centred 1 s smoothing (visible frames only)
    Sm = np.array([np.where(S[k] < 0, -1.0, np.convolve(np.clip(S[k], 0, None), ker, "same")) for k in range(T)])
    import os
    if os.environ.get("SPK_DEBUG"):
        for k, t in enumerate(tracks): print(f"track {k} x~{np.median([x for _, x in t['x']]) * sx:.0f} frames {len(t['x'])} S {np.round(np.where(S[k] < 0, np.nan, S[k])[:30], 2).tolist()}")
    switch = 0.6                                                # Viterbi: maximise the chosen face's score, pay for every switch
    score = np.where(Sm[:, 0] < 0, -5.0, Sm[:, 0]); back = np.zeros((T, n), int)
    for i in range(1, n):
        cand = score[None, :] - switch * (1 - np.eye(T))       # [to, from]
        back[:, i] = cand.argmax(axis=1); score = cand.max(axis=1) + np.where(Sm[:, i] < 0, -5.0, Sm[:, i])
    path = [int(score.argmax())]
    for i in range(n - 1, 0, -1): path.append(int(back[path[-1], i]))
    path = path[::-1]
    xs = {k: dict(t["x"]) for k, t in enumerate(tracks)}
    def xat(k, i):
        if i in xs[k]: return xs[k][i]
        near = min(xs[k], key=lambda j: abs(j - i)); return xs[k][near]
    res = [(xat(k, i) * sx, k) for i, k in enumerate(path)]
    hold = int(1.2 * fps); changed = True                       # minimum speaker shot
    while changed:
        changed = False; runs, i = [], 0
        while i < len(res):
            j = i
            while j + 1 < len(res) and res[j + 1][1] == res[i][1]: j += 1
            runs.append((i, j)); i = j + 1
        for r, (i, j) in enumerate(runs):
            if j - i + 1 < hold and len(runs) > 1:
                ni = runs[r - 1][0] if r > 0 else runs[r + 1][0]; k = res[ni][1]
                for q in range(i, j + 1): res[q] = (xat(k, q) * sx, k)
                changed = True; break
    return res

def camera_track(src, s, e, aspect, words=None):
    """crop-window x (source px) over the segment: subject from faces (else motion + detail), a dead zone, a pan limit.
    returns (crop_w, crop_h, keys [(t, x)]) with t relative to the segment start"""
    import numpy as np
    m = probe(src); W0, H0 = m["w"], m["h"]; aw, ah = map(int, aspect.split(":"))
    cw = min(W0, int(round(H0 * aw / ah / 2) * 2)); ch = H0 if cw < W0 else min(H0, int(round(W0 * ah / aw / 2) * 2))
    if cw >= W0: return cw, ch, [(0.0, 0.0)]
    fps = 10; frames = gray_frames(src, fps, 480, start=s, dur=max(0.4, e - s)); sx = W0 / 480
    speech = [any(w["s"] - 0.1 <= s + i / fps <= w["e"] + 0.1 for w in words) for i in range(len(frames))] if words else [True] * len(frames)
    pcm = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{s}", "-i", str(src), "-t", f"{max(0.4, e - s)}", "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], capture_output=True).stdout, np.int16).astype(np.float32)
    hop = int(8000 / fps); env = np.array([np.sqrt((pcm[k * hop:(k + 1) * hop] ** 2).mean() + 1) for k in range(len(pcm) // hop)])
    env = np.r_[0, np.abs(np.diff(np.log(env)))] if len(env) > 1 else env      # syllable-rate changes, not the level
    spk = active_speaker(frames, fps, speech, sx, env)
    subj, prev, ids = [], None, []
    for i, f in enumerate(frames):
        if spk[i][0] is not None:
            subj.append((spk[i][0], 1.0)); ids.append(spk[i][1])
        else:
            g = f.mean(axis=2)
            if prev is not None:
                d = np.abs(g - prev); col = d.sum(axis=0) + 0.3 * np.abs(np.diff(g, axis=0)).sum(axis=0)
                x = (col * np.arange(len(col))).sum() / (col.sum() + 1e-6) * sx
                subj.append((0.6 * x + 0.4 * W0 / 2, 0.3))
            else: subj.append((W0 / 2, 0.1))
            prev = g
            ids.append(None)
    if not subj: return cw, ch, [(0.0, (W0 - cw) / 2)]
    dead, vmax = 0.08 * cw, 0.45 * cw            # px: hold inside the dead zone; pan at most ~half a frame width a second
    cx = subj[0][0]; path = []; last_id = ids[0] if ids else None
    for i, (x, conf) in enumerate(subj):
        err = x - cx
        if ids[i] is not None and last_id is not None and ids[i] != last_id and abs(err) > 0.35 * cw:   # far speaker change: cut, don't pan
            if path: path.append((i / fps - 0.001, path[-1][1]))
            cx = x; path.append((i / fps, float(np.clip(cx - cw / 2, 0, W0 - cw)))); last_id = ids[i]; continue
        if ids[i] is not None: last_id = ids[i]
        if abs(err) > dead:
            step = np.clip((abs(err) - dead) * 0.35 * conf + 0.0, 0, vmax / fps); cx += np.sign(err) * step
        path.append((i / fps, float(np.clip(cx - cw / 2, 0, W0 - cw))))
    keys = [path[0]]                               # thin to the keys that matter (direction changes, every ~1 s while moving)
    for i in range(1, len(path) - 1):
        a, b, c = path[i - 1][1], path[i][1], path[i + 1][1]
        jump = path[i + 1][0] - path[i][0] < 0.01 or path[i][0] - path[i - 1][0] < 0.01
        if jump or (b - a) * (c - b) < 0 or (abs(b - keys[-1][1]) > 2 and path[i][0] - keys[-1][0] >= 1.0): keys.append(path[i])
    keys.append(path[-1])
    return cw, ch, [(round(t, 3), round(x, 1)) for t, x in keys]

def piecewise(keys):
    """ffmpeg expression in t for a piecewise-linear path"""
    if len(keys) == 1: return f"{keys[0][1]}"
    expr = f"{keys[-1][1]}"
    for (t0, x0), (t1, x1) in reversed(list(zip(keys, keys[1:]))):
        expr = f"if(lt(t\\,{t1})\\,{x0}+({x1 - x0})*(t-{t0})/{max(1e-3, t1 - t0)}\\,{expr})"
    return f"if(lt(t\\,{keys[0][0]})\\,{keys[0][1]}\\,{expr})"

# ------------------------------------------------------------------ highlights: long -> short
def cmd_highlights(a):
    import numpy as np
    vd = pathlib.Path(a.dir); ed = edit_dir(vd); rows = []
    for src in sources(vd):
        T = load_tr(vd, src.stem); sc = bin_scores(src); cuts = picture_cuts(src); ph = phrases(T["words"], a.brk)
        mean = lambda s0, e0: float(sc[int(s0 / 0.5):max(int(s0 / 0.5) + 1, int(e0 / 0.5))].mean()) if int(s0 / 0.5) < len(sc) else -9
        for i in range(len(ph)):
            for j in range(i, min(len(ph), i + 5)):
                s0, e0 = ph[i][0]["s"], ph[j][-1]["e"]; d = e0 - s0
                if d < a.min_shot: continue
                if d > a.max_shot: break
                text = " ".join(w["w"] for p in ph[i:j + 1] for w in p)
                if any(s0 + 0.3 < c < e0 - 0.3 for c in cuts) and not a.allow_cuts: continue
                rate = sum(len(p) for p in ph[i:j + 1]) / d
                bonus = 0.25 * bool(re.search(r"[?!]|\d", text)) + 0.1 * min(rate / 3.0, 1.0)
                rows.append({"src": src.stem, "start": s0, "end": e0, "score": round(mean(s0, e0) + bonus, 3), "text": text})
    rows.sort(key=lambda r: -r["score"])
    lines = ["# Highlight candidates (best first)", "", "| score | src | time | text |", "|---|---|---|---|"]
    lines += [f"| {r['score']:.2f} | {r['src']} | {r['start']:.1f}-{r['end']:.1f} | {r['text'][:110]} |" for r in rows[:30]]
    (ed / "highlights.md").write_text("\n".join(lines) + "\n")
    used = []
    for n in range(a.count):
        pick, total = [], 0.0
        for r in rows:
            if total >= a.duration: break
            if any(r["src"] == u["src"] and r["start"] < u["end"] + 1.0 and r["end"] > u["start"] - 1.0 for u in used + pick): continue
            if total + (r["end"] - r["start"]) > a.duration * 1.15: continue
            pick.append(r); total += r["end"] - r["start"]
        if not pick: break
        used += pick; best = max(pick, key=lambda r: r["score"]); pick.sort(key=lambda r: (r["src"], r["start"]))
        if a.hook_first: pick.remove(best); pick.insert(0, best)        # the strongest moment opens the short
        srcs = {r["src"]: str(next(p for p in sources(vd) if p.stem == r["src"]).relative_to(vd)) for r in pick}
        edl = {"sources": srcs, "segments": [{"src": r["src"], "start": r["start"], "end": r["end"], "why": f"score {r['score']}", "quote": r["text"][:80]} for r in pick],
               "pad": [0.05, 0.08], "fade": 0.03, "aspect": a.aspect, "jump_zoom": 1.0, "note": "auto highlights; reorder for a hook first, check every pick reads on its own"}
        out = ed / ("edl_short.json" if n == 0 else f"edl_short{n + 1}.json"); out.write_text(json.dumps(edl, indent=1, ensure_ascii=False))
        print(f"{out}: {len(pick)} moments, {total:.1f}s")
    print(ed / "highlights.md")

# ------------------------------------------------------------------ B-roll: slots from the words, media via media_hunt
STOP_ABSTRACT = {"thing", "things", "way", "ways", "problem", "problems", "matter", "lot", "kind", "part", "place", "fact", "idea", "story", "time", "day", "today", "everything", "something", "nothing",
                 "hundred", "hundreds", "thousand", "thousands", "dozen", "dozens", "million", "millions", "number", "meaning", "task", "need", "needs", "result", "staff", "trend", "trends", "force", "forces"}
PEOPLE = {"man", "men", "woman", "women", "person", "people", "guy", "friend", "friends", "neighbor", "neighbors", "family", "families", "child", "children", "kid", "kids", "consultant", "manager", "boss", "staff", "member", "members"}   # B-roll shows things and places, not private faces

def phrase_chunks(text, lang):
    """concrete noun phrases worth a picture, best first"""
    if lang == "en":
        try:
            import spacy
            global _NLP
            if "_NLP" not in globals(): _NLP = spacy.load("en_core_web_sm")
            out = []
            for ch in _NLP(text).noun_chunks:
                root = ch.root; lem = root.lemma_.lower()
                if root.pos_ not in ("NOUN", "PROPN") or root.ent_type_ in ("PERSON", "NORP") or lem in STOP_ABSTRACT or root.text.lower() in STOP_ABSTRACT or lem in PEOPLE or root.text.lower() in PEOPLE: continue
                mods = [t for t in ch if t.i < root.i and not t.is_stop and t.pos_ in ("NOUN", "PROPN", "ADJ")][-2:]
                q = " ".join([t.text for t in mods] + [root.text])
                score = 1 + len(mods) * 0.6 + (1.0 if root.pos_ == "PROPN" else 0) + (0.4 if root.tag_ in ("NNS", "NNPS") else 0) + (0.8 if root.ent_type_ in ("GPE", "LOC", "FAC") else 0)
                out.append((score, q, ch.start_char))
            return [(q, pos) for sc, q, pos in sorted(out, key=lambda x: -x[0])]
        except Exception: pass
    words = re.findall(r"[\wçğıöşüÇĞİÖŞÜ]{5,}", text)
    return [(w, text.find(w)) for w in sorted(words, key=len, reverse=True)[:3]]

def cmd_broll(a):
    vd = pathlib.Path(a.dir); ed = edit_dir(vd); cut = pathlib.Path(a.cut) if a.cut else ed / "cut.mp4"; meta = json.loads(cut.with_suffix(".json").read_text())
    E = json.loads((ed / "edl.json").read_text()) if (ed / "edl.json").exists() else {}
    words, dur = meta["words"], meta["duration"]; vertical = meta["size"][1] > meta["size"][0]
    mode = a.mode if a.mode != "auto" else ("split" if vertical else "full")
    gap = {"light": 20.0, "medium": 12.0, "heavy": 8.0}[a.density]; target = max(1, round(dur / gap))
    # keep-out: the hook, the tail, and every overlay that needs the face or the frame (cards, names, titles)
    busy = [(0, 2.0), (dur - 1.5, dur)]
    for o in E.get("overlays", []):
        at = o.get("at")
        if at is None and "word" in o:
            hits = [w for w in words if norm(w["w"]) == norm(o["word"])]
            at = hits[min(len(hits) - 1, o.get("nth", 0))]["s"] if hits else None
        if at is not None: busy.append((at - 0.3, at + o.get("dur", 3) + 0.3))
    # phrases on the output timeline
    ph, cur = [], []
    for w in words:
        if cur and (w["s"] - cur[-1]["e"] >= 0.4 or cur[-1]["seg"] != w.get("seg")): ph.append(cur); cur = []
        cur.append(w)
    if cur: ph.append(cur)
    cands = []
    for p in ph:
        text = " ".join(w["w"] for w in p); chunks = phrase_chunks(text, a.lang)
        if not chunks: continue
        q, pos = chunks[0]; k = len(text[:pos].split()); anchor = p[min(k, len(p) - 1)]
        at = max(0.0, anchor["s"] - 0.1); d = min(4.0, max(2.5, p[-1]["e"] + 0.4 - at))
        if any(at < b1 and at + d > b0 for b0, b1 in busy): continue
        cands.append({"at": round(at, 2), "dur": round(d, 2), "query": q, "word": anchor["w"], "text": text[:90], "score": len(q.split())})
    cands.sort(key=lambda c: -c["score"]); slots = []
    for c in cands:                                  # >= 2 s of face between cutaways
        if len(slots) >= target: break
        if all(c["at"] >= s["at"] + s["dur"] + 2.0 or c["at"] + c["dur"] + 2.0 <= s["at"] for s in slots): slots.append(c)
    slots.sort(key=lambda c: c["at"])
    for i, sl in enumerate(slots): sl["id"] = i + 1; sl["mode"] = mode
    name = re.sub(r"[^a-z0-9]+", "-", vd.name.lower()).strip("-") or "edit"
    (ed / "broll.json").write_text(json.dumps({"mode": mode, "density": a.density, "era": a.era, "slots": slots}, indent=1, ensure_ascii=False))
    era = f" {a.era}" if a.era else ""
    vis = {"public_dir": f"edits/{name}/broll", "acts": [], "lines": [{"line": sl["id"], "shot": "photo", "idea": f"B-roll for '{sl['word']}': {sl['text']}",
           "media": {"queries": [sl["query"] + era, sl["query"], sl["word"] + era], "type": a.type, "n": 4, "need": True}} for sl in slots]}
    (ed / "broll_visuals.json").write_text(json.dumps(vis, indent=1, ensure_ascii=False))
    print(f"{ed / 'broll.json'}: {len(slots)} slots ({a.density}, {mode}) over {dur:.0f}s")
    for sl in slots: print(f"  slot {sl['id']}: {sl['at']:6.2f}s +{sl['dur']:.1f}s  '{sl['query']}'  <- \"{sl['text'][:60]}\"")
    print(f"next: python tools/media_hunt.py hunt --visuals {ed / 'broll_visuals.json'}   (then pick per slot, then finish)")

def cmd_broll_pick(a):
    """use your own footage, an archive clip (tools/archive_clips.py) or any licensed file for a slot"""
    import shutil
    vd = pathlib.Path(a.dir); ed = edit_dir(vd); vp = ed / "broll_visuals.json"; V = json.loads(vp.read_text())
    src = pathlib.Path(a.src); core = pathlib.Path(__file__).resolve().parents[1]; pub = core / "public" / V["public_dir"]; pub.mkdir(parents=True, exist_ok=True)
    dst = pub / f"S{a.slot:02d}{src.suffix.lower()}"; shutil.copy(src, dst)
    m = probe(dst) if src.suffix.lower() in VIDEO_EXT else None
    if m is None:
        from PIL import Image
        w, h = Image.open(dst).size
    else: w, h = m["w"], m["h"]
    line = next(l for l in V["lines"] if l["line"] == a.slot)
    line["picked"] = {"src": f"{V['public_dir']}/{dst.name}", "aspect": round(w / h, 3), "in": a.at, "title": a.title or src.name, "license": a.license, "creator": a.creator}
    line["media"]["need"] = False; vp.write_text(json.dumps(V, indent=1, ensure_ascii=False)); print(f"slot {a.slot} <- {dst.name} ({w}x{h}, in {a.at}s, {a.license})")

def cmd_formats(a):
    """one edit, every shape: render + finish per aspect from the same EDL, then a side-by-side sheet at the same moments"""
    vd = pathlib.Path(a.dir); ed = edit_dir(vd); outs = []
    for asp in a.aspects.split(","):
        tag = asp.replace(":", "x"); cut = ed / f"cut_{tag}.mp4"
        subprocess.run([sys.executable, __file__, "render", str(vd), "--aspect", asp, "--out", str(cut)] + (["--edl", a.edl] if a.edl else []), check=True)
        subprocess.run([sys.executable, __file__, "finish", str(vd), "--cut", str(cut), "--captions", a.captions] + (["--edl", a.edl] if a.edl else []), check=True)
        outs.append((asp, ed / f"cut_{tag}_final.mp4"))
    from PIL import Image, ImageDraw
    times = [float(x) for x in a.times.split(",")] if a.times else None
    if not times:
        d = json.loads((ed / f"cut_{a.aspects.split(',')[0].replace(':', 'x')}.json").read_text())["duration"]; times = [round(d * k / 5, 1) for k in range(1, 5)]
    rows = []
    for t in times:
        tiles = []
        for asp, f in outs:
            png = ed / "fmt.png"; sh(["ffmpeg", "-v", "error", "-y", "-ss", f"{t}", "-i", str(f), "-frames:v", "1", "-vf", "scale=-2:420", str(png)])
            im = Image.open(png).convert("RGB"); ImageDraw.Draw(im).text((6, 4), f"{asp}  {t:.1f}s", fill="yellow"); tiles.append(im)
        w = sum(i.width + 8 for i in tiles); row = Image.new("RGB", (w, 420), "#111"); x = 0
        for i in tiles: row.paste(i, (x, 0)); x += i.width + 8
        rows.append(row)
    sheet = Image.new("RGB", (max(r.width for r in rows), len(rows) * 428), "#111")
    for k, r in enumerate(rows): sheet.paste(r, (0, k * 428))
    sheet.save(ed / "formats.jpg", quality=82); (ed / "fmt.png").unlink(missing_ok=True)
    print("formats:", ", ".join(str(f.name) for _, f in outs), "->", ed / "formats.jpg")

# ------------------------------------------------------------------ render: snap, pad, fade, one pass
def snap(seg, words, pad):
    """move the edges onto word boundaries; pad without entering a neighbouring word"""
    s, e = seg["start"], seg["end"]
    inside = [w for w in words if w["e"] > s + 0.02 and w["s"] < e - 0.02]
    if not inside: raise SystemExit(f"segment {seg} contains no words")
    first, last = inside[0], inside[-1]
    prev = max((w["e"] for w in words if w["e"] <= first["s"] + 1e-6 and w is not first), default=0.0)
    nxt = min((w["s"] for w in words if w["s"] >= last["e"] - 1e-6 and w is not last), default=1e9)
    a = max(first["s"] - pad[0], prev + 0.01, 0.0)
    b = min(last["e"] + pad[1], nxt - 0.01)
    return round(a, 3), round(b, 3), inside

def cmd_render(a):
    vd = pathlib.Path(a.dir); ed = edit_dir(vd); E = json.loads((pathlib.Path(a.edl) if a.edl else ed / "edl.json").read_text())
    pad, fade = E.get("pad", [0.05, 0.08]), E.get("fade", 0.03)
    ids = list(dict.fromkeys(s["src"] for s in E["segments"])); inputs = []
    for i in ids:
        p = pathlib.Path(E["sources"][i]); p = p if p.is_absolute() else (ed.parent / p); inputs += ["-i", str(p)]
    base = probe(pathlib.Path(inputs[1])); fps = E.get("fps") or round(base["fps"])
    ASPECT_SIZE = {"9:16": [1080, 1920], "1:1": [1080, 1080], "4:5": [1080, 1350], "16:9": [1920, 1080]}
    asp = a.aspect or E.get("aspect"); W, H = (ASPECT_SIZE[asp] if a.aspect else None) or E.get("size") or (ASPECT_SIZE[asp] if asp else [base["w"], base["h"]])
    if asp and abs(base["w"] / base["h"] - W / H) < 0.02: asp = None          # same shape as the source: no reframe needed
    if a.preview: W, H = (1280, int(1280 * H / W) // 2 * 2) if W > 1280 else (W, H)
    fc, cat, out_words, t_out, plan, alt = [], [], [], 0.0, [], 0
    for k, seg in enumerate(E["segments"]):
        words = load_tr(vd, seg["src"])["words"]; s, e, inside = snap(seg, words, pad); d = e - s; n = ids.index(seg["src"])
        # jump-cut masking: consecutive segments of the same source alternate between full frame and a slight push-in,
        # so a cut inside one take reads as a deliberate punch instead of a jump (segment "zoom" overrides)
        jz = E.get("jump_zoom", 1.0); same = k > 0 and E["segments"][k - 1]["src"] == seg["src"]
        alt = (alt + 1) % 2 if same else 0
        z = float(seg.get("zoom", jz if alt == 1 else 1.0))
        zf = f",crop=iw/{z}:ih/{z}:(iw-iw/{z})/2:(ih-ih/{z})*0.35" if z > 1.001 else ""
        rf = ""
        if asp:                                        # reframe: a virtual camera that follows the subject
            srcp = pathlib.Path(inputs[2 * n + 1]); cw, ch, keys = camera_track(srcp, s, e, asp, words)
            rf = f",crop={cw}:{ch}:x='{piecewise(keys)}':y=(ih-{ch})/2"; seg["_keys"] = keys
        fc.append(f"[{n}:v]trim=start={s}:end={e},setpts=PTS-STARTPTS,fps={fps}{rf}{zf},scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1[v{k}]")
        fc.append(f"[{n}:a]atrim=start={s}:end={e},asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:st=0:d={fade},afade=t=out:st={max(0, d - fade):.3f}:d={fade}[a{k}]")
        cat.append(f"[v{k}][a{k}]")
        for w in inside: out_words.append({"w": w["w"], "s": round(w["s"] - s + t_out, 3), "e": round(w["e"] - s + t_out, 3), "seg": k})
        plan.append({"seg": k, "src": seg["src"], "in": s, "out": e, "at": round(t_out, 3), "beat": seg.get("beat"), **({"camera": seg["_keys"]} if "_keys" in seg else {})}); t_out += d
    fc.append("".join(cat) + f"concat=n={len(cat)}:v=1:a=1[v][a0]")
    fc.append(f"[a0]loudnorm=I={a.lufs}:TP=-1.5:LRA=11[a]" if a.lufs else "[a0]anull[a]")
    out = pathlib.Path(a.out) if a.out else ed / ("preview.mp4" if a.preview else "cut.mp4")
    cmd = ["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]",
           "-c:v", "libx264", "-crf", "23" if a.preview else "17", "-preset", "veryfast" if a.preview else "medium", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out)]
    sh(cmd)
    meta = {"video": out.name, "duration": round(t_out, 3), "fps": fps, "size": [W, H], "segments": plan, "words": out_words}
    out.with_suffix(".json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    print(f"{out}  {t_out:.2f}s, {len(plan)} segments, {len(out_words)} words (output-timeline words in {out.with_suffix('.json').name})")

# ------------------------------------------------------------------ verify: every word whole, duration, loudness, sheets
def cmd_verify(a):
    vd = pathlib.Path(a.dir); ed = edit_dir(vd); cut = pathlib.Path(a.cut) if a.cut else ed / "cut.mp4"; meta = json.loads(cut.with_suffix(".json").read_text())
    from faster_whisper import WhisperModel
    wav = ed / "verify.16k.wav"; sh(["ffmpeg", "-v", "error", "-y", "-i", str(cut), "-vn", "-ac", "1", "-ar", "16000", str(wav)])
    segs, _ = WhisperModel(a.model, device="cpu", compute_type="int8").transcribe(str(wav), language=a.lang, word_timestamps=True, condition_on_previous_text=False)
    heard = [{"w": w.word.strip(), "s": w.start} for s in segs for w in s.words if w.word.strip()]; wav.unlink(missing_ok=True)
    exp = [norm(w["w"]) for w in meta["words"]]; got = [norm(w["w"]) for w in heard]
    import difflib
    sm = difflib.SequenceMatcher(a=exp, b=got, autojunk=False); missing = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op in ("delete", "replace"): missing += [meta["words"][i] for i in range(i1, i2)]
    joins = [s["at"] for s in meta["segments"][1:]]
    near = [m for m in missing if any(abs(m["s"] - j) < 0.6 or abs(m["e"] - j) < 0.6 for j in joins)]
    # second opinion: re-hear a 4 s window around each suspect (whole-file decoding drifts near joins); a word heard
    # there (fuzzy >= 0.7, names vary) is fine
    model = WhisperModel(a.model, device="cpu", compute_type="int8"); confirmed = []
    for m in near:
        win = ed / "verify.win.wav"; t0 = max(0, m["s"] - 2)
        sh(["ffmpeg", "-v", "error", "-y", "-ss", f"{t0}", "-i", str(cut), "-t", "4", "-vn", "-ac", "1", "-ar", "16000", str(win)])
        ws, _ = model.transcribe(str(win), language=a.lang, word_timestamps=True, condition_on_previous_text=False)
        local = [norm(w.word) for s2 in ws for w in s2.words]; win.unlink(missing_ok=True)
        if not any(difflib.SequenceMatcher(a=norm(m["w"]), b=x).ratio() >= 0.7 for x in local): confirmed.append(m)
    near = confirmed
    dur = probe(cut)["duration"]
    lufs = re.findall(r"I:\s+(-?[\d.]+) LUFS", subprocess.run(["ffmpeg", "-hide_banner", "-i", str(cut), "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr)
    print(f"words expected {len(exp)}, heard back {len(got)}, match {sm.ratio():.3f}")
    print(f"duration {dur:.2f}s vs EDL {meta['duration']:.2f}s ({'OK' if abs(dur - meta['duration']) < 0.15 else 'MISMATCH'})")
    print(f"loudness {lufs[-1] if lufs else '?'} LUFS")
    print(f"words not heard back: {len(missing)}; at a join (likely clipped): {len(near)}")
    for m in near[:20]: print(f"  CHECK {m['s']:7.2f}s '{m['w']}' (join at {min(joins, key=lambda j: abs(j - m['s'])):.2f}s)")
    rv = subprocess.run([sys.executable, str(pathlib.Path(__file__).with_name("review_sheets.py")), str(cut)], capture_output=True, text=True)
    print(rv.stdout.strip().splitlines()[-1] if rv.stdout.strip() else rv.stderr[-300:])
    return 1 if near else 0

# ------------------------------------------------------------------ finish: captions + overlays over the cut, sound muxed back
def cmd_finish(a):
    import shutil
    vd = pathlib.Path(a.dir); ed = edit_dir(vd); cut = pathlib.Path(a.cut) if a.cut else ed / "cut.mp4"; meta = json.loads(cut.with_suffix(".json").read_text())
    E = json.loads((pathlib.Path(a.edl) if a.edl else ed / "edl.json").read_text()); core = pathlib.Path(__file__).resolve().parents[1]
    name = (re.sub(r"[^a-z0-9]+", "-", vd.name.lower()).strip("-") or "edit") + ("" if cut.stem == "cut" else "-" + cut.stem); pub = core / "public" / "edits" / name; pub.mkdir(parents=True, exist_ok=True)
    shutil.copy(cut, pub / "cut.mp4")
    def when(o):                       # overlay time: "at" seconds on the output, or "word": text of the first matching word (+ "nth")
        if "at" in o: return float(o["at"])
        hits = [w for w in meta["words"] if norm(w["w"]) == norm(o["word"])]
        if not hits: raise SystemExit(f"overlay word not found: {o['word']}")
        return hits[min(len(hits) - 1, o.get("nth", 0))]["s"]
    ov = [{**{k: v for k, v in o.items() if k not in ("word", "nth", "item_words")}, "at": round(when(o), 3)} for o in E.get("overlays", [])]
    for o, src_o in zip(ov, E.get("overlays", [])):      # list items land on their words: the first match after the card opens
        if src_o.get("item_words"):
            times = []
            for w in src_o["item_words"]:
                hit = next((x["s"] for x in meta["words"] if x["s"] >= o["at"] - 0.05 and norm(x["w"]) == norm(w)), None)
                times.append(round(hit, 3) if hit is not None else None)
            o["itemTimes"] = [x if x is not None else o["at"] + 0.5 + i for i, x in enumerate(times)]
    if (ed / "broll.json").exists() and (ed / "broll_visuals.json").exists():
        B = json.loads((ed / "broll.json").read_text()); BV = {l["line"]: l for l in json.loads((ed / "broll_visuals.json").read_text())["lines"]}
        for sl in B["slots"]:
            pk = BV.get(sl["id"], {}).get("picked")
            if pk:
                ar = meta["size"][0] / meta["size"][1]; mode = sl.get("mode", "full")
                if ar < 1.2 and mode == "full": mode = "split"          # narrow formats keep the speaker: B-roll on top, face below
                if ar >= 1.2 and mode == "split": mode = "full"
                fit = "cover"
                if not pk["src"].lower().endswith(tuple(VIDEO_EXT)):      # a document (paper, drawing, page) is shown whole, never cropped
                    from PIL import Image
                    import numpy as np
                    g = np.asarray(Image.open(core / "public" / pk["src"]).convert("L").resize((64, 64)), dtype=np.float32)
                    if g.mean() > 200 and (g > 230).mean() > 0.6: fit = "contain"
                ov.append({"kind": "broll", "at": sl["at"], "dur": sl["dur"], "mode": mode, "src": pk["src"], "aspect": pk.get("aspect", 1.5), "in": pk.get("in", 0), "fit": fit})
        lines = ["# B-roll credits", ""] + [f"- {l['picked'].get('title', '')} - {l['picked'].get('creator', '') or 'unknown'} - {l['picked'].get('license', '')} {l['picked'].get('page', '')}".rstrip()
                                          for l in BV.values() if l.get("picked")]
        (ed / "CREDITS.md").write_text("\n".join(lines) + "\n")
    # music: analysed, big moments snapped onto its beats (<= 0.15 s; small ones <= 0.10 s), mixed ducked under the voice
    M = E.get("music")
    if M:
        sys.path.insert(0, str(pathlib.Path(__file__).parent)); import beatmap as BM
        mp = pathlib.Path(M["src"]); mp = mp if mp.is_absolute() else (core / mp if (core / mp).exists() else ed.parent / mp)
        y = BM.load(mp, M.get("start", 0), meta["duration"] + 1); B = BM.analyze(y, bpm_fixed=M.get("bpm"))
        (ed / "beats.json").write_text(json.dumps(B))
        if M.get("snap", True):
            big = {"broll", "title", "card"}
            ev = [{"id": i, "t": o["at"], "size": "big" if o["kind"] in big and o.get("card") not in ("label", "lower", "list", "versus") else "small"} for i, o in enumerate(ov)]
            for e2 in BM.snap(B, ev):
                if e2["on"]: ov[e2["id"]]["at"] = e2["t"]; ov[e2["id"]]["snapped"] = e2["on"]
        print(f"music {mp.name}: {B['bpm']} BPM [{B['confidence'].split(' ')[0]}], {sum(1 for o in ov if o.get('snapped'))}/{len(ov)} overlays on the beat")
    props = {"video": f"edits/{name}/cut.mp4", "words": meta["words"], "duration": meta["duration"], "fps": meta["fps"], "size": meta["size"], "captions": a.captions, "overlays": ov}
    pp = ed / "finish.props.json"; pp.write_text(json.dumps(props, ensure_ascii=False))
    silent = ed / "finish.silent.mp4"; out = pathlib.Path(a.out) if a.out else ed / ("final.mp4" if cut.stem == "cut" else f"{cut.stem}_final.mp4")
    subprocess.run(["npx", "remotion", "render", "src/index.ts", "FootageEdit", str(silent.resolve()), f"--props={pp.resolve()}", "--codec", "h264", "--crf", "17", "--concurrency=4", "--log", "error"], cwd=core, check=True)
    audio = cut
    if M:
        voice = ed / "finish.voice.wav"; mus = ed / "finish.music.wav"; mixed = ed / "finish.mix.m4a"
        sh(["ffmpeg", "-v", "error", "-y", "-i", str(cut), "-vn", "-ac", "2", "-ar", "48000", str(voice)])
        sh(["ffmpeg", "-v", "error", "-y", "-ss", f"{M.get('start', 0)}", "-i", str(mp), "-t", f"{meta['duration']}", "-af", f"afade=t=out:st={max(0, meta['duration'] - 1.5)}:d=1.5", "-ac", "2", "-ar", "48000", str(mus)])
        sh([sys.executable, str(pathlib.Path(__file__).with_name("mix_film.py")), "--voice", str(voice), "--music", str(mus), "--out", str(mixed), "--lufs", "-16", "--music-db", str(M.get("music_db", -14))])
        audio = mixed
    sh(["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(audio), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac" if M else "copy", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(out)])
    silent.unlink(missing_ok=True); print(f"{out}  ({meta['duration']:.2f}s, captions {a.captions}, {len(ov)} overlays)")
    tc = subprocess.run([sys.executable, str(pathlib.Path(__file__).with_name("text_check.py")), str(out), "--every", "0.5"], capture_output=True, text=True)
    print("\n".join(tc.stdout.strip().splitlines()[:12]))

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter); sp = ap.add_subparsers(dest="cmd", required=True)
    for n in ("transcribe", "pack", "tighten", "render", "verify", "finish", "highlights", "broll", "broll-pick", "formats"):
        p = sp.add_parser(n); p.add_argument("dir"); p.add_argument("--lang", default="en"); p.add_argument("--model", default="small"); p.add_argument("--break", dest="brk", type=float, default=0.5)
        if n == "tighten": p.add_argument("--keep-gap", type=float, default=0.25); p.add_argument("--fillers", action="store_true"); p.add_argument("--retakes", action="store_true")
        if n == "render": p.add_argument("--edl"); p.add_argument("--out"); p.add_argument("--preview", action="store_true"); p.add_argument("--lufs", type=float, default=-16.0); p.add_argument("--aspect")
        if n == "formats": p.add_argument("--aspects", default="9:16,1:1,4:5,16:9"); p.add_argument("--edl"); p.add_argument("--captions", default="sentence", choices=["sentence", "bold", "none"]); p.add_argument("--times")
        if n == "verify": p.add_argument("--cut")
        if n == "finish": p.add_argument("--captions", default="sentence", choices=["sentence", "bold", "none"]); p.add_argument("--out"); p.add_argument("--edl"); p.add_argument("--cut")
        if n == "broll":
            p.add_argument("--cut"); p.add_argument("--density", default="medium", choices=["light", "medium", "heavy"]); p.add_argument("--mode", default="auto", choices=["auto", "full", "panel", "split"])
            p.add_argument("--era", default=""); p.add_argument("--type", default="image", choices=["image", "video"])
        if n == "broll-pick":
            p.add_argument("--slot", type=int, required=True); p.add_argument("--src", required=True); p.add_argument("--at", type=float, default=0.0)
            p.add_argument("--license", required=True, help="e.g. 'own footage', 'Public domain (Prelinger)', 'CC BY 4.0'"); p.add_argument("--creator", default=""); p.add_argument("--title", default="")
        if n == "highlights":
            p.add_argument("--duration", type=float, default=45); p.add_argument("--aspect", default="9:16"); p.add_argument("--count", type=int, default=1)
            p.add_argument("--hook-first", action=argparse.BooleanOptionalAction, default=True); p.add_argument("--min-shot", type=float, default=4); p.add_argument("--max-shot", type=float, default=15); p.add_argument("--allow-cuts", action="store_true")
    a = ap.parse_args()
    sys.exit({"transcribe": cmd_transcribe, "pack": cmd_pack, "tighten": cmd_tighten, "render": cmd_render, "verify": cmd_verify, "finish": cmd_finish, "highlights": cmd_highlights, "broll": cmd_broll, "broll-pick": cmd_broll_pick, "formats": cmd_formats}[a.cmd](a) or 0)

if __name__ == "__main__":
    main()
