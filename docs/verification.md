# Rebel Watch — Operation Emberline verification

Verified locally and on the public site September 6, 2026. This report distinguishes the complete local campaign walkthrough from the public release smoke and measured performance. The preceding city release is preserved in [verification-living-city.md](verification-living-city.md). The linked GitHub workflow records tests and build status for each repository revision.

## Published result

The local browser walkthrough completed all six main chapters through actual game inputs, and the convoy ending finished naturally. Grogu remained a companion after the convoy escaped. All three optional contracts were still available and had never been accepted, demonstrating a complete main path without side-quest rewards.

All three optional contracts were then completed through ordinary browser controls. A page reload preserved every campaign objective flag, all five owned weapons, the equipped scatterblaster, resources and the earned shield upgrade; the actual ground HUD showed **120/120**. The final combined automated run passed **141/141 tests**, including the final camera regression, and the production TypeScript/Vite build passed. The build reports Vite’s existing large-chunk advisory, not a build error. Final flight/rooftop observations and the public-release smoke are complete.

**Operation Emberline is published at [rebelwatch.newsfromskippy.com](https://rebelwatch.newsfromskippy.com/).** HTTPS-served HTML and JavaScript hashes match the final package exactly. The public HTML loads `/assets/index-BBOiL0l3.js`, identifying the verified campaign build.

## Main story observed in the browser

| Chapter | Observed result |
| --- | --- |
| **A Signal Beneath the Ash** | Maera’s briefing, chapter acceptance and explicit supplies claim. |
| **The Smallest Light** | Rescue Grogu at the refuge, physically escort him to Ryn at the archive, then claim the chapter. |
| **Three Silent Towers** | Disconnect all three relays and claim the Ionlance. |
| **The Warden’s Last Order** | Fight and defeat the Warden with the earned ion weapon, then claim the reward. |
| **A Road Through the Sky** | Destroy three actual TIE fighters after acceptance. An emergency return correctly preserved the kills without completing the landing objective. A subsequent normal refuge landing completed it; claim the Ember Arc. |
| **Leave No Ember Behind** | Basic Cairn Carbine shots did no damage to Vader. Toggle enemies off to pause the encounter, resume, buy a field repair for 20 credits and 2 cells, then win with the Ember Arc. Explicitly signal the convoy and finish the ending. |

The recorded post-ending state has six `complete` main chapters, three `available` side contracts, all three relay IDs, three mission flight kills, normal refuge landing and both boss victories. It retains only the main-path weapons—Cairn Carbine, Ionlance and Ember Arc—with no optional shield upgrade. The cinematic is inactive, the boss is idle with player shield 66, Grogu is rescued, and no main objective remains. That evidence confirms actual completion beyond merely opening the final scene.

The before-side-contract checkpoint and later completed/reloaded states were inspected directly. Raw browser traces and logs remain local and are excluded from the repository; selected untouched captures are included below.

## Optional-contract walkthrough and shield correction

After finishing the independent main path, **Hands That Still Heal** was accepted, its medicine delivered and its reward claimed in the browser. That walkthrough exposed an integration bug: the campaign recorded the permanent shield upgrade, but ordinary ground combat still used its original capacity.

The correction applies the earned capacity consistently to ground combat, recovery and repair paths. Ground and boss shield capacity are **120** after the reward; the ship retains its independent **100-point** shield. The targeted verification passed **37 tests**, including the capacity and save/restore paths; those regressions are included in the final **141-test full pass**. The final browser reload also retained the upgrade, and the ordinary HUD displayed **120/120**.

| Contract | Browser result |
| --- | --- |
| **Hands That Still Heal** | Accepted and delivered the medicine, claimed the reward and verified the corrected shield capacity. |
| **The Dockworkers’ Reserve** | Collected all three caches, returned to Maera and claimed the Trench Scatterblaster and resources. |
| **One More Good Turn** | Accepted the request, repaired the astromech for 6 scrap and claimed the Patchwork Arc Repeater and resources. The repeater was equipped through the UI. |

The final completed state contains **six complete main chapters, three complete side contracts, all five weapons, 920 credits, 69 scrap and 43 cells**, with the Trench Scatterblaster equipped and `shieldUpgrade: 20`. The browser was then reloaded. Every objective flag, resource balance, weapon and equipped choice matched the saved state; the shield upgrade remained present and ordinary combat displayed **120/120**. These are the observed balances for this walkthrough, which included a field-repair purchase, rather than a promised universal ending balance.

## World and authored assets

The Refuge, Drydock and Bastion extend the previous seven-district city to **ten connected districts**. The final collision-aware player area is **6,020.9725 m²**, up from **2,869.89 m²**: **2.097980×**. Companion clearance covers **5,816.19 m²**, up from **2,756.16 m²**: **2.110251×**. These are connected, traversable areas rather than a comparison of rectangular map bounds.

[Campaign art provenance](campaign-art.json), [the art notes](campaign-art.md), and the [measurement tool](../tools/measure-campaign-area.mts) document the authored geometry and measurement method. Automated asset/navigation checks cover the new districts, mission anchors and boss arena. Grogu, Vader, the Warden, reward weapons, the Rebel fighter and TIE fighters were authored in Blender through MCP; the concept was generated with built-in imagegen. No marketplace meshes were added.

The drydock crane was moved to provide at least **6.40 m** of clearance beyond the fighter’s left wing. The rooftop deck core was lowered below its visible panels to remove overlapping surfaces. Geometry and clearance checks cover the corrections. The final drydock landing left the fighter clear of the crane with both companions at the ramp. A complete rooftop cycle was observed: the shuttle docked at a 6.6 m root height with its fourth landing recorded, then departed with its fourth departure recorded. No surface flicker was observed during this check.

## Final flight and rooftop review

The final flight camera keeps the whole fighter visible with the city below. The docked state, takeoff, braking to a hover, manual flight and normal landing were exercised after the camera and crane corrections. The camera was raised and moved farther behind the fighter; the final screenshot verifies the runtime framing rather than relying only on calculated projection.

Rooftop traffic also completed its corrected docking/departure cycle in motion. The landing screenshot shows the settled shuttle, while the observed state sequence establishes the subsequent departure. A still image alone is not used as evidence of the full cycle.

## Actual campaign captures

These images are copied byte-for-byte from the local walkthrough. Some earlier captures contained JPEG data with `.png` source filenames; all published copies use `.jpg` to match their actual format. No retouching, compositing or image generation was applied to gameplay captures.

| Capture | What it establishes |
| --- | --- |
| [Hidden Refuge](images/campaign-refuge.jpg) | Grogu and Tallow present with the traveler at an Imperial relay in the new district. |
| [Refuge landing](images/campaign-refuge-landing.jpg) | Wayfarer One parked at the refuge and the flight chapter’s reward ready to claim. |
| [Vader encounter](images/campaign-vader-gameplay.jpg) | Active combat with the Ember Arc, Vader’s damaged health and a visible attack warning. |
| [Final flight camera](images/campaign-flight-camera-verified.jpg) | The whole fighter fits in the view above the city, with flight and landing guidance visible. |
| [Final drydock landing](images/campaign-drydock-final.jpg) | Clear parked fighter, player and both companions at the boarding ramp, with all missions complete. |
| [Corrected rooftop dock](images/campaign-rooftop-docked.jpg) | The shuttle settled on the corrected rooftop pad during the observed complete traffic cycle. |

The promotional README hero and campaign concept remain clearly identified as generated artwork. These frames show the runtime interpretation; they do not establish pixel equivalence to the concept.

## Automated verification scope

The campaign checks exercise a complete main path without optional quests; all three independent side contracts; once-only rewards and resource deductions; owned-weapon selection; valid, malformed and inconsistent saves; cinematic skip behavior; physical escort arrival; mission-specific flight counts; normal landing requirements; and free checkpoint retries. Boss simulations check both weapon gates, real projectile hits and victories, delayed attack warnings, obstacle blocking, defeat/retry and enemy-off behavior. Flight, Grogu, navigation, world assets and the pre-existing city systems are also covered.

At this checkpoint:

- Final full suite: **141 passed, 0 failed, 0 skipped**, including the retry, shield-capacity and final camera regressions.
- Production build: **TypeScript validation and Vite build passed**.
- Browser save/reload: **passed** for complete main/side progress, inventory, equipment, resources and shield upgrade.
- Final camera/flight and rooftop cycle: **passed in the browser** after the camera and geometry corrections.
- Exact public-release smoke: **passed**; served HTML and JavaScript match the final package.
- Repository automation: [GitHub Flight checks](https://github.com/GJBOW1/rebel-watch/actions/workflows/checks.yml) runs the test suite and production build for pushes and pull requests; consult its run for the matching commit’s status.

## Public release and package audit

The public browser completed Cloudflare’s automatic verification and loaded all **23 runtime models** to the ready state. The six-chapter campaign card appeared. Through normal controls, the player walked from the courtyard into the cantina, pressed **E** to accept the first quest and watched its actual public cinematic montage. Claiming its reward then completed chapter one and opened chapter two, with the expected **40 credits, 20 scrap and 5 cells** in the new public session. Browser development logs contained **no warnings or errors** during this smoke.

This public smoke verifies startup, asset loading, traversal, interaction and cinematic delivery on the exact deployed package. The complete six-chapter and three-contract walkthrough was performed locally; it is not described as a second full campaign run on the public site.

The release audit checked **23 models, 24 image references, six valid shared textures and 2,062 unchanged geometry accessors**. The package report lists **33 files**, approximately **86.5 MB uncompressed** and **29.21 MB with gzip**. Packaging shares existing texture data without changing geometry or texture pixels. HTTPS-served HTML and JavaScript match the final package hashes. Raw audit logs and host-specific operation details remain excluded from the repository.

## Performance observations and limits

Measurements below are rolling samples on the development machine from local and public browser sessions, not a controlled cross-hardware benchmark or a guaranteed frame-rate floor. The public measurement was taken with the browser in the foreground; background-throttled readings are excluded.

| View | Observed samples | Scope |
| --- | --- | --- |
| Public campaign cinematic | **53.73 FPS / 25.2 ms p95** | Foreground public browser at High quality, 2268×1294 framebuffer, running the deployed campaign cinematic. |
| Public Balanced setting | **54.62 FPS / 25.0 ms p95** | Foreground public browser at Balanced quality, 1512×863 framebuffer. High quality was restored after the check. |
| Final player-flight camera | **113.05 FPS / 16.5 ms p95**, then **73.34 FPS / 17.6 ms p95** | Two fresh samples after the final camera/crane changes; High quality, 2061×1176 framebuffer. |
| Corrected rooftop traffic | **66.06 FPS / 18.1 ms p95**, then **69.79 FPS / 17.8 ms p95** | Two fresh samples during the final roof review at the same quality and resolution. |
| Earlier player flight | 14 samples; **80.30–119.99 FPS**, sampled p95 frame times **9.7–17.7 ms** | Recorded before the final flight-camera adjustment; retained as earlier evidence only. |
| Vader encounter | **69.9 FPS**, **25.1 ms p95** frame time | One reported combat sample; the p95 indicates some frames exceeded a 60 FPS frame budget. |
| Ground travel | Approximately **67–100 FPS** | Walkthrough observations, not an exhaustive district-by-district benchmark. |

These are short rolling observations. Several p95 values exceed the 16.67 ms frame budget for 60 FPS, and both public quality-setting samples averaged below 60 FPS. The measurements do not establish a global or per-frame 60 FPS minimum. Earlier living-city samples are retained in the [previous report](verification-living-city.md) and are not substituted for expanded-campaign results.

## Repository checks

The verified package is live and its public smoke has passed. The [GitHub Flight checks workflow](https://github.com/GJBOW1/rebel-watch/actions/workflows/checks.yml) runs the test suite and production build for pushes and pull requests. Its run history records the result for each commit; the locally observed 141-test pass is reported separately above.
