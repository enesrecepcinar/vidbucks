#!/usr/bin/env python
"""logo_prep.py - the user's own logo (SVG) -> plain parts for the LogoReveal kit (+ its sound logo cues).

  python tools/logo_prep.py mark.svg --out public/logo/<name>/logo.json [--wordmark "Name"] [--tagline "..."] [--style draw|assemble|mask]
         [--cues videos/<name>/cues.json]

Reads path, rect, circle, ellipse, line, polyline and polygon (fill / stroke kept), applies translate/scale/matrix
transforms on elements and groups, and writes {viewBox, parts: [{d, fill, stroke, sw}]} in drawing order. Gradients,
masks, filters and text are not carried over (flatten them to paths in the design tool first; text -> outlines).
Only the user's own logo or one they are licensed to animate: never a third party's mark."""
import argparse, json, math, pathlib, re, sys
import xml.etree.ElementTree as ET

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("svg"); ap.add_argument("--out", required=True); ap.add_argument("--wordmark"); ap.add_argument("--tagline"); ap.add_argument("--style", default="draw"); ap.add_argument("--cues")
a = ap.parse_args()
root = ET.parse(a.svg).getroot(); tag = lambda e: e.tag.split("}")[-1]
vb = root.get("viewBox") or f"0 0 {re.sub('[^0-9.]', '', root.get('width', '100'))} {re.sub('[^0-9.]', '', root.get('height', '100'))}"

def parse_tf(s):
    M = [1, 0, 0, 1, 0, 0]
    for name, args in re.findall(r"(\w+)\s*\(([^)]*)\)", s or ""):
        v = [float(x) for x in re.split(r"[ ,]+", args.strip()) if x]
        if name == "translate": m = [1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0]
        elif name == "scale": m = [v[0], 0, 0, v[1] if len(v) > 1 else v[0], 0, 0]
        elif name == "matrix": m = v
        elif name == "rotate":
            r = math.radians(v[0]); c, s_ = math.cos(r), math.sin(r); m = [c, s_, -s_, c, 0, 0]
            if len(v) == 3: m = mul(mul([1, 0, 0, 1, v[1], v[2]], m), [1, 0, 0, 1, -v[1], -v[2]])
        else: print(f"warning: transform {name} ignored", file=sys.stderr); continue
        M = mul(M, m)
    return M
def mul(A, B): return [A[0]*B[0]+A[2]*B[1], A[1]*B[0]+A[3]*B[1], A[0]*B[2]+A[2]*B[3], A[1]*B[2]+A[3]*B[3], A[0]*B[4]+A[2]*B[5]+A[4], A[1]*B[4]+A[3]*B[5]+A[5]]
def ap_(M, x, y): return M[0]*x + M[2]*y + M[4], M[1]*x + M[3]*y + M[5]

def path_tf(d, M):
    """transform an absolute/relative path by M (affine): converts to absolute commands; arcs are approximated by lines"""
    if M == [1, 0, 0, 1, 0, 0]: return d
    toks = re.findall(r"[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e-?\d+)?", d); out = []; i = 0; cx = cy = sx = sy = 0; cmd = None
    def num():
        nonlocal i; v = float(toks[i]); i += 1; return v
    while i < len(toks):
        if re.match(r"[A-Za-z]", toks[i]): cmd = toks[i]; i += 1
        rel = cmd.islower(); C = cmd.upper()
        if C == "Z": out.append("Z"); cx, cy = sx, sy; continue
        if C in "ML":
            x, y = num(), num(); x, y = (cx + x, cy + y) if rel else (x, y); X, Y = ap_(M, x, y); out.append(f"{C}{X:.2f} {Y:.2f}")
            cx, cy = x, y
            if C == "M": sx, sy = x, y; cmd = "l" if rel else "L"
        elif C in "HV":
            v = num(); x, y = ((cx + v if rel else v), cy) if C == "H" else (cx, (cy + v if rel else v)); X, Y = ap_(M, x, y); out.append(f"L{X:.2f} {Y:.2f}"); cx, cy = x, y
        elif C in "CSQT":
            n = {"C": 3, "S": 2, "Q": 2, "T": 1}[C]; pts = []
            for _ in range(n): x, y = num(), num(); pts.append((cx + x, cy + y) if rel else (x, y))
            out.append(C + " ".join(f"{X:.2f} {Y:.2f}" for X, Y in (ap_(M, *p) for p in pts))); cx, cy = pts[-1]
        elif C == "A":
            for _ in range(5): num()
            x, y = num(), num(); x, y = (cx + x, cy + y) if rel else (x, y); X, Y = ap_(M, x, y); out.append(f"L{X:.2f} {Y:.2f}"); cx, cy = x, y
    return " ".join(out)

def shape_d(e):
    t = tag(e); f = lambda k, d=0.0: float(e.get(k, d) or d)
    if t == "path": return e.get("d", "")
    if t == "rect": x, y, w, h = f("x"), f("y"), f("width"), f("height"); return f"M{x} {y}H{x + w}V{y + h}H{x}Z"
    if t in ("circle", "ellipse"):
        cx, cy = f("cx"), f("cy"); rx = f("r") if t == "circle" else f("rx"); ry = f("r") if t == "circle" else f("ry")
        P = [(cx + rx * math.cos(2 * math.pi * k / 48), cy + ry * math.sin(2 * math.pi * k / 48)) for k in range(48)]
        return "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in P) + "Z"
    if t == "line": return f"M{f('x1')} {f('y1')}L{f('x2')} {f('y2')}"
    if t in ("polyline", "polygon"):
        v = [float(x) for x in re.split(r"[ ,]+", (e.get("points") or "").strip()) if x]
        return "M" + " L".join(f"{v[i]} {v[i + 1]}" for i in range(0, len(v) - 1, 2)) + ("Z" if t == "polygon" else "")
    return None

parts = []
def style_of(e, inh):
    st = dict(inh)
    for kv in (e.get("style") or "").split(";"):
        if ":" in kv: k, v = kv.split(":", 1); st[k.strip()] = v.strip()
    for k in ("fill", "stroke", "stroke-width"):
        if e.get(k): st[k] = e.get(k)
    return st
def walk(e, M, inh):
    M2 = mul(M, parse_tf(e.get("transform"))); st = style_of(e, inh)
    if tag(e) in ("defs", "clipPath", "mask", "style", "title", "desc", "metadata"): return
    if tag(e) == "text": print("warning: text element skipped (convert text to outlines)", file=sys.stderr); return
    d = shape_d(e)
    if d: parts.append({"d": path_tf(d, M2), "fill": st.get("fill", "#000000"), "stroke": st.get("stroke", "none"), "sw": float(re.sub("[^0-9.]", "", st.get("stroke-width", "1")) or 1) * math.sqrt(abs(M2[0] * M2[3] - M2[1] * M2[2]))})
    for c in e: walk(c, M2, st)
walk(root, [1, 0, 0, 1, 0, 0], {})
for p in parts:
    if (p["fill"] or "").startswith("url("): print("warning: gradient fill replaced by its first stop is not supported; set a flat colour", file=sys.stderr); p["fill"] = "#888888"
L = {"viewBox": vb, "parts": parts, "wordmark": a.wordmark, "tagline": a.tagline, "style": a.style}
pathlib.Path(a.out).parent.mkdir(parents=True, exist_ok=True); pathlib.Path(a.out).write_text(json.dumps(L, indent=1))
print(f"logo: {len(parts)} parts, viewBox {vb} -> {a.out}")
if a.cues:   # sound logo: a riser into the land, one impact, a bright tail
    land = {"draw": 1.9, "assemble": 1.5, "mask": 1.4}.get(a.style, 1.8)
    C = [{"kind": "riser", "t": max(0, land - 1.2), "gain": 0.35, "dur": 1.2}, {"kind": "impact", "t": land, "gain": 0.6}, {"kind": "chime", "t": land + 0.05, "gain": 0.4}]
    if a.wordmark: C.append({"kind": "tap", "t": land + 0.5, "gain": 0.25})
    pathlib.Path(a.cues).write_text(json.dumps(C)); print(f"cues -> {a.cues}")
