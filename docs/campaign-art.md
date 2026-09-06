# Campaign art and world expansion

The campaign adds The Hidden Refuge, Kestrel Drydock and Obsidian Bastion to the existing seven districts. All new meshes were authored in Blender through the connected Blender MCP bridge. Existing generated albedo textures were reused; no downloaded meshes or marketplace kits are included.

The three-panel [concept target](../public/assets/concepts/campaign-target.png) was generated with the built-in imagegen tool before modeling. Its complete prompt is in [campaign-art.json](campaign-art.json). The three districts carry the concept's warm repaired sanctuary, industrial shipyard and severe red-lit fortress treatments, while preserving broad navigable paths. The existing seven districts and building interiors remain, apart from the three required boundary openings and background objects displaced by the expansion.

## Appearance research

Official appearance references opened during this work were [Grogu](https://www.starwars.com/databank/grogu), [Darth Vader](https://www.starwars.com/databank/darth-vader), [TIE fighter](https://www.starwars.com/databank/tie-fighter) and [X-wing starfighter](https://www.starwars.com/databank/x-wing-starfighter). The small child's ears, expressive eyes and cloth robe; Vader's flared helmet, grille, cape and chest controls; and the TIE's hexagonal solar wings and radial cockpit were modeled from authored geometry. The Rebel fighter is a newly designed strike craft with a long forward cockpit, split wings and four wing cannons.

## Reproducible sources

- `tools/build_assets.py`, `tools/build_city.py` and `tools/build_campaign_world.py` generate the complete world and its collider/light manifest.
- `tools/build_campaign_assets.py` generates Grogu, Vader, the Imperial Warden, both fighters, three weapons and the corrected landing deck, using reusable geometry helpers in `tools/build_population.py`.
- `art/ashfall_master.blend` is the expanded editable world; `art/ashfall_campaign.blend` contains the new editable actors, ships and weapons.
- `public/assets/models/campaign-manifest.json` records exact exported bounds, triangle counts, draw counts and joint positions. `manifest.json` records world collision geometry and lights.

Run either generator through `tools/blender_mcp_call.py --server <installed-blender-mcp-executable> <generator.py>` using the installed MCP Python environment. The Blender extension must be listening on port 9876.

## Navigation and mission anchors

| District | Bounds: X / Z | Clear connection |
|---|---|---|
| Hidden Refuge | −20…20 / −86…−47 | X −3…3, Z −48…−42 |
| Kestrel Drydock | −88…−48 / −20…20 | X −49…−43, Z −3…3 |
| Obsidian Bastion | 33.5…75.5 / 18.5…50 | X 44…50, Z 13.5…20 |

The saved seven-district baseline is `tests/fixtures/campaign-baseline.json`. `tools/measure-campaign-area.mts` samples `Navigation.isFree` and flood-fills the component connected to the original courtyard. At 5 cm sample spacing, the player-radius connected walkable area grows from **2,869.89 m² to 6,020.97 m²**, or **2.098×**. At the companion's larger 0.48 m radius, it grows from **2,756.16 m² to 5,816.19 m²**, or **2.110×**. An independent 10 cm sampling pass also exceeds 2× for both actor sizes.

`tests/campaign-world.test.ts` verifies all three thresholds; continuous collision-free routes from the original courtyard to all fourteen mission anchors for both player and companion; and the entire eight-metre boss arena radius. Relays and caches sit just behind their interaction anchors so their geometry does not block the standing positions.

Both ground landing decks have a top surface at **Y = 0.02 m**. The Rebel fighter's gear touches local **Y = 0**; place its root at **Y = 0.025 m**. The boarding point at (−61, 6) is clear. The TIE uses a cockpit-centered origin and is intended for flight, with its solar wings extending roughly 2.8 m above and below that origin.

## Landing-deck rendering fix

The old rooftop deck core and separate top panels both ended at exactly local Y = 0, causing coplanar depth flicker. The core now ends at **Y = −0.065 m** while the visible walking panels retain **Y = 0**. Existing deck placement can stay unchanged. The four support columns remain centered at **X = ±1.7 m, Z = ±1.25 m**, extend to **Y = −3.2 m**, and have diagonal load-bearing braces. This keeps their anchors within the smaller rooftop footprint while supporting the 8 × 6 m overhang.

## Animation and rendering contracts

Actors and ships face local +Z. Humanoid limbs use `Actor_Arm_L`, `Actor_Arm_R`, `Actor_Leg_L`, `Actor_Leg_R`, `Actor_Head` and optional `Actor_Cloak` pivots. Arms rest vertically. Vader's `Saber_Blade` is a child of `Saber_Hilt`, which is attached to `Actor_Arm_R`; hide or animate that subtree during combat. Grogu's `Pram_Body` and `Pram_Canopy` are separate from his head and arms. The child is enlarged modestly for the game's high-isometric readability.

Both fighters provide `Engine_L`, `Engine_R`, `Muzzle_L` and `Muzzle_R`. The Rebel fighter's paired muzzle markers average the upper/lower wing cannon height. Small weapons use the existing grip-origin contract, +Z barrels and a `Muzzle` node; they have two material draws each and carry no embedded texture images. All material-colored exports include the authored `COLOR_0` vertex colors.

Blender studio captures inspect actor silhouette, clothing, helmet detail, ship profiles and weapon distinctions. These captures are modeling evidence, not in-game screenshots or frame-rate evidence. Final lighting, battle animation, flight alignment and performance require the integrated runtime captures and gameplay checks.

## Integrated drydock correction

The first live drydock capture showed a transverse crane beam across the fighter and its takeoff path. Both gantry runs were rotated into a maintenance frame along the western perimeter. The closest crane vertices are at X = −72.150 m, at least 6.40 m beyond the left wing. No world triangle bounds intersect the buffered takeoff column X[−66,−56], Z[−3.73,5.29], Y ≥ 0.25 m. The generator also checks the default camera projection. Only four Drydock material meshes changed; the other 348 meshes retain identical vertex and index arrays.
