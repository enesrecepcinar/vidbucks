# Motion rules (defaults for every composition)

These are defaults with reasons, not bans: when the user's direction differs, follow the user and note a trade-off once.

1. **No linear motion.** Every `interpolate()` gets an easing curve and `extrapolateLeft/Right: "clamp"`. Entrances prefer `spring()`. Use gentle sine curves for long moves: every fast eased move registers as a "cut" when measured.
2. **Entrances animate two or three properties together** (opacity + translate + scale/blur). A lone fade looks cheap.
3. **Stagger.** Lists, words, letters, rays: 3-6 frame offsets; nothing enters at once.
4. **Exits are faster than entrances** (about half the duration) and never overlap the next caption: end each phrase ~0.25 s before the next starts.
5. **Layers, bottom to top:** background (never a flat colour unless the reference is flat) -> assets -> graphics/type -> colour grade -> grain + vignette.
6. **Idle things breathe:** anything on screen more than two seconds gets a tiny sine motion.
7. **Everything derives from `fps`.** Times in seconds, converted once. No magic frame numbers.
8. **One theme object** (colours, easings, fonts) per composition; one accent colour.
9. **Heavy work once.** Build textures/geometry at module load or in `useMemo`; use `delayRender`/`continueRender` for async work (fonts, geometry); deterministic randomness (seeded or `random("key"+frame)`).
10. **Responsive by construction.** Size unit `u = min(width, height)/1080`; positions as fractions of width/height; check every requested format.
11. **Fonts via `@remotion/google-fonts`**, never system fonts. Keep text >= 28 px at 1080 wide on phones.
12. **Render -> look -> fix.** Stills at `--scale 0.3-0.4` first; look for text outside the frame, overlaps, artefacts, an empty first 0.3 s; then render and measure.
13. **Duration and easing follow the feeling** (starting points, not law): calm 500-1000 ms sine; trust 300-400 ms gentle ease; confidence 200-400 ms strong ease-out; delight 200-300 ms with overshoot; urgency 100-200 ms snappy ease-out; surprise 150-300 ms exponential. A secondary element follows the primary 50-100 ms later on a different curve; after a move resolves, hold 100-200 ms of stillness before the next.
14. **Spring presets** (stiffness / damping): snappy UI 320 / 30, default containers and camera 170 / 26, heavy type and logos 120 / 24, playful characters 180 / 12. Return exact 0 and 1 at the ends of any solved easing (a 1e-9 value fires "has started" guards early).
15. **Cut seams:** cut at peak velocity; direction and speed match on both sides; a zoom keeps the sign of its scale change across the cut; motion blur only on the 1-3 slam moves, never on text meant to be read, never across a hard cut.
16. **Captions on screen:** at least 0.7 s each, at most ~17 characters a second, no 1-3 frame gaps between cues; a word lights on its own start frame, never before; drop words a recogniser invents over trailing silence.
17. **Overlays that must stay put** (countdowns, slams, captions) live outside the camera group, or they scale and drift with it; a camera that follows a subject needs the set wider than the whole path.
18. **Sound follows visible actions**, not every cut: soft air on a real move, a damped tap when something lands, a dry click for small UI, paper for documents, one short warm tone for a check. No zaps or pitch-drop plops unless the style is a cartoon.
19. **Audio is muxed by ffmpeg, not by the renderer.** Render picture only, mix separately, mux with `-c:v copy -c:a aac`: a renderer-encoded AAC track can start ~43 ms late (encoder priming without an edit list).
20. **Review sheets before "done":** `python core/tools/review_sheets.py <render> [--ref <reference>]` writes contact (2 fps), cuts (3 frames either side of every cut), first 2.5 s, phone width (360 px) and, with a reference, REFERENCE | OURS pairs per second and a stacked sync video. Look at every sheet; a one-frame empty panel or a black slide-in only shows on the cut strips.
21. **Text is measured, not eyeballed:** `python core/tools/text_check.py <render>` OCRs every half second and fails on text touching the frame edge, two texts overlapping, or contrast under 2:1 lasting a second or more (warns under 3:1, outside the 4 % title-safe margin, and under the phone UI on 9:16). Panel text is sized to its zone; upcoming list items stay readable (>= 0.45 opacity).
22. **Big moments land on the music:** with a real track, map it (`beatmap.py analyze`) and put reveals, cards and cutaways on a beat or a hit when one is within 0.15 s (0.10 s for small entrances); the drop goes on the key visual; never drag a moment away from its word to reach a beat.
23. **One motion personality per film, from code.** `core/src/kits/motion.ts` is the motion language: `calm` (sine, 0.6 s,
    no bounce), `premium` (decelerate, 0.5 s, no overshoot: serious and financial content), `confident` (ease-out 0.35 s,
    the default), `playful` (back-ease, 10-20 % overshoot), `snappy` (expo-out 0.22 s, hard landings). New compositions
    import `persona()`, `entrance()`, `staggerAt()`, `secondary()` instead of hand-typed durations; MediaScene and the card
    library already do. A brief's `tone` picks it (`personaForTone` / `segment_draft.persona_for_tone`), else the medium's default.
24. **Curves by role:** enter = ease-out (`EASE.out`), exit = ease-in at about half the time (`EASE.in`), a move that stays
    on screen = ease-in-out (`EASE.inOut`); `EASE.linear` only for loops. Two curves per film, a third must earn its place.
25. **Duration follows distance** (`dur(P, distance)`): a 20 px nudge and a full-width slide must not share a duration.
26. **Groups reveal in under ~0.8 s** (`staggerAt` caps the offset), top-to-bottom or outward from the focal point, and at
    most a third of a group moves at once (`maxMoving`); everything moving together is noise with no focal point.
27. **Secondary motion:** attached parts (label, shadow, tag) settle 40-120 ms after the body (`secondary(at, P)`); a hero
    that lands with its label at the same frame looks pasted.
28. **Three layers:** hero (boldest, slowest, lands on the beat), support (smaller, faster, out of the way), texture
    (subliminal loops). If two elements compete for the eye, demote one. One "wow" moment per piece.
29. **Restraint:** no overshoot on serious or financial content; never loop-animate text that is still being read; never
    stack transitions (a wipe and a spin and a fade).
30. **Colour moves through OKLCH** (`mixOklch(a, b, k)`), never raw sRGB: blue -> orange in sRGB passes through grey.
31. **Speed ramps for impacts** (`speedRamp(t, hit)`): feed the warped time to the scene's animations; the helper slows to
    25 % into the hit and pays the time back right after, so the picture is in sync with the sound again ~1 s later.
32. **Promos and sizzle reels cut fast** (user note, 2026-11-17: "too slow, more motion, different sfx, real footage"):
    cut on halves and quarters of the beat (median shot <= 0.5 s), a camera pulse on every beat, whips with motion blur,
    glitch / chromatic hits on the big moments, colour changes per word, and REAL renders from our own films (clips cut
    from `core/out/films`, never stock). Targets: still share < 0.45 under `quality_gate --profile motion`, >= 60 cuts/min,
    one distinct sound per kind of event (>= 15 kinds in 30 s). A design-only build reads as a slide show, however clean.
33. **Joins blend and never repeat** (user note, 2026-11-17: "do not stick to one thing, use different transition styles,
    smooth and fluid"): shots overlap by 0.2-0.6 s through `src/kits/transitions.tsx` (`TransitionStage`: push, whip,
    zoom-through, flip, spin, stack, iris, diagonal, wave, blob, tiles, bars, glitch, flash, luma, split) and neighbouring
    joins use different kinds; motion keeps one direction through a join; mount every shot early (a `LEAD`) so it can be
    half-way in; the sound of a join follows its language (whip -> whip, flip -> flip, blob -> morph, glitch -> static).
34. **A showcase edit becomes what it shows** (user note, 2026-11-17: "only the sfx changed; the edit itself must change
    shape with what Vidbucks can do, smooth, glass if needed, show things beyond what you learned"): each chapter turns
    INTO the capability (the frame tears into cut paper, tilts into isometric, a chat bubble grows into a bar race, the
    leader bar becomes a #1, a whiteboard ticks it off) and the joins are made of that capability, not picked from a list.
    Changing only transitions or sounds over the same skeleton is not a new edit. Glass look: real `backdrop-filter`
    over a moving mesh, a bright rim, an inner top highlight; SVG displacement + specular light for liquid glass.
    Note: a smooth, morph-driven edit reads ~0.6 "still" to `quality_gate --profile motion` (slow glides at 64x36);
    judge it on the review sheets, not on rule 32's cut-rate targets, which are for fast sizzle cuts.

