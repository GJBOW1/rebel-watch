# Rebel Watch — living city verification

Verified locally and publicly September 5–6, 2026. The earlier interior report is preserved as `verification-interiors.md`.

## Result and current public release

- Public address: https://rebelwatch.newsfromskippy.com/
- Name: **Rebel Watch — The Ember Outpost**, chosen in response to the user's Rebellion naming request.
- Existing web host, a new isolated Nginx site and release directory, a new Cloudflare-proxied DNS record, and a dedicated Let's Encrypt certificate. No existing site or DNS record was replaced.
- 84/84 tests and production TypeScript/Vite build pass. Vite reports the existing large renderer bundle advisory; there are no build errors.
- 16 independently walking residents, four resident silhouettes, 48 authored conversation lines, two rooftop flight schedules, six neutral stormtroopers, and two visiting Jedi. Player participation is optional and observers are immune to crossfire.
- Original 32-bar score with independent toggle/volume and master mute; no external music recording.

## Directly observed gameplay

The local Chrome walkthrough and public in-app-browser walkthrough used ordinary clicks and keys. They confirmed residents walking, E conversation text and stop/face behavior, neutral patrols, blue and green lightsabers, Jedi attacks and trooper defeats, observer shield remaining 100, J participation and stand-down, companion Call, and music toggle/volume.

The public build loaded every model and its shared texture files, reached the entry screen, and entered gameplay. Browser warning/error log was empty during the public smoke. Cloudflare presents a brief automatic security verification on a fresh browser visit. Plain curl is challenged with HTTP 403; the browser completed verification normally without manual intervention. Public availability is verified through the browser, rather than claimed from curl.

Rooftop arrivals and departures were observed in free camera. Screenshots and `living-flights-performance.json` preserve the ship state sequence. The sampled trace ends with two completed shuttle landings and departures and two freighter landings. A prior view captured the docked shuttle. Automated tests cover complete repeated cycles and mid-descent occupied-pad recovery without discontinuity.

## Performance and image iteration

22 live Chrome skyport samples at High quality and 2061×1252 framebuffer resolution measured 64.86–70.59 rolling FPS. Earlier populated-courtyard and combat checks measured approximately 67–90 FPS. The public in-app browser at 1282×1356 sampled 58.94 FPS initially and 71.05 FPS in a later check. These are observations on this machine, not a guaranteed minimum on all hardware.

Nine new assets were modeled and exported through the installed Blender MCP bridge. The ship concept and alloy texture were generated with built-in imagegen. The character concept attempts were blocked by the generation system; official appearance references and Blender studio review guided those silhouettes. `population-art.md` records that limitation and the sources.

Runtime iteration corrected the two saber colors using distinct emissive materials, astromech rolling animation, lowered neutral-patrol rifles, trooper grip alignment, forward-facing ship approach, and rooftop support columns. The ship meshes preserve the concept silhouettes and palette; the concept has richer fine surface weathering than the runtime meshes. No claim of pixel equivalence is made.

## Independent challenge and corrections

A fresh verifier with no conversation history independently ran 82 baseline tests and a production build, inspected render/controller integration, and exercised 300-second encounter loops in all seven districts. It identified cyan-only saber emission, walking astromech outriggers, battle freezing in free camera, unresolved player-only patrol victories, and civilian overlap during circulation.

All five issues were corrected. The verifier explicitly confirmed the first two render fixes before its session hit an account usage limit. It did not provide a final approval. Root re-ran the verifier's unchanged probe against the final source: every district completed an encounter, a player-only victory returned to observer cooldown, and the minimum civilian center separation increased from 0.027 m to 0.801 m. Two added regression tests cover the latter behaviors. Evidence: `living-review-before.json`, `living-review-after.json`, `living-final-tests.txt`. This distinguishes the independent findings from the author's final recheck.

## Public packaging

`tools/package_release.py` externalizes and deduplicates byte-identical embedded images from the authored GLBs. Geometry buffer bytes and texture pixels are unchanged; source Blender files and source exports remain intact. Nineteen embedded image copies become six shared textures. The compressed release transfer falls from 57.10 MB to 25.12 MB. Only the runtime HTML, JS, CSS, GLBs, collision manifest and shared textures are published; source, concepts, private files and review artifacts are excluded.

`deployment-assets.json` records SHA-256 checksums. The production origin returned byte-identical reviewed HTML over verified HTTPS. The deployment uses isolated versioned releases, an atomic current-release symlink, and automated certificate renewal. Host-specific operation files and raw logs are intentionally excluded from the source repository.

The project graph was refreshed without an LLM: 694 nodes and 2214 extracted edges, then reclustered to 71 communities and 1249 consolidated edges. No vault or memory files were changed.
