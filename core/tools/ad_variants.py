#!/usr/bin/env python
"""ad_variants.py - one ad template x a CSV of rows = N finished ad variants (AdSpot kit), each in every aspect it asks for.

  python tools/ad_variants.py ads.csv --out out/ads/<campaign> [--aspects 9:16,1:1,16:9] [--only id1,id2] [--dry-run]

CSV columns: id, hook, hook_type (question | claim | pain | number | pov), product, tagline, benefit1, benefit2, benefit3,
cta, offer, color, icon (media icon id) or image (file under core/public/), proof_quote, proof_source, proof_rating,
proof_count, motion. Empty cells are fine. Per variant: props json, a silent render, synthesised sound (a pulse bed + one
hit per beat: hook impact, product pop, a pop per benefit, whoosh into the CTA) mixed to -16 LUFS, the muxed mp4, and one
index sheet (hook frame | benefits frame | CTA frame per variant) to compare hooks side by side.
Honesty: proof is used only when the row gives it (a real quote WITH its source, or a rating WITH its count); a quote
without a source or a rating without a count is dropped with a warning. Nothing is published."""
import argparse, csv, json, pathlib, subprocess, sys

CORE = pathlib.Path(__file__).resolve().parents[1]
SIZES = {"9:16": (1080, 1920), "1:1": (1080, 1080), "4:5": (1080, 1350), "16:9": (1920, 1080)}
ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("csv"); ap.add_argument("--out", required=True); ap.add_argument("--aspects", default="9:16"); ap.add_argument("--only"); ap.add_argument("--dry-run", action="store_true")
a = ap.parse_args()
out = pathlib.Path(a.out).resolve(); out.mkdir(parents=True, exist_ok=True)
rows = list(csv.DictReader(open(a.csv, encoding="utf-8")))
if a.only: rows = [r for r in rows if r["id"] in a.only.split(",")]
PY = sys.executable

def props_of(r):
    g = lambda k: (r.get(k) or "").strip()
    p = {"hook": g("hook"), "hookType": g("hook_type") or "claim", "product": g("product"), "benefits": [b for b in (g("benefit1"), g("benefit2"), g("benefit3")) if b], "cta": g("cta") or "Learn more"}
    # every optional field is written, empty or not: the renderer fills missing props from the template's demo defaults
    p.update({"tagline": g("tagline"), "offer": g("offer"), "image": g("image"), "proof": None})
    for k in ("color", "icon", "motion"):
        if g(k): p[k] = g(k)
    proof = {}
    if g("proof_quote"):
        if g("proof_source"): proof.update(quote=g("proof_quote"), source=g("proof_source"))
        else: print(f"  [{g('id')}] proof_quote dropped: a quote needs its source")
    if g("proof_rating"):
        if g("proof_count"): proof.update(rating=float(g("proof_rating")), count=g("proof_count"))
        else: print(f"  [{g('id')}] proof_rating dropped: a rating needs its count (e.g. '1,240 reviews')")
    if proof: p["proof"] = proof
    return p

def cues(p):
    c = [{"kind": "impact", "t": 0.05, "gain": 0.5}, {"kind": "whoosh", "t": 2.25, "gain": 0.4, "dur": 0.4}, {"kind": "pop", "t": 2.55, "gain": 0.45}]
    c += [{"kind": "pop", "t": round(5.15 + i * 1.1, 2), "gain": 0.4} for i in range(len(p["benefits"]))]
    if p.get("proof"): c += [{"kind": "whoosh", "t": 9.25, "gain": 0.35, "dur": 0.4}] + ([{"kind": "ticks", "t": 9.6, "gain": 0.25, "dur": 0.7}] if p["proof"].get("rating") else [])
    c += [{"kind": "whoosh", "t": 11.4, "gain": 0.5, "dur": 0.4}, {"kind": "impact", "t": 11.62, "gain": 0.55}, {"kind": "chime", "t": 12.1, "gain": 0.35}]
    return c

def sh(cmd, **kw):
    r = subprocess.run(cmd, cwd=CORE, capture_output=True, text=True, **kw)
    if r.returncode: raise SystemExit(f"failed: {' '.join(map(str, cmd[:4]))} ...\n{(r.stderr or r.stdout)[-600:]}")
    return r

made = []
for r in rows:
    p = props_of(r); vid = r["id"].strip()
    if not p["hook"] or not p["product"]: print(f"  [{vid}] skipped: hook and product are required"); continue
    for asp in a.aspects.split(","):
        W, H = SIZES[asp.strip()]; tag = f"{vid}_{asp.replace(':', 'x')}"
        pj = out / f"{tag}.props.json"; pj.write_text(json.dumps({**p, "size": [W, H]}, ensure_ascii=False, indent=1))
        if a.dry_run: print(f"  {tag}: props written"); continue
        silent, cj, sfx, bed, mix, final = out / f"{tag}.silent.mp4", out / f"{tag}.cues.json", out / f"{tag}.sfx.wav", out / f"{tag}.bed.wav", out / f"{tag}.mix.m4a", out / f"{tag}.mp4"
        sh(["npx", "remotion", "render", "src/index.ts", "AdSpot", str(silent), f"--props={pj}", "--codec", "h264", "--crf", "18", "--concurrency=4", "--log", "error"])
        cj.write_text(json.dumps(cues(p)))
        sh([PY, "tools/sfx_synth.py", "--cues", str(cj), "--duration", "15", "--out", str(sfx)])
        sh([PY, "tools/make_pulse_track.py", "--bpm", "120", "--dur", "15", "--mood", "bright", "--out", str(bed)])
        sh(["ffmpeg", "-v", "error", "-y", "-i", str(bed), "-i", str(sfx), "-filter_complex", "[0:a]volume=0.45[m];[m][1:a]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=7,volume=1.5dB,alimiter=limit=0.84:level=false", "-ar", "48000", "-c:a", "aac", "-b:a", "160k", str(mix)])
        sh(["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(mix), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy", "-shortest", str(final)])
        for x in (silent, sfx, bed, mix, cj): x.unlink(missing_ok=True)
        made.append((vid, asp, final)); print(f"  {tag}.mp4")

if made:   # index sheet: hook | benefits | CTA for every variant (first aspect)
    from PIL import Image, ImageDraw
    firsts = [m for m in made if m[1] == a.aspects.split(",")[0]]
    shots = []
    for vid, asp, f in firsts:
        row = []
        for t in (1.6, 7.6, 13.0):
            png = out / f"_{vid}_{t}.png"; sh(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(f), "-frames:v", "1", "-vf", "scale=-1:480", str(png)]); row.append(Image.open(png).convert("RGB")); png.unlink()
        shots.append((vid, row))
    w, h = shots[0][1][0].size; S = Image.new("RGB", (3 * (w + 8) + 8, len(shots) * (h + 40) + 8), "#151515"); d = ImageDraw.Draw(S)
    for i, (vid, row) in enumerate(shots):
        for j, im in enumerate(row): S.paste(im, (8 + j * (w + 8), 8 + i * (h + 40)))
        d.text((8, 8 + i * (h + 40) + h + 8), f"{vid}: hook | benefits | CTA", fill="#ffd84a")
    S.save(out / "index.jpg", quality=85); print(f"index -> {out / 'index.jpg'}")
