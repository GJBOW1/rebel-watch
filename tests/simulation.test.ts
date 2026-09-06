import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Simulation, Navigation, type Vec2, type SimInput, type Obstacle, type WalkArea, WORLD, WALK_AREAS, getZone } from '../src/simulation.ts';

const idle = { x: 0, z: 0, run: false };
const gap = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const obstacles: Obstacle[] = [
  { id: 'central-machine', x: 0, z: 0, hx: 1.8, hz: 1.8 },
  { id: 'cargo-a', x: 6, z: -3.5, hx: 1.2, hz: 1 },
  { id: 'cargo-b', x: -5, z: 3, hx: 1.3, hz: 0.8 },
  { id: 'alley-stack', x: 19, z: -1.6, hx: 0.65, hz: 0.55 },
];
function advance(sim: Simulation, seconds: number, input: SimInput = idle) {
  for (let i = 0; i < seconds * 60; i++) {
    const before = { ...sim.droid };
    sim.tick(1 / 60, input);
    assert.ok(gap(before, sim.droid) <= 6.71 / 60 + 1e-6, 'droid moved continuously within speed cap');
    assert.ok(sim.droidNav.isFree(sim.droid), 'droid radius does not overlap geometry');
    assert.ok(sim.playerNav.isFree(sim.player), 'player radius does not overlap geometry');
  }
}
function walk(sim: Simulation, point: Vec2, timeout = 30) {
  sim.walkTo(point);
  for (let i = 0; i < timeout * 60; i++) {
    advance(sim, 1 / 60);
    if (gap(sim.player, point) < 0.2) return;
  }
  assert.fail(`player failed to reach ${JSON.stringify(point)} from ${JSON.stringify(sim.player)}`);
}
test('manual movement normalized; every cardinal/diagonal visual heading follows translation', () => {
  for (const x of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
    if (!x && !z) continue;
    const sim = new Simulation(); const before = { ...sim.player };
    advance(sim, 0.5, { x, z, run: false });
    assert.ok(Math.abs(gap(sim.player, before) - 1.5) < 1e-6);
    const expected = Math.atan2(x, z);
    assert.ok(Math.abs(Math.atan2(Math.sin(sim.player.yaw - expected), Math.cos(sim.player.yaw - expected))) < 1e-6);
  }
});
test('cancelWalk stops a previous click destination when camera or emote UI takes control', () => {
  const sim = new Simulation(); sim.walkTo({ x: -6, z: 6 }); advance(sim, 0.5);
  const stopped = { ...sim.player }; sim.cancelWalk(); advance(sim, 2);
  assert.equal(gap(stopped, sim.player), 0); assert.equal(sim.player.speed, 0);
  advance(sim, 0.5, { x: 1, z: 0, run: false }); assert.ok(gap(stopped, sim.player) > 1.4);
});
test('patrol starts on its ellipse and moves continuously from the very first frame', () => {
  const sim = new Simulation();
  for (let frame = 0; frame < 3600; frame++) {
    const previous = { ...sim.patrol }; sim.tick(1 / 60, idle);
    assert.ok(gap(previous, sim.patrol) < 0.58 / 60, 'patrol does not snap on startup or ellipse wrap');
    assert.ok(sim.patrol.speed > 0 && sim.patrol.speed <= 0.576 + 1e-8);
  }
});
test('radius-aware A* prevents diagonal corner cutting and routes around courtyard debris', () => {
  const nav = new Navigation(obstacles, 0.34);
  const start = { x: -3.5, z: 0 }, goal = { x: 3.5, z: 0 };
  assert.equal(nav.segmentClear(start, goal), false);
  const path = nav.path(start, goal);
  assert.ok(path.length >= 2);
  let previous = start;
  for (const point of path) { assert.ok(nav.segmentClear(previous, point)); previous = point; }
  assert.ok(gap(path[path.length - 1], goal) < 0.01);
  const corner = new Navigation([{ id: 'corner', x: 0, z: 0, hx: 0.6, hz: 0.6 }], 0.3);
  const waypoints = corner.path({ x: -1.1, z: 0.2 }, { x: 0.2, z: -1.1 });
  let p = { x: -1.1, z: 0.2 };
  for (const q of waypoints) { assert.ok(corner.segmentClear(p, q)); p = q; }
});
test('swept manual movement slides along solids and cannot tunnel during a delayed frame', () => {
  const sim = new Simulation(obstacles);
  sim.player.x = 3; sim.player.z = 0;
  sim.tick(0.25, { x: -1, z: 0, run: true });
  assert.ok(sim.player.x >= 2.14);
  advance(sim, 0.5, { x: -1, z: 1, run: true });
  assert.ok(sim.player.z > 1);
});
test('continuous follow navigates debris, both threshold directions and sustained sprint', () => {
  const sim = new Simulation(obstacles);
  for (const point of [{ x: -10, z: 6 }, { x: -10, z: -8 }, { x: 10, z: -8 }, { x: 11, z: 0 }, { x: 27, z: 0 }, { x: 10, z: 0 }, { x: 7, z: 8 }]) {
    walk(sim, point); advance(sim, 2);
    assert.ok(gap(sim.player, sim.droid) < 2.4, `follower caught up at ${JSON.stringify(point)}, ${JSON.stringify(sim.droid)}`);
  }
  sim.player.x = -10; sim.player.z = -8; sim.droid.x = -12; sim.droid.z = -8;
  advance(sim, 4, { x: 1, z: 0, run: true });
  assert.ok(gap(sim.player, sim.droid) < 3.3, 'companion can sustain the player sprint');
  for (let n = 0; n < 10; n++) { advance(sim, 3.5, { x: n % 2 ? 1 : -1, z: 0, run: true }); }
  advance(sim, 3);
  assert.ok(gap(sim.player, sim.droid) < 2.4);
});
test('call hustles to hunter, holds briefly, then follows; stay toggles and scan stays independent', () => {
  const sim = new Simulation();
  sim.droid.x = -5; sim.droid.z = 6;
  sim.command('call'); assert.equal(sim.mode, 'call'); advance(sim, 3);
  assert.equal(sim.mode, 'follow'); assert.ok(sim.bond > 18);
  sim.command('stay'); const held = { ...sim.droid };
  advance(sim, 1, { x: 1, z: 0, run: false });
  assert.equal(sim.mode, 'hold'); assert.equal(gap(held, sim.droid), 0);
  sim.command('scan'); assert.ok(sim.scanTime > 2); assert.equal(sim.mode, 'hold');
  advance(sim, 3); assert.equal(sim.scanTime, 0);
  sim.command('stay'); assert.equal(sim.mode, 'follow'); advance(sim, 3);
  assert.ok(gap(sim.player, sim.droid) < 2.4);
});
test('fetch retrieves physically and returns to a moving hunter; completing twice cannot duplicate rewards', () => {
  const sim = new Simulation(obstacles);
  walk(sim, { x: -6, z: -6 }); advance(sim, 2);
  const initial = { ...sim.token };
  sim.command('fetch'); assert.equal(sim.mode, 'fetch');
  advance(sim, 0.1); assert.equal(sim.token.carried, false); assert.equal(sim.token.x, initial.x);
  advance(sim, 1, { x: 1, z: 0, run: false });
  advance(sim, 8);
  assert.equal(sim.token.collected, true); assert.equal(sim.objectives.token, true); assert.equal(sim.token.carried, false);
  const bond = sim.bond; sim.command('fetch'); advance(sim, 3); assert.equal(sim.bond, bond);
  assert.equal(sim.drainEvents().filter(e => e.type === 'objective' && e.title === 'A Name Returned').length, 1);
});
test('interrupting fetch before pickup preserves ground token, and after pickup preserves carried token until resumed', () => {
  const sim = new Simulation();
  sim.player.x = -6; sim.player.z = -6; sim.droid.x = -4; sim.droid.z = -6;
  sim.command('fetch'); advance(sim, 0.1); sim.command('stay'); advance(sim, 2);
  assert.equal(sim.token.carried, false); assert.equal(sim.token.x, -8); assert.equal(sim.token.collected, false);
  sim.command('fetch');
  for (let i = 0; i < 600 && !sim.token.carried; i++) advance(sim, 1 / 60);
  assert.equal(sim.token.carried, true); sim.command('stay'); const held = { ...sim.droid };
  advance(sim, 2, { x: 1, z: 0, run: false });
  assert.equal(sim.mode, 'hold'); assert.equal(gap(held, sim.droid), 0); assert.equal(sim.token.collected, false); assert.equal(gap(sim.token, sim.droid), 0);
  sim.command('stay'); assert.equal(sim.mode, 'return'); advance(sim, 8); assert.equal(sim.objectives.token, true);
});
test('emotes complete, return to stay state, and cannot farm trust; overwatch flanks and emits threat', () => {
  const sim = new Simulation(); sim.command('stay');
  for (const emote of ['salute', 'spin', 'growl', 'chirp'] as const) {
    const bond = sim.bond; sim.emoteAction(emote); assert.equal(sim.emote, emote); advance(sim, 2);
    assert.equal(sim.mode, 'hold'); assert.equal(sim.emote, null);
    if (emote !== 'salute') assert.equal(sim.bond, bond);
  }
  sim.player.x = 27; sim.player.z = 0; sim.droid.x = 25.5; sim.droid.z = 0;
  sim.command('overwatch'); advance(sim, 3); assert.equal(sim.mode, 'overwatch');
  assert.ok(sim.droid.speed < 0.05); assert.ok(sim.drainEvents().some(e => e.type === 'threat'));
  sim.command('overwatch'); assert.equal(sim.mode, 'follow');
});
test('all three objectives complete in order across connected zones and dusk follows ridge hold', () => {
  const sim = new Simulation(obstacles);
  walk(sim, { x: 27, z: 0 }); advance(sim, 20);
  assert.equal(sim.objectives.escort, false); assert.equal(sim.objectives.ridge, false);
  walk(sim, { x: -6, z: -6 }); advance(sim, 2); sim.command('fetch'); advance(sim, 8);
  assert.equal(sim.objectives.token, true);
  walk(sim, { x: 18, z: 0 }); advance(sim, 3); assert.equal(sim.objectives.escort, true); assert.equal(sim.zone, 'passage');
  walk(sim, { x: 28, z: 0 }); sim.command('call'); advance(sim, 4); assert.equal(sim.zone, 'ridge');
  advance(sim, 19); assert.equal(sim.objectives.ridge, true); assert.equal(sim.ridgeProgress, 18); assert.equal(sim.timeOfDay, 18.5);
  const events = sim.drainEvents(); assert.equal(events.filter(e => e.type === 'objective').length, 3); assert.ok(events.filter(e => e.type === 'note').length >= 6);
});
test('high trust tightens the trail and emits the warmer recall chirp', () => {
  const sim = new Simulation(); const original = sim.followDistance; sim.bond = 90; assert.ok(sim.followDistance < original);
  sim.command('call'); advance(sim, 3); assert.ok(sim.drainEvents().some(e => e.sound === 'warm-chirp'));
});
test('seeded 12-minute pursuit stress remains continuous through over 80 routes and reentrant obstacle corners', () => {
  const sim = new Simulation([
    { id: 'long-wall', x: 0, z: 0, hx: 0.5, hz: 4 },
    { id: 'wall-return', x: 3, z: 3.5, hx: 2.5, hz: 0.5 },
    { id: 'west-debris', x: -5, z: -3, hx: 2, hz: 0.4 },
    { id: 'east-debris', x: 7, z: -5, hx: 0.65, hz: 2 },
    { id: 'passage-debris', x: 20, z: 1.6, hx: 0.7, hz: 0.4 },
  ]);
  let seed = 1107;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 2 ** 32; };
  const targets = [{ x: 27, z: 0 }, { x: -11, z: -8 }, ...Array.from({ length: 100 }, () => ({ x: random() * 23 - 11.5, z: random() * 19 - 9.5 })).filter(p => sim.playerNav.isFree(p))];
  for (const target of targets) {
    sim.walkTo(target);
    let arrived = false;
    for (let frame = 0; frame < 2400; frame++) {
      advance(sim, 1 / 60, { x: 0, z: 0, run: true });
      if (gap(sim.player, target) < 0.2) { arrived = true; break; }
    }
    assert.ok(arrived, `sprint route reaches ${JSON.stringify(target)}`);
    advance(sim, 6);
    assert.ok(gap(sim.player, sim.droid) < 2.5, `companion catches up at ${JSON.stringify(target)}`);
  }
  assert.ok(targets.length > 80);
  assert.ok(sim.elapsed > 12 * 60);
});
test('scan rewards only real in-cone discoveries, once per target, with no empty-scan farming', () => {
  const sim = new Simulation(); sim.command('stay'); sim.droid.x = -5; sim.droid.z = -6; sim.droid.yaw = Math.PI / 2;
  sim.command('scan'); assert.deepEqual(sim.scanHits, []); assert.equal(sim.bond, 18);
  advance(sim, 3); sim.droid.yaw = -Math.PI / 2;
  sim.command('scan'); assert.deepEqual(sim.scanHits, ['token']); assert.equal(sim.bond, 21); assert.ok(sim.scanned.has('token'));
  advance(sim, 3); sim.command('scan'); assert.equal(sim.bond, 21);
  advance(sim, 3); sim.droid.x = 8; sim.droid.z = -3; sim.droid.yaw = Math.PI;
  sim.command('scan'); assert.deepEqual(sim.scanHits, ['machine']); assert.equal(sim.bond, 24);
  advance(sim, 3); sim.droid.x = 18; sim.droid.z = 0; sim.droid.yaw = Math.PI / 2;
  sim.command('scan'); assert.deepEqual(sim.scanHits, ['terminal']); assert.equal(sim.bond, 27);
  advance(sim, 3); sim.command('scan'); assert.equal(sim.bond, 27); assert.equal(sim.scanned.size, 3);
});

const manifest = JSON.parse(readFileSync(new URL('../public/assets/models/manifest.json', import.meta.url), 'utf8')) as { obstacles: Obstacle[] };
test('real Blender manifest: all courtyard routes and both gate directions keep the companion clear', () => {
  assert.ok(manifest.obstacles.some(o => o.id === 'cistern'));
  assert.ok(manifest.obstacles.some(o => o.id === 'relay_console'));
  const sim = new Simulation(manifest.obstacles);
  const routes = [
    { x: -9, z: 7 }, { x: 9, z: 8 }, { x: 8, z: -5.5 }, { x: -8, z: -6 },
    { x: -8, z: 1 }, { x: 8, z: 1 }, { x: 12, z: 0 }, { x: 16, z: 0 },
    { x: 22, z: -1.3 }, { x: 27, z: 0 }, { x: 28, z: 3 }, { x: 11, z: 0 }, { x: 3, z: 6 },
  ];
  for (const target of routes) {
    assert.ok(sim.playerNav.isFree(target), `manifest waypoint is outside collision: ${JSON.stringify(target)}`);
    walk(sim, target); advance(sim, 4);
    assert.ok(gap(sim.player, sim.droid) < 2.5, `companion reaches real-world waypoint ${JSON.stringify(target)}`);
  }
  assert.equal(sim.zone, 'courtyard');
  const titles = sim.drainEvents().filter(e => e.type === 'note').map(e => e.title);
  for (const name of ['The Ninth Courtyard', 'The Sundered Line', 'Emberwatch Ridge']) assert.ok(titles.includes(name), `location note: ${name}`);
});
test('real Blender manifest: token, gate escort, terminal approach, overwatch and dusk work end-to-end', () => {
  const sim = new Simulation(manifest.obstacles);
  walk(sim, { x: -6.2, z: -6 }); advance(sim, 3); sim.command('fetch'); advance(sim, 8);
  assert.equal(sim.objectives.token, true);
  walk(sim, { x: 18, z: 0 }); advance(sim, 3); assert.equal(sim.objectives.escort, true);
  walk(sim, { x: 22, z: 1.4 }); advance(sim, 3);
  assert.ok(gap(sim.player, { x: 22, z: 0 }) < 1.6, 'relay reachable within interaction distance without entering collider');
  walk(sim, { x: 28, z: 0 }); sim.command('call'); advance(sim, 4); sim.command('overwatch'); advance(sim, 3);
  assert.equal(sim.mode, 'overwatch'); assert.ok(sim.drainEvents().some(e => e.type === 'threat'));
  advance(sim, 19); assert.equal(sim.objectives.ridge, true); assert.equal(sim.timeOfDay, 18.5);
});
test('real Blender manifest: invalid, obstructed and outside clicks preserve finite, clear positions', () => {
  const sim = new Simulation(manifest.obstacles);
  for (const target of [
    { x: NaN, z: 0 }, { x: Infinity, z: 0 }, { x: -Infinity, z: NaN },
    { x: 1e9, z: -1e9 }, { x: -18, z: 0 }, { x: 32, z: 8 },
    { x: 0, z: -1 }, { x: 22, z: 0 },
  ]) {
    sim.walkTo(target); advance(sim, 15);
    for (const entity of [sim.player, sim.droid]) assert.ok([entity.x, entity.z, entity.speed, entity.yaw].every(Number.isFinite));
    assert.ok(sim.playerNav.isFree(sim.player)); assert.ok(sim.droidNav.isFree(sim.droid));
  }
});
test('final Blender manifest: model-width radii survive randomized sprint routes without sticking', () => {
  const sim = new Simulation(manifest.obstacles);
  assert.ok(manifest.obstacles.length >= 28, 'city preserves or expands collision coverage');
  assert.equal(sim.playerNav.radius, 0.42);
  assert.equal(sim.droidNav.radius, 0.48);
  let seed = 81028;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 2 ** 32; };
  const targets = [
    { x: -8, z: -6 }, { x: 28, z: 0 }, { x: 22, z: 1.5 }, { x: 3, z: 6 },
    ...Array.from({ length: 160 }, () => ({ x: random() * 42 - 13, z: random() * 22 - 11 })).filter(p => sim.playerNav.isFree(p)),
  ];
  for (const target of targets) {
    sim.walkTo(target);
    let arrived = false;
    for (let frame = 0; frame < 2400; frame++) {
      advance(sim, 1 / 60, { x: 0, z: 0, run: true });
      if (gap(sim.player, target) < 0.2) { arrived = true; break; }
    }
    assert.ok(arrived, `full-sized hunter reaches ${JSON.stringify(target)}`);
    advance(sim, 6);
    assert.ok(gap(sim.player, sim.droid) < 2.5, `full-sized companion catches hunter at ${JSON.stringify(target)}`);
  }
  assert.ok(targets.length >= 90);
});
test('Morrow condenser collider blocks its center but leaves the machine inspection approach reachable', () => {
  const sim = new Simulation(manifest.obstacles), center = { x: 8, z: -7 }, approach = { x: 8, z: -5.5 };
  assert.ok(manifest.obstacles.some(o => o.id === 'morrow_condenser'));
  assert.equal(sim.playerNav.isFree(center), false); assert.equal(sim.droidNav.isFree(center), false);
  walk(sim, approach); advance(sim, 4);
  assert.ok(gap(sim.player, center) < 2.8, 'hunter can inspect without standing inside machine');
  assert.ok(gap(sim.player, sim.droid) < 2.5, 'companion follows around the machine collider');
});
test('fetching a token under the hunter leaves two separated silhouettes after physical delivery', () => {
  const sim = new Simulation(manifest.obstacles);
  walk(sim, { x: -8, z: -6 }); advance(sim, 3);
  assert.ok(gap(sim.player, sim.token) < 0.2, 'hunter is standing on the marked token');
  sim.command('fetch'); advance(sim, 8);
  assert.equal(sim.objectives.token, true); assert.equal(sim.mode, 'follow');
  assert.ok(gap(sim.player, sim.droid) >= 0.95, 'delivery does not leave companion overlapped with hunter');
  assert.ok(gap(sim.player, sim.droid) < 2.5);
  advance(sim, 4); assert.ok(gap(sim.player, sim.droid) >= 0.95, 'separation remains stable while idle');
});
test('personal space finds a continuous route beside a wall and never moves a planted Stay companion', () => {
  const sim = new Simulation(manifest.obstacles);
  sim.player.x = -12.75; sim.player.z = -3; sim.droid.x = -12.85; sim.droid.z = -3;
  assert.ok(sim.playerNav.isFree(sim.player)); assert.ok(sim.droidNav.isFree(sim.droid));
  advance(sim, 3);
  assert.ok(gap(sim.player, sim.droid) >= 0.95, 'droid separates tangentially where directly away points into the wall');
  sim.command('stay'); sim.player.x = sim.droid.x; sim.player.z = sim.droid.z;
  const planted = { ...sim.droid }; advance(sim, 2);
  assert.equal(gap(planted, sim.droid), 0, 'Stay preserves its exact planted location even when crowded');
  sim.command('stay'); advance(sim, 3); assert.ok(gap(sim.player, sim.droid) >= 0.95);
});
test('calling an overlapping companion opens personal space before the brief hold and follow resume', () => {
  const sim = new Simulation(manifest.obstacles); sim.droid.x = sim.player.x; sim.droid.z = sim.player.z;
  sim.command('call'); advance(sim, 4);
  assert.equal(sim.mode, 'follow'); assert.ok(gap(sim.player, sim.droid) >= 0.95);
});
test('call beside east freight completes where the hunter fits inside the wider droid clearance margin', () => {
  const sim = new Simulation(manifest.obstacles);
  sim.player.x = 6.4254837513; sim.player.z = 4.9305969148;
  sim.droid.x = 6.5965921983; sim.droid.z = 4.5981488522;
  assert.ok(sim.playerNav.isFree(sim.player)); assert.equal(sim.droidNav.isFree(sim.player), false);
  assert.ok(sim.droidNav.isFree(sim.droid));
  sim.command('call'); advance(sim, 6);
  assert.equal(sim.mode, 'follow'); assert.ok(gap(sim.player, sim.droid) >= 0.95);
  const settled = { ...sim.droid }; advance(sim, 4);
  assert.equal(gap(settled, sim.droid), 0, 'different body clearances do not cause endless approach/separation oscillation');
});
test('nearby hunter behind a wall still requires a route around it before call can arrive', () => {
  const sim = new Simulation([{ id: 'thin-divider', x: 0, z: 0, hx: 0.02, hz: 2 }]);
  sim.player.x = 0.45; sim.player.z = 0; sim.droid.x = -0.51; sim.droid.z = 0;
  assert.ok(sim.playerNav.isFree(sim.player)); assert.ok(sim.droidNav.isFree(sim.droid));
  assert.equal(sim.droidNav.segmentClear(sim.droid, sim.player, 0.04), false);
  sim.command('call'); advance(sim, 0.2);
  assert.equal(sim.mode, 'call'); assert.ok(sim.droid.x < 0, 'call does not complete through divider');
  advance(sim, 7); assert.equal(sim.mode, 'follow'); assert.ok(sim.droid.x > 0, 'droid physically routes around divider');
  assert.ok(gap(sim.player, sim.droid) >= 0.95);
});


function unionArea(rectangles: WalkArea[]): number {
  const xs = [...new Set(rectangles.flatMap(r => [r.minX, r.maxX]))].sort((a, b) => a - b);
  const zs = [...new Set(rectangles.flatMap(r => [r.minZ, r.maxZ]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 1; i < xs.length; i++) for (let j = 1; j < zs.length; j++) {
    const x = (xs[i - 1] + xs[i]) / 2, z = (zs[j - 1] + zs[j]) / 2;
    if (rectangles.some(r => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)) area += (xs[i] - xs[i - 1]) * (zs[j] - zs[j - 1]);
  }
  return area;
}

test('city traversable footprint is at least five times the original connected union', () => {
  const original = unionArea(WORLD.districts.slice(0, 3).map(d => d.bounds));
  const expanded = unionArea(WALK_AREAS);
  assert.ok(Math.abs(original - 720.86) < 1e-6);
  assert.ok(expanded >= original * 5, `${expanded} / ${original} exceeds five`);
  assert.equal(WORLD.districts.length, 7); assert.equal(WORLD.connections.length, 4);
});

test('all seven district locations and threshold field notes derive from actual 2D coordinates', () => {
  const sim = new Simulation();
  for (const district of WORLD.districts) {
    assert.equal(getZone(district.center), district.id);
    sim.player.x = district.center.x; sim.player.z = district.center.z; sim.tick(1 / 60);
    assert.equal(sim.zone, district.id); assert.ok(sim.visitedZones.has(sim.zone));
    assert.ok(sim.drainEvents().some(e => e.type === 'note' && e.title === district.name));
  }
  assert.equal(sim.visitedCount, 7);
  assert.equal(getZone({ x: 0, z: -13.8 }), 'market');
  assert.equal(getZone({ x: 0, z: 13.8 }), 'landing');
  assert.equal(getZone({ x: -15, z: 0 }), 'salvage');
  assert.equal(getZone({ x: 31.7, z: 0 }), 'watch');
});

test('the four city links support bidirectional full-sized follow and long cross-city sprint paths', () => {
  const sim = new Simulation();
  const route = [
    { x: 0, z: -28 }, { x: 0, z: 0 }, { x: -29, z: 0 }, { x: 0, z: 0 },
    { x: 0, z: 27 }, { x: 0, z: 0 }, { x: 46, z: 0 }, { x: 0, z: 0 },
    { x: -38, z: 8 }, { x: 55, z: 8 }, { x: 6, z: -37 }, { x: -6, z: 36 },
  ];
  for (const target of route) {
    sim.walkTo(target);
    let arrived = false;
    for (let frame = 0; frame < 3600; frame++) {
      advance(sim, 1 / 60, { x: 0, z: 0, run: true });
      if (gap(sim.player, target) < 0.2) { arrived = true; break; }
    }
    assert.ok(arrived, `city sprint reaches ${JSON.stringify(target)}`);
    advance(sim, 5);
    assert.ok(gap(sim.player, sim.droid) < 2.5, `companion reaches ${JSON.stringify(target)}`);
  }
  assert.equal(sim.visitedCount, 7);
});

test('new city scan discoveries use authored landmark text and reward each landmark only once', () => {
  const sim = new Simulation(); sim.command('stay');
  for (const landmark of WORLD.landmarks) {
    sim.droid.x = landmark.x - 2; sim.droid.z = landmark.z; sim.droid.yaw = Math.PI / 2;
    sim.tick(3); // Tick caps catch-up; explicit cooldown advances below preserve normal timing.
    for (let i = 0; i < 180; i++) sim.tick(1 / 60);
    sim.drainEvents(); const before = sim.bond;
    sim.command('scan');
    assert.ok(sim.scanHits.includes(landmark.id), `in-cone scan sees ${landmark.id}`);
    assert.ok(sim.scanned.has(landmark.id)); assert.ok(sim.bond >= before + 3);
    assert.ok(sim.drainEvents().some(e => e.type === 'note' && e.text?.includes(landmark.text)));
    for (let i = 0; i < 180; i++) sim.tick(1 / 60);
    const earned = sim.bond; sim.command('scan'); assert.equal(sim.bond, earned, 'repeat scan does not farm bond');
  }
  assert.ok(WORLD.landmarks.every(l => sim.scanned.has(l.id)));
});

test('distant city districts cannot complete the original gate or ridge objectives by sharing an X coordinate', () => {
  const sim = new Simulation(); sim.objectives.token = true; sim.command('stay');
  for (const point of [{ x: 46, z: 0 }, { x: 54, z: 7 }, { x: 28, z: 12 }]) {
    sim.player.x = point.x; sim.player.z = point.z; sim.droid.x = point.x - 1; sim.droid.z = point.z;
    for (let i = 0; i < 1200; i++) sim.tick(1 / 60);
    assert.equal(sim.objectives.escort, false); assert.equal(sim.ridgeProgress, 0);
  }
  sim.objectives.escort = true;
  sim.player.x = 46; sim.player.z = 0; sim.droid.x = 45; sim.droid.z = 0;
  for (let i = 0; i < 1200; i++) sim.tick(1 / 60);
  assert.equal(sim.objectives.ridge, false); assert.equal(sim.ridgeProgress, 0);
});

test('expanded Blender city: every new portal works in both directions with continuous full-width companion follow', () => {
  const sim = new Simulation(manifest.obstacles);
  const origin = { x: 3, z: 6 };
  const districts = WORLD.districts.filter(d => ['market', 'salvage', 'landing', 'watch'].includes(d.id));
  for (const district of districts) {
    assert.ok(sim.playerNav.isFree(district.id === 'landing' ? { x: 0, z: 21 } : district.center), `district stop ${district.id} has player clearance`);
    assert.ok(sim.droidNav.isFree(district.id === 'landing' ? { x: 0, z: 21 } : district.center), `district stop ${district.id} has companion clearance`);
    for (const target of [district.id === 'landing' ? { x: 0, z: 21 } : district.center, origin]) {
      sim.walkTo(target);
      let arrived = false;
      for (let frame = 0; frame < 3600; frame++) {
        advance(sim, 1 / 60, { x: 0, z: 0, run: true });
        if (gap(sim.player, target) < 0.2) { arrived = true; break; }
      }
      assert.ok(arrived, `real portal route arrives at ${JSON.stringify(target)} (${district.id})`);
      advance(sim, 5);
      assert.ok(gap(sim.player, sim.droid) < 2.5, `companion follows real portal ${district.id} without sticking`);
    }
  }
  assert.equal(sim.visitedCount, 7);
});

test('expanded Blender city: seeded long routes reach every district without collision or follower teleports', () => {
  const sim = new Simulation(manifest.obstacles);
  let seed = 59375, routes = 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 2 ** 32; };
  for (let round = 0; round < 8; round++) for (const district of WORLD.districts) {
    const b = district.bounds;
    let target = district.center;
    for (let attempt = 0; attempt < 100; attempt++) {
      const candidate = { x: b.minX + 1 + random() * (b.maxX - b.minX - 2), z: b.minZ + 1 + random() * (b.maxZ - b.minZ - 2) };
      if (sim.playerNav.isFree(candidate) && sim.droidNav.isFree(candidate)) { target = candidate; break; }
    }
    sim.walkTo(target);
    let arrived = false;
    for (let frame = 0; frame < 4200; frame++) {
      advance(sim, 1 / 60, { x: 0, z: 0, run: round % 2 === 0 });
      if (gap(sim.player, target) < 0.2) { arrived = true; break; }
    }
    assert.ok(arrived, `expanded long route reaches ${district.id} ${JSON.stringify(target)}`);
    advance(sim, 6);
    assert.ok(gap(sim.player, sim.droid) < 2.5, `companion catches up in ${district.id} ${JSON.stringify(target)}`);
    routes++;
  }
  assert.equal(routes, 56); assert.equal(sim.visitedCount, 7);
});

test('expanded Blender city: all authored lore landmarks have a collision-safe reachable interaction approach', () => {
  const sim = new Simulation(manifest.obstacles);
  for (const landmark of WORLD.landmarks) {
    let approach: Vec2 | undefined;
    for (const radius of [1.5, 2.0, 2.5, 2.75]) {
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8;
        const point = { x: landmark.x + Math.sin(angle) * radius, z: landmark.z + Math.cos(angle) * radius };
        if (!sim.playerNav.isFree(point) || !sim.droidNav.isFree(point)) continue;
        const path = sim.playerNav.path(sim.player, point);
        if (path.length && gap(path[path.length - 1], point) < 0.1) { approach = point; break; }
      }
      if (approach) break;
    }
    assert.ok(approach, `${landmark.id} can be inspected within 2.8 m of its visible marker`);
    walk(sim, approach!, 65); advance(sim, 5);
    assert.ok(gap(sim.player, landmark) <= 2.8);
    assert.ok(gap(sim.player, sim.droid) < 2.5, `Tallow accompanies inspection of ${landmark.id}`);
  }
});
