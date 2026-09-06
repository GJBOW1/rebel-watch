# ASHFALL city expansion — independent artifact review

Reviewed 5 September 2026 against `docs/expansion-plan.md`. **Verdict: pass within the verification limits below. No unresolved blocking defect was found in the final reviewed artifact.**

The verifier inspected source, authored asset previews, saved live screenshots and state captures, independently ran the test suite and build, and performed separate area and rendering checks. The verifier did not operate the shared live game or treat the maker's narration as test evidence.

## Rubric assessment

| Criterion | Result | Evidence |
| --- | --- | --- |
| At least five times the original connected usable area; seven districts with continuous companion follow | Pass | Independent clearance-aware flood fill found 5.23× hunter area and 5.19× companion area, with no disconnected sampled free cells. Real-manifest tests traverse every new portal in both directions and run 56 longer routes through all seven districts. `city-watch.jpg` visibly records 7/7 explored. |
| Distinct Blender districts, original science-fiction landmarks and retained art direction | Pass | Reviewed `tools/build_assets.py`, `tools/build_city.py`, the four Blender previews and four live district captures. The market's awnings, domes and holoprojector, salvage drive/crawler yard, three-engine landing ship, and watch beacon/archives distinguish the spaces. Live captures retain wet stone, warm lanterns, cyan machinery and the original traveler/Tallow silhouettes. |
| Original controls, objectives, bond, free camera, map and lore | Pass | Existing fetch/return, escort, ridge, call/stay/scan/overwatch, emote and bond tests pass against the current manifest. City map and free-camera captures show their controls. The Still Ember's displayed note matches the shared layout's authored lore. Source review confirms modal gating and held-input clearing. |
| Draw/holster, mouse/Space fire, visible projectiles, synthesized sound, scenery/enemy collision and optional enemies | Pass with audio limit | `city-combat.jpg` shows the drawn blaster, cyan projectile, hostile actors and one defeat. Corresponding state includes one downed enemy, another at 33 health and one projectile. Stand-down state clears all enemies/projectiles and restores/retains shield 100. Tests cover thin-wall collision, nearest-hit ordering, telegraphs, damage, defeat, recovery, cooldown and stand-down. Four audio contract tests validate synthesis and routing; audible playback was not personally heard. |
| Build, meaningful regression checks and honest runtime evidence | Pass | Independent `npm test`: 47 passed, 0 failed. TypeScript/production build passed; Vite emits its nonfatal bundle-size advisory. Saved runtime samples and their limits are reported below. |

## Independent area measurement

The verifier used a separate Node script with `Navigation.isFree`, a 10 cm grid of cell centers, and a four-neighbor flood fill starting at `(3, 6)`. The baseline used `outputs/original-manifest.json` obstacles inside the preserved original courtyard/passage/ridge walk rectangles; the expanded measurement used the current manifest and district/link union. Both measurements include actor clearance. This was independently recalculated rather than accepted from `outputs/city-area.json`.

| Actor clearance | Original usable area | Expanded usable area | Connected-area ratio | Disconnected sampled free cells |
| --- | ---: | ---: | ---: | ---: |
| Hunter, radius 0.42 m | 550.26 m² | 2877.72 m² | 5.2297× | 0 |
| Tallow, radius 0.48 m | 533.98 m² | 2773.08 m² | 5.1932× | 0 |

These are sampled usable-center estimates, not exact polygon areas. The existing 5 cm measurement artifact reports approximately 5.21× and 5.20× respectively, consistent with the independent result. The exact walk-rectangle union expands from 720.86 to 4098.62 m²; that gross area is kept separate from obstacle- and clearance-adjusted usable area.

## Combat and audio checks

- Source inspection verified that projectile sweeps choose the earliest wall or actor contact. Exact rectangle intersections prevent tunneling through thin walls. The main loop checks the player-to-muzzle segment and falls back to the player's clear center when necessary, preventing a protruding muzzle from starting a shot beyond a wall.
- A separate Three.js scene probe checked 18 instance transforms across six actors and three articulated parts against their original hierarchy matrices. Every transform matched within `1e-5`; muzzle coordinates remained finite. Stand-down removed every enemy root, set all corresponding instance counts to zero and hid the pools.
- A separate 3 m grid sampling across all seven districts found six reachable enemy spawns at every valid sampled player position.
- `tests/audio.test.ts` checks one-time context/source initialization, resume without duplicate ambience, descending blaster envelopes distinct from rising companion chirps, separate player/enemy pitch, source routing through the master gain, transient cleanup, live mute/volume behavior, and mute before initialization.
- The Web Audio test uses a contract stub. It does not render an audio waveform, access physical speakers, measure loudness, or establish that playback was heard. Main-loop source maps player/enemy fire events to the corresponding blaster sounds.

## Live artifacts independently inspected

- `outputs/city-landing.jpg`: original landing ship, surrounding structures, preserved HUD and a reachable ship-inspection prompt.
- `outputs/city-market.jpg`: market stalls, domed buildings, lighting, holoprojector and separated traveler/companion silhouettes.
- `outputs/city-cantina-lore.jpg`: The Still Ember field note and inspection prompt, consistent with `src/world-layout.json`.
- `outputs/city-salvage.jpg`: repair gantry/drive, yard objects and visible traveler/Tallow.
- `outputs/city-watch.jpg`: watch beacon, district architecture, traveler/Tallow and 7/7 districts explored.
- `outputs/city-map.jpg`: all seven named district destinations and connected city layout, proportionally rendered.
- `outputs/city-free-camera.jpg`: free-camera controls remain accessible in the expanded world.
- `outputs/city-combat.jpg` and `city-combat-state.json`: visible cyan bolt, armed enemies, combat HUD, one defeat, another damaged enemy and shield 100.
- `outputs/city-stand-down.json`: enemies disabled, empty enemies/projectiles, shield 100, traveler and companion positions preserved.

## Observed performance

These are saved local browser samples at a reported drawing-buffer resolution of **2061×1176**. FPS values are the game's rolling frame-interval measurements; they are not an independent GPU benchmark or a promise for other hardware.

| Captured activity | Observed rolling FPS | Observed p95 frame interval |
| --- | ---: | ---: |
| Landing snapshot | 70.8 | 18.1 ms |
| Six stationary market snapshots | 74.7–83.7 | 17.5–17.8 ms |
| Four snapshots moving through the courtyard and west gate toward salvage | 72.5–78.0 | 17.7–18.1 ms |
| Four stationary salvage snapshots | 81.8–84.4 | 17.5–17.6 ms |
| Twelve stationary ridge snapshots | 66.9–73.8 | 17.9–24.3 ms |
| Combat snapshot with a live projectile and one defeat | 73.2 | 18.1 ms |

Sources: `outputs/city-landing-state.json`, `outputs/city-travel-performance.json`, `outputs/city-combat-state.json`. The travel file contains both moving and stationary samples; the rows above distinguish them from actual position changes. Combat's captured total was 949 render submissions and 1,673,477 rendered triangles across its rendering passes. These samples do not establish a sustained minimum frame rate or long-session stability.

## Defects found and resolved during review

1. **P2 — map click coordinates shifted in shorter viewports.** A capped canvas height with `object-fit:contain` created letterboxing while the click handler used the full element rectangle. The final proportional width/automatic height removes that discrepancy.
2. **P2 — minimap mouse clicks passed through to gameplay.** The minimap inherited the HUD's `pointer-events:none`. The final `.map-frame` rule restores pointer input.
3. **P3 — muting before audio initialization still routed ambience at nonzero gain.** The master gain initialized from volume without checking the enabled flag. The final initialization honors mute, and the regression test passes.

All three corrections were verified in the final source. No further confirmed blocker was found. Review coverage is limited to the inspected artifact and captured desktop view: audible playback, every viewport size, every possible input sequence and long-duration stability were not independently established.

## Addendum — final live oath evidence

Independently inspected `outputs/city-oath-complete.jpg` and the seven snapshots in `outputs/city-oath-performance.json`. The screenshot visibly shows **3/3 objectives complete**, bond **87/100**, **7/7 districts explored**, traveler and Tallow together on Emberwatch Ridge, and the dusk completion note. The saved sequence progresses from a recovered token in the courtyard, to completed escort in the passage, to ridge progress increasing from 3.53 through 8.48 and 13.52 to **18 seconds**, with all three objective flags true in the final two samples. This adds live artifact evidence that the original quest remains completable after exploring the expanded city.

The ten `outputs/city-return-performance.json` snapshots also show the traveler and companion returning from Far Watch through ridge/passage to courtyard. Recomputed `outputs/city-verification-summary.json` against all **43** source snapshots: observed rolling FPS **66.9–84.4**, largest sampled p95 frame interval **24.6 ms**. Capture gaps and changing/stationary positions remain distinct; these values do not imply one uninterrupted stability run or guaranteed performance on other hardware. The initial sound button now has `aria-pressed="true"`, verified against `Soundscape.enabled = true`. The review verdict remains **pass with the stated limits**.
