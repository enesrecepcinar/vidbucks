#!/usr/bin/env python
"""gates.py - three cheap approvals before an expensive build: STORY -> LOOK -> BOARD. Nothing is fully rendered
until all three are approved by the user (a wrong story or look costs a whole build; a text table costs a minute).

  python tools/gates.py story   <project_dir>                       # story.json -> STORY.md (the beat table to show)
  python tools/gates.py look    <project_dir> --comp <Id> --at 2.2,9.7,16.5 [--props props.json]   # 2-4 full style frames -> look.jpg
  python tools/gates.py board   <project_dir> --comp <Id> [--props props.json]                     # one panel per beat -> board.jpg
  python tools/gates.py approve <project_dir> story|look|board [--notes "..."] [--panels-down 3,7]
  python tools/gates.py status  <project_dir>
  python tools/gates.py check   <project_dir>                       # exit 1 unless all three are approved (run before a full render)

story.json: {"title", "idea": one line, "device": the sayable device, "format", "style", "length_s", "bpm"?,
  "beats": [{"t": 0.0, "title": "...", "what": "what we see / hear", "bridge": "how it joins the next beat", "sound": "role of the sound: silence, the loudest hit, a riser ..."}]}
Gate state lives in <project_dir>/gates.json (with notes and the panels marked down). A change to story.json after its
approval re-opens the story gate (and the later ones), so an approved plan cannot drift silently."""
import argparse, datetime, hashlib, json, pathlib, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

CORE = pathlib.Path(__file__).resolve().parents[1]
ORDER = ["story", "look", "board"]

def font(sz):
    for f in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        try: return ImageFont.truetype(f, sz)
        except Exception: pass
    return ImageFont.load_default()

def state(pd):
    p = pd / "gates.json"; return json.loads(p.read_text()) if p.exists() else {g: {"status": "open"} for g in ORDER}
def save(pd, s): (pd / "gates.json").write_text(json.dumps(s, indent=1, ensure_ascii=False))
def story_hash(pd): return hashlib.sha1((pd / "story.json").read_bytes()).hexdigest()[:12]

def reopen_if_changed(pd, s):
    if s.get("story", {}).get("status") == "approved" and s["story"].get("hash") != story_hash(pd):
        for g in ORDER: s[g] = {"status": "open", "why": "story.json changed after approval"}
        save(pd, s); print("story.json changed after approval: all gates re-opened")
    return s

def still(comp, frame, out, props=None, scale=0.5):
    cmd = ["npx", "remotion", "still", "src/index.ts", comp, str(out), "--frame", str(frame), "--scale", str(scale), "--log", "error"] + ([f"--props={pathlib.Path(props).resolve()}"] if props else [])
    subprocess.run(cmd, cwd=CORE, check=True)

def cmd_story(a):
    pd = pathlib.Path(a.dir); S = json.loads((pd / "story.json").read_text())
    rows = ["| # | time | beat | what we see / hear | bridge to next | sound |", "|---|---|---|---|---|---|"]
    for i, b in enumerate(S["beats"], 1):
        rows.append(f"| {i} | {b['t']:.1f}s | {b.get('title', '')} | {b.get('what', '')} | {b.get('bridge', '')} | {b.get('sound', '')} |")
    head = [f"# {S.get('title', 'Story')}", "", f"**Idea:** {S.get('idea', '')}", f"**Device:** {S.get('device', '')}",
            f"**Format / style / length:** {S.get('format', '')} · {S.get('style', '')} · {S.get('length_s', '?')} s" + (f" · {S['bpm']} BPM" if S.get("bpm") else ""), ""]
    (pd / "STORY.md").write_text("\n".join(head + rows) + "\n\nApprove / change beats / different angle?\n")
    s = state(pd); s["story"] = {"status": "shown", "hash": story_hash(pd), "at": datetime.datetime.now().isoformat(timespec="seconds")}; save(pd, s)
    print((pd / "STORY.md").read_text())

def sheet(paths, labels, out, cols, title=None):
    ims = [Image.open(p).convert("RGB") for p in paths]; w, h = ims[0].size; pad = 12; top = 60 if title else 0
    rows = -(-len(ims) // cols); S = Image.new("RGB", (cols * (w + pad) + pad, top + rows * (h + 56 + pad) + pad), "#151515"); d = ImageDraw.Draw(S)
    if title: d.text((pad, 14), title, fill="white", font=font(30))
    for i, (im, lab) in enumerate(zip(ims, labels)):
        x = pad + (i % cols) * (w + pad); y = top + pad + (i // cols) * (h + 56 + pad)
        S.paste(im, (x, y)); d.text((x, y + h + 6), lab, fill="#ffd84a", font=font(20))
    S.save(out, quality=86); return out

def cmd_look(a):
    pd = pathlib.Path(a.dir); s = reopen_if_changed(pd, state(pd))
    if s["story"]["status"] != "approved": raise SystemExit("story gate is not approved yet: show STORY.md first")
    fps = 30; ts = [float(x) for x in a.at.split(",")]; outs = []
    for k, t in enumerate(ts):
        o = pd / f"look_{k}.png"; still(a.comp, int(round(t * fps)), o, a.props, 0.5); outs.append(o)
    sheet(outs, [f"{t:.1f}s" for t in ts], pd / "look.jpg", cols=min(len(outs), 2), title="LOOK: these frames set the style. Approve / change?")
    for o in outs: o.unlink()
    s["look"] = {"status": "shown", "at": datetime.datetime.now().isoformat(timespec="seconds"), "frames": ts}; save(pd, s); print(pd / "look.jpg")

def cmd_board(a):
    pd = pathlib.Path(a.dir); s = reopen_if_changed(pd, state(pd))
    if s["look"]["status"] != "approved": raise SystemExit("look gate is not approved yet")
    S = json.loads((pd / "story.json").read_text()); fps = 30; outs, labs = [], []
    ends = [b["t"] for b in S["beats"][1:]] + [S.get("length_s", S["beats"][-1]["t"] + 4)]
    for i, (b, e) in enumerate(zip(S["beats"], ends), 1):
        t = b.get("key", b["t"] + 0.6 * (e - b["t"]))           # 60 % into the beat: after its action has happened
        o = pd / f"board_{i:02d}.png"; still(a.comp, int(round(t * fps)), o, a.props, 0.3); outs.append(o)
        labs.append(f"{i}. {b.get('title', '')[:28]}  ·  {b.get('sound', '')[:24]}")
    sheet(outs, labs, pd / "board.jpg", cols=4, title=f"STORYBOARD: thumbs up/down by panel number ({len(outs)} beats)")
    for o in outs: o.unlink()
    s["board"] = {"status": "shown", "at": datetime.datetime.now().isoformat(timespec="seconds")}; save(pd, s); print(pd / "board.jpg")

def cmd_approve(a):
    pd = pathlib.Path(a.dir); s = reopen_if_changed(pd, state(pd)); g = a.gate
    prev = ORDER[: ORDER.index(g)]
    if any(s[p]["status"] != "approved" for p in prev): raise SystemExit(f"approve {', '.join(prev)} first")
    if a.panels_down:
        s[g] = {**s[g], "status": "changes", "panels_down": [int(x) for x in a.panels_down.split(",")], "notes": a.notes}
        save(pd, s); print(f"{g}: panels {a.panels_down} down -> redraw them, show the board again"); return
    s[g] = {**s[g], "status": "approved", "notes": a.notes, "approved_at": datetime.datetime.now().isoformat(timespec="seconds")}
    if g == "story": s[g]["hash"] = story_hash(pd)
    save(pd, s); print(f"{g}: approved")

def cmd_status(a):
    pd = pathlib.Path(a.dir); s = reopen_if_changed(pd, state(pd))
    for g in ORDER: print(f"{g:6} {s[g]['status']:9} {s[g].get('notes') or ''} {('panels down ' + str(s[g]['panels_down'])) if s[g].get('panels_down') else ''}")

def cmd_check(a):
    pd = pathlib.Path(a.dir); s = reopen_if_changed(pd, state(pd))
    missing = [g for g in ORDER if s[g]["status"] != "approved"]
    if missing: print("GATES CLOSED: " + ", ".join(f"{g} ({s[g]['status']})" for g in missing) + " -> no full render yet"); sys.exit(1)
    print("GATES OPEN: story, look and board approved")

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter); sp = ap.add_subparsers(dest="cmd", required=True)
    for n in ("story", "look", "board", "approve", "status", "check"):
        p = sp.add_parser(n); p.add_argument("dir")
        if n in ("look", "board"): p.add_argument("--comp", required=True); p.add_argument("--props")
        if n == "look": p.add_argument("--at", required=True)
        if n == "approve": p.add_argument("gate", choices=ORDER); p.add_argument("--notes", default=""); p.add_argument("--panels-down")
    a = ap.parse_args()
    {"story": cmd_story, "look": cmd_look, "board": cmd_board, "approve": cmd_approve, "status": cmd_status, "check": cmd_check}[a.cmd](a)

if __name__ == "__main__":
    main()
