# ASHFALL verification — 5 September 2026

The playable local build and objective journey are complete. Sustained 60 fps remains an open acceptance item because the final in-app timing run measured approximately 30 fps while the desktop was locked. Earlier interactive observations were faster; those are not substituted for the sustained result.

## Build and navigation

- `npm run build`: strict TypeScript and Vite production build pass. The engine bundle is 683 kB minified / 178 kB gzip. Vite emits its advisory for bundles over 500 kB.
- `npm test`: 24 tests pass, including real exported geometry, eight movement headings, normalized sprint, swept collision, path clearance, both gate directions, fetch interruptions, scan cone/reward rules, emotes, call/stay/overwatch, all objectives and bond behavior.
- The seeded pursuit test runs over 12 simulated minutes. Separate tests use the actual 28-obstacle Blender manifest and each actor's physical radius.
- An independent reviewer ran another 480 overlap scenarios across 160 valid placements for follow, call and return. No collisions, failed arrivals, failed deliveries or inadequate final separation were found. Maximum observed displacement was 0.04684 m per simulation frame.
- Personal-space movement prevents the droid remaining inside the hunter after fetching a token directly under the player. A narrow clearance case beside the eastern cargo stack was reproduced and fixed. Stay remains planted.

## Live browser checks

Both reference posts were opened and the shared 18.55-second clip was watched through its final frame. Reference details and the acceptance rubric are in `build-plan.md`.

The game was tested with ordinary browser controls, without setting objective or character state through a debug API. The full journey was completed twice, including after the final Blender surface pass:

1. Click across the court, approach the token and press E. Tallow physically retrieves it, returns and separates from the player; first objective completes.
2. Approach Morrow and read its note. Press V while the condenser is inside Tallow's cone; highlight, note and bond reward appear.
3. Walk through the east gate. Location changes to The Sundered Line and both actors cross before the escort objective completes.
4. Approach the cyan relay and press E. Its original lore note appears.
5. Reach Emberwatch Ridge, press Q and observe the moving patrol alert. Both figures remain beyond the watchline until dusk and all three objectives complete.
6. Return through the passage into the courtyard; location updates again and Tallow follows continuously.

Additional checks: WASD movement, planted Stay while moving away, call arrival, all four emotes, C camera toggle, orbit/pan/recenter and on-screen help, High/Balanced resolution switching, reduced motion, sound toggle/volume wiring, settings from free camera, Escape on focused settings controls, and emote/settings interruption. Movement and sprint magnitude/facing also have eight-direction simulation coverage. Synthesized audio is driven by the interaction events; no external audio files are used.

## Performance evidence

Hardware: Apple M5 Max MacBook Pro, 128 GB memory. Rendering uses the local Three.js build.

| Environment and method | Render resolution | Result |
| --- | --- | --- |
| Chrome interactive observations before desktop lock, High | 2061 × 1176 | Approximately 120 fps in sampled courtyard states; not a sustained final benchmark |
| In-app interactive journey observations, High | 1920 × 1080 | Approximately 60–82 fps in sampled states |
| Final 30.125-second in-app sample, High, desktop locked | 1920 × 1080 | 30.01 effective fps; maximum sampled rolling p95 interval 34.7 ms |
| Same preview, 14-second Balanced comparison, desktop locked | 1280 × 720 | 30.15 effective fps; approximately the same frame cadence |

Raw final samples: `outputs/performance-high.json` and `outputs/performance-balanced.json`. Timing includes visible-tab stalls. The nearly identical cadence with lighter rendering suggests a preview/presentation limit, but its cause has not been proven. An unlocked sustained run is required before claiming stable 60 fps. The default remains High; Balanced is available in settings.

Shadow maps update once per rendered frame and are reused by reflections and ambient occlusion. The main courtyard snapshot dropped from about 581 to 456 draw calls after that change. The simulation uses a fixed 60 Hz step and caps delayed-frame catch-up; movement does not teleport to compensate for stalls.

## Art and provenance

Blender MCP connected successfully; original geometry was built and exported through `execute_blender_code`. The editable master and deterministic generator are included. Final world: 25 material batches, 202,750 triangles, three embedded generated images and no external GLB resource URIs. Actor meshes, materials and articulation were retained through the last surface pass.

Built-in Codex imagegen produced the concept and stone, slate and forged-alloy textures. Exact prompts are in `imagegen-prompts.json`. No marketplace models, franchise characters, logos, copied costumes or third-party game assets are included.

Independent review of the final screenshots found complete HUD framing, distinct player/companion silhouettes, coherent free camera and visible improvement from chipped coping, patched cloth, broken paving and darker contact shading. The result follows the concept's composition, palette and lighting at a stylized blocky level of detail. It does not establish equality with the concept's photorealistic material richness.

## Screenshots

- `outputs/courtyard-final.jpg`: default final courtyard and complete HUD.
- `outputs/free-camera-final.jpg`: orbit mode and camera help.
- `outputs/token-returned-final.jpg`: successful retrieval.
- `outputs/morrow-note-final.jpg`: stationary machine lore.
- `outputs/scan-final.jpg`: directional scan.
- `outputs/escort-final.jpg`: threshold and escort field note.
- `outputs/relay-note-final.jpg`: readable relay lore.
- `outputs/patrol-threat-final.jpg`: overwatch patrol alert.
- `outputs/ridge-complete-final.jpg`: completed three-part oath.

These are unedited browser captures. `surface-pass-*.png` files are Blender previews, clearly separate from runtime evidence. Earlier numbered iterations and capture-diagnostic images are retained as process evidence.

## Remaining acceptance item

Unlock the desktop and repeat a sustained High-quality timing run while moving through both thresholds. If it falls below the target, profile and iterate. Until that run succeeds, stable 60 fps is not signed off.
