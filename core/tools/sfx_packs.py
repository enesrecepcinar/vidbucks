#!/usr/bin/env python
"""sfx_packs.py - install real, CC0-licensed sound-effect packs next to the synthesised library and index them.

  python tools/sfx_packs.py install sfx-kit uisfx opus     # fetch (sparse git, audio folders only), copy, index
  python tools/sfx_packs.py install sfx-kit --src <clone>   # use an existing clone instead of fetching
  python tools/sfx_packs.py list [--kind whoosh]            # what is installed, per kind
  python tools/sfx_packs.py remove uisfx

Files go to public/audio-lib/packs/<pack>/ (git-ignored, like the rest of the library); the index is
public/audio-lib/packs/index.json. Every entry keeps its licence, source URL and commit, the pack's sync point
(the sample time that must meet the picture: a hit's transient, a riser's arrival), its loudness, and the cue
kinds it can play (`kinds`), so tools/sfx_synth.py can use a real sample for a cue and fall back to synthesis.

Only packs whose licence was read in the repository itself are listed in PACKS (all CC0 1.0, no attribution
required; we still keep the source per file). Repositories are fetched as data: nothing in them is executed."""
import argparse, hashlib, json, pathlib, re, shutil, subprocess, sys, tempfile
import numpy as np, soundfile as sf

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "audio-lib" / "packs"
INDEX = OUT / "index.json"

PACKS = {
    "sfx-kit": {"repo": "https://github.com/wyzowl/sfx-kit", "license": "CC0-1.0", "creator": "Wyzowl SFX Kit",
                "licence_file": "LICENSE", "paths": ["/sounds/", "/sounds.json", "/LICENSE*"]},
    "uisfx": {"repo": "https://github.com/romainsimon/uisfx", "license": "CC0-1.0", "creator": "uisfx",
              "licence_file": "LICENSE-AUDIO", "paths": ["/packages/uisfx/sounds/**/*.mp3", "/LICENSE*"]},
    "opus": {"repo": "https://github.com/Tguntenaar/opus-sound-directory", "license": "CC0-1.0", "creator": "Opus Sound Directory",
             "licence_file": "ASSETS-LICENSE.md", "paths": ["/public/assets/*/out.mp3", "/ASSETS-LICENSE.md"]},
}

# Our cue kinds (tools/sfx_synth.py) -> sfx-kit ids, best first. Several ids = takes that rotate, so repeats differ.
SFXKIT_KINDS = {
    "pop": ["pop-small-in", "pop-medium-in", "pop-small-bubble", "pop-medium-bubble"],
    "slide": ["foley-paper-slide", "foley-card-slide", "foley-wood-slide"],
    "whoosh": ["whoosh-medium-medium", "whoosh-medium-soft", "whoosh-slow-medium", "whoosh-fast-medium"],
    "whip": ["whoosh-fast-medium", "swish-medium", "whoosh-fast-hard", "swish-hard"],
    "zip": ["zip-in-medium", "zip-out-medium", "zip-in-soft"],
    "swipe": ["swipe-medium-soft", "swipe-fast-soft", "swipe-medium-firm"],
    "marker": ["writing-marker-draw", "writing-marker-write", "writing-highlighter"],
    "highlight": ["writing-highlighter"],
    "pencil": ["writing-pencil-draw", "writing-pencil-write", "writing-pen-draw"],
    "chalk": ["writing-chalk-write", "writing-chalk-draw"],
    "scribble": ["writing-scribble"], "erase": ["writing-eraser", "writing-wipe"],
    "tick": ["data-tick", "click-tap-soft"],
    "ticks": ["data-countup-medium", "data-countup-short", "data-countup-long", "time-clock-fast"],
    "click": ["click-mouse-medium", "click-button-medium", "click-mouse-soft"],
    "tap": ["click-tap-medium", "click-tap-soft"],
    "toggle": ["click-toggle-on-medium", "click-toggle-off-medium"],
    "snip": ["props-scissors"],
    "stamp": ["impact-medium-firm", "mechanical-latch-heavy"],
    "impact": ["impact-medium-hard", "impact-heavy-firm", "impact-medium-firm"],
    "thunk": ["data-number-land", "impact-light-firm"],
    "thud": ["foley-wood-touch", "impact-light-soft"],
    "boom": ["boom-hit-strong", "boom-hit-medium", "cinematic-drum-big"],
    "hit": ["cinematic-slam-big", "cinematic-drum-big", "cinematic-metal-big"],
    "subdrop": ["bass-sub-drop-medium", "bass-sub-drop-short", "bass-808-medium"],
    "riser": ["riser-1s-soft", "riser-2s-soft", "riser-4s-soft", "riser-1s-strong", "riser-2s-strong", "riser-4s-strong"],
    "faller": ["faller-1s-soft", "faller-2s-soft", "faller-4s-soft"],
    "reverse": ["reverse-whoosh-medium-soft", "reverse-whoosh-short-soft", "reverse-whoosh-long-soft"],
    "snap": ["click-snap-firm", "click-snap-medium"],
    "knife": ["swish-hard", "swish-medium"],
    "glock": ["tone-ding-high", "tone-ding-mid"],
    "paper": ["foley-paper-touch", "props-page-turn"],
    "pageturn": ["props-page-turn"],
    "key": ["keyboard-letter-medium", "keyboard-letter-soft", "keyboard-letter-firm"],
    "keys": ["keyboard-typing-steady-short", "keyboard-typing-steady-medium", "keyboard-typing-steady-long", "keyboard-typing-quick-short"],
    "shutter": ["mechanical-shutter-light", "mechanical-shutter-heavy"],
    "blip": ["digital-blip-clear", "digital-blip-subtle"],
    "blipup": ["tone-step-3", "notification-message-out-soft"],
    "bell": ["tone-ding-mid", "props-shop-bell"],
    "swell": ["shimmer-medium-soft", "shimmer-long-soft"],
    "sparkle": ["shimmer-short-sparkle", "shimmer-medium-sparkle"],
    "boing": ["move-bounce", "move-spring"],
    "chime": ["notification-success-chime", "notification-success-soft", "notification-success-warm"],
    "success": ["notification-success-clear", "notification-success-pluck", "notification-success-bubble"],
    "fanfare": ["notification-success-fanfare", "notification-success-flourish"],
    "fail": ["notification-failure-minor", "notification-failure-low", "notification-failure-wobble"],
    "error": ["notification-error-soft", "digital-denied"],
    "msgin": ["notification-message-in-soft", "notification-message-in-clear"],
    "msgout": ["notification-message-out-soft", "notification-message-out-clear"],
    "notify": ["notification-alert-soft", "notification-attention-soft"],
    "glitch": ["digital-glitch-clear", "digital-glitch-subtle", "digital-scramble"],
    "scan": ["digital-scan-clear", "digital-scan-subtle"],
    "powerup": ["digital-power-up"], "powerdown": ["digital-power-down"],
    "static": ["digital-static", "digital-interference"],
    "appear": ["appear-materialise", "appear-poof", "appear-burst"],
    "flip": ["appear-flip-quick", "appear-flip-slow"],
    "morph": ["transform-morph", "transform-grow", "transform-stretch"],
    "grow": ["transform-grow", "data-bar-grow"], "shrink": ["transform-shrink", "transform-deflate"],
    "zoomin": ["move-zoom-in"], "zoomout": ["move-zoom-out"], "spin": ["move-spin"],
    "chart": ["data-chart-reveal", "data-bar-grow"], "progress": ["data-progress-short", "data-progress-long"],
    "sting": ["sting-minimal-short", "sting-bright-short", "sting-warm-short", "sting-tech-short"],
    "stinglong": ["sting-bold-long", "sting-warm-long", "sting-airy-long"],
    "coin": ["money-coin-drop", "money-coin-spin"], "cash": ["money-register", "money-notes"],
    "applause": ["celebration-applause-small", "celebration-applause-big"], "confetti": ["celebration-confetti", "celebration-popper"],
    "fireworks": ["celebration-fireworks"],
    "ring": ["phone-ring-modern", "phone-ring-classic"], "vibrate": ["phone-vibrate-table", "phone-vibrate-hand"],
    "alarm": ["time-alarm"], "clock": ["time-clock", "time-stopwatch"], "countdown": ["time-countdown", "time-timer"],
    "latch": ["mechanical-latch-light", "mechanical-lock-light"], "ratchet": ["mechanical-ratchet-light"],
    "switch": ["mechanical-switch-light", "mechanical-switch-heavy"],
    "box": ["props-box-open"], "book": ["props-book-close"], "tape": ["props-tape"], "drip": ["props-drip"], "splash": ["props-splash"],
    "doorbell": ["props-doorbell"],
}
# uisfx names (same 156 in each of 12 themes) -> kinds. Used for UI-heavy films and when a theme is asked for.
UISFX_KINDS = {"click": ["press", "select", "tap", "double-click"], "tap": ["press"], "toggle": ["toggle-on", "toggle-off"],
               "blip": ["hover", "focus"], "success": ["success", "complete", "check"], "chime": ["achievement", "reward", "level-up"],
               "fanfare": ["level-up", "achievement"], "fail": ["error", "invalid-drop"], "error": ["error", "blocked", "warning"],
               "msgin": ["receive", "notification", "mention"], "msgout": ["send"], "notify": ["notification", "info"],
               "pop": ["open", "expand", "drop"], "thud": ["drop"], "coin": ["purchase", "add-to-cart", "coupon", "bonus"],
               "keys": ["typing"], "swipe": ["swipe"], "snap": ["snap"], "latch": ["lock", "unlock"], "sparkle": ["streak", "badge"],
               "powerup": ["wake", "start", "connect"], "powerdown": ["sleep", "stop", "disconnect"], "scan": ["scanning", "processing"],
               "progress": ["progress-step", "loading"]}
# opus slugs -> kinds (everything else is still indexed under its own slug and category)
OPUS_KINDS = {"trailer-braam-hit": ["braam", "hit"], "heavy-boom-meme": ["boom", "meme"], "drop-impact-heavy": ["impact", "hit"],
              "drop-whoosh-stinger": ["whoosh", "stinger"], "whoosh-pass-by": ["whoosh", "passby"], "endless-riser-shepard": ["riser", "tension"],
              "riser-tension-8s": ["riser", "tension"], "tape-stop-transition": ["tapestop"], "glitch-transition-digital": ["glitch"],
              "heartbeat-tension-12s": ["heartbeatbed", "tension"], "wah-wah-fail": ["fail", "meme"], "game-coin-pickup": ["coin"],
              "game-level-up": ["fanfare"], "ui-camera-shutter": ["shutter"], "ui-success-chime": ["chime", "success"],
              "ui-error-soft": ["error"], "ui-message-sent": ["msgout"], "ui-toggle-on": ["toggle"], "countdown-10-to-0": ["countdown"],
              "dialup-modem-56k": ["modem"], "logo-sting-bright": ["sting"], "logo-sting-dark-cinematic": ["sting", "stinglong"],
              "logo-sting-deep-bass": ["sting", "stinglong"], "logo-sting-organic": ["sting"], "guitar-chime-logo": ["sting"],
              "guitar-blues-bend-sting": ["sting"], "bouncing-dot-end-sting": ["sting"], "arcade-game-over": ["fail", "gameover"],
              "bass-wobble-drop-150": ["subdrop"], "explainer-era-dial-ticks": ["ticks"], "metric-counter-flash-ticks": ["ticks"]}
MUSIC_HINT = re.compile(r"(bed|loop|theme|underscore|story|fugue|drive|bowls|lofi|showreel|-\d+s$)")


def sh(*cmd, cwd=None):
    return subprocess.run(cmd, cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def fetch(pack, dest):
    """Sparse, blob-less clone of only the audio paths. Nothing in the clone is run."""
    p = PACKS[pack]
    sh("git", "clone", "--depth", "1", "--filter=blob:none", "--no-checkout", "--quiet", p["repo"], str(dest))
    sh("git", "sparse-checkout", "set", "--no-cone", *p["paths"], cwd=dest)
    sh("git", "checkout", "--quiet", "HEAD", cwd=dest)
    return dest


def measure(path):
    """duration, peak dBFS, onset (first sample within 30 dB of the peak), attack (first within 10 dB: the sync point), time of the peak."""
    x, sr = sf.read(str(path), always_2d=True); m = np.abs(x).max(axis=1)
    pk = float(m.max()) or 1e-9; on = int(np.argmax(m > pk * 0.0316)); at = int(np.argmax(m)); hit = int(np.argmax(m > pk * 0.3))
    return {"duration": round(len(x) / sr, 3), "peakDb": round(20 * np.log10(pk), 1), "onset": round(on / sr, 3), "peakAt": round(at / sr, 3), "attack": round(hit / sr, 3)}


def entry(pack, eid, rel, cat, kinds, tags, meta, src_url, commit, extra=None):
    p = PACKS[pack]
    e = {"id": eid, "kind": "sfx", "category": cat, "origin": "pack", "pack": pack, "file": rel, "kinds": kinds, "tags": tags,
         "creator": p["creator"], "license": p["license"], "attribution": False, "source": src_url, "commit": commit, **meta}
    e.update(extra or {}); return e


def install_sfxkit(src, commit):
    data = json.loads((src / "sounds.json").read_text()); rev = {}
    for k, ids in SFXKIT_KINDS.items():
        for i in ids: rev.setdefault(i, []).append(k)
    out = []
    for s in data["sounds"]:
        dst = OUT / "sfx-kit" / s["category"] / (s["id"] + ".flac"); dst.parent.mkdir(parents=True, exist_ok=True)
        x, sr = sf.read(str(src / s["file"]), always_2d=True); sf.write(str(dst), x, sr, format="FLAC")   # lossless: keeps the sync point exact
        meta = measure(dst)
        out.append(entry("sfx-kit", "kit-" + s["id"], str(dst.relative_to(ROOT / "public")), s["category"], rev.get(s["id"], []), s.get("tags", []), meta,
                         f"{PACKS['sfx-kit']['repo']}/blob/{commit}/{s['file']}", commit,
                         {"title": s.get("name", s["id"]), "sync": {"at": s["sync"].get("at", 0), "meets": s["sync"].get("meets", "instant")},
                          "lufs": s.get("level", {}).get("lufs"), "useFor": s.get("use_for", []), "avoidFor": s.get("avoid_for", []),
                          "fits": s.get("fits_seconds"), "rate": s.get("adapt", {}).get("rate")}))
    return out


def install_uisfx(src, commit):
    rev = {}
    for k, names in UISFX_KINDS.items():
        for n in names: rev.setdefault(n, []).append(k)
    out = []
    for f in sorted((src / "packages/uisfx/sounds").glob("*/*.mp3")):
        theme, name = f.parent.name, f.stem
        dst = OUT / "uisfx" / theme / f.name; dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(f, dst)
        meta = measure(dst)
        out.append(entry("uisfx", f"ui-{theme}-{name}", str(dst.relative_to(ROOT / "public")), "ui", rev.get(name, []), [theme, name, "ui"], meta,
                         f"{PACKS['uisfx']['repo']}/blob/{commit}/{f.relative_to(src)}", commit,
                         {"title": f"{name} ({theme})", "theme": theme, "sync": {"at": meta["attack"], "meets": "instant"}}))
    return out


def install_opus(src, commit):
    out = []
    for f in sorted((src / "public/assets").glob("*/out.mp3")):
        slug = f.parent.name; music = bool(MUSIC_HINT.search(slug)) and slug not in OPUS_KINDS
        dst = OUT / "opus" / (slug + ".mp3"); dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(f, dst)
        meta = measure(dst); kinds = OPUS_KINDS.get(slug, [])
        meets = "arrival" if any(k in ("riser", "tension") for k in kinds) else "instant"
        e = entry("opus", "opus-" + slug, str(dst.relative_to(ROOT / "public")), "music_pack" if music else "opus", kinds, [slug], meta,
                  f"{PACKS['opus']['repo']}/blob/{commit}/{f.relative_to(src)}", commit,
                  {"title": slug.replace("-", " "), "sync": {"at": meta["peakAt"] if meets == "arrival" else meta["attack"], "meets": meets}})
        if music: e["kind"] = "music"
        out.append(e)
    return out


def load_index():
    return json.loads(INDEX.read_text()) if INDEX.exists() else []


def main():
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd", required=True)
    i = sub.add_parser("install"); i.add_argument("packs", nargs="+", choices=list(PACKS)); i.add_argument("--src")
    l = sub.add_parser("list"); l.add_argument("--kind")
    r = sub.add_parser("remove"); r.add_argument("packs", nargs="+", choices=list(PACKS))
    a = ap.parse_args(); idx = load_index()
    if a.cmd == "list":
        by = {}
        for e in idx:
            for k in e.get("kinds", []): by.setdefault(k, []).append(e["id"])
        if a.kind: print("\n".join(by.get(a.kind, [])) or f"no sample for kind {a.kind}"); return
        packs = {}
        for e in idx: packs[e["pack"]] = packs.get(e["pack"], 0) + 1
        print("installed:", ", ".join(f"{p} {n}" for p, n in packs.items()) or "none")
        print(f"{len(by)} kinds have real samples:", " ".join(sorted(by))); return
    if a.cmd == "remove":
        for p in a.packs: shutil.rmtree(OUT / p, ignore_errors=True)
        idx = [e for e in idx if e["pack"] not in a.packs]; INDEX.write_text(json.dumps(idx, indent=1)); print("removed", ", ".join(a.packs)); return
    OUT.mkdir(parents=True, exist_ok=True)
    for p in a.packs:
        tmp = None
        src = pathlib.Path(a.src) if a.src else fetch(p, pathlib.Path(tmp := tempfile.mkdtemp(prefix=f"vb-{p}-")) / "repo")
        lic = src / PACKS[p]["licence_file"]
        if not lic.exists() or ("CC0" not in lic.read_text(errors="ignore") and "Creative Commons Zero" not in lic.read_text(errors="ignore")):
            sys.exit(f"{p}: licence file {lic.name} missing or not CC0 - not installing")
        commit = sh("git", "rev-parse", "HEAD", cwd=src)
        shutil.rmtree(OUT / p, ignore_errors=True)
        new = {"sfx-kit": install_sfxkit, "uisfx": install_uisfx, "opus": install_opus}[p](src, commit)
        idx = [e for e in idx if e["pack"] != p] + new
        shutil.copy2(lic, OUT / p / f"LICENSE-{p}.txt")
        if tmp: shutil.rmtree(tmp, ignore_errors=True)
        print(f"{p}: {len(new)} sounds, {sum(1 for e in new if e['kinds'])} mapped to cue kinds, commit {commit[:8]}, {PACKS[p]['license']}")
    INDEX.write_text(json.dumps(idx, indent=1))
    print(f"index: {INDEX.relative_to(ROOT)} ({len(idx)} entries)")


if __name__ == "__main__":
    main()
