# Enterable buildings — implementation and done rubric

Create three physically connected, individually furnished original space-western interiors inside the existing city: The Still Ember cantina, Kestrel Repair House and the Oath Archive. Preserve the seven districts, all original objectives and commands, companion continuity and optional blaster combat. src/interiors.json is the shared geometry/navigation/UI contract.

1. All three buildings have genuine walkable interiors with collision-safe sliding-door thresholds. Player and Tallow physically enter/exit without scene warps or teleportation, using normal movement or E at a marked door.
2. Blender-authored, generated-texture furnishings distinguish the warm cantina/bar, industrial repair shop and cool blue clan archive. Roof and camera-facing upper walls cut away to keep the player and companion visible, returning on exit.
3. Interior location names, doorway prompts, map destinations and authored interior inspection lore work. Existing companion commands, city traversal, objectives, blaster impacts and enemy toggle remain functional.
4. Production build and meaningful real-manifest interior movement/collision/regression checks pass. An independent verifier sees only artifact and rubric.
5. Actual in-game screenshots are compared with the generated interior concept and refined; local frame-time samples and limitations are documented honestly.
