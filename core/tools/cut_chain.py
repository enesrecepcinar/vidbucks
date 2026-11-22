#!/usr/bin/env python3
"""cut_chain.py - plan cuts as an eye trace: where the eye is when a shot ends, and where the next shot picks it up.

A cut feels smooth when the viewer's eye is already where the next shot needs it. Each shot gets an IN hook (what the
eye lands on when the shot starts) and an OUT hook (what it is on when the shot ends). The plan is written before the
build, next to the scene plan, and checked twice: on paper (`check`) and on the render (`verify`).

  python tools/cut_chain.py check  chain.json                 # every cut rated: match / eye-trace / graphic / jump
  python tools/cut_chain.py board  chain.json out.jpg         # one tile per cut: out-hook | in-hook on a thirds grid
  python tools/cut_chain.py verify chain.json video.mp4       # where the eye really is around each cut (salience)

chain.json: {"shots": [{"id": "s1", "t": 0.0, "what": "a radar sweep",
                        "in":  {"at": "CC", "glyph": "circle", "move": "none"},
                        "out": {"at": "TR", "glyph": "circle", "move": "right", "colour": "#e3241b"},
                        "intent": "jolt" (optional: this cut is meant to jump)}, ...]}
  at     a place on the frame: the nine points TL TC TR / ML CC MR / BL BC BR, the thirds lines H1 H2 (across) and V1 V2
         (down), or FULL (something fills the lens: a push into a screen, a hand over the camera - it carries any cut)
  glyph  the shape the eye locks onto: circle, rect, hline, vline, diag, vanish (a vanishing point), blob, streaks, dots, text, face
  move   none, left, right, up, down, in (towards camera / push), out (pull back), cw, ccw
  t      shot start in seconds (needed for verify; from timing.json / the scene plan)

Rating per cut (out of shot i -> in of shot i+1):
  match       same place (or a point on the same line) AND same shape family, moves agree -> the smoothest join
  eye-trace   same or neighbouring place, different shape -> smooth, the eye does not travel
  graphic     same shape family, the place moves -> a graphic match: fine when the move carries the eye there
  jump        nothing shared -> the eye has to search; fine only on purpose ("intent": "jolt": a shock, a chapter, a reveal)
A plan is a set of choices, not a rule: a film of only "match" cuts is as flat as one of only jumps. `check` also says
when the same glyph or the same rating repeats three times in a row.
"""
import argparse, json, math, pathlib, subprocess, sys

PTS = {"TL": (1, 1), "TC": (2, 1), "TR": (3, 1), "ML": (1, 2), "CC": (2, 2), "MR": (3, 2), "BL": (1, 3), "BC": (2, 3), "BR": (3, 3)}
LINES = {"H1": ("y", 1), "H2": ("y", 3), "V1": ("x", 1), "V2": ("x", 3)}
FAMILY = {"circle": "round", "blob": "round", "dots": "texture", "streaks": "texture", "rect": "rect", "text": "rect",
          "hline": "hline", "vline": "vline", "diag": "diag", "vanish": "vanish", "face": "face"}
OPPOSITE = {("left", "right"), ("right", "left"), ("up", "down"), ("down", "up"), ("in", "out"), ("out", "in"), ("cw", "ccw"), ("ccw", "cw")}


def pos(at):
    """(x, y) in a 4x4 grid units for points (1..3), None for lines/FULL."""
    return PTS.get(at)


def place_score(a, b):
    """1 = same place, 0.5 = neighbouring / on the same line, 0 = elsewhere. FULL only meets FULL (and then is 1)."""
    if a == "FULL" or b == "FULL": return 1.0 if a == b else 0.0
    if a == b: return 1.0
    pa, pb = pos(a), pos(b)
    if pa and pb: return 0.5 if max(abs(pa[0] - pb[0]), abs(pa[1] - pb[1])) == 1 else 0.0
    for p, l in ((pa, b), (pb, a)):              # a point lying on a line hook
        if p and l in LINES:
            axis, v = LINES[l]
            if (p[1] if axis == "y" else p[0]) == v: return 1.0
    if a in LINES and b in LINES: return 0.5 if LINES[a][0] == LINES[b][0] else 0.0
    return 0.0


def rate(o, i):
    ps = place_score(o.get("at", "CC"), i.get("at", "CC"))
    same_shape = FAMILY.get(o.get("glyph"), o.get("glyph")) == FAMILY.get(i.get("glyph"), i.get("glyph"))
    mo, mi = o.get("move", "none"), i.get("move", "none")
    moves_ok = (mo, mi) not in OPPOSITE
    if o.get("at") == "FULL" and i.get("at") == "FULL": r = "match"
    elif ps == 1.0 and same_shape and moves_ok: r = "match"
    elif ps >= 0.5: r = "eye-trace"
    elif same_shape: r = "graphic"
    else: r = "jump"
    return r, ps, same_shape, moves_ok


def load(p):
    d = json.loads(pathlib.Path(p).read_text(encoding="utf-8"))
    return d["shots"] if isinstance(d, dict) else d


def cmd_check(a):
    S = load(a.chain); rows, bad = [], 0
    for k in range(len(S) - 1):
        o, i = S[k].get("out", {}), S[k + 1].get("in", {})
        r, ps, sh, mv = rate(o, i)
        jolt = S[k + 1].get("intent") == "jolt"
        note = ""
        if r == "jump" and not jolt: note = "the eye has to search: move the next hook to %s, or mark it \"intent\": \"jolt\"" % o.get("at"); bad += 1
        if not mv: note += (" · " if note else "") + f"moves fight ({o.get('move')} -> {i.get('move')}): turn one of them"
        rows.append((S[k].get("id", k), S[k + 1].get("id", k + 1), r + (" (jolt)" if jolt and r == "jump" else ""), o.get("at"), i.get("at"), note))
    for a_, b_, r, x, y, n in rows: print(f"{a_:>8} -> {b_:<8} {r:16} {x:>4} -> {y:<4} {n}")
    for k in range(len(rows) - 2):
        if rows[k][2] == rows[k + 1][2] == rows[k + 2][2]: print(f"note: three '{rows[k][2]}' cuts in a row from {rows[k][0]}: vary the join")
    gl = [s.get("in", {}).get("glyph") for s in S]
    for k in range(len(gl) - 2):
        if gl[k] and gl[k] == gl[k + 1] == gl[k + 2]: print(f"note: three shots open on a {gl[k]} from {S[k].get('id', k)}: vary the shape")
    mix = {}
    for r in rows: mix[r[2].split()[0]] = mix.get(r[2].split()[0], 0) + 1
    print("CHAIN", " ".join(f"{k}={v}" for k, v in sorted(mix.items())), f"unplanned jumps={bad}")


def xy(at, w, h):
    if at == "FULL": return None
    if at in PTS: x, y = PTS[at]; return (w * x / 4, h * y / 4)
    return None


def cmd_board(a):
    from PIL import Image, ImageDraw
    S = load(a.chain); tw, th = 320, 180; tiles = []
    col = {"match": (80, 210, 120), "eye-trace": (120, 190, 255), "graphic": (240, 200, 80), "jump": (235, 80, 70)}
    for k in range(len(S) - 1):
        o, i = S[k].get("out", {}), S[k + 1].get("in", {}); r = rate(o, i)[0]
        T = Image.new("RGB", (tw * 2 + 10, th + 40), (18, 18, 22)); d = ImageDraw.Draw(T)
        for j, (hk, lab) in enumerate(((o, S[k].get("what", S[k].get("id", ""))), (i, S[k + 1].get("what", S[k + 1].get("id", ""))))):
            x0 = j * (tw + 10)
            d.rectangle([x0, 0, x0 + tw - 1, th - 1], outline=(90, 90, 100))
            for q in (1, 2, 3): d.line([x0 + tw * q / 4, 0, x0 + tw * q / 4, th], fill=(45, 45, 55)); d.line([x0, th * q / 4, x0 + tw, th * q / 4], fill=(45, 45, 55))
            at = hk.get("at", "CC")
            if at == "FULL": d.rectangle([x0 + 6, 6, x0 + tw - 7, th - 7], outline=col[r], width=4)
            elif at in LINES:
                ax, v = LINES[at]
                if ax == "y": d.line([x0, th * v / 4, x0 + tw, th * v / 4], fill=col[r], width=4)
                else: d.line([x0 + tw * v / 4, 0, x0 + tw * v / 4, th], fill=col[r], width=4)
            else:
                px, py = xy(at, tw, th); d.ellipse([x0 + px - 12, py - 12, x0 + px + 12, py + 12], outline=col[r], width=4)
            d.text((x0 + 6, th + 4), f"{'OUT' if j == 0 else 'IN'} {at} {hk.get('glyph', '')} {hk.get('move', '')}"[:44], fill=(230, 230, 230))
            d.text((x0 + 6, th + 20), str(lab)[:44], fill=(150, 150, 160))
        d.text((tw - 20, th // 2 - 6), r[:5], fill=col[r])
        tiles.append(T)
    if not tiles: sys.exit("need at least two shots")
    cols = 2; W, H = tiles[0].size; rows = -(-len(tiles) // cols)
    B = Image.new("RGB", (cols * (W + 16) + 16, rows * (H + 16) + 16), (10, 10, 12))
    for n, T in enumerate(tiles): B.paste(T, (16 + (n % cols) * (W + 16), 16 + (n // cols) * (H + 16)))
    B.save(a.out, quality=88); print(a.out)


def frame_at(video, t, w=96, h=54):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{max(0, t):.3f}", "-i", video, "-frames:v", "1", "-vf", f"scale={w}:{h},format=gray", "-f", "rawvideo", "-"],
                         capture_output=True, timeout=60).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w).astype(np.float32) if len(raw) == w * h else None


def salient_place(f, prev=None):
    """The place the eye most likely sits on: local contrast (+ motion when a previous frame is given), centroid of the
    top 4 % of the map, snapped to the nearest of the nine points (FULL when the map is spread over the whole frame)."""
    import numpy as np
    gy, gx = np.gradient(f); m = np.hypot(gx, gy)
    if prev is not None: m = m + 1.5 * np.abs(f - prev)
    thr = np.quantile(m, 0.96); ys, xs = np.where(m >= thr)
    if len(xs) == 0: return "CC", 0.0
    spread = (xs.std() / f.shape[1] + ys.std() / f.shape[0]) / 2
    if spread > 0.27: return "FULL", spread
    cx, cy = xs.mean() / f.shape[1] * 4, ys.mean() / f.shape[0] * 4
    best = min(PTS, key=lambda p: (PTS[p][0] - cx) ** 2 + (PTS[p][1] - cy) ** 2)
    return best, spread


def cmd_verify(a):
    S = load(a.chain); miss = 0
    for k in range(1, len(S)):
        t = S[k].get("t")
        if t is None: print(f"{S[k].get('id', k)}: no t, skipped"); continue
        f0, f0p = frame_at(a.video, t - 0.08), frame_at(a.video, t - 0.2)
        f1, f1n = frame_at(a.video, t + 0.2), frame_at(a.video, t + 0.08)
        if f0 is None or f1 is None: continue
        po, _ = salient_place(f0, f0p); pi, _ = salient_place(f1, f1n)
        want_o, want_i = S[k - 1].get("out", {}).get("at"), S[k].get("in", {}).get("at")
        ok_o = want_o is None or place_score(want_o, po) >= 0.5; ok_i = want_i is None or place_score(want_i, pi) >= 0.5
        if not (ok_o and ok_i): miss += 1
        print(f"cut {t:7.2f} s  out planned {want_o or '-':4} seen {po:4} {'ok' if ok_o else 'OFF'}   in planned {want_i or '-':4} seen {pi:4} {'ok' if ok_i else 'OFF'}")
    print(f"VERIFY {len(S) - 1 - miss}/{len(S) - 1} cuts land where planned (salience is a hint: look at the frames of the OFF ones)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    p = sp.add_parser("check"); p.add_argument("chain")
    p = sp.add_parser("board"); p.add_argument("chain"); p.add_argument("out")
    p = sp.add_parser("verify"); p.add_argument("chain"); p.add_argument("video")
    a = ap.parse_args()
    {"check": cmd_check, "board": cmd_board, "verify": cmd_verify}[a.cmd](a)
