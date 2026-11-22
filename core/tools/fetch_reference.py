#!/usr/bin/env python
"""fetch_reference.py - download a reference video (any public link) so it can be measured frame by frame.

  python tools/fetch_reference.py <url> [--out DIR] [--height 1080] [--audio-only] [--force]
  python tools/fetch_reference.py <url> --print-path            # only the file path (for other tools)

Order of methods (the first that returns a playable file wins):
  1. yt-dlp            YouTube, Shorts, X/Twitter, Instagram, TikTok, Reddit, Vimeo, Facebook, Twitch, Bluesky, ...
                       env VIDBUCKS_COOKIES_BROWSER=chrome|safari|firefox adds --cookies-from-browser (set it yourself:
                       it uses YOUR browser session, needed for login-walled Instagram/X posts)
  2. media API         Vidbucks' fallback route: the link goes to a download service running on your own machine
                       (env VIDBUCKS_MEDIA_API, e.g. http://localhost:9000; optional VIDBUCKS_MEDIA_API_KEY) and
                       whatever it returns is saved: one file, every item of a multi-item post, or separate video and
                       audio streams that are merged here with ffmpeg.
  3. nothing worked    exit 2 with the errors; the agent falls back to the Browser-pane viewing pass.

Writes DIR/source.<ext> (+ DIR/source-<n>.<ext> for extra items of a multi-item post) and DIR/source.json
{url, method, files, duration_s, width, height, fetched_at}. Cached: a second call returns the file unless --force.
Default DIR: knowledge/references/_fetch/<slug>/ (knowledge/references/ is git-ignored: downloaded media is never committed).
Use: local measurement of form (cuts, pacing, palette, sound). Re-uploading or reusing the footage in an output is the
user's call and their responsibility.
"""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, time, urllib.request, urllib.error

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
REFS = os.path.join(ROOT, "knowledge", "references")
ENV_FILE = os.path.join(ROOT, "core", ".env")
VIDEO_EXT = (".mp4", ".mkv", ".webm", ".mov", ".m4v")
MEDIA_EXT = VIDEO_EXT + (".m4a", ".mp3", ".opus", ".ogg", ".wav", ".jpg", ".jpeg", ".png", ".webp", ".gif")


def env(name, default=""):
    if os.environ.get(name):
        return os.environ[name]
    if os.path.exists(ENV_FILE):
        for line in open(ENV_FILE, encoding="utf-8"):
            k, _, v = line.strip().partition("=")
            if k == name and v:
                return v.strip().strip('"')
    return default


def slug_for(url):
    u = re.sub(r"^https?://(www\.|m\.)?", "", url.strip())
    host = u.split("/")[0].replace(".com", "").replace(".", "-")
    vid = re.search(r"(?:v=|youtu\.be/|shorts/|status/|reel/|p/|video/)([A-Za-z0-9_-]{5,})", u)
    tail = vid.group(1) if vid else hashlib.sha1(url.encode()).hexdigest()[:10]
    return re.sub(r"[^a-z0-9-]+", "-", f"{host}-{tail}".lower()).strip("-")[:60]


def probe(path):
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height",
                            "-of", "json", path], capture_output=True, text=True, timeout=60)
        j = json.loads(r.stdout or "{}")
        v = next((s for s in j.get("streams", []) if s.get("codec_type") == "video"), {})
        return {"duration_s": round(float(j.get("format", {}).get("duration") or 0), 2), "width": v.get("width"), "height": v.get("height"),
                "has_audio": any(s.get("codec_type") == "audio" for s in j.get("streams", []))}
    except Exception:
        return {"duration_s": 0}


def playable(path):
    if not os.path.exists(path) or os.path.getsize(path) < 2048:
        return False
    if path.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        return True
    return probe(path).get("duration_s", 0) > 0


# ------------------------------------------------------------------ 1. yt-dlp
def via_ytdlp(url, out, height, audio_only):
    if not shutil.which("yt-dlp"):
        raise RuntimeError("yt-dlp not installed (pip install yt-dlp)")
    fmt = "ba/b" if audio_only else (f"bv*[height<={height}][ext=mp4]+ba[ext=m4a]/bv*[height<={height}]+ba/"
                                     f"b[height<={height}]/bv*+ba/b")
    cmd = ["yt-dlp", "--no-playlist", "--no-warnings", "--restrict-filenames", "-f", fmt,
           "-o", os.path.join(out, "source.%(ext)s"), "--print", "after_move:filepath"]
    if not audio_only:
        cmd += ["--merge-output-format", "mp4"]
    cb = env("VIDBUCKS_COOKIES_BROWSER")
    if cb:
        cmd += ["--cookies-from-browser", cb]
    r = subprocess.run(cmd + [url], capture_output=True, text=True, timeout=1800)
    paths = [l.strip() for l in r.stdout.splitlines() if l.strip() and os.path.exists(l.strip())]
    if r.returncode != 0 or not paths:
        raise RuntimeError("yt-dlp: " + (r.stderr.strip().splitlines() or ["no file"])[-1][:300])
    return paths


# ------------------------------------------------------------------ 2. media API (self-hosted, see docs/reference-fetch.md)
def _post(api, body, key):
    req = urllib.request.Request(api.rstrip("/") + "/", data=json.dumps(body).encode(), method="POST",
                                 headers={"Accept": "application/json", "Content-Type": "application/json",
                                          "User-Agent": "vidbucks-fetch/1.0", **({"Authorization": f"Api-Key {key}"} if key else {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode())
        except Exception:
            raise RuntimeError(f"media API HTTP {e.code}")


def _get(link, path):
    req = urllib.request.Request(link, headers={"User-Agent": "vidbucks-fetch/1.0"})
    with urllib.request.urlopen(req, timeout=1800) as resp, open(path, "wb") as f:
        shutil.copyfileobj(resp, f, 1 << 20)
    return path


def _ext(name, fallback):
    e = os.path.splitext(name or "")[1].lower()
    return e if e in MEDIA_EXT else fallback


def via_media_api(url, out, height, audio_only):
    api = env("VIDBUCKS_MEDIA_API")
    if not api:
        raise RuntimeError("media API not configured (set VIDBUCKS_MEDIA_API to a self-hosted instance, see docs/reference-fetch.md)")
    body = {"url": url, "videoQuality": str(height), "downloadMode": "audio" if audio_only else "auto", "alwaysProxy": True}
    j = _post(api, body, env("VIDBUCKS_MEDIA_API_KEY"))
    st = j.get("status")
    if st in ("tunnel", "redirect"):          # one file behind a link
        return [_get(j["url"], os.path.join(out, "source" + _ext(j.get("filename"), ".mp4")))]
    if st == "picker":                        # several items (carousel, thread)
        files = []
        for i, it in enumerate(j.get("picker", [])):
            ext = ".mp4" if it.get("type") in ("video", "gif") else ".jpg"
            files.append(_get(it["url"], os.path.join(out, ("source" if i == 0 else f"source-{i}") + ext)))
        if j.get("audio"):
            files.append(_get(j["audio"], os.path.join(out, "source-audio" + _ext(j.get("audioFilename"), ".mp3"))))
        return files
    if st == "local-processing":              # separate streams: fetch each, combine here
        kind, links = j.get("type"), j.get("tunnel", [])
        oext = _ext((j.get("output") or {}).get("filename"), ".mp4")
        parts = [_get(t, os.path.join(out, f"_part{i}")) for i, t in enumerate(links)]
        dst = os.path.join(out, "source" + oext)
        if kind == "merge" and len(parts) >= 2:
            cmd = ["ffmpeg", "-y", "-v", "error", "-i", parts[0], "-i", parts[1], "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", dst]
        elif kind == "audio":
            dst = os.path.join(out, "source.m4a")
            cmd = ["ffmpeg", "-y", "-v", "error", "-i", parts[0], "-vn", "-c:a", "aac", "-b:a", "192k", dst]
        else:   # mute / remux / gif
            cmd = ["ffmpeg", "-y", "-v", "error", "-i", parts[0], "-c", "copy", dst]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:   # a copy can fail on odd containers: re-encode once
            cmd = cmd[:-3] + ["-c:v", "libx264", "-crf", "16", "-c:a", "aac", dst] if kind == "merge" else cmd
            subprocess.run(cmd, capture_output=True, text=True)
        for p in parts:
            os.path.exists(p) and os.remove(p)
        return [dst]
    err = (j.get("error") or {}).get("code") or j.get("text") or str(j)[:200]
    raise RuntimeError(f"media API: {st or 'no status'} {err}")


METHODS = [("yt-dlp", via_ytdlp), ("media-api", via_media_api)]


def fetch(url, out=None, height=1080, audio_only=False, force=False, quiet=False):
    """Download `url` into `out` (default knowledge/references/_fetch/<slug>). Returns the source.json dict; raises if all methods fail."""
    out = out or os.path.join(REFS, "_fetch", slug_for(url))
    os.makedirs(out, exist_ok=True)
    meta_p = os.path.join(out, "source.json")
    if not force and os.path.exists(meta_p):
        m = json.load(open(meta_p))
        if m.get("url") == url and m.get("files") and all(playable(os.path.join(out, f)) for f in m["files"]):
            quiet or print(f"cached: {os.path.join(out, m['files'][0])}")
            return dict(m, dir=out)
    errors = []
    for name, fn in METHODS:
        try:
            quiet or print(f"trying {name} ...", flush=True)
            paths = [p for p in fn(url, out, height, audio_only) if playable(p)]
            if not paths:
                raise RuntimeError("no playable file")
            main = next((p for p in paths if p.lower().endswith(VIDEO_EXT)), paths[0])
            info = probe(main)
            m = {"url": url, "method": name, "files": [os.path.basename(main)] + [os.path.basename(p) for p in paths if p != main],
                 **info, "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                 "use": "local measurement of form; reuse in an output is the user's call"}
            json.dump(m, open(meta_p, "w"), indent=1)
            quiet or print(f"OK {name}: {main} ({info.get('duration_s')} s, {info.get('width')}x{info.get('height')})")
            return dict(m, dir=out)
        except Exception as e:
            errors.append(f"{name}: {e}")
            quiet or print(f"  {name} failed: {e}", flush=True)
    raise RuntimeError("all methods failed:\n  " + "\n  ".join(errors))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("url"); ap.add_argument("--out"); ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--audio-only", action="store_true"); ap.add_argument("--force", action="store_true")
    ap.add_argument("--print-path", action="store_true")
    a = ap.parse_args()
    try:
        m = fetch(a.url, a.out, a.height, a.audio_only, a.force, quiet=a.print_path)
    except RuntimeError as e:
        print(str(e), file=sys.stderr)
        print("fallback: view the link in the Browser pane (visual pass) and say what stays unknown", file=sys.stderr)
        sys.exit(2)
    print(os.path.join(m["dir"], m["files"][0]) if a.print_path else json.dumps({k: v for k, v in m.items()}, indent=1))


if __name__ == "__main__":
    main()
