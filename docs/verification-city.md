# ASHFALL city and blaster verification — 5 September 2026

The expanded local build is complete. All seven districts were visited using ordinary game controls, then the original foundling-token, escort and dusk objectives were completed again. The new combat mode was exercised with visible bolts, enemy damage/defeat and immediate stand-down. Enemies start disabled.

## Geometry and scale

- Four new districts connect to the three original zones through clear gates. `src/world-layout.json` is shared by Blender generation, navigation, location/lore and city-map UI.
- Exact walk-rectangle union: 720.86 → 4098.62 m² (5.686×).
- Collision-clearance-adjusted connected usable space, 5 cm grid: player 552.64 → 2879.78 m² (**5.211×**); Tallow 532.93 → 2771.05 m² (**5.200×**). All sampled free space connects to the starting court.
- A fresh independent verifier recomputed the result on a separate 10 cm grid: 5.23× and 5.19× respectively, with no disconnected cells.
- Final Blender world: 551,564 triangles, 128 material batches in seven spatial chunks, 123 collision shapes and 51 emissive warm fixtures. Twelve nearby point lights are reused as the camera moves. Wet reflections cover every district.
- Original generated ship-panel texture was revised from noisy repetition to broad hull plates. Habitat roof utilities, patches, vents and original clan details were added after preview review.
- `art/ashfall_master.blend` and both deterministic model generators were rebuilt through the actual Blender MCP connection. No marketplace kit or franchise model is used.

## Build and regression gate

- `npm test`: **47 passed, 0 failed**.
- `npm run build`: TypeScript and production build pass. Final engine bundle is approximately 713 kB minified / 189 kB gzip; Vite prints its nonfatal size advisory.
- Tests cover original interaction/objective behavior; all four new portals in both directions; 56 long city routes; all nine landmark approaches; thin-wall projectile collision; enemy hits, telegraphs, navigation, defeat, shield recovery and toggle cleanup; and four audio initialization/envelope/muting contracts.
- Raider rendering uses 34 articulated model instances across six actors instead of 204 separate submissions per rendering pass. Independent matrix checks verify the original hierarchy transforms, and turning enemies off hides/zeros all instance pools.
- Independent review: `docs/city-independent-review.md`. Map click aspect ratio, minimap pointer handling and pre-initialization mute defects found during review were fixed.

## Live browser evidence

All actions used normal UI controls, without changing game state through a debug API. Read-only DOM state snapshots record the result.

1. Walked courtyard → landing → market → salvage → ridge → Far Watch and back, with dynamic headers and continuous Tallow follow. The HUD reached 7/7 districts.
2. Used the minimap and M map, a street click and destination buttons. Approached the courier's inspection point, then read the Still Ember's authored note with E.
3. C entered free camera with its help controls; returning restored play.
4. B drew the original Cairn pulse carbine. Mouse-aimed clicks fired cyan bolts, reduced enemy health 66 → 33 → 0 and recorded a defeat. Raiders rendered their weapons, red target rings and warning lines.
5. N disabled enemies with a live projectile present: saved state has zero enemies, zero projectiles, full shield and unchanged traveler/companion positions. Defeat and recovery were also exercised during the initial combat pass.
6. Fetched the original foundling token with E, physically returned with Tallow and earned bond. Crossed the original gate together; called Tallow onto the ridge and held until dusk. `city-oath-performance.json` ends with all three objectives true, ridge progress 18 and bond 87.

Live screenshots are `outputs/city-{landing,market,salvage,watch,map,combat,free-camera}.jpg`, plus `city-cantina-lore.jpg` and `city-oath-complete.jpg`. They are actual engine frames; separate Blender previews are explicitly named `blender-*-preview.png`. Concepts are comparison targets rather than game screenshots.

## Performance and limits

High-quality desktop captures at a 2061×1176 drawing buffer recorded **66.9–84.4 rolling FPS** across 43 saved samples containing both movement and stationary states. The largest sampled p95 frame interval was 24.6 ms. The live combat capture recorded **73.2 FPS**, a visible projectile, one defeat and 949 total submissions across rendering passes. The final three-objective state recorded 78.0 FPS.

Sources: `outputs/city-travel-performance.json`, `city-return-performance.json`, `city-oath-performance.json`, `city-combat-state.json` and `city-verification-summary.json`. Capture runs have gaps; these are measured local observations, not a guaranteed minimum or an independent GPU benchmark. Other hardware, window sizes and long sessions may differ. Balanced quality remains available. The original locked-desktop 30 FPS measurements are retained as historical evidence in `verification-original.md`; the new desktop browser observations do not erase them.

Blaster sound is synthesized locally using descending oscillator sweeps and noise transients, with distinct enemy pitch, master volume and mute handling. Source routing and bounded envelopes pass automated tests; physical speaker output was not independently listened to or measured.

No account, external gameplay service, analytics, commit, push or deployment was added. The local Vite preview remains the playable delivery.
