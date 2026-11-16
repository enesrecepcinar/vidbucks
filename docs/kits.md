# Kits: one timeline, any number of styles, chosen by the content

Vidbucks' kits turn a narration into a film from **data the agent writes**, with every hit on the spoken word.
They are Remotion components, so kits can be sequenced, layered or nested in one composition, and they share one
voice, one sound pipeline and the same gates.

```
script.txt ──► voice (make_narration.py / vo_words.py / any TTS) ──► tools/kit_timing.py ──► timing.json
                                                                     (lines + Whisper word times)
timing.json + scene data ─► BoardFilm | LayerScene | Swiss | your composition (src/kits/*) ─► render
scene data ─► tools/kit_cues.py ─► cues.json ─► tools/sfx_synth.py ─► sfx.wav ─┐
narration.wav (+ music) ──────────────────────────────────────────────────────┴► tools/mix_film.py ─► mix.m4a
checks: layer_check.py (contract) · readcheck.py (reading time) · asr_line_check.py (every line heard) · quality_gate.py --profile
```

## Style director and MultiStyle (the whole catalogue in one film)
`core/styles/registry.json` lists every style (98 style prompts + Vidbucks templates) with the content it suits and how
it renders (native / skin / author / build / config). `tools/style_director.py` analyses the topic and each line and
segments the film; the number of styles comes out of the content (a switch must pay `--switch-cost`, a segment runs
`--min-seg` seconds; `"format": "single"` or a reference style locks one). `tools/segment_draft.py` drafts each
segment's data; `src/kits/multi/MultiStyle.tsx` renders them in sequence with per-pair transitions over one narration.
TypeCards (`src/kits/type/`) gives ~30 graphic styles a skin (palette, type, texture, ornament, motion grammar) that is
drafted straight from the narration. Demos: `Tpl-MultiStyle` (director's default for a documentary script: one style),
`Tpl-MultiStyle-Many` (the same script with switch cost 0: 11 segments, 7 styles).

## The shared core (`src/kits/time.ts`, `src/kits/camera.ts`, `tools/kittime.py`)
- **Time expressions** in data files: `12.4` · `{"line": 7}` · `{"end": 7}` · `{"word": [7, "ceylan"], "dt": -0.1}` · `{"beat": 12}`.
  Words come from Whisper; without them a word's time is its share of the line's letters. Unicode-aware: Turkish
  `ı ş ğ ü ö ç İ` count (a lesson from testing an a-z-only engine, where every Turkish hit drifted).
- **Easing**: `PRESS` = cubic-bezier(.7,0,.2,1) for snaps that land on a beat (`snapTo`), `easeOutCubic`, `easeOutBack`, `smooth`.
- **Camera**: keys `{t, x, y, zoom, rot}` in world units (4K px at zoom 1), monotone cubic Hermite (no overshoot
  between holds), zoom in log space, slow handheld wobble, a spotlight with its own keys. `worldTransform`, `toScreen`.
- **Cues**: items announce their own sounds; `kit_cues.py` collects them, `sfx_synth.py` synthesises every kind
  (pop, slide, whoosh, marker, pencil, ticks, stamp, impact, boom, heartbeat, riser, snap, thunk, knife, glock, …).

## BoardFilm (`src/kits/board/`, demo `Tpl-BoardFilm`)
One continuous camera over one designed world: a cork wall, slate, studio table, blueprint, paper or night board.
`board.json`: `look`, `grade` (bw / sepia / natural), `items`, `camera`. Items: `print` (photo with border, pin,
drop-in, torn clipping, name label), `doc` (typeset document with grey body rows, real quote, highlights on words,
"RECREATION" mark), `bigtext`, `counter`, `stamp`, `pen` (underline / ellipse / highlight / tick / cross), `string`,
`card`, `map` + `region` + `route` + `marker` (maps from `tools/board_map.py`: Natural Earth, Mercator or Albers,
projected straight into world px). Rules: one hero per line (the spotlight dims the rest); hits land on the spoken
word; a phrase is shown one way (typed OR on a document); after the cold open, story time only moves forward;
type readable on a phone (≥ 3 % of frame height); nothing invented that looks real (code-drawn documents are marked
as recreations and quote only real words). Self-review traps: dark ink on a dark board, the spotlight left behind
the camera, map scale too small, colliding labels, highlights off their words.

## LayerScene (`src/kits/layers/`, demo `Tpl-LayerScene`, contract `tools/layer_check.py`)
Agent-authored vector scenes: `layers.json` = shots `[{start, end, layers}]` that cover the film with no gap,
layers `rect / ellipse / path (M L Q C Z) / group (pivot) / line / arrow / underline / text / image`, bounded local
keys (x, y, w, angle, alpha, progress, scaleX/Y) with smoothstep, `from/to` visibility, one-line semantic captions,
an optional analog-TV finish (`look: tv | grid | paper`). The contract: every animated layer declares
`motion {role: actor|prop|information, reason}`; no window over 2.5 s without a real change of position, angle,
scale, width or drawing progress (**alpha fades, caption turnover and cuts do not count**); captions one line,
grouped by meaning, never past the picture. Designing rules that worked: blank round heads, rounded joints,
generous negative space, show the behaviour the narration names (an approach needs steps, not a sliding sprite).

## Swiss (`src/kits/swiss/`, demo `Tpl-SwissDance`)
International-Typographic-Style motion: 12-column grid, paper / ink / greys and **one** signal colour, every snap on
the beat with `PRESS`, entrances are clip-reveals (`ClipText`), deletions are knife cuts (`knife`), the subtitles
are part of the layout (`Statement`: a grey lead-in and a bold sentence revealed on each word's spoken time).
The one element allowed off the grid (the "exception") moves linearly and unsnapped.

## Media (`src/kits/media/Media.tsx`, demo `MediaReel`, sheet `MediaGallery`)
Seven drawing media as primitives (registry `renderer: "media"`: our 7 media `native`, 11 related styles `skin`).
**Automatic scenes** (`MediaScene.tsx`, rendered by MultiStyle): `segment_draft.py` turns every SENTENCE of a segment into a
beat (`{line, w: first word index, kind}`): a sentence with a number -> `number` (counted up; years and clock times stamp,
"11" ".52" from Whisper joins to "11:52"); a sentence with a known word -> `object` with one of 40 icons from `ICONS` (people and
things, places and transport: train, tunnel, door, phone, city, car, ship, plane; nature: tree, mountain, wave, flame, cloud,
moon, bolt; ideas: key, lock, gear, shield, crown, eye, burst ...; English + Turkish stems in `ICON_LEX`, specific before
generic; the same icon never twice in a row; sheet: composition `MediaIconSheet`) labelled with the word that chose it; nothing honest to draw -> `title` (the sentence if <= 5 words, else its 3
content words). Two more beat kinds: `compare` (two things in one sentence with "but / than / instead / ama / yerine" -> vs, or "became /
turned into / dönüştü" -> an arrow; the second figure lands on its own word) and `list` (3+ short items split by commas and a
final and/ve: each row lands on its word, the lead-in keeps its last word, the list ends at the item after the conjunction).
Single objects alternate centre / left / right; a year beside another number makes the number the hero ("4,500 · 1900"), and a
thousands group Whisper split ("4" ",500") is joined. The first beat of a segment starts 0.2 s before frame 0, so a film (or an
iris) opens on a drawing being finished, never blank paper. The camera pushes 7 % and drifts per beat (direction alternates).
**Motion:** `cfg.motion` picks one personality from `src/kits/motion.ts` (default by medium: crosshatch/sketchbook calm,
cut-paper playful, riso confident, pixel snappy, isometric/math premium); draw-on times, the bounce, label lag (secondary
motion), list-row entrances and the camera push all follow it. Sheet: same beat under four personalities (`MediaScene-demo`, prop `motion`).
**Sound:** `tools/media_cues.py --edit edit.json --timing timing.json --out cues.json` -> `sfx_synth.py` -> `mix_film.py`:
one hit per beat in the medium's voice (pencil / paper / plate slide / chime / snap / tick), ticks + thunk for a counted
number, a stamp for a year, whoosh or impact for a comparison, a tap per list row, whoosh at a change of medium.
Each medium draws the same beat its own way and keeps idle motion; captions sit bottom-anchored in title-safe,
unspoken words at 72 % (lower fails the 3:1 contrast gate). Edit icons/labels in edit.json; add an icon to ICONS + ICON_LEX.
Primitives:
- **crosshatch**: `Ink` (a hand line that boils on 2s: re-wobbled every 2 frames, two passes, `frac` writes it on), `Hatch`
  (parallel wobbly lines clipped in a shape, a density function puts ink on the shadow side, `cross` adds the darks), `Shape`
  (colour a few px off the line + hatch + outline), `Paper` (grain, vignette, optional dot grid). Rule: no flat fills, the line never stands still.
- **sketchbook**: graphite construction (`Ink` light grey, no double) -> inked over -> a one-colour scribble fill that writes on, one highlighted word.
- **cut-paper**: `tear()` + `Cut` (torn edge, soft shadow, crayon grain) and `PaperDefs` patterns (stripes, dots, gingham, wood);
  a full-bleed wall, a character with a face that pops (`pop`) and blinks, hand-lettered tags, never an object floating on blank paper.
- **riso**: `RisoPrint` prints shapes as three spot-ink plates (teal 15°, pink 75°, yellow 45° halftone screens, 10 tone levels),
  multiplied, the non-key plates a few px off register, worn by a noise mask. Colours are tones per ink: green = teal + yellow,
  violet = teal + pink, never black. Type is a knockout (paper colour) on a solid plate.
- **pixel**: `PixelCanvas` draws at a low resolution (192x108 = 10 px squares at 1080p; pick a divisor of the frame), snaps every
  pixel to a 16-colour palette, scales up nearest-neighbour; `ditherBand` for skies (4x4 ordered dither). Sprites are strings.
- **isometric**: `iso()` 2:1 dimetric projection and `IsoBox` (white faces hide what is behind, `#a4a4ac` hairlines, inner lines
  lighter, ONE dark accent per frame); exploded views and stacks that drop in.
- **math**: near-black stage, axes and curves that sweep on, a tracking dot with a live decimal readout, one colour per quantity
  everywhere (formula, figure, readout), `morph()` blends two outlines resampled by angle. Only for true maths.
Bridges: `Iris` (the old world closes into a window shaped like an object - circle, torn, star - blank paper, the new world
opens from it; the new scene starts half-drawn so the window shows a world), `Beam` (a coloured bar wipes, the next scene
behind its trailing edge). A beat-cut piece cuts hard; a morph-joined piece keeps at most one hard cut (the payoff).
Registry styles drawn in the nearest medium: colored-pencil, urban-sketch, printed-long-take (crosshatch); crayon-book,
crayon-world, paper-popup (cut-paper); pixel-rpg, microgame (pixel); isometric-picture-book, precise-mechanism, white-model (isometric).

## Format kits (`src/kits/chat`, `src/kits/data`, `src/kits/list`)
All three are responsive (9:16 keeps text clear of the platform UI; 16:9 re-lays out), read `src/kits/motion.ts`, and take
`--props {"cfg": ..., "size": [w, h]}` (duration comes from the data).
- **ChatStory** (`ChatStory`): the thread is data; `tools/chat_story.py plan` turns it into a timed file (read-gap = reading time
  of the previous bubble, typing indicator before received messages, the composer types sent ones, optional `--tts` voices
  per side that the thread waits for) and the cues (keys, send pop, receive chime, reaction). Text ~50 px at 1080 wide; on
  16:9 the newest message is repeated large beside the phone. The title card hides the phone (OCR reads UI text through a
  97 % veil). Fictional people only; a generic messenger, never an app's logo or exact chrome.
- **DataRace** (`DataRace`): keyframes per period; values interpolate linearly, ranks are averaged over 0.3 s so overtakes
  slide, the scale eases to the leader, gridlines on 1-2-5 steps, the label column fits the longest name, the period label
  stays readable (>= 3:1). `source` is required; data that is not real says so.
- **Countdown** (`Countdown`): N..1 with a rank slam, whip slide (direction alternates), rail, secondary title and note, an
  icon (media library) or a picture, a slow push while each entry holds, and the one flash on #1.

## Mixing kits
```tsx
<Series>
  <Series.Sequence durationInFrames={...}><BoardFilm cfg={board} timing={timing} /></Series.Sequence>
  <Series.Sequence durationInFrames={...}><SwissDance timing={timing2} /></Series.Sequence>
</Series>
```
A kit inside another: render a LayerScene in an `AbsoluteFill` over a BoardFilm, or place any React component in a
BoardFilm card via a new item type (all kits take time from `useCurrentFrame`, so nesting stays frame-exact).

## Where the ideas came from
The kits re-implement, in Vidbucks' own code, the architectures of three open engines that were installed, read and
pushed with a one-minute film each (study notes: `.vidbucks/research/`, not in the repo): a Python/Skia "board film"
engine (one camera, items that cue their own sounds), a declarative layer-manifest runtime with a strict motion and
caption contract, and the Lemo-Opuscar style library (a style = a written prompt + a hand-built engine; reading-time and
speech checks; a page rendered as a pure function of time). Lemo-Opuscar's style documents ship unchanged, with credit
and under their own non-commercial licence, in `third_party/lemo-opuscar/` (see its README).
