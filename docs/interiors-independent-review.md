# Independent enterable-interior review

Artifact: repository root (`.`).

Acceptance contract: `docs/interiors-plan.md`. Review used artifact source, exported assets, independent execution, and actual saved game screenshots. No existing browser tab was controlled. Source/assets were not edited. Temporary independent probes live in `outputs/interiors-independent/`.

## Current verdict

Pass against all five points in `docs/interiors-plan.md`. No confirmed functional or blocking visual defect remains. The observed cantina door-leaf occlusion was corrected and reverified in the actual game image. The final performance/limitations documentation was inspected and agrees with the saved evidence.

1. Physical interiors and continuous entry/exit: pass, supported by the actual geometry, real-manifest tests, independent doorway mesh checks and continuous companion probes.
2. Distinct Blender/textured furnishing and visibility cutaways: pass, supported by GLB decoding, embedded-texture identity, runtime visibility checks and all three actual game images.
3. UI/lore/map and preserved companion/city/combat behavior: pass, supported by source integration, actual map/scan/combat evidence and existing plus independent regression probes.
4. Production build and meaningful checks with an independent artifact-only reviewer: pass.
5. Concept comparison/refinement and honest local frame-time reporting: pass. The final images and first-pass images show meaningful changes; the documented sample range and limitations match the files.

## Independent execution

- `npm test`: all 58 tests passed, no failures/skips. Tests include actual exported manifest, interior path traversal, body-width thresholds, furniture-side routes, scan lore, shell impacts, enemy toggles, seven-district traversal, and the original three objectives.
- `npm run build`: TypeScript and Vite production build passed. Vite reports the greater-than-500 kB JavaScript chunk warning; this is an optimization limitation, not a build failure.
- Repeated the production build after the material/light/camera and door-pocket refinements: still passed. Re-ran the real-GLB probe and added independent assertions for the changed leaf visibility: partially opening leaves stay visible; fully retracted near-wall leaves hide; far-wall leaves remain; closed exterior leaves restore.
- `verify.mts`: decoded the real 277-mesh `world.glb`, built Three meshes from its actual buffer accessors, and exercised the real `InteriorView` class. All three interiors have real roof/wall/door meshes. All camera-facing wall sides hide as expected; roof and wall visibility restores after both actors leave; a companion staying inside keeps the roof removed. Thirty-six manual body-width doorway crossings remain clear of the actual moved door leaves. Twenty-seven rays at three heights and three lateral positions found no static GLB blocker through the openings.
- The generated `interior-panels.png` bytes exactly match the embedded GLB image by SHA-256, `0900a3097e1834b7d643ac1c0ffe9012a90f902f69f0d913fcfb7823ebd52c4b`. The export's `manifest.interiors` equals the runtime `src/interiors.json` contract.
- `companion.mts`: for each interior, physically picked up the original courtyard token, held the carrying companion in the courtyard while the hunter walked indoors, then resumed delivery to the indoor hunter. All four emotes, overwatch, recall, and exit succeeded afterward. Across 13,692 simulated 30 Hz frames every player and companion position remained collision-free and movement stayed within speed bounds. This does not bypass the authored near-token range requirement when starting Fetch.

## Source and asset findings

The Blender generator replaces each solid building collider with split wall shells and furniture colliders using the shared room manifest. The engine keeps city coordinates throughout entry/exit, and E/map/button actions request navigation paths. Room names, per-room lore, doorway prompts, city map destinations, minimap room bounds, and the original companion/combat controls are integrated. The source art distinguishes bar/booths/bottles and host, repair bench/scout components/toolboard/power coils, and relic/data cabinets/star ledger.

## Screenshot review so far

Compared `public/assets/concepts/interiors-target.png` with actual `outputs/interiors-cantina-first-pass.jpg`, `outputs/interiors-cantina.jpg`, `outputs/interiors-cantina-exterior.jpg`, and `outputs/interiors-free-camera.jpg`.

The final cantina preserves the concept's warm bar, side seating, low front walls, and open central circulation. Relative to first pass, the final game screenshot visibly fixes severely bright doorway plates and patchy black masonry. The restored exterior image shows the dome and complete shell back in place, with both actors on the street. The free-camera image visibly contains the interior lore title and the camera controls.

Resolved and reverified in the final game image: at the earlier normal cantina arrival formation, Tallow was partly occluded by the full-height right sliding leaf from the default camera. This was reported to the maker. The updated source now hides fully retracted near-wall leaves with the cutaway; independent mesh-backed runtime assertions confirm this behavior while retaining opening/closing animation and exterior restoration. The refreshed `outputs/interiors-cantina.jpg` (18:51:24 local file timestamp) visibly shows the companion clearly through the doorway.

Also reviewed actual `outputs/interiors-workshop.jpg`, `outputs/interiors-combat.jpg`, and matching workshop/combat/stand-down snapshots. The workshop has a readable toolboard, repair bench, disassembled scout, and exposed power coils. It matches the concept's industrial task-light character with a broad navigable aisle. The westward camera makes the room readable despite exterior salvage structures, and both characters are identifiable inside. The screenshot confirms the repair-bench inspection prompt.

Combat evidence shows equipped and enemy-enabled play reaching shield defeat. The stand-down snapshot restores shield to 100, clears enemies/projectiles, and preserves both actor positions exactly. The workshop rolling sample records ~84.4 FPS and p95 17.1 ms; combat sample ~67.3 FPS and p95 24.7 ms, both at 2061×1252. These snapshots corroborate the independent collision/combat tests but do not themselves demonstrate a wall-impact frame.

Also reviewed `outputs/interiors-archive.jpg`, `outputs/interiors-scan.jpg`, `outputs/interiors-archive-combat.jpg`, and corresponding archive/combat/stand-down JSON. The cool archive contains the star ledger, four data cabinets, and relic plinths; both actors are clearly visible in the open room. The authored inspection title/text and scan overlay are visible. Combat shows one enemy defeated while shield remains full, followed by a clean stand-down. This room is visually distinct from the warm cantina and industrial workshop and follows the generated concept's intended identity.

`outputs/interiors-performance.json` contains 26 snapshots at 2061×1252. Directly recomputed combined range is 62.07–90.16 rolling FPS and largest sampled p95 interval 25.0 ms. The file spans multiple capture runs, including a frame-counter restart, and contains both traversal and stationary samples. Archive snapshot records ~89.1 FPS/p95 17.2 ms; archive live-combat snapshot ~82.6 FPS/p95 17.3 ms. These are saved local rolling samples, not a hardware/browser-wide performance guarantee. The final `docs/verification.md` explicitly describes multiple sessions, gaps, view refinements, startup warm-up risk, hardware/resolution variability and unmeasured physical speaker output. Its range and summary match independent recomputation.

Final `outputs/interiors-map.jpg` visibly shows all seven district destination buttons, all three named building destinations, and 3/3 visited interiors. Final cantina snapshot independently confirms `visitedInteriors` contains workshop, archive and cantina, with both actors in the cantina and enemies disabled.

Final manifest hash and counts were independently recomputed: SHA-256 `9d37b080147d7d46b1c11e76ff5aa339693ce586db31b2d77d7469ed90debd67`; 600,740 source triangles, 277 world batches, 153 colliders and 60 fixtures, agreeing with the final verification prose. Existing city/objective evidence is clearly retained separately from this interior pass.

## Remaining limitations

The verifier inspected saved runtime screenshots/state and did not personally operate a browser session. The runtime rendering checks are based on actual image evidence plus CPU-side execution of real geometry and visibility classes; automated simulation tests establish continuous motion and collision behavior. Physical audio output, every free-camera angle, other devices/browsers and uninterrupted long-duration GPU performance were not independently measured. The nonfatal large-bundle advisory remains. These limitations do not invalidate the requested local deliverable rubric.
