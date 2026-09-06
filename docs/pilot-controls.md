# Your Rebel starfighter

The ship is available immediately at Rebel Drydock, beside the boarding ramp at **(-61, 6)**. Bring your companion within 4.8 metres and press **E**. Companions travel aboard. Boarding and vertical takeoff finish before manual control begins.

| Control | Flight action |
| --- | --- |
| W / S | Accelerate / brake, down to a hover |
| A / D | Turn left / right |
| Q / E | Rise / descend |
| Shift | Boost, up to 40 m/s |
| Space / left click | Fire forward; modest assistance within a 12.6 degree cone |
| L | Land at the nearest marked dock |
| N | Enable or disable Imperial fighters (the UI may also toggle ground patrols) |

Flight uses a chase camera. Rooftop clearance is 18 metres and the altitude ceiling is 60 metres. The flight area covers X **-105 to 90**, Z **-105 to 65**. Boundaries stop outward travel while allowing the pilot to turn back.

To land, approach within **32 metres** of a landing marker and slow below **18 m/s**. The HUD names the nearest dock, gives its range, and says when landing is available. Autoland moves over the dock at safe altitude, aligns the fighter, then descends continuously. Dock pads are Rebel Drydock **(-61, 0.025, 1)** and Rebel Refuge **(10, 0.025, -55)**, leaving 5 mm above the authored 2 cm platform. Their ramps are five metres south of the landing point.

Four Imperial fighters patrol the sky. Enemy shots damage ship shields; two direct player hits destroy a TIE. Destroying a fighter increments `kills` once. A destroyed fighter may be replaced at a distant map edge after 24 seconds; actor count never exceeds four. Zero shields engages a continuous emergency return to the nearest dock. Emergency landings award no kills; landing events identify emergency returns so mission logic can distinguish them. Boarding at a marked dock repairs the ship before its next flight.

## Integration contract

`new Pilot()` supplies an initially parked ship. Call `tick(dt, { throttle, turn, rise, boost, fire })` only during active gameplay. Axes accept -1 to 1; positive turn is clockwise and positive rise climbs. Invalid axes become zero. Non-finite/negative elapsed time is ignored; each update accepts at most 100 milliseconds, divided into 60 Hz steps. Pausing or hiding a tab must omit ticks and reset the caller's elapsed-time accumulator.

`state` includes `x`, `y`, `z`, `yaw`, `pitch`, `bank`, `speed`, `shield`, `phase` and `padId`. Phases are `parked`, `boarding`, `takeoff`, `flying`, `landing`, `emergency`. `aboard` includes all phases except parked; `airborne` excludes parked and boarding. `speed` is forward airspeed in manual flight, actual translation speed during autopilot, and zero on the deck.

- `boardingPoint`, `canBoard(player, companion)`, `boardingHint(player, companion)` support the ground E prompt.
- `board(player, companion)` begins boarding, returning false if the ship or companion is out of reach. `repair()` separately services a parked ship.
- `nearestPad` returns `{ pad, distance }`; `landingHint` is display-ready status text. `requestLanding()` returns whether autoland started.
- `setEnemiesEnabled(bool)` toggles the sky patrol independently of ground combat. Disabling removes all TIEs and enemy bolts immediately.
- `ships` and `projectiles` enumerate bounded visible combat actors. `kills` and `landings` are cumulative counters on this Pilot instance.
- `cameraPose()` returns `{ position: {x,y,z}, target: {x,y,z} }` for the chase view. The caller smooths camera movement.
- `drainEvents()` returns `boarded`, `takeoff`, `fire`, `hit`, `enemy-down`, `emergency`, `landed`, `repaired`, and `notice` events. Each has a 3D position. Sound hooks can route `fire` by `owner`, play an impact for `hit`, an explosion for `enemy-down`, and engine sounds for takeoff/landing.
- A `landed` event supplies `padId`, `disembarkPoint`, and `emergency`. Move the hidden ground actors to that physical ramp before making them visible. `boarded` is the transition at which ground actors should be hidden. Never display duplicate ground companions while they are aboard.

`new PilotView(scene, { fighter, tie })` expects locally authored GLB scenes facing +Z, landing contact at Y=0. Engine pivots named `Engine`, `Engine_L`, `Engine_R`, or `Engine_1` etc. receive rear-facing glow cones. Call `view.events(drainedEvents)` and `view.update(pilot, gameplayTime)`; the view does not consume model events. Matching TIE mesh parts and laser/impact effects use shared instance pools. Counters and mission rewards belong to the host campaign engine, not the renderer.
