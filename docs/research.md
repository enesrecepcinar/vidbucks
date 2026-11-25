# YouTube research without paid credits (`core/tools/yt_research.py`)

## How the paid tools work
NexLev and TubeLab both sell searches over a database they build themselves:
- **Crawl.** Workers search YouTube for many topics and walk the channels they find, every day ("400K+ channels, 4M+ outliers, updated every day"; TubeLab also sells on-demand topic "scans" that take 30 min to 4 h).
- **Score against the channel itself.** An outlier is a video whose views are far above *that channel's* typical video (TubeLab's `averageViewsRatio`, NexLev's outlier score); channels are scored by views-to-subscribers (above 1 = healthy demand), age (`foundAt`, `publishedAtFrom`), upload cadence and the variation of their views.
- **Classify and estimate.** Faceless/on-camera, language, niche labels (models over titles, thumbnails and transcripts) and revenue/RPM estimates (models fitted to creators who shared their numbers). These are estimates, not data YouTube publishes.
- **Snapshots.** Re-crawling the same videos gives views per day and "rising" lists.

## What Vidbucks does instead
The same scoring, on demand, for one niche at a time, from YouTube's own public web endpoints (the calls the youtube.com page makes for search, a channel's video list and the channel page). No key, no quota, no credits; a niche takes 10-20 s, a channel 1-2 s.

```bash
python tools/yt_research.py niche "abandoned military bases" --also "cold war bunker,what is still there military" [--period year]
python tools/yt_research.py outliers "tornado documentary" --period year
python tools/yt_research.py channel @WhereTheyStood
python tools/yt_research.py similar @WhereTheyStood
```

- `niche`: searches every phrase sorted by views, relevance and date (4 pages each), keeps the real result list (not the "people also watched" shelves), keeps channels whose titles are about the niche (half of a phrase's words, generic words such as "documentary" ignored), measures their latest uploads and pages, and ranks **opportunity channels** (young + views above subscribers + repeatable outliers, weighted by how on-topic the channel is), **top outliers** (views / that channel's median, at least 10K views), the phrases and title shapes outliers share, and growth since the last run.
- `outliers`: the same with the outlier table only, filtered to the period.
- `channel`: one channel's median, last-4 average, variation, best and worst videos against its own median, and title formats it reused 3+ times with their views oldest to newest (the decay pattern).
- `similar`: channels that rank for the same searches as its best videos.
- `--api` (with `doctor.mjs --set YOUTUBE_API_KEY=...`, free): exact publish dates and view counts, 1 quota unit per 50 videos.

Outputs: `.vidbucks/research/yt/<slug>/report.md` (read this), `channels.csv`, `videos.csv`, `data.json`; every run is stored in `.vidbucks/research/yt_cache.sqlite`, so the next run of the same niche shows views per day.

## Not measured
Revenue, RPM, monetisation status, audience country, retention and traffic sources are private to each channel; the paid tools estimate them with models. Dates marked `~` come from "N weeks ago" text unless `--api` refined them. Use NexLev/TubeLab when one of those estimates is the decision; use this tool for discovery, outliers and channel checks.
