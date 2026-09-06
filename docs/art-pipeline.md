# Ashfall original asset workshop

All exported solid geometry was modeled procedurally in Blender 5.2.1 through its installed Blender MCP extension. No external models or marketplace kits were used. Surface source images were generated with Codex image generation, then UV-mapped and embedded in glTF and the editable Blender file.

## Deliverables

- `world.glb`: 25 material batches, 202,750 triangles. Courtyard, connected service passage/ridge, gates, architecture, paved terrain, layered outpost skyline and cliffs, furniture, rooftop utilities, vegetation and freight. The relay console is included at (22, 0).
- `hunter.glb`: original helmeted scout, forward +Z, 1.850 m top height. Articulated named leg/arm/head/cloak groups retain anatomically placed pivots.
- `tallow.glb`: original four-leg scout, forward +Z, 0.780 m top height, 0.942 m stance width. 0.012 m foot sole clearance from origin. Four leg groups and head retain named pivots.
- `machine.glb`: stationary salvage mechanic to place at (8, -7).
- `token.glb`: six-sided original clan token to place at (-8, -6).
- `manifest.json`: collidable AABBs, fixture positions, interaction centers, articulation names, optional puddle placement.
- `art/ashfall_master.blend`: editable master, source meshes, packed textures, character placements and preview light/camera rig.
- `tools/build_assets.py`: complete deterministic asset generator (seed 409).
- `outputs/surface-pass-overview.png` / `outputs/surface-pass-detail.png`: Blender inspection renders. `outputs/courtyard-final.jpg` and `outputs/free-camera-final.jpg` are actual in-game screenshots.

## Coordinates and integration

All glTF exports are Y-up. North is -Z. Player and scout face +Z. Floor top stays below or at y=0.01; the ridge walks flat at y=0 while exterior stone terraces provide the visual rise. The environment deliberately extends past navigation bounds to connect the outpost to a larger landscape.

The world shader material names for wet-floor enhancement start `Ground flagstone`. Water is `Cistern still water`. The main emission surfaces are `Warm lantern glass`, `Buried amber cells`, and `Cyan optics`. Opaque materials are single-sided; canvas and foliage are double-sided. Three generated color textures (`ochre-stone.png`, `rain-slate.png`, `forged-metal.png`) are embedded. Dynamic lighting, reflections, fog/rain and interaction highlights remain engine effects.

The final interior freight AABBs are centered (-6.96, 3.10) and (7.04, 6.10), both half-width 1.28 and half-depth 0.74. The cistern is conservatively represented by an AABB with half-extents 2.34.

## Rebuild

The generators require Blender and the checked-in generated textures. With Blender's executable on `PATH`, the direct route is:

```sh
blender --background --python tools/build_assets.py
blender --background --python tools/build_population.py
```

For the MCP route used during development, install the Python MCP SDK in the client environment with `python -m pip install mcp`. Install and enable the Blender MCP server and bridge separately. With the bridge's Blender extension enabled, start Blender in a separate terminal:

```sh
blender --online-mode --background --command blender_mcp --host 127.0.0.1 --port 9876
```

The executable name assumes Blender is on `PATH`; otherwise use the path to your Blender installation. Keep the bridge bound to loopback. The client looks for the `blender-mcp` server command on `PATH`:

```sh
python tools/blender_mcp_call.py
python tools/blender_mcp_call.py tools/build_assets.py
python tools/blender_mcp_call.py tools/build_population.py
```

If the server is installed in a separate environment, pass `--server /path/to/blender-mcp` or set `BLENDER_MCP_COMMAND` to its executable path. The first command checks the connection; the next two rebuild the environment and population respectively. The Python environment running the client needs the `mcp` package even when the server lives elsewhere.

The generators resolve output, source, and texture folders relative to the project root; no path edits are needed when relocating the workshop. The MCP client sets `__file__` before execution. A rebuild replaces the explicit generated outputs. The MCP response reports file paths, triangle/draw counts, fixture and obstacle counts.

## Visual iteration

The exported world includes 28 collision boxes and 18 lantern fixtures. Later passes added rooftop machinery, aerials, fragmented paving, localized rubble, asymmetric patched canvas with torn hems, chipped segmented cistern coping and riveted repairs. The engine adds contact shading, fine world-space weathering, physically reflected rain pools and cool/warm light separation. Character scale and named joint pivots were inspected before integration.
