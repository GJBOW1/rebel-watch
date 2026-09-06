# ASHFALL city expansion and blaster — done rubric

Preserve the original courtyard, characters, visual language, commands and three objectives. Expand into four connected, individually recognizable districts: Lantern Exchange to the north, Iron Wadi to the west, Cinder Landing to the south and the Far Watch beyond the ridge. Use original space-western ships, droids, domes, repair yards, holoprojectors and clan details.

The shared layout is `src/world-layout.json`. It is consumed by navigation, renderer/map/lore and Blender generation. Scale means traversable area, not camera zoom or scaled-up meshes.

1. The connected traversable footprint is at least five times the original footprint, and measured usable area is reported. All seven named zones can be entered and left with collision-safe continuous companion follow.
2. New authored Blender geometry creates distinct districts and original science-fiction landmarks, with generated textures, wet lighting and the existing art direction. Live screenshots show the new spaces, meaningful density and readable actors.
3. Original controls, fetch/escort/ridge objectives, bond and free camera remain functional. The larger city has an accessible map, direction cues, dynamic location headings and new inspectable lore.
4. B draws/holsters an original blaster. Mouse aim and click fire visible projectiles with synthesized blaster audio; projectiles collide with scenery and damage enemies. Enemies can be enabled/disabled at any time; quiet exploration is the default. Combat status and controls are visible and tested.
5. TypeScript/production build and meaningful navigation/combat regression checks pass. An independent verifier reviews only the artifact and this rubric. Live play and measured performance are reported honestly, with remaining issues fixed or explicitly identified.

Implementation: generate district concept/material; expand Blender geometry and shared collision metadata; widen navigation and zone discovery; add bounded combat simulation; integrate map, lighting, actors, projectiles and audio; playtest and iterate.
