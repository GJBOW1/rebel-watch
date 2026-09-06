# Population and landing traffic art

These assets were authored for ASHFALL in Blender 5.2.1 through the installed Blender MCP server. No character or spacecraft mesh was downloaded. The user explicitly requested recognizable Star Wars troopers and Jedi on September 5, 2026, superseding the earlier original-design-only constraint for this addition. Existing ASHFALL player, Tallow, architecture, and UI designs remain original.

## Viewed appearance references

The official pages below were opened and their images inspected in the browser before modeling. The images are appearance references; they are not embedded in the game.

- [Stormtroopers — Star Wars Databank](https://www.starwars.com/databank/stormtroopers): white segmented armor over black undersuit, rounded helmet crown, dark separated lenses, brow trim, projecting cheek respirators, belt equipment. The exported trooper is 1.831 m tall, consistent with the page's 1.83 m average.
- [Jedi Order — Star Wars Databank](https://www.starwars.com/databank/jedi-order): cream layered tunic, brown outer robe, visible human face, belt, boots, luminous blade. The model represents an unnamed adult Jedi rather than an actor likeness.
- [Lightsaber — Star Wars Databank](https://www.starwars.com/databank/lightsaber): metal hilt, emitter, bright narrow blade. The blade and hilt are separate articulated groups for runtime igniting, posing, and recoloring.
- [Protocol Droid — Star Wars Databank](https://www.starwars.com/databank/protocol-droid): slender gold humanoid proportions, circular optics, rigid limbs, exposed abdominal wiring and mechanical joints.
- [Astromech Droid — Star Wars Databank](https://www.starwars.com/databank/astromech-droid): short cylindrical utility body, metallic dome, recessed tool bays and three-foot stance. This model uses ivory and rust red panels and a cyan lens.
- [Twi'lek — Star Wars Databank](https://www.starwars.com/databank/twi-lek): paired long lekku, humanoid face and distinctive skin color. The courier has a teal complexion, practical work clothes, and a leather headband.
- [U-wing — Star Wars Databank](https://www.starwars.com/databank/u-wing): practical transport construction, forward cockpit, engine pods and wing silhouette informed the shuttle. Both added spacecraft are original arrangements with authored industrial detail.

## Image generation

The built-in Codex imagegen tool generated `public/assets/concepts/living-ships-target.png` and the tileable albedo `public/assets/textures/population-alloy.png`. The exact successful prompts and project destinations are recorded in `population-imagegen-prompts.json`. The quiet neutral alloy texture is packed in the Blender master and embedded in each GLB; painted per-face vertex colors provide the different character palettes without multiplying material draws.

Two attempts to generate a peaceful character lineup returned output safety-system errors and produced no character concept image. They are recorded honestly in the prompt provenance. Character silhouettes were instead built from the official visual references above and iterated in Blender studio renders.

## Editable sources and exports

Run `tools/build_population.py` using the existing `tools/blender_mcp_call.py` client. It produces only the nine new GLBs, `population-manifest.json`, `art/ashfall_population.blend`, and the two studio review renders. It does not regenerate the city or overwrite `world.glb`.

Every actor faces local +Z, with feet at Y=0. Humanoid shoulder, hip, neck, and cloak pivots use exact `Actor_Arm_L/R`, `Actor_Leg_L/R`, `Actor_Head`, and `Actor_Cloak` names. The astromech has leg and dome pivots but should roll instead of swinging its outrigger legs. The Jedi hilt is nested under the right arm and its `Saber_Blade` child can be hidden while walking peacefully. GLB joints have no Blender numeric suffixes. The master uses asset prefixes to keep joint names unique across the single editable scene.

The stormtrooper has free hands. Attach the existing game blaster to `Actor_Arm_R`, approximately `(0,-0.60,0.10)` relative to that shoulder, then pose the arm for patrol/aim animation. Jedi saber tint can be changed through the material named `Population luminous saber`; the cyan engine, red running lights, amber lights, and saber use separate emissive materials.

Ships face +Z and their landing-contact plane is Y=0. `Engine_L/R` empty nodes mark the rear emission planes. The landing deck surface is Y=0, with low guides rising to 0.302 m and supporting columns down to −3.20 m, set inside the rooftop footprint and braced beneath the deck. At the runtime 90-degree heading, scales are 0.72 for the shuttle and 0.60 for the freighter. Exact unscaled bounds are in the manifest.

## Verification

Three rounds of Blender MCP generation and studio visual review checked proportions, recognizable silhouettes, helmet face construction, contact heights, robe mesh validity, ship detail, emissive colors, and joint exports. The final MCP response reported success with no export warnings. Every GLB primitive includes `COLOR_0`; binary accessor inspection confirmed nonconstant palette colors instead of a dummy white color channel. Texture maps are embedded and material texture references are present. The final character meshes use 2,100–3,300 triangles and 6–9 draws; the vehicles remain below 10,000 triangles each. Runtime lighting, motion, battle behavior, and performance are verified separately in the playable scene.
