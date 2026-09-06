# Operation Emberline

The Empire has turned the outpost’s old relay network into a register of everyone who lives there. Two Jedi, Ryn and Sena, are sheltering Grogu beyond the northern lamps. Rebel courier Maera Venn has assembled a convoy, but a command shield closes its ground route and TIE fighters control its air corridor. The traveler’s work is to open one road after another until everyone can leave.

The story ends with the convoy escaping and Vader being forced to withdraw. It does not depict Vader’s canonical death. Grogu remains a companion after the finale. The original Tallow oath, ambient patrols, residents, interiors and optional contracts remain separate activities.

## Six chapters

| Chapter | Acceptance and actions | Completion and main-path reward |
| --- | --- | --- |
| A Signal Beneath the Ash | Speak to Maera inside the Still Ember. Listen to or skip the briefing. | Speak again to collect emergency supplies: 40 credits, 12 scrap, 3 cells. |
| The Smallest Light | Accept at the cantina. Reach the northern refuge and use the Rescue Grogu interaction. Physically escort him to Jedi Ryn at the archive. | Both player and Grogu must reach the archive. Claim 60 credits and 4 scrap. |
| Three Silent Towers | Accept from Ryn. Disconnect each of the west, east and north Imperial tracking relays. | Each core grants 2 scrap and 1 cell. Return to Ryn and claim the Ionlance, 80 credits and 4 cells. |
| The Warden’s Last Order | Accept at the archive. Equip an ion weapon and challenge the Warden at the bastion entrance. | Break the shield core and win the actual encounter. Claim 120 credits, 10 scrap and 6 cells at the bastion marker. |
| A Road Through the Sky | Accept at the drydock. Board the freely available ship and defeat three TIE fighters after acceptance. Land at the refuge landing pad. | Claim the tier-three Ember Arc, 150 credits and 8 cells at the landing pad. Earlier free-flight kills and emergency returns do not count. |
| Leave No Ember Behind | Accept at the refuge landing pad. Equip the Ember Arc and challenge Vader at the bastion. | Break his guard and force a retreat, then explicitly signal the convoy at the mission marker. Earn 250 credits, 20 scrap and 10 cells; play or skip the ending. |

Acceptance and reward claims are separate interactions. Reaching a location, skipping dialogue, defeating an unrelated ambient patrol or merely starting a boss does not complete a chapter. The current objective and every available action have a map marker. Main-path rewards supply every weapon required to finish the story.

## Optional work

These contracts can be accepted at any time and do not set main-quest flags.

- **The Dockworkers’ Reserve:** Maera asks for three caches at the western drydock. Each cache supplies 3 scrap. Claim a Trench Scatterblaster, 90 credits and 6 more scrap from Maera.
- **Hands That Still Heal:** accept the free medical parcel at the cantina and deliver it to the refuge medic. Claim 70 credits, 5 cells and a permanent shield-capacity increase from 100 to 120 for ground and boss combat. The ship retains its separate 100-point shield.
- **One More Good Turn:** accept the stranded astromech’s repair request. Spend 6 scrap, then claim the Patchwork Arc Repeater, 80 credits and 4 cells. The fresh campaign starts with 8 scrap, so this contract can be completed without taking another quest.

Caches, relays, repairs and claims reward only once. Weapons have rechargeable game ammunition; cells are field-repair resources, not a consumable requirement for boss progression. A field repair costs 2 cells and 20 credits through `spendRepair()`. The integration restores the active shield or parked ship after a successful purchase. Boss checkpoint retries are free, so exhausting repair supplies cannot lock the main story.

## Authored cinematics

`CAMPAIGN_CUTSCENES` contains six briefing scenes and the ending, each with three to five beats and a total duration of 26–35 seconds. Every beat supplies a speaker, original dialogue, a world-space camera focus and a duration. The renderer supplies the camera motion, captions and skip control.

The campaign emits `{ type: 'cutscene', title, beats }` and holds quest interaction while the cinematic is open. Call `skipCutscene()` on either natural completion or Skip. That method only removes the cinematic lock. It does not claim rewards, rescue Grogu, complete an escort or grant a boss victory.

A saved cinematic replays on load. The already-earned quest state is preserved, so neither closing the page nor skipping a replay duplicates a reward.

## Playing the integrated campaign

Open **K** for the journal’s Main Story, Side Contracts, and Armory tabs. Select a destination, walk to the marked contact, and press **E** to accept, act or claim a reward. **1–5** select owned weapons in acquisition order; the Armory shows the available choices. The journal offers the field-repair purchase. Progress is automatically saved in browser-local storage by `Expedition`.

The integrated cinematics use the game’s own scene and camera with speaker captions. **Skip scene** or **Esc** finishes the scene without changing its quest objective. The original Tallow oath and companion controls remain available alongside the campaign; Grogu physically follows after rescue.

Wayfarer One is available from the beginning at Kestrel Drydock. Bring companions to the ramp and press **E**. In flight, **W/S** accelerate/brake, **A/D** steer, **Q/E** climb/descend, **Shift** boosts, and **Space/left click** fires. Approach the drydock or refuge landing pad within 32 metres, slow below 18 m/s, and press **L** to autoland. **N** toggles enemies. See [the pilot guide](pilot-controls.md) for the complete flight contract.

The expanded world has ten connected districts. A collision-aware connected-area measurement for the player increased from 2,869.89 to 6,020.97 square metres, approximately 2.10 times the preceding seven-district city.

## Campaign integration

`Campaign(saved?: unknown)` accepts either the JSON-safe `CampaignSave` object or its serialized string. `save()` returns an independent copy; `serialize()` returns JSON. No storage or network API is used by the pure simulation.

- Read `currentQuest`, `quests`, `markers`, `weapons`, `equippedWeapon`, `resources`, `groguRescued`, `shieldUpgrade`, `completed` and `activeCutscene` for rendering.
- `interact(marker.id, context)` requires the player to be within three world units of an active marker. The integration should additionally honor architecture and interaction priority when presenting a prompt.
- `tick(dt, context)` checks the escort, reported boss victory, flight-kill delta and completed landing.
- `equip(id)` only equips an owned weapon. `cycleWeapon()` advances through owned weapons.
- Drain `note`, `cutscene`, `reward`, `companion` and `start-boss` events. The latter supplies `boss: 'warden' | 'vader'`.
- `spendRepair()` checks and deducts its cost atomically. Only heal after it returns true.

`CampaignContext` contains `player`, optional `grogu`, `flying`, `flightKills`, `landedAt`, `bossVictory` and `bossActive`. `flightKills` is the flight system’s total. Acceptance snapshots that total; saving also preserves the last observed total and earned mission count. If a fresh flight runtime restarts its total at zero after load, the existing mission count remains intact and later kills continue it.

`landedAt` is the completed normal landing position, not an approach target or an emergency return. Emergency returns preserve earned mission kills but do not satisfy the landing objective. Skybreak requires three counted kills, the player outside flight, a landing within five units of the refuge pad and the player nearby. Free flight can be offered before this quest; accepting it is the only way to start its kill count.

`validateCampaignSave` rejects invalid JSON, unknown versions, malformed quest ordering, nonfinite/negative/out-of-range resources, impossible objective flags, duplicate collection IDs, unowned equipment, prematurely granted weapons and inconsistent shield upgrades. Invalid input starts a clean campaign with an explanatory note. The campaign does not persist live boss projectiles or enemy health: an unfinished boss chapter resumes at its challenge marker for a full checkpoint retry.

## Boss integration

`CampaignCombat` is independent of the ambient `Combat` class. The integration routes player fire to it while a boss is active.

```ts
boss.start('warden', player, campaign.equippedWeapon, campaign.shieldUpgrade);
boss.fire(player, aimPoint, campaign.equippedWeapon);
boss.tick(dt, player, navigation, campaign.equippedWeapon);
campaign.tick(dt, { player, bossVictory: boss.victory, bossActive: boss.active });
```

The boss appears at `(54, 34)`; the challenge marker is `(54, 26)`, eight units south. Both encounters use real collision-aware movement and swept projectile contact against the supplied navigation. The arena geometry must leave those positions and the surrounding dodge routes clear.

- The Warden has a 216-point command shield. Ordinary bolts cannot reduce it. Tier-two ion fire breaks the core, cancels a pending warning and opens a stun. The Ionlance comes from the required relay chapter; the optional Arc Repeater also works.
- Vader has a 288-point guard and rejects lower-tier weapons even after a break. The Ember Arc is guaranteed by the required Skybreak chapter.
- Cone, circle and line attacks lock their marked locations and provide visible warning time before damage. Walls block attack damage and projectiles. Movement can avoid every attack shape.
- A hit snapshots its weapon power when fired; changing weapons cannot strengthen an airborne shot.
- Player shield recovery, optional shield capacity, defeat, a full `retry(player, weapon)` checkpoint and `cancel()` are supported. `setEnabled(false)` pauses the encounter and clears pending threats without reporting victory.
- `boss`, `projectiles`, `telegraphs`, `shield`, `maxShield`, `status`, `active`, `defeated` and `victory` are renderer-facing state. `victory` is the boss kind or `null`, suitable for the campaign context.

The scene uses one boss, at most 48 projectiles and one live attack warning. Event queues are bounded. `victory` is emitted only after real boss health reaches zero; Vader’s final animation/state is retreat.

## Verification scope

Pure-simulation tests exercise all six chapters without side quests, all optional contracts, once-only rewards, actual resource spending, save/load and invalid saves, explicit cinematic skipping, escort arrival, flight acceptance baselines and landing requirements. Boss tests win both encounters through real shots while moving to dodge, confirm ordinary weapons fail, check warning locks and real damage, verify thin-wall contact and immutable projectile power, restore checkpoints after defeat, and clear threats on enemy-off.

The local browser walkthrough completed all six main chapters through actual inputs and let the convoy ending finish naturally, rescued and escorted Grogu, earned both required weapon upgrades, defeated both bosses through actual shots, destroyed three TIE fighters, and completed a normal refuge landing. An emergency return preserved the kills without completing the landing objective. Basic carbine fire did not damage Vader; enemy-off paused his encounter, and field repair deducted 20 credits and 2 cells. The final state retained Grogu and left all three optional contracts available, directly confirming that the main path does not depend on them.

The medicine contract was subsequently completed in the browser. That run exposed an ordinary-combat shield-capacity integration bug, which was corrected so the earned upgrade applies to ground and boss combat at 120 while ship capacity remains 100. The correction passed its focused checks and the final full suite. The cache and astromech contracts were then completed through the UI: all three caches were returned to Maera, the astromech repair spent 6 scrap, and both optional weapons were claimed.

The final browser state has all six main chapters and three contracts complete, all five weapons, 920 credits, 69 scrap and 43 cells, the scatterblaster equipped, and a 20-point shield upgrade. Reloading preserved every objective flag, resource balance and loadout choice, and the ground HUD showed 120/120.

The final source passed **141/141 tests**, including the final camera regression, and TypeScript validation plus the Vite production build passed. Takeoff, braking, flight, normal landing and the corrected rooftop traffic cycle were reviewed in the browser. Operation Emberline is published at [the public game](https://rebelwatch.newsfromskippy.com/), where all runtime models loaded, the cantina interaction accepted the first chapter, its cinematic played and its reward was claimed to unlock chapter two, without logged warnings or errors. The complete story walkthrough was local; the public check was a release smoke. The [GitHub workflow](https://github.com/GJBOW1/rebel-watch/actions/workflows/checks.yml) records automated checks for each commit. See [the verification report](verification.md) for precise evidence, including the public High and Balanced samples below 60 FPS.
