#!/usr/bin/env python
"""yt_research.py - niche, outlier and channel research for YouTube without paid credits.

How the paid tools work (NexLev, TubeLab): they keep a database of channels and videos that crawlers refresh every day,
and score every video against its own channel ("outlier" = views / the channel's median or average views), every channel
by views-to-subscribers, age and growth, then sell filtered searches over that database. This tool does the same thing on
demand for one niche at a time, in about a minute, and keeps every result in a local cache so re-runs show growth.

Data comes from YouTube's own public web endpoints (the ones the youtube.com page calls: search, channel browse, the
channel page), so no key and no quota are needed. With a free YouTube Data API key (`doctor.mjs --set YOUTUBE_API_KEY=...`)
exact publish dates and view counts replace the approximate "3 weeks ago" values (1 quota unit per 50 videos).

  python tools/yt_research.py niche "abandoned military bases" [--also "cold war bunker,missile silo"] [--period year] [--channels 40] [--videos 60]
  python tools/yt_research.py channel @WhereTheyStood [--videos 120]
  python tools/yt_research.py outliers "tornado documentary" [--min-score 3] [--period month]
  python tools/yt_research.py similar @youSeeWhyOfficial
  python tools/yt_research.py fresh --seeds seeds.txt --max-age 45     # channels opened in the last 45 days that already pull views

Output: .vidbucks/research/yt/<slug>/ -> report.md (read this), channels.csv, videos.csv, data.json. Cache: .vidbucks/research/yt_cache.sqlite.
Numbers are measured from public pages; "~" dates come from "N weeks ago" text unless the API key refined them.
Not measured here: revenue/RPM, monetisation status, audience geography and retention (only the channel owner sees those).
"""
import argparse, base64, concurrent.futures as cf, csv, datetime as dt, json, math, os, pathlib, random, re, sqlite3, statistics as st, sys, time, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / ".vidbucks" / "research" / "yt"
CACHE = ROOT / ".vidbucks" / "research" / "yt_cache.sqlite"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
CTX = {"client": {"clientName": "WEB", "clientVersion": "2.20251120.01.00", "hl": "en", "gl": "US"}}
NOW = dt.datetime.now(dt.timezone.utc)
VIDEOS_TAB = "EgZ2aWRlb3PyBgQKAjoA"


# ---------------------------------------------------------------- transport
def _post(ep, body, tries=3):
    data = json.dumps({"context": CTX, **body}).encode()
    for k in range(tries):
        try:
            req = urllib.request.Request(f"https://www.youtube.com/youtubei/v1/{ep}?prettyPrint=false", data=data,
                                         headers={"Content-Type": "application/json", "User-Agent": UA, "Accept-Language": "en-US"})
            return json.load(urllib.request.urlopen(req, timeout=25))
        except Exception as e:
            if k == tries - 1: raise
            time.sleep(1.5 * (k + 1) + random.random())


def _get(url, tries=3):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US"})
            return urllib.request.urlopen(req, timeout=25).read().decode("utf-8", "replace")
        except Exception:
            if k == tries - 1: raise
            time.sleep(1.5 * (k + 1))


def walk(o, key, out=None):
    out = [] if out is None else out
    if isinstance(o, dict):
        for k, v in o.items():
            if k == key: out.append(v)
            walk(v, key, out)
    elif isinstance(o, list):
        for v in o: walk(v, key, out)
    return out


def strings(o):
    return [x for x in walk(o, "content") + walk(o, "simpleText") + walk(o, "text") if isinstance(x, str)]


# ---------------------------------------------------------------- parsing helpers
def num(s):
    """'1.2M views' -> 1200000, '35K' -> 35000, '2.77M subscribers' -> 2770000, 'No views' -> 0"""
    if not s: return None
    s = s.replace(",", "").strip()
    if re.match(r"^no ", s, re.I): return 0
    m = re.search(r"([\d.]+)\s*([KMB])?", s, re.I)
    if not m: return None
    v = float(m.group(1)) * {"": 1, "K": 1e3, "M": 1e6, "B": 1e9}[(m.group(2) or "").upper()]
    return int(v)


UNITS = {"second": 1 / 86400, "minute": 1 / 1440, "hour": 1 / 24, "day": 1, "week": 7, "month": 30.44, "year": 365.25}


def ago_days(s):
    """'3 weeks ago' / 'Streamed 2 days ago' -> days (float); None if unknown"""
    if not s: return None
    m = re.search(r"(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago", s)
    return int(m.group(1)) * UNITS[m.group(2)] if m else None


def dur_s(s):
    if not s: return None
    p = [int(x) for x in re.findall(r"\d+", s)]
    return sum(v * 60 ** i for i, v in enumerate(reversed(p))) if p else None


def sp(sort=None, period=None, kind="video", length=None):
    """search filter param (protobuf): sort 0 relevance / 2 date / 3 views; period hour..year; type video; length short|medium|long"""
    def varint(n):
        b = b""
        while True:
            x = n & 0x7F; n >>= 7
            b += bytes([x | (0x80 if n else 0)])
            if not n: return b
    SORT = {"relevance": 0, "date": 2, "views": 3}; PER = {"hour": 1, "today": 2, "week": 3, "month": 4, "year": 5}; LEN = {"short": 1, "long": 2, "medium": 3}
    flt = b""
    if period in PER: flt += b"\x08" + varint(PER[period])
    if kind == "video": flt += b"\x10\x01"
    if length in LEN: flt += b"\x18" + varint(LEN[length])
    msg = (b"\x08" + varint(SORT[sort]) if sort in SORT and SORT[sort] else b"") + (b"\x12" + varint(len(flt)) + flt if flt else b"")
    return base64.urlsafe_b64encode(msg).decode() if msg else ""


# ---------------------------------------------------------------- cache
def db():
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(CACHE)
    c.execute("create table if not exists channel(id text, fetched text, data text)")
    c.execute("create table if not exists video(id text, channel text, fetched text, views integer, data text)")
    return c


def last_snapshot(c, vid):
    r = c.execute("select fetched, views from video where id=? order by fetched desc limit 1", (vid,)).fetchone()
    return r


# ---------------------------------------------------------------- YouTube reads
def primary(r):
    """only the real result list: itemSectionRenderer items, not the 'people also watched' / shorts / news shelves"""
    out = []
    for sec in walk(r, "itemSectionRenderer"):
        for it in sec.get("contents", []):
            if "videoRenderer" in it: out.append(it["videoRenderer"])
    return out


def search(query, sort="views", period=None, pages=2, length=None):
    out, body = [], {"query": query, "params": sp(sort, period, "video", length)}
    r = _post("search", body)
    for _ in range(pages):
        for v in primary(r):
            try:
                own = v["ownerText"]["runs"][0]
                out.append({"id": v["videoId"], "title": "".join(x["text"] for x in v["title"]["runs"]), "channel": own["text"],
                            "channel_id": own["navigationEndpoint"]["browseEndpoint"]["browseId"],
                            "views": num(v.get("viewCountText", {}).get("simpleText")), "age_days": ago_days(v.get("publishedTimeText", {}).get("simpleText")),
                            "duration": dur_s(v.get("lengthText", {}).get("simpleText")), "query": query})
            except (KeyError, IndexError):
                continue
        tok = walk(r, "continuationCommand")
        if not tok: break
        r = _post("search", {"continuation": tok[-1]["token"]})
    return out


def channel_videos(cid, limit=60):
    """latest uploads of a channel (videos tab) with views, approximate age and duration; plus header numbers"""
    r = _post("browse", {"browseId": cid, "params": VIDEOS_TAB})
    head = strings(walk(r, "pageHeaderViewModel"))
    meta = (walk(r, "channelMetadataRenderer") or [{}])[0]
    info = {"id": cid, "title": meta.get("title"), "handle": next((h for h in head if h.startswith("@")), None),
            "subs": next((num(h) for h in head if "subscriber" in h), None), "video_count": next((num(h) for h in head if re.search(r"\bvideos?\b", h)), None),
            "description": (meta.get("description") or "")[:400], "keywords": meta.get("keywords")}
    vids = []
    while True:
        for lk in walk(r, "lockupViewModel"):
            vid = lk.get("contentId")
            if not vid or lk.get("contentType", "LOCKUP_CONTENT_TYPE_VIDEO") != "LOCKUP_CONTENT_TYPE_VIDEO": continue
            t = [x for x in strings(lk.get("metadata", {})) if x]
            badge = [x for x in walk(lk.get("contentImage", {}), "text") if isinstance(x, str) and re.match(r"^\d+(:\d\d)+$", x)]
            title = t[0] if t else ""
            views = next((num(x) for x in t if re.search(r"views?$", x)), None)
            age = next((ago_days(x) for x in t if "ago" in x), None)
            vids.append({"id": vid, "title": title, "views": views, "age_days": age, "duration": dur_s(badge[0]) if badge else None, "channel_id": cid})
        if len(vids) >= limit: break
        tok = walk(r, "continuationCommand")
        if not tok: break
        r = _post("browse", {"continuation": tok[-1]["token"]})
    return info, vids[:limit]


def channel_about(cid):
    """join date, country and total views from the channel page"""
    try:
        h = _get(f"https://www.youtube.com/channel/{cid}/about")
    except Exception:
        return {}
    j = re.search(r'"joinedDateText":\{"content":"Joined ([^"]+)"', h)
    c = re.search(r'"country":"([^"]+)"', h)
    v = re.search(r'"viewCountText":"([\d,]+) views"', h)
    out = {"country": c.group(1) if c else None, "total_views": int(v.group(1).replace(",", "")) if v else None}
    if j:
        try: out["joined"] = dt.datetime.strptime(j.group(1), "%b %d, %Y").date().isoformat()
        except ValueError: out["joined"] = j.group(1)
    return out


def resolve(ref):
    """@handle / URL / UC id -> UC id"""
    if re.match(r"^UC[\w-]{22}$", ref): return ref
    url = ref if ref.startswith("http") else f"https://www.youtube.com/{ref if ref.startswith('@') else '@' + ref}"
    h = _get(url)
    m = re.search(r'"externalId":"(UC[\w-]{22})"', h) or re.search(r'"channelId":"(UC[\w-]{22})"', h)
    if not m: sys.exit(f"could not resolve channel {ref}")
    return m.group(1)


def api_refine(videos):
    """with YOUTUBE_API_KEY: exact publish time and views (videos.list, 1 unit per 50 ids)"""
    key = os.environ.get("YOUTUBE_API_KEY") or _env_key()
    if not key: return 0
    ids = [v["id"] for v in videos]
    by = {v["id"]: v for v in videos}
    n = 0
    for i in range(0, len(ids), 50):
        q = urllib.parse.urlencode({"part": "snippet,statistics,contentDetails", "id": ",".join(ids[i:i + 50]), "key": key})
        try:
            d = json.loads(_get(f"https://www.googleapis.com/youtube/v3/videos?{q}"))
        except Exception as e:
            print(f"  api: {str(e)[:80]} - keeping web values"); return n
        for it in d.get("items", []):
            v = by.get(it["id"]);
            if not v: continue
            pub = dt.datetime.fromisoformat(it["snippet"]["publishedAt"].replace("Z", "+00:00"))
            v["age_days"] = (NOW - pub).total_seconds() / 86400; v["published"] = pub.date().isoformat(); v["exact"] = True
            v["views"] = int(it["statistics"].get("viewCount", v.get("views") or 0)); n += 1
    return n


def _env_key():
    p = ROOT / "core" / ".env"
    if p.exists():
        m = re.search(r"^YOUTUBE_API_KEY=(.+)$", p.read_text(), re.M)
        return m.group(1).strip() if m else None


# ---------------------------------------------------------------- metrics
def score_channel(info, vids, about):
    long_ = [v for v in vids if v.get("views") is not None and (v.get("duration") or 999) > 62]
    views = [v["views"] for v in long_] or [0]
    med = st.median(views) if views else 0
    for v in vids:
        if v.get("views") is None: continue
        others = [x["views"] for x in long_ if x is not v] or views
        m = st.median(others) or 1
        v["score"] = round(v["views"] / m, 2)
        v["vpd"] = round(v["views"] / max(1, v["age_days"] or 1), 1) if v.get("age_days") else None
        if v.get("age_days") is not None and not v.get("published"): v["published"] = "~" + (NOW - dt.timedelta(days=v["age_days"])).date().isoformat()
    ages = sorted(v["age_days"] for v in vids if v.get("age_days") is not None)
    span = (ages[-1] - ages[0]) if len(ages) > 1 else None
    joined = about.get("joined")
    age = (NOW.date() - dt.date.fromisoformat(joined)).days if joined and re.match(r"\d{4}-", joined) else (ages[-1] if ages else None)
    subs = info.get("subs") or 0
    recent = [v["views"] for v in sorted(long_, key=lambda v: v.get("age_days") or 9e9)[:10]]
    c = {**info, **about, "age_days": round(age) if age else None, "median_views": int(med), "recent10_median": int(st.median(recent)) if recent else 0,
         "views_per_sub": round(med / subs, 2) if subs else None, "outliers_3x": sum(1 for v in vids if (v.get("score") or 0) >= 3),
         "best_score": max((v.get("score") or 0) for v in vids) if vids else 0, "uploads_per_week": round(len(ages) / (span / 7), 2) if span and span > 6 else None,
         "shorts_share": round(sum(1 for v in vids if (v.get("duration") or 999) <= 62) / max(1, len(vids)), 2), "avg_minutes": round(st.mean([v["duration"] for v in long_ if v.get("duration")]) / 60, 1) if any(v.get("duration") for v in long_) else None,
         "sampled": len(vids)}
    # opportunity: young channel, strong views for its size, repeatable hits
    young = 1.0 if (c["age_days"] or 9999) < 365 else 0.6 if (c["age_days"] or 9999) < 730 else 0.25
    c["opportunity"] = round(young * min(5, c["views_per_sub"] or 0) * (1 + min(5, c["outliers_3x"])) * math.log10(10 + c["recent10_median"]), 2)
    return c


def weigh(c):
    """opportunity counts only as much as the channel is about the niche"""
    c["opportunity"] = round((c.get("opportunity") or 0) * (0.2 + 0.8 * (c.get("relevance") or 0)), 2)
    return c


def skeleton(title):
    t = re.sub(r"\d[\d,.]*", "{N}", title)
    t = re.sub(r"\b[A-Z]{2,}\b", "{CAPS}", t)
    return t


def stems(text):
    return {w[:5] for w in re.findall(r"[a-z']+", text.lower()) if len(w) > 3 and w not in STOP and w not in GENERIC}


def relevant(title, keys):
    """keys: list of stem sets, one per search phrase; a title matches a phrase when it shares half of its stems (at least one)"""
    t = stems(title)
    return any(len(t & k) >= max(1, math.ceil(len(k) / 2)) for k in keys if k)


GENERIC = set("documentary documentaries explained explain video videos full story stories best top part ever every most first last new watch official episode things facts history".split())
STOP = set("the a an of to in on for and or is are was were be been with at by from this that it its as how why what who when where you your i my we our they their his her not no do does did can will just about into than then so".split())


def themes(titles, n=15):
    words, bigr = {}, {}
    for t in titles:
        w = [x for x in re.findall(r"[a-zA-Z']+", t.lower()) if x not in STOP and len(x) > 2]
        for x in w: words[x] = words.get(x, 0) + 1
        for a, b in zip(w, w[1:]): bigr[a + " " + b] = bigr.get(a + " " + b, 0) + 1
    top = lambda d: [k for k, v in sorted(d.items(), key=lambda kv: -kv[1]) if v > 1][:n]
    return top(bigr), top(words)


# ---------------------------------------------------------------- pipelines
def gather_channels(ids, videos_per, workers=8):
    out = {}
    def one(cid):
        try:
            info, vids = channel_videos(cid, videos_per)
            return cid, info, vids, channel_about(cid)
        except Exception as e:
            return cid, None, [], {"error": str(e)[:120]}
    with cf.ThreadPoolExecutor(workers) as ex:
        for cid, info, vids, about in ex.map(one, ids):
            if info: out[cid] = (info, vids, about)
    return out


def save(slug, title, channels, videos, notes, extra_md=""):
    d = OUT / slug; d.mkdir(parents=True, exist_ok=True)
    c = db(); stamp = NOW.isoformat()
    for ch in channels: c.execute("insert into channel values(?,?,?)", (ch["id"], stamp, json.dumps(ch)))
    growth = {}
    for v in videos:
        prev = last_snapshot(c, v["id"])
        if prev and v.get("views") is not None and prev[1] is not None:
            days = max(0.01, (NOW - dt.datetime.fromisoformat(prev[0])).total_seconds() / 86400)
            if days > 0.2: growth[v["id"]] = round((v["views"] - prev[1]) / days, 1)
        c.execute("insert into video values(?,?,?,?,?)", (v["id"], v.get("channel_id"), stamp, v.get("views"), json.dumps(v)))
    c.commit()
    for v in videos:
        if v["id"] in growth: v["views_per_day_since_last_run"] = growth[v["id"]]
    ck = ["title", "handle", "id", "subs", "median_views", "recent10_median", "views_per_sub", "outliers_3x", "best_score", "age_days", "joined", "country", "uploads_per_week", "avg_minutes", "shorts_share", "total_views", "video_count", "opportunity"]
    with open(d / "channels.csv", "w", newline="") as f:
        w = csv.DictWriter(f, ck, extrasaction="ignore"); w.writeheader(); w.writerows(channels)
    vk = ["title", "channel", "channel_id", "id", "views", "score", "vpd", "published", "duration", "views_per_day_since_last_run", "query"]
    with open(d / "videos.csv", "w", newline="") as f:
        w = csv.DictWriter(f, vk, extrasaction="ignore"); w.writeheader(); w.writerows(videos)
    (d / "data.json").write_text(json.dumps({"title": title, "fetched": stamp, "notes": notes, "channels": channels, "videos": videos}, ensure_ascii=False, indent=1))
    (d / "report.md").write_text(extra_md)
    return d


def fmt(n):
    if n is None: return "-"
    return f"{n/1e6:.1f}M" if n >= 1e6 else f"{n/1e3:.0f}K" if n >= 1e3 else str(n)


PERIOD_DAYS = {"week": 7, "month": 31, "year": 366}


def niche_report(title, channels, videos, notes, min_views=10000, period=None):
    L = [f"# {title}", "", f"Fetched {NOW.date()} from public YouTube pages. " + " ".join(notes), ""]
    chs = sorted(channels, key=lambda c: -(c["opportunity"] or 0))
    young = [c for c in channels if (c.get("age_days") or 9999) < 365]
    meds = [c["median_views"] for c in channels if c.get("median_views")]
    L += ["## Niche at a glance", f"- Channels sampled: {len(channels)}; videos measured: {len(videos)}",
          f"- Channels younger than 1 year: {len(young)} ({round(100 * len(young) / max(1, len(channels)))} %) - many young channels with strong views = demand that is still open",
          f"- Median of channel medians: {fmt(int(st.median(meds))) if meds else '-'} views per video",
          f"- Channels where a typical video gets more views than the channel has subscribers (views/sub > 1): {sum(1 for c in channels if (c.get('views_per_sub') or 0) > 1)}", ""]
    L += ["## Opportunity channels (young + strong views for size + repeatable hits)", "| channel | subs | median views | views/sub | 3x outliers | age (days) | uploads/wk | avg min | on-topic |", "|---|---|---|---|---|---|---|---|---|"]
    for c in chs[:15]:
        L.append(f"| [{c.get('title')}](https://www.youtube.com/channel/{c['id']}) | {fmt(c.get('subs'))} | {fmt(c.get('median_views'))} | {c.get('views_per_sub') or '-'} | {c.get('outliers_3x')} | {c.get('age_days') or '-'} | {c.get('uploads_per_week') or '-'} | {c.get('avg_minutes') or '-'} | {int(100 * (c.get('relevance') or 0))} % |")
    lim = PERIOD_DAYS.get(period or "", 1e9)
    outl = sorted([v for v in videos if (v.get("score") or 0) >= 3 and (v.get("duration") or 999) > 62 and v.get("on_topic", True)
                   and (v.get("views") or 0) >= min_views and (v.get("age_days") or 0) <= lim], key=lambda v: -(v["score"]))
    L += ["", f"## Top outliers (views / that channel's median; at least {fmt(min_views)} views" + (f", uploaded in the last {period}" if period else "") + ")", "| score | views | published | title | channel |", "|---|---|---|---|---|"]
    for v in outl[:25]:
        L.append(f"| {v['score']}x | {fmt(v['views'])} | {v.get('published') or '-'} | [{v['title'][:70]}](https://youtu.be/{v['id']}) | {v.get('channel') or ''} |")
    bi, wo = themes([v["title"] for v in outl])
    sk = {}
    for v in outl: s = skeleton(v["title"]); sk[s] = sk.get(s, 0) + 1
    L += ["", "## What the outliers have in common", f"- Phrases: {', '.join(bi[:12]) or '-'}", f"- Words: {', '.join(wo[:15]) or '-'}",
          f"- Lengths of outliers: median {round(st.median([v['duration'] for v in outl if v.get('duration')]) / 60, 1) if any(v.get('duration') for v in outl) else '-'} min",
          f"- Title shapes used more than once: " + ("; ".join(f"`{k}` x{v}" for k, v in sorted(sk.items(), key=lambda kv: -kv[1]) if v > 1)[:600] or "none")]
    grow = sorted([v for v in videos if v.get("views_per_day_since_last_run")], key=lambda v: -v["views_per_day_since_last_run"])
    if grow:
        L += ["", "## Growing since the last run (views per day)"] + [f"- {fmt(int(v['views_per_day_since_last_run']))}/day - [{v['title'][:70]}](https://youtu.be/{v['id']})" for v in grow[:10]]
    L += ["", "## Not measured", "Revenue/RPM, monetisation status, audience country and retention are private to each channel; the paid tools estimate them. Dates marked ~ are from 'N weeks ago' text."]
    return "\n".join(L) + "\n"


def run_niche(a, outliers_only=False):
    queries = [a.query] + [q.strip() for q in (a.also or "").split(",") if q.strip()]
    found, t0 = [], time.time()
    jobs = [(q, s) for q in queries for s in (["views", "relevance", "date"] if not outliers_only else ["views", "relevance"])]
    with cf.ThreadPoolExecutor(6) as ex:
        for res in ex.map(lambda qs: search(qs[0], qs[1], a.period, a.pages), jobs): found += res
    keys = [stems(q) for q in queries]
    found = [v for v in found if relevant(v["title"], keys)] or found
    by_ch = {}
    for v in found: by_ch.setdefault(v["channel_id"], []).append(v)
    # channels that keep showing up for the niche first, then the strongest single hit
    ids = sorted(by_ch, key=lambda c: (-len(by_ch[c]), -max((v.get("views") or 0) for v in by_ch[c])))[: a.channels * 2]
    print(f"search: {len(found)} results, {len(by_ch)} channels in {time.time() - t0:.1f}s; measuring {len(ids)} channels...")
    data = gather_channels(ids, a.videos)
    channels, videos = [], []
    for cid, (info, vids, about) in data.items():
        rel = sum(1 for v in vids if relevant(v["title"], keys)) / max(1, len(vids))
        if rel < a.min_relevance and len(by_ch.get(cid, [])) < 2: continue          # one lucky hit on an off-topic channel
        ch = score_channel(info, vids, about); ch["relevance"] = round(rel, 2); ch["search_hits"] = len(by_ch.get(cid, [])); weigh(ch); channels.append(ch)
        for v in vids: v["channel"] = info.get("title"); v["on_topic"] = relevant(v["title"], keys)
        videos += vids
    channels = sorted(channels, key=lambda c: (-c["search_hits"], -c["relevance"]))[: a.channels]
    keep = {c["id"] for c in channels}; videos = [v for v in videos if v["channel_id"] in keep]
    seen = {v["id"] for v in videos}
    videos += [v for v in found if v["id"] not in seen and v["channel_id"] not in data]
    n = api_refine(videos) if a.api else 0
    if n:
        for cid, (info, vids, about) in data.items():
            ch = next(c for c in channels if c["id"] == cid); ch.update(score_channel(info, vids, about))
    notes = [f"Queries: {', '.join(queries)}; period: {a.period or 'any'}.", f"API-refined videos: {n}." if n else "No API key: dates approximate."]
    title = ("Outliers: " if outliers_only else "Niche: ") + a.query
    if outliers_only:
        videos = [v for v in videos if (v.get("score") or 0) >= a.min_score]
    md = niche_report(title, channels, videos, notes, a.min_views, a.period)
    d = save(slug(a.query) + ("-outliers" if outliers_only else ""), title, channels, videos, notes, md)
    print(f"done in {time.time() - t0:.1f}s -> {d}/report.md")


def run_channel(a):
    t0 = time.time(); cid = resolve(a.ref)
    info, vids = channel_videos(cid, a.videos); about = channel_about(cid)
    if a.api: api_refine(vids)
    ch = score_channel(info, vids, about)
    for v in vids: v["channel"] = info.get("title")
    order = sorted([v for v in vids if v.get("age_days") is not None], key=lambda v: v["age_days"])
    last4 = [v["views"] for v in order[:4] if v.get("views") is not None]
    sk = {}
    for v in vids: sk.setdefault(skeleton(v["title"]), []).append(v)
    L = [f"# Channel: {info.get('title')} ({info.get('handle') or cid})", "",
         f"- Subscribers {fmt(info.get('subs'))}, videos {info.get('video_count')}, total views {fmt(about.get('total_views'))}, joined {about.get('joined') or '-'}, country {about.get('country') or '-'}",
         f"- Median views {fmt(ch['median_views'])}, last 4 average {fmt(int(st.mean(last4))) if last4 else '-'}, views/sub {ch['views_per_sub']}, uploads/week {ch['uploads_per_week']}, avg length {ch['avg_minutes']} min, shorts share {ch['shorts_share']}",
         f"- Variation (coefficient): {round(st.pstdev([v['views'] for v in vids if v.get('views')]) / max(1, st.mean([v['views'] for v in vids if v.get('views')])), 2) if vids else '-'}", "",
         "## Best and worst against the channel's own median", "| score | views | published | title |", "|---|---|---|---|"]
    best = sorted(vids, key=lambda v: -(v.get("score") or 0))[:12]
    for v in best + [v for v in sorted(vids, key=lambda v: (v.get("score") or 0))[:5] if v not in best]:
        L.append(f"| {v.get('score')}x | {fmt(v.get('views'))} | {v.get('published') or '-'} | [{v['title'][:80]}](https://youtu.be/{v['id']}) |")
    rep = [(k, vs) for k, vs in sk.items() if len(vs) >= 3]
    if rep:
        L += ["", "## Title formats used 3+ times (oldest -> newest)"]
        for k, vs in rep:
            vs = sorted(vs, key=lambda v: -(v.get("age_days") or 0))
            L.append(f"- `{k}`: " + " -> ".join(fmt(v.get('views')) for v in vs))
    L += ["", "## Not measured", "Revenue, monetisation, retention and traffic sources are private to the channel owner."]
    d = save(slug(info.get("handle") or cid), f"Channel {info.get('title')}", [ch], vids, [], "\n".join(L) + "\n")
    print(f"done in {time.time() - t0:.1f}s -> {d}/report.md")


def run_similar(a):
    """channels that rank for the same searches as this channel's best videos"""
    t0 = time.time(); cid = resolve(a.ref)
    info, vids = channel_videos(cid, 40)
    ch = score_channel(info, vids, {})
    top = sorted(vids, key=lambda v: -(v.get("score") or 0))[:6]
    queries = [" ".join([w for w in re.findall(r"[A-Za-z']+", v["title"]) if w.lower() not in STOP][:6]) for v in top]
    hits = {}
    with cf.ThreadPoolExecutor(6) as ex:
        for res in ex.map(lambda q: search(q, "relevance", None, 1), queries):
            for r in res:
                if r["channel_id"] != cid: hits.setdefault(r["channel_id"], {"n": 0, "channel": r["channel"], "views": 0}); hits[r["channel_id"]]["n"] += 1; hits[r["channel_id"]]["views"] += r.get("views") or 0
    ids = [k for k, _ in sorted(hits.items(), key=lambda kv: (-kv[1]["n"], -kv[1]["views"]))][: a.channels]
    data = gather_channels(ids, 30)
    channels = [score_channel(i, v, ab) for i, v, ab in data.values()]
    for c in channels: c["shared_searches"] = hits[c["id"]]["n"]
    channels.sort(key=lambda c: (-c["shared_searches"], -(c["median_views"] or 0)))
    L = [f"# Channels similar to {info.get('title')}", "", f"Searched the titles of its {len(queries)} best videos and counted which channels rank for the same searches.", "",
         "| channel | shared searches | subs | median views | views/sub | age (days) |", "|---|---|---|---|---|---|"]
    for c in channels:
        L.append(f"| [{c.get('title')}](https://www.youtube.com/channel/{c['id']}) | {c['shared_searches']} | {fmt(c.get('subs'))} | {fmt(c.get('median_views'))} | {c.get('views_per_sub') or '-'} | {c.get('age_days') or '-'} |")
    d = save(slug(info.get("handle") or cid) + "-similar", "Similar", channels, [], [], "\n".join(L) + "\n")
    print(f"done in {time.time() - t0:.1f}s -> {d}/report.md")


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60] or "research"


def run_fresh(a):
    """breakout channels: opened in the last N days and already pulling views. Search many seed phrases for videos uploaded
    this week/month (sorted by views), then keep the channels whose join date is recent."""
    t0 = time.time()
    seeds = [q.strip() for q in (open(a.seeds).read().splitlines() if a.seeds and os.path.exists(a.seeds) else (a.seeds or "").split(",")) if q.strip() and not q.startswith("#")]
    jobs = [(q, per) for q in seeds for per in a.periods.split(",")]
    found = []
    with cf.ThreadPoolExecutor(8) as ex:
        for q, res in zip(jobs, ex.map(lambda j: _safe_search(j[0], "views", j[1], a.pages), jobs)):
            for v in res: v["seed"] = q[0]
            found += res
    by = {}
    for v in found: by.setdefault(v["channel_id"], []).append(v)
    # cheap pre-filter: a channel whose best hit is young and strong is worth one page fetch
    cand = [c for c, vs in by.items() if max((v.get("views") or 0) for v in vs) >= a.min_views]
    print(f"search: {len(found)} results from {len(jobs)} searches, {len(by)} channels, {len(cand)} with a {fmt(a.min_views)}+ video ({time.time() - t0:.1f}s)")
    abouts = {}
    with cf.ThreadPoolExecutor(10) as ex:
        for cid, ab in zip(cand, ex.map(channel_about, cand)): abouts[cid] = ab
    young = [c for c in cand if (abouts[c].get("joined") and re.match(r"\d{4}-", abouts[c]["joined"]) and (NOW.date() - dt.date.fromisoformat(abouts[c]["joined"])).days <= a.max_age)]
    print(f"joined in the last {a.max_age} days: {len(young)}; measuring them...")
    data = gather_channels(young, a.videos)
    channels, videos = [], []
    for cid, (info, vids, about) in data.items():
        ch = score_channel(info, vids, {**about, **abouts.get(cid, {})}); ch["seeds"] = sorted({v["seed"] for v in by[cid]})
        ch["total_views_est"] = about.get("total_views") or sum(v.get("views") or 0 for v in vids)
        channels.append(ch)
        for v in vids: v["channel"] = info.get("title")
        videos += vids
    channels.sort(key=lambda c: -(c.get("total_views_est") or 0))
    L = [f"# Breakout channels: joined in the last {a.max_age} days", "", f"Fetched {NOW.date()}. {len(jobs)} searches over {len(seeds)} seed phrases ({a.periods}), sorted by views; channels with a {fmt(a.min_views)}+ video and a join date within {a.max_age} days.", "",
         "| channel | joined | subs | total views | videos | median views | best video | avg min | shorts | country | found by |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    for c in channels:
        best = max((v for v in videos if v["channel_id"] == c["id"]), key=lambda v: v.get("views") or 0, default=None)
        L.append(f"| [{c.get('title')}](https://www.youtube.com/channel/{c['id']}) | {c.get('joined')} | {fmt(c.get('subs'))} | {fmt(c.get('total_views_est'))} | {c.get('video_count') or c.get('sampled')} | {fmt(c.get('median_views'))} | "
                 + (f"[{fmt(best.get('views'))}](https://youtu.be/{best['id']}) {best['title'][:50]}" if best else "-") + f" | {c.get('avg_minutes') or '-'} | {int(100 * (c.get('shorts_share') or 0))} % | {c.get('country') or '-'} | {', '.join(c['seeds'])[:60]} |")
    L += ["", "## Not measured", "Revenue, monetisation and audience are private; join date and totals come from the channel page; video dates are approximate."]
    d = save("fresh-" + slug(a.name), "Breakout channels", channels, videos, [], "\n".join(L) + "\n")
    print(f"done in {time.time() - t0:.1f}s -> {d}/report.md")


def _safe_search(q, sort, period, pages):
    try:
        return search(q, sort, period, pages)
    except Exception:
        return []


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("niche", "outliers"):
        p = sub.add_parser(name); p.add_argument("query"); p.add_argument("--also", help="more search phrases, comma separated")
        p.add_argument("--period", choices=["week", "month", "year"], help="only videos uploaded in this period"); p.add_argument("--pages", type=int, default=4)
        p.add_argument("--channels", type=int, default=30); p.add_argument("--videos", type=int, default=45); p.add_argument("--min-score", type=float, default=3); p.add_argument("--min-views", type=int, default=10000)
        p.add_argument("--api", action="store_true", help="refine dates/views with YOUTUBE_API_KEY (1 unit per 50 videos)")
        p.add_argument("--min-relevance", type=float, default=0.15, help="share of a channel's titles that must match the niche (channels with 2+ search hits always stay)")
    p = sub.add_parser("channel"); p.add_argument("ref"); p.add_argument("--videos", type=int, default=90); p.add_argument("--api", action="store_true")
    p = sub.add_parser("similar"); p.add_argument("ref"); p.add_argument("--channels", type=int, default=15)
    p = sub.add_parser("fresh", help="channels opened in the last N days that already pull views")
    p.add_argument("--seeds", required=True, help="comma-separated phrases or a text file with one phrase per line"); p.add_argument("--name", default="seeds")
    p.add_argument("--max-age", type=int, default=45); p.add_argument("--periods", default="week,month"); p.add_argument("--pages", type=int, default=2)
    p.add_argument("--min-views", type=int, default=20000); p.add_argument("--videos", type=int, default=30)
    a = ap.parse_args()
    {"niche": lambda: run_niche(a), "outliers": lambda: run_niche(a, True), "channel": lambda: run_channel(a), "similar": lambda: run_similar(a), "fresh": lambda: run_fresh(a)}[a.cmd]()
