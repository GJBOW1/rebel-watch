import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Simulation, Navigation, WORLD, WALK_AREAS, type Vec2, type Obstacle } from '../src/simulation.ts';
import { Combat } from '../src/combat.ts';
import { INTERIORS, INTERIOR_LANDMARKS, getInterior, getNearbyDoor, type Interior } from '../src/interiors.ts';

const gap = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const manifest = JSON.parse(readFileSync(new URL('../public/assets/models/manifest.json', import.meta.url), 'utf8')) as { obstacles: Obstacle[] };

function advance(sim: Simulation, seconds: number, run = false) {
  for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) {
    const player = { ...sim.player }, droid = { ...sim.droid };
    sim.tick(1 / 60, { x: 0, z: 0, run });
    assert.ok(gap(player, sim.player) <= (run ? 5.2 : 3) / 60 + 1e-8, 'hunter never warps across a threshold');
    assert.ok(gap(droid, sim.droid) <= 6.7 / 60 + 1e-8, 'Tallow enters continuously within movement speed');
    assert.ok(sim.playerNav.isFree(sim.player), 'hunter shoulder radius stays outside shell and furnishings');
    assert.ok(sim.droidNav.isFree(sim.droid), 'Tallow full stance stays outside shell and furnishings');
  }
}
function walk(sim: Simulation, point: Vec2, run = false) {
  sim.walkTo(point);
  for (let frame = 0; frame < 5400; frame++) {
    advance(sim, 1 / 60, run);
    if (gap(sim.player, point) < 0.17) return;
  }
  assert.fail(`room route could not reach ${JSON.stringify(point)}: hunter ${JSON.stringify(sim.player)}, droid ${JSON.stringify(sim.droid)}`);
}
function loreApproach(sim: Simulation, room: Interior): Vec2 {
  const landmark = room.landmarks[0];
  for (const radius of [1.2, 1.6, 2, 2.4]) for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI / 12;
    const point = { x: landmark.x + Math.sin(angle) * radius, z: landmark.z + Math.cos(angle) * radius };
    if (getInterior(point)?.id !== room.id || !sim.playerNav.isFree(point) || !sim.droidNav.isFree(point)) continue;
    const path = sim.playerNav.path(sim.player, point);
    if (path.length && gap(path[path.length - 1], point) < 0.05) return point;
  }
  assert.fail(`no collision-safe interior lore approach in ${room.id}`);
}

test('interior identity remains nested within the expanded city districts', () => {
  const sim = new Simulation();
  assert.equal(INTERIORS.length, 3); assert.equal(sim.interior, null); assert.equal(sim.visitedInteriors.size, 0);
  for (const room of INTERIORS) {
    assert.equal(getInterior(room.center)?.id, room.id);
    assert.equal(getInterior(room.door.inside)?.id, room.id);
    assert.equal(getInterior(room.door.outside), null);
    const district = WORLD.districts.find(d => d.id === room.zone)!;
    assert.ok(WALK_AREAS.includes(district.bounds));
    assert.ok(room.bounds.minX >= district.bounds.minX && room.bounds.maxX <= district.bounds.maxX);
    assert.ok(room.bounds.minZ >= district.bounds.minZ && room.bounds.maxZ <= district.bounds.maxZ);
  }
  for (const invalid of [{ x: NaN, z: 0 }, { x: Infinity, z: 0 }]) assert.equal(getInterior(invalid), null);
  assert.equal(WORLD.districts.length, 10);
});

test('door actions select physical destinations on the other side and never offer flank-wall entry', () => {
  assert.equal(getNearbyDoor({ x: NaN, z: 0 }), null);
  for (const room of INTERIORS) {
    const entry = getNearbyDoor(room.door.outside), exit = getNearbyDoor(room.door.inside);
    assert.equal(entry?.building.id, room.id); assert.equal(entry?.entering, true); assert.deepEqual(entry?.destination, room.center);
    assert.equal(exit?.building.id, room.id); assert.equal(exit?.entering, false); assert.deepEqual(exit?.destination, { x: room.door.outside.x, z: room.door.outside.z + room.door.normalZ * 1.5 });
    assert.equal(getNearbyDoor({ x: room.door.x + room.door.width / 2 + 0.6, z: room.door.z }), null);
    assert.equal(getNearbyDoor({ x: room.door.x, z: room.door.z + room.door.normalZ * 3 }), null);
    assert.equal(getNearbyDoor(room.center), null, 'formation entry stop leaves room lore ahead of exit prompt');
  }
});

test('room arrival and exterior return emit one matching field note without changing district discovery counts', () => {
  const sim = new Simulation(); sim.command('stay'); sim.drainEvents();
  for (const room of INTERIORS) {
    sim.player.x = room.door.outside.x; sim.player.z = room.door.outside.z; sim.tick(1 / 60); sim.drainEvents();
    const visited = sim.visitedCount;
    sim.player.x = room.center.x; sim.player.z = room.center.z; sim.tick(1 / 60);
    assert.equal(sim.interior, room.id); assert.equal(sim.zone, room.zone); assert.equal(sim.visitedCount, visited);
    assert.ok(sim.visitedInteriors.has(room.id));
    assert.deepEqual(sim.drainEvents().filter(e => e.type === 'note').map(e => [e.title, e.text]), [[room.name, room.note]]);
    for (let frame = 0; frame < 240; frame++) sim.tick(1 / 60);
    assert.equal(sim.drainEvents().filter(e => e.type === 'note').length, 0, 'remaining in room does not repeat note');
    sim.player.x = room.door.outside.x; sim.player.z = room.door.outside.z; sim.tick(1 / 60);
    assert.equal(sim.interior, null); assert.equal(sim.visitedCount, visited);
    const district = WORLD.districts.find(d => d.id === room.zone)!;
    assert.deepEqual(sim.drainEvents().filter(e => e.type === 'note').map(e => [e.title, e.text]), [[district.name, district.note]]);
  }
  assert.equal(sim.visitedInteriors.size, 3);
  assert.deepEqual(sim.objectives, { token: false, escort: false, ridge: false });
});

for (const room of INTERIORS) {
  test(`real Blender ${room.id}: walk and sprint through the door, inspect, call and exit with continuous full-width companion`, () => {
    assert.equal(manifest.obstacles.some(o => o.id === room.buildingId), false, 'old solid building collider replaced by its physical shell');
    const sim = new Simulation(manifest.obstacles);
    for (const point of [room.door.outside, room.door.inside, room.center, getNearbyDoor(room.door.inside)!.destination]) {
      assert.ok(sim.playerNav.isFree(point), `${room.id} hunter clearance at ${JSON.stringify(point)}`);
      assert.ok(sim.droidNav.isFree(point), `${room.id} companion clearance at ${JSON.stringify(point)}`);
    }
    walk(sim, room.door.outside, true); advance(sim, 4);
    assert.equal(sim.interior, null);
    for (const run of [false, true]) {
      const entry = getNearbyDoor(sim.player)!;
      assert.equal(entry.building.id, room.id); assert.equal(entry.entering, true);
      walk(sim, entry.destination, run); advance(sim, 6);
      assert.equal(sim.interior, room.id); assert.equal(getInterior(sim.droid)?.id, room.id, 'Tallow follows into the actual room');
      assert.ok(gap(sim.player, sim.droid) < 2.5);
      const approach = loreApproach(sim, room); walk(sim, approach, run); sim.command('call'); advance(sim, 5);
      assert.equal(sim.mode, 'follow', 'recall finishes inside furnished space');
      assert.ok(gap(sim.player, sim.droid) >= 0.95 && gap(sim.player, sim.droid) < 2.5);
      assert.ok(gap(sim.player, room.landmarks[0]) < 2.8, 'inspection uses a reachable nearby position');
      sim.command('stay'); const held = { ...sim.droid }; advance(sim, 1); assert.equal(gap(held, sim.droid), 0);
      sim.command('stay');
      walk(sim, room.door.inside, run); const exit = getNearbyDoor(sim.player)!; assert.equal(exit.entering, false);
      walk(sim, exit.destination, run);
      advance(sim, 6);
      assert.equal(sim.interior, null); assert.equal(getInterior(sim.droid), null, 'Tallow physically follows back outside');
      assert.ok(gap(sim.player, sim.droid) < 2.5);
      walk(sim, room.door.outside, run);
    }
    assert.ok(sim.visitedInteriors.has(room.id));
  });
}

test('real Blender room shells stop swept manual movement outside their actual door openings', () => {
  for (const room of INTERIORS) {
    const nav = new Navigation(manifest.obstacles, 0.48), { bounds, door } = room;
    const blocked = [
      { x: bounds.minX, z: (bounds.minZ + bounds.maxZ) / 2 },
      { x: bounds.maxX, z: (bounds.minZ + bounds.maxZ) / 2 },
      { x: bounds.minX + 0.6, z: door.z },
      { x: bounds.maxX - 0.6, z: door.z },
    ];
    for (const wall of blocked) assert.equal(nav.isFree(wall), false, `solid ${room.id} shell at ${JSON.stringify(wall)}`);
    assert.equal(nav.segmentClear(door.outside, door.inside), true, `${room.id} opening clears full companion width`);
    for (const sign of [-1, 1]) {
      const entity = { ...room.center }; nav.move(entity, sign * 20, 0);
      assert.ok(nav.isFree(entity)); assert.equal(getInterior(entity)?.id, room.id, 'swept manual movement cannot tunnel out through side wall');
    }
    // Ballistic collision uses this same static collider manifest.
    const flank = { x: bounds.minX + 0.6, z: door.z };
    assert.ok(manifest.obstacles.some(o => Math.abs(flank.x - o.x) <= o.hx && Math.abs(flank.z - o.z) <= o.hz));
  }
});

test('real Blender interiors: scan discovers authored room lore once and cannot see it from the street', () => {
  const sim = new Simulation(manifest.obstacles);
  for (const room of INTERIORS) {
    walk(sim, room.door.outside, true); advance(sim, 5); sim.command('stay');
    const landmark = room.landmarks[0];
    sim.droid.yaw = Math.atan2(landmark.x - sim.droid.x, landmark.z - sim.droid.z);
    sim.command('scan'); assert.ok(!sim.scanHits.includes(landmark.id), 'indoor lore is not exposed through exterior wall');
    advance(sim, 3); sim.command('stay'); walk(sim, room.center); sim.command('call'); advance(sim, 5);
    assert.equal(getInterior(sim.droid)?.id, room.id);
    sim.command('stay'); sim.droid.yaw = Math.atan2(landmark.x - sim.droid.x, landmark.z - sim.droid.z);
    const before = sim.bond; sim.command('scan');
    assert.ok(sim.scanHits.includes(landmark.id)); assert.ok(sim.scanned.has(landmark.id)); assert.ok(sim.bond >= before + 3);
    assert.ok(sim.drainEvents().some(event => event.type === 'note' && event.text?.includes(landmark.text)));
    advance(sim, 3); const after = sim.bond; sim.command('scan'); assert.equal(sim.bond, after, 'repeat discovery cannot farm bond');
    advance(sim, 3); sim.command('stay'); walk(sim, room.door.outside); advance(sim, 5);
  }
  assert.equal(INTERIOR_LANDMARKS.length, 3);
});


test('real Blender interiors: blaster bolts pass door openings, stop at walls, and enemies toggle without moving the player', () => {
  for (const room of INTERIORS) {
    const combat = new Combat(new Navigation(manifest.obstacles, 0.43));
    combat.toggleEquip();
    assert.equal(combat.fire(room.door.inside, room.door.outside), true);
    for (let frame = 0; frame < 6; frame++) combat.tick(1 / 60, room.door.inside);
    assert.equal(combat.projectiles.length, 1, 'shot traverses the physical open doorway');
    assert.ok(gap(combat.projectiles[0], room.door.outside) < 0.01);
    combat.setEnabled(false, room.center);
    assert.equal(combat.fire(room.center, { x: room.center.x - 20, z: room.center.z }), true);
    for (let frame = 0; frame < 30; frame++) combat.tick(1 / 60, room.center);
    assert.equal(combat.projectiles.length, 0, 'room shell stops the wall-directed shot');
    const hit = combat.drainEvents().find(event => event.type === 'impact');
    assert.ok(hit && hit.x > room.bounds.minX - 0.2 && hit.x < room.bounds.maxX + 0.2);
    const player = { ...room.center }, before = { ...player };
    combat.setEnabled(true, player); assert.ok(combat.enemies.length > 0, 'indoor encounter has reachable local enemies');
    for (const enemy of combat.enemies) {
      assert.ok(combat.nav.isFree(enemy));
      const path = combat.nav.path(player, enemy);
      assert.ok(path.length && gap(path[path.length - 1], enemy) < 0.1);
    }
    for (let frame = 0; frame < 180; frame++) {
      const positions = new Map(combat.enemies.map(enemy => [enemy.id, { ...enemy }]));
      combat.tick(1 / 60, player);
      for (const enemy of combat.enemies) {
        assert.ok(combat.nav.isFree(enemy));
        assert.ok(gap(positions.get(enemy.id)!, enemy) <= 2.1 / 60 + 1e-8);
      }
    }
    combat.setEnabled(false, player);
    assert.deepEqual(player, before); assert.equal(combat.enemies.length, 0); assert.equal(combat.projectiles.length, 0);
    assert.equal(combat.enabled, false); assert.equal(combat.shield, 100);
  }
});

test('real Blender furnished rooms: seeded edge routes, sprint turns and recall preserve companion clearance', () => {
  const sim = new Simulation(manifest.obstacles);
  let seed = 93051;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 2 ** 32; };
  for (const room of INTERIORS) {
    walk(sim, room.center, true); advance(sim, 5);
    const targets: Vec2[] = [];
    for (let attempt = 0; attempt < 1500 && targets.length < 20; attempt++) {
      const point = { x: room.bounds.minX + random() * (room.bounds.maxX - room.bounds.minX), z: room.bounds.minZ + random() * (room.bounds.maxZ - room.bounds.minZ) };
      if (!sim.playerNav.isFree(point) || !sim.droidNav.isFree(point)) continue;
      targets.push(point);
    }
    assert.equal(targets.length, 20, `${room.id} offers many distinct interior standing positions`);
    for (let i = 0; i < targets.length; i++) {
      walk(sim, targets[i], i % 2 === 0); advance(sim, 5);
      assert.equal(sim.interior, room.id);
      assert.ok(gap(sim.player, sim.droid) < 2.5, `${room.id} follower settles at ${JSON.stringify(targets[i])}`);
      if (i % 4 === 0) {
        sim.command('call'); advance(sim, 5);
        assert.equal(sim.mode, 'follow', `${room.id} recall completes beside tables and wall edges`);
        assert.ok(gap(sim.player, sim.droid) >= 0.95);
      }
    }
    walk(sim, getNearbyDoor(room.door.inside)!.destination, true); advance(sim, 5);
  }
});

test('real Blender thresholds permit both body widths across the full usable opening and stop jamb clipping', () => {
  for (const room of INTERIORS) for (const radius of [0.42, 0.48]) {
    const nav = new Navigation(manifest.obstacles, radius), door = room.door;
    for (const offset of [-0.5, 0, 0.5]) for (const direction of [-1, 1]) {
      const actor = { x: door.x + offset, z: door.z + door.normalZ * direction * 0.9 };
      assert.ok(nav.isFree(actor), `${room.id} threshold approach starts clear for radius${radius}`);
      for (let frame = 0; frame < 36; frame++) {
        const before = { ...actor };
        nav.move(actor, 0, -door.normalZ * direction * 0.05);
        assert.ok(nav.isFree(actor)); assert.ok(gap(actor, before) <= 0.05 + 1e-8);
      }
      assert.ok(Math.abs(actor.z - (door.z - door.normalZ * direction * 0.9)) < 1e-8, `${room.id} full-width crossing is not pinched by jambs`);
    }
    const clipped = { x: door.x + door.width / 2 - radius / 2, z: door.z + door.normalZ * 0.9 };
    nav.move(clipped, 0, -door.normalZ * 2);
    assert.ok((clipped.z - door.z) * door.normalZ > 0, 'a shoulder overlapping the jamb cannot clip through the wall');
  }
});
