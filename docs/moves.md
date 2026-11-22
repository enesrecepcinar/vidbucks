# Moves: what a note asks for, and how to make that change

A note names a feeling ("too busy", "the start drags", "it looks cheap"). Before editing, pick the move it asks for,
then change only what that move touches. Everything the note does not name stays (write what is kept next to the
ask: CLAUDE.md §6, skill `vidbucks-qa-revise`). A note can ask for two or three moves; do them as separate asks.

| Move | The note sounds like | What changes | What stays | Check it with |
|---|---|---|---|---|
| **quieter** | "too much", "busy", "loud", "calm it down" | fewer simultaneous elements, smaller motion amplitudes, softer SFX, music bed down 3-6 dB, fewer accent colours | the story, the cuts, the timing | `quality_gate` (loudness, life), stills side by side |
| **bolder** | "flat", "boring", "needs punch", "weak" | bigger type and scale contrast, one strong colour, harder hits on the beats, a hero moment that clearly outweighs its neighbours | the content and order | jury question 2 (hero moment), stills |
| **retime** | "drags", "too fast", "can't read it", "off the beat" | shot and caption durations, holds, where moments land (`beatmap.py snap`, word times) | the pictures | `readcheck.py`, `sync_check.py`, `quality_gate` cuts/min |
| **recut** | "the order is confusing", "start with the good part" | the order and choice of shots; the hook moves to the first 2 s | the shots themselves, the look | `cut_chain.py check`, jury question 1 |
| **clarify** | "I don't get it", "what is this", "too much text" | one idea per shot, the spoken thing visible when it is said, labels shorter, one reading path | the look | stills at each line, `text_check.py` |
| **regrade** | "too dark", "washed out", "colours are off" | grade, contrast, background tone, palette | layout, motion, timing | `analyze_reference --compare` (brightness, palette), stills |
| **retype** | "font looks cheap", "hard to read", "text is ugly" | typeface, weight, size, tracking, line breaks, contrast plates | words, placement logic | `text_check.py` (size, contrast, safe area) |
| **reframe** | "too wide", "cut off", "for vertical", "under the buttons" | crop, scale, safe areas, the subject's place on the thirds | the edit | `text_check.py` safe zones, phone sheet in `review_sheets.py` |
| **simplify** | "too long", "get to the point", "cut the fluff" | fewer beats, merged scenes, shorter lines (re-narrate) | the best moments (locked) | duration in `quality_gate --brief`, jury question 4 |
| **polish** | "nearly there", "clean it up" | joins, easing, stray frames, sound on every big hit, consistent margins | everything else | `quality_gate` (pops, repeats), `defects.py`, cut strips |
| **liven** | "static", "nothing happens", "dead" | an action or camera move per shot, breathing on held elements, entrances staggered | composition and content | `quality_gate` (still share, static shots) |
| **restructure** | "this isn't working", "start over", "different idea" | the story and the look are re-planned; the facts, footage and approved lines are kept as material | the facts and the user's material | the STORY/LOOK/BOARD gates again (or `gates.py waive` if the user skips them) |

A note that should hold for every future video also becomes a rule in `knowledge/taste.json` (`python tools/taste.py add`).
