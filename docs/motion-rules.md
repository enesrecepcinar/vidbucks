# Motion rules (apply to every composition)

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
