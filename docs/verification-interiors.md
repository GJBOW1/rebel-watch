# ASHFALL enterable interiors — 5 September 2026

Three buildings now contain physically connected, furnished interiors: The Still Ember in Lantern Exchange, Kestrel Repair House in the Iron Wadi, and the Oath Archive at the Far Watch. The player and Tallow walk through sliding doors using ordinary movement, an E doorway action, or a building destination on the city map. They remain in the same continuous navigation world.

## Delivered behavior

- All three original solid building colliders were replaced by wall strips around 2.2 m openings, with separate furniture colliders. Door approach/exit stops leave room for Tallow's actual follow lag. E entering walks farther into the room; E leaving or the Return to street button walks both characters outside.
- Roofs and the camera-facing upper walls cut away on entry/near approach. Invisible ceiling geometry retains roof shadows. Fully retracted door leaves disappear with their wall pockets, so they cannot cover the small scout; closed exterior doors restore. The roof remains cut away if either character is inside.
- Each room has a distinct camera composition, indoor practical lights, dry flooring, quieter ambient sound, a local floor-plan minimap, location header, arrival/exit note and inspectable lore. Free camera, including recenter and return, also works indoors.
- Cantina: brass/timber horseshoe bar, bottle shelves and taps, worn booth seating, tables, a clan rug and an original planted host automaton. Repair house: dismantled scout chassis, repair arm, bench, tools, coils and a safety-marked aisle. Archive: data stacks, original relic displays and a luminous orbital ledger.
- The seven outdoor districts, original objectives, companion commands and optional blaster/enemy system remain functional. The combat status panel allows aiming clicks to pass through its noninteractive surface.

## Asset process and visual iteration

The built-in Codex imagegen tool produced the three-panel concept and original interior panel texture. Exact prompts and reference provenance are in `docs/interiors-imagegen-prompts.json`; outputs are `public/assets/concepts/interiors-target.png` and `public/assets/textures/interior-panels.png`.

Models were authored and exported through the installed Blender MCP client/bridge, with a successful receipt in `outputs/blender-interiors-build.json`. Reproducible sources are `tools/build_assets.py`, `tools/build_city.py`, `tools/build_interiors.py` and `src/interiors.json`; `art/ashfall_master.blend` is the editable scene. All assets remain project-original, with no marketplace kit, franchise character, exact costume or branded symbol.

Final world: **600,740 triangles, 277 material batches, 153 collision shapes and 60 fixtures**. The renderer reuses a bounded pool of twelve nearby point lights. Indoor lighting chooses the active room's fixtures; outdoor lighting chooses outdoor fixtures. The generated panel texture is embedded in the world GLB. Manifest SHA-256: `9d37b080147d7d46b1c11e76ff5aa339693ce586db31b2d77d7469ed90debd67`.

Actual engine frames were compared with the concept and refined:

1. Moved a workshop approach lamp and widened its rear bench aisle after full-body navigation probes found tight clearances.
2. Reduced bloom indoors and prevented outdoor point lights from washing through interior walls. Material preparation now runs once for shared GLB materials, correcting overly dark repeated stone patches.
3. Changed the workshop view to the west and archive view to the north, keeping the exterior crane and near walls from covering the furnishings. Recenter uses the same room composition.
4. Hid retracted door leaves with their cutaway pockets after screenshot review found a partial Tallow occlusion. The HUD's expanded field kit now sits below the location line.
5. Changed the archive's solid cyan tabletop to a dark surface with fine luminous edges/orbits, retaining a readable chart.

`outputs/interiors-{cantina,workshop}-first-pass.jpg` retain the earlier comparison frames. Final game captures are `interiors-cantina.jpg`, `interiors-workshop.jpg`, `interiors-archive.jpg`, `interiors-scan.jpg`, `interiors-free-camera.jpg`, `interiors-map.jpg`, `interiors-archive-combat.jpg` and the two exterior captures. Files named `interior-*-preview.png` are separate Blender previews. The concept is a visual target, not a screenshot or a claim of pixel identity.

## Verification

- **58 tests passed, zero failures or skips** against the actual exported manifest (`outputs/interiors-test.log`); TypeScript and production Vite build pass. The approximately 721 kB minified engine bundle still triggers Vite's nonfatal size advisory.
- Eleven new checks add all three formation-aware E entries/exits at walk and sprint speeds, sixty furnished interior edge routes, thirty-six full-body doorway crossings, hold/call/resume, indoor scan/lore, shots through open doors, wall impacts and enemy navigation/toggle behavior. All original 47 navigation, interaction, objective, audio and combat regressions remain intact.
- A fresh independent verifier independently ran the build/tests, decoded the actual GLB, matched the embedded generated texture to its PNG, tested cutaway/door restoration and checked physical clearance against moved door meshes. Additional independent companion fetch/return, emote and overwatch probes ran 13,692 simulated frames with bounded collision-free motion. Report: `docs/interiors-independent-review.md`.
- Live browser actions used ordinary UI input. Read-only DOM snapshots recorded results. Visited all three interiors with continuous Tallow follow; used E on the cantina door; inspected the barkeep, repair bench and star ledger; tested free camera/recenter/return; scanned archive lore; and walked out with roofs restoring after both actors left.
- Live archive combat defeated one raider with shots through the doorway. Its stand-down capture shows full shield, no enemies/projectiles and unchanged player/companion coordinates. The workshop pass also exercised shield defeat and recovery. Room wall/shot contact is additionally covered by automated real-manifest tests.
- The final cantina snapshot records all three interiors visited, six outdoor districts visited, unarmed/quiet mode and player/Tallow inside. Browser warning/error inspection returned no entries after the final walkthrough.

## Performance and limits

Twenty-six saved local samples at **2061×1252**, High quality, ranged from **62.07 to 90.16 rolling FPS**. The largest sampled p95 frame interval was **25.0 ms**. Samples include city travel, stationary rooms and live indoor combat; the archive combat state recorded **82.60 FPS**. `outputs/interiors-performance.json` contains the captures and `outputs/interiors-verification-summary.json` recomputes the range.

These are local rolling frame intervals from multiple QA sessions, with capture gaps and view refinements between sessions. They are not an uninterrupted GPU benchmark or a guaranteed minimum. Initial loading/shader warm-up can hitch; other hardware, resolutions and long sessions may differ. Balanced quality remains available. Source/envelope checks establish local synthesized audio routing; physical speaker output was not independently measured. The final visual result matches the concepts' room identity, palette, cutaway composition and original character scale, with simpler geometry than the generated illustrations.

Previous city/area/objective/combat evidence is retained in `docs/verification-city.md` and `docs/city-independent-review.md`; original courtyard evidence remains in `docs/verification-original.md`. No account, analytics, external gameplay service, commit, push or deployment was added. Delivery is the running local preview.
