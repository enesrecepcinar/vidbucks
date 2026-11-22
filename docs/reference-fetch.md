# Reference download (`core/tools/fetch_reference.py`)

Vidbucks downloads a reference video so it can be measured frame by frame (cuts, shot lengths, palette, motion,
transitions, loudness, tempo, transcript, shot review). `analyze_reference.py --link <url>` does it on its own;
`--no-fetch` keeps the old metadata-and-captions-only mode.

```
python core/tools/fetch_reference.py <url>                 # -> knowledge/references/_fetch/<slug>/source.mp4 + source.json
python core/tools/fetch_reference.py <url> --height 720    # smaller file
python core/tools/fetch_reference.py <url> --audio-only    # sound only (tempo, loudness, voice pace)
python core/tools/analyze_reference.py --link <url>        # metadata + captions + download + full file measurement
```

## Methods, in order
1. **yt-dlp** (`pip install yt-dlp` / `brew install yt-dlp`): YouTube, Shorts, X/Twitter, Instagram, TikTok, Reddit,
   Vimeo, Facebook, Twitch, Bluesky and many more. Keep it updated (`yt-dlp -U` or `brew upgrade yt-dlp`): platforms
   change often and most failures are fixed by an update.
   Login-walled posts (some Instagram / X / Facebook): set `VIDBUCKS_COOKIES_BROWSER=chrome` (or safari, firefox) with
   `node core/tools/doctor.mjs --set VIDBUCKS_COOKIES_BROWSER=chrome`. yt-dlp then reads YOUR browser's session for that
   download; the assistant never sets this on its own.
2. **Media API** (Vidbucks' fallback route when yt-dlp fails): the link is sent to a download service running on your
   own machine, set with `node core/tools/doctor.mjs --set VIDBUCKS_MEDIA_API=http://localhost:9000` (optional
   `VIDBUCKS_MEDIA_API_KEY`). Whatever it returns is saved: one file, every item of a multi-item post (`source.mp4`,
   `source-1.jpg`...), or separate video and audio streams that Vidbucks merges locally with ffmpeg.
3. **All failed** -> exit code 2 and the errors; the agent falls back to the view-only Browser-pane pass.

## Where files go
`knowledge/references/` is git-ignored, so downloaded media never reaches a commit. `source.json` records the URL,
method, size and time. Using the downloaded footage inside a finished video, or publishing it, is the user's decision
and responsibility; by default Vidbucks measures the form and builds the output from licensed or generated material.
