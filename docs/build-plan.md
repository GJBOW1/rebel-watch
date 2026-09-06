# ASHFALL: The Ninth Courtyard

Original space-western exploration scene. No franchise names, characters, costumes, logos, marketplace assets, or external art in the game.

## Reference study
Both supplied X posts were opened in Chrome. The first embeds the second author's 18.55-second clip. Playback and stepped frames inspected from the opening through the end: high tracking camera; free orbit/pan/recenter camera; Rain Court to Common Line passage; terminal field note; return to stationary machine; close boxy companion; wet specular stone, haze, warm lanterns and cyan ambient; perimeter HUD panels. References:
- https://x.com/birdabo/status/2096101381925114327
- https://x.com/anshuc/status/2096008083826725132

## Build sequence
1. Generate courtyard concept and stone/metal texture targets with built-in Codex imagegen.
2. Connect to the installed Blender MCP using a local MCP client. Model and export original world and characters; retain editable Blender source.
3. Three.js real-time renderer: soft shadows, planar wet reflections, fog/haze, PBR lighting. Browser UI; local assets only.
4. Companion navigation and commands; courtyard, service passage and ridge; terminal/machine lore and three objectives.
5. Live browser playthrough, screenshot comparison, bounded performance measurement and independent review. Iterate on failures.

## Done rubric
1. Recognizable high-isometric experience: original dense courtyard, connected passage, threshold updates, free camera with help, field notes and contextual interactions.
2. Original Blender meshes and generated mesh textures present, source reproducible; wet PBR art direction closely follows concept with clear player/companion silhouettes.
3. Continuous collision-safe companion movement and every command end-to-end: F call, X stay, V scan, E fetch, Q overwatch, R four emotes. No teleport recovery.
4. All three objectives completable in ordinary controls, bond affects follow and chirps, terminal and machine give lore.
5. Build/test gates pass, live screenshots captured and inspected, frame timing measured near 60fps on this machine at declared resolution/settings; limitations reported honestly.
