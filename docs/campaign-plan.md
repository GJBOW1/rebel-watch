# Operation Emberline — campaign expansion

The public showcase baseline is commit `2cf9de4`, with 84 passing tests and successful GitHub Flight checks. This checklist tracks the subsequently requested expansion as of September 6, 2026. The complete local campaign and optional-contract walkthroughs are complete, and the verified package is live on the public site. The linked GitHub workflow records checks for each publication commit. See [verification.md](verification.md) for observations and limits.

## Implemented and checked

- [x] Add the connected Refuge, Drydock and Bastion districts. Final connected player area grows from 2,869.89 to 6,020.9725 m² (**2.097980×**); companion area grows from 2,756.16 to 5,816.19 m² (**2.110251×**).
- [x] Author Grogu, Vader, an elite Warden, a Rebel fighter, TIE fighters and distinct reward weapons in Blender through MCP.
- [x] Implement six linked main quests, seven skippable in-engine scenes, objective markers, a journal, checkpoints and an ending. Complete all six chapters and the ending in the local browser.
- [x] Implement three independent optional contracts, once-only rewards, resources and an accessible five-weapon loadout. Exercise their progression and economy in simulation tests; complete the browser main path with all three contracts still available.
- [x] Rescue Grogu and physically escort him to the archive. Retain Grogu and Tallow after the finale; exercise companion navigation in automated checks.
- [x] Win both actual boss encounters with earned upgrades. Verify Vader rejects the starting carbine, enemy-off pauses the fight and field repair spends 20 credits plus 2 cells. Cover warning shapes, weapon gates and checkpoint retries in simulation tests.
- [x] Board and pilot the fighter, destroy three TIEs after mission acceptance, then physically land at the refuge. Observe an emergency return preserve kills without falsely completing the normal-landing objective.
- [x] Add validated browser-local saves and checkpoint restoration; test malformed saves, mission counts, once-only rewards and retry regressions.
- [x] Correct the rooftop deck overlap and move the drydock crane clear of the fighter. Run authored-geometry and clearance checks.
- [x] Pass the **141/141-test full suite** and TypeScript/Vite production build, including the retry, shield-capacity and final camera regressions.
- [x] Complete Hands That Still Heal in the browser. Correct the exposed ground-combat upgrade integration so ground and boss shield capacity reaches 120 while ship capacity remains 100.
- [x] Capture current refuge, landing and Vader gameplay. Copy the images untouched into the README gallery and distinguish them from concept artwork.

## Final verification and release

- [x] Complete all three optional contracts through ordinary browser controls and claim all rewards. Verify all five weapons and the observed final resources: 920 credits, 69 scrap and 43 cells.
- [x] Reload the browser and preserve every campaign objective flag, inventory, equipped scatterblaster, resources and shield upgrade. Confirm the actual ground HUD displays 120/120.
- [x] Observe the complete corrected rooftop docking/departure cycle without surface flicker. Review the final player-flight camera through docked state, takeoff, braking, manual flight and normal landing, with the whole fighter visible.
- [x] Capture fresh final-camera and rooftop performance at High quality, 2061×1176: two flight samples at 73.34/113.05 FPS and two rooftop samples at 66.06/69.79 FPS. Record the sampled 16.5–18.1 ms p95 frame times and their limited scope.
- [x] Audit and publish the final package; confirm HTTPS-served HTML and JavaScript hashes match. Load all 23 models in the public browser, enter the cantina, accept chapter one, play its cinematic and claim its reward to unlock chapter two with no logged warnings/errors. Record the foreground High-quality 2268×1294 sample of 53.73 FPS / 25.2 ms p95 and Balanced 1512×863 sample of 54.62 FPS / 25.0 ms p95.
- [x] Update the README and verification report with observed local/public results and bounded performance claims. Link the GitHub workflow for per-commit results without substituting the local pass for a CI result.

The [GitHub Flight checks workflow](https://github.com/GJBOW1/rebel-watch/actions/workflows/checks.yml) records the test and build result for each pushed commit.

## Isolation and integration

World/art, story/combat simulation and flight simulation/view were authored in separate worktrees. Root owns runtime integration, journal/cutscene UI, Grogu movement/view, presentation, staging and release verification. Existing streets, interiors, residents, score and companion interactions remain supported.

## Narrative

The outpost shelters a Jedi route known as Emberline. A Rebel courier brings word that Grogu has been traced to the northern refuge. Recover the child, lead him to the archive’s surviving Jedi, disable tracking relays, defeat the Imperial Warden, clear a sky corridor and force Vader to withdraw long enough for the first convoy to escape. The final scene returns the player to free exploration: the first convoy is safe, and the next one still needs a watch.

Main rewards provide the Ionlance and Ember Arc needed for the bosses. Optional salvage, medical and droid-repair contracts grant additional resources, weapon choices and defenses without advancing the main-quest flags. The [campaign guide](campaign-story.md) records the six chapters, rewards, controls and integration contract.
