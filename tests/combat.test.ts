import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Combat, COMBAT_LIMITS } from '../src/combat.ts';
import { Navigation, WORLD, type Vec2, type Obstacle } from '../src/simulation.ts';

const gap = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
function advance(combat: Combat, seconds: number, player: Vec2) {
  for (let n = 0; n < Math.round(seconds * 60); n++) combat.tick(1 / 60, player);
}
function encounter(obstacles: Obstacle[] = []) {
  const player = { x: -4, z: 0 };
  const combat = new Combat(new Navigation(obstacles, 0.43));
  combat.setEnabled(true, player);
  assert.ok(combat.enemies.length > 0);
  const enemy = combat.enemies[0];
  combat.enemies = [enemy];
  enemy.x = 4; enemy.z = 0;
  return { combat, player, enemy };
}
function incoming(combat: Combat, player: Vec2, id = 9000) {
  combat.projectiles.push({ id, owner: 'enemy', x: player.x + 0.6, z: player.z, dx: -1, dz: 0, speed: 13.5, age: 0 });
}

test('blaster starts holstered; equip, cooldown, aim validation and target practice work', () => {
  const combat = new Combat(new Navigation([], 0.43));
  const player = { x: 0, z: 0 }, target = { x: 5, z: 0 };
  assert.equal(combat.enabled, false);
  assert.equal(combat.fire(player, target), false);
  assert.equal(combat.toggleEquip(), true);
  assert.equal(combat.fire(player, player), false);
  assert.equal(combat.fire(player, { x: NaN, z: 0 }), false);
  assert.equal(combat.fire(player, target), true);
  assert.equal(combat.fire(player, target), false);
  advance(combat, 0.2, player);
  assert.equal(combat.fire(player, target), false);
  advance(combat, 0.05, player);
  assert.equal(combat.fire(player, target), true);
  assert.equal(combat.toggleEquip(), false);
  advance(combat, 0.3, player);
  assert.equal(combat.fire(player, target), false);
  assert.equal(combat.drainEvents().filter(e => e.type === 'fire' && e.owner === 'player').length, 2);
});

test('continuous projectile collision stops a fast shot at a very thin wall', () => {
  const { combat, player, enemy } = encounter([{ id: 'foil-wall', x: 0, z: 0, hx: 0.001, hz: 10 }]);
  combat.toggleEquip();
  combat.fire(player, enemy);
  combat.tick(0.25, player);
  assert.equal(enemy.health, COMBAT_LIMITS.enemyHealth);
  assert.equal(combat.projectiles.length, 0);
  const hit = combat.drainEvents().find(e => e.type === 'impact');
  assert.ok(hit);
  assert.ok(Math.abs(hit.x + 0.066) < 0.002, `wall impact was ${hit.x}`);
});

test('nearest enemy absorbs a shot; two hits defeat it without hitting the actor behind', () => {
  const player = { x: -4, z: 0 }, combat = new Combat(new Navigation([], 0.43));
  combat.setEnabled(true, player);
  const [enemy, second] = combat.enemies;
  assert.ok(second);
  combat.enemies = [enemy, second];
  enemy.x = 4; enemy.z = 0; second.x = 7; second.z = 0;
  combat.toggleEquip();
  combat.fire(player, enemy);
  advance(combat, 0.3, player);
  assert.equal(enemy.health, 33);
  assert.equal(second.health, COMBAT_LIMITS.enemyHealth);
  assert.equal(combat.kills, 0);
  combat.fire(player, enemy);
  advance(combat, 0.3, player);
  assert.equal(enemy.health, 0);
  assert.equal(enemy.state, 'down');
  assert.equal(combat.kills, 1);
  assert.equal(second.health, COMBAT_LIMITS.enemyHealth);
  assert.equal(combat.drainEvents().filter(e => e.type === 'enemy-down').length, 1);
  advance(combat, 1, player);
  assert.equal(combat.enemies.length, 1, 'defeated actors clean up after the fall animation');
  assert.equal(combat.enemies[0].id, second.id);
});

test('enemy fire has a visible warning, locks its target, and can be dodged', () => {
  const { combat, player, enemy } = encounter();
  advance(combat, 1.9, player);
  assert.equal(enemy.state, 'aim');
  assert.ok(enemy.telegraph > 0 && enemy.telegraph < 1);
  assert.equal(enemy.aimX, player.x);
  assert.equal(enemy.aimZ, player.z);
  const dodged = { x: player.x, z: 3 };
  advance(combat, 1.5, dodged);
  assert.equal(combat.shield, 100);
  assert.ok(combat.drainEvents().some(e => e.type === 'fire' && e.owner === 'enemy'));
});

test('enemy bolts damage a stationary player and shield recovers only after quiet', () => {
  const { combat, player } = encounter();
  advance(combat, 3.5, player);
  assert.equal(combat.shield, 86);
  assert.ok(combat.drainEvents().some(e => e.type === 'player-hit' && e.value === 86));
  combat.enemies = [];
  combat.projectiles = [];
  advance(combat, 7, player);
  assert.equal(combat.shield, 86);
  advance(combat, 2, player);
  assert.ok(combat.shield > 86 && combat.shield <= 100);
  advance(combat, 2, player);
  assert.equal(combat.shield, 100);
});

test('stand down clears active enemies, airborne bolts and queued attack effects immediately', () => {
  const { combat, player } = encounter();
  combat.toggleEquip();
  incoming(combat, player);
  combat.shield = 28;
  combat.setEnabled(false, player);
  assert.equal(combat.enabled, false);
  assert.equal(combat.enemies.length, 0);
  assert.equal(combat.projectiles.length, 0);
  assert.equal(combat.drainEvents().length, 0);
  assert.equal(combat.shield, 100);
  advance(combat, 20, player);
  assert.equal(combat.shield, 100);
  assert.equal(combat.defeated, false);
  assert.equal(combat.equipped, true, 'stand down does not change the chosen weapon pose');
});

test('defeat ends damage and firing until explicit retry or stand down', () => {
  const { combat, player } = encounter();
  combat.toggleEquip();
  combat.shield = 10;
  incoming(combat, player);
  combat.tick(1 / 60, player);
  assert.equal(combat.defeated, true);
  assert.equal(combat.shield, 0);
  assert.equal(combat.projectiles.length, 0);
  assert.equal(combat.fire(player, { x: 3, z: 0 }), false);
  const positions = combat.enemies.map(e => ({ x: e.x, z: e.z }));
  advance(combat, 10, player);
  assert.deepEqual(combat.enemies.map(e => ({ x: e.x, z: e.z })), positions);
  assert.equal(combat.drainEvents().filter(e => e.type === 'defeat').length, 1);
  combat.restart(player);
  assert.equal(combat.shield, 100);
  assert.equal(combat.defeated, false);
  assert.ok(combat.enemies.length > 0);
  assert.equal(combat.fire(player, combat.enemies[0]), true);
  combat.shield = 10;
  incoming(combat, player, 9001);
  combat.tick(1 / 60, player);
  combat.setEnabled(false, player);
  assert.equal(combat.defeated, false);
  assert.equal(combat.shield, 100);
});

test('real city spawns are separated, collision free and reachable in every district', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/assets/models/manifest.json', import.meta.url), 'utf8'));
  const nav = new Navigation(manifest.obstacles, 0.43);
  for (const district of WORLD.districts) {
    let player: Vec2 | undefined;
    for (let r = 0; r < 7 && !player; r += 0.8) for (let angle = 0; angle < Math.PI * 2; angle += 0.5) {
      const p = { x: district.center.x + Math.sin(angle) * r, z: district.center.z + Math.cos(angle) * r };
      if (nav.isFree(p)) { player = p; break; }
    }
    assert.ok(player, `${district.id} has a player spawn`);
    const combat = new Combat(nav);
    combat.setEnabled(true, player);
    assert.ok(combat.enemies.length >= 1, `${district.id} has a reachable encounter`);
    assert.ok(combat.enemies.length <= COMBAT_LIMITS.enemies);
    for (const enemy of combat.enemies) {
      assert.ok(nav.isFree(enemy), `${district.id}: ${enemy.id} is clear of structures and NPCs`);
      assert.ok(gap(player, enemy) >= 5.99);
      const path = nav.path(player, enemy);
      assert.ok(path.length > 0 && gap(path[path.length - 1], enemy) < 0.31, `${district.id}: ${enemy.id} is reachable`);
      for (const other of combat.enemies) if (other.id !== enemy.id) assert.ok(gap(enemy, other) >= 2.1);
    }
  }
});

test('enemy pursuit remains collision free with bounded continuous movement during long frames', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/assets/models/manifest.json', import.meta.url), 'utf8'));
  const nav = new Navigation(manifest.obstacles, 0.43);
  const player = { x: 3, z: 6 }, combat = new Combat(nav);
  combat.setEnabled(true, player);
  for (let n = 0; n < 360; n++) {
    const previous = new Map(combat.enemies.map(e => [e.id, { x: e.x, z: e.z }]));
    combat.shield = 100; // Keep this traversal test running after simulated hits.
    combat.tick(0.25, player);
    for (const enemy of combat.enemies) {
      assert.ok(nav.isFree(enemy));
      assert.ok(gap(previous.get(enemy.id)!, enemy) <= COMBAT_LIMITS.enemySpeed * 0.25 + 1e-7);
      assert.ok(gap(enemy, player) >= 1.299);
    }
  }
});

test('identical input histories produce identical patrols, projectiles and damage', () => {
  const player = { x: 3, z: 6 };
  const a = new Combat(new Navigation([], 0.43));
  const b = new Combat(new Navigation([], 0.43));
  for (const combat of [a, b]) { combat.setEnabled(true, player); combat.toggleEquip(); }
  for (let n = 0; n < 720; n++) {
    for (const combat of [a, b]) {
      if (n % 25 === 0 && combat.enemies.length) combat.fire(player, combat.enemies[0]);
      combat.tick(1 / 60, player);
    }
  }
  const snapshot = (combat: Combat) => ({ enemies: combat.enemies, projectiles: combat.projectiles, shield: combat.shield, kills: combat.kills, defeated: combat.defeated, events: combat.drainEvents() });
  assert.deepEqual(snapshot(a), snapshot(b));
});

test('effect queues and projectiles remain bounded over sustained target practice', () => {
  const combat = new Combat(new Navigation([], 0.43));
  const player = { x: 0, z: 0 };
  combat.toggleEquip();
  for (let n = 0; n < 1200; n++) {
    combat.fire(player, { x: Math.sin(n) * 10, z: Math.cos(n) * 10 });
    combat.tick(0.25, player);
    assert.ok(combat.projectiles.length <= COMBAT_LIMITS.projectiles);
  }
  assert.ok(combat.drainEvents().length <= COMBAT_LIMITS.events);
  advance(combat, 2, player);
  assert.equal(combat.projectiles.length, 0);
  const before = { shield: combat.shield, cooldown: combat.cooldown };
  combat.tick(NaN, player); combat.tick(-1, player); combat.tick(1, { x: Infinity, z: 0 });
  assert.deepEqual({ shield: combat.shield, cooldown: combat.cooldown }, before);
});
