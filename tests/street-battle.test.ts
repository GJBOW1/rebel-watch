import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Combat, COMBAT_LIMITS } from '../src/combat.ts';
import { StreetBattle } from '../src/street-battle.ts';
import { Navigation, WORLD, type Vec2 } from '../src/simulation.ts';
import { INTERIORS } from '../src/interiors.ts';

const manifest = JSON.parse(readFileSync(new URL('../public/assets/models/manifest.json', import.meta.url), 'utf8'));
const gap = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
function fixture(real = true, player = { x: 3, z: 6 }) {
  const nav = new Navigation(real ? manifest.obstacles : [], 0.43);
  if (!nav.isFree(player)) player = nav.path({ x: 3, z: 6 }, player).at(-1)!;
  const combat = new Combat(nav), battle = new StreetBattle(nav, combat);
  battle.setEnabled(true, player);
  return { nav, combat, battle, player };
}
function advance(f: ReturnType<typeof fixture>, seconds: number, indoors = false) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    f.battle.tick(1 / 60, f.player, indoors); f.combat.tick(1 / 60, f.player);
  }
}

test('ambient stormtrooper patrols are neutral until the player deliberately joins', () => {
  const f = fixture();
  assert.equal(f.battle.joined, false);
  assert.equal(f.combat.enemies.length, 6);
  const starts = f.combat.enemies.map(e => ({ ...e }));
  advance(f, 25);
  assert.equal(f.combat.shield, 100);
  assert.equal(f.combat.projectiles.length, 0);
  assert.ok(f.combat.enemies.every((e, i) => gap(e, starts[i]) > 3));
  assert.ok(!f.combat.drainEvents().some(e => e.type === 'fire'));
  assert.equal(f.battle.join(f.player), true);
  assert.equal(f.battle.playerHostile, true);
  assert.equal(f.combat.equipped, true);
  advance(f, 10);
  assert.ok(f.combat.drainEvents().some(e => e.type === 'fire' && e.owner === 'enemy'));
});

test('a natural Jedi encounter completes without observer damage, teleportation or collider crossings', () => {
  const f = fixture();
  let sawArrival = false, sawSkirmish = false, sawDeparture = false, sawDeflection = false, sawStrike = false;
  let lastTroopers = new Map<number, Vec2>(), lastJedi = new Map<number, Vec2>();
  for (let frame = 0; frame < 90 * 60; frame++) {
    f.battle.tick(1 / 60, f.player); f.combat.tick(1 / 60, f.player);
    sawArrival ||= f.battle.phase === 'arrival'; sawSkirmish ||= f.battle.phase === 'skirmish'; sawDeparture ||= f.battle.phase === 'departure';
    assert.ok(f.combat.enemies.length <= 6 && f.battle.guardians.length <= 2 && f.combat.projectiles.length <= COMBAT_LIMITS.projectiles);
    for (const e of f.combat.enemies) {
      assert.ok(f.nav.isFree(e), `trooper ${e.id} intersects architecture`);
      if (lastTroopers.has(e.id)) assert.ok(gap(e, lastTroopers.get(e.id)!) <= 2.1 / 60 + 1e-6, 'trooper relocated');
    }
    for (const g of f.battle.guardians) {
      assert.ok(f.nav.isFree(g), `Jedi ${g.id} intersects architecture`);
      if (lastJedi.has(g.id)) assert.ok(gap(g, lastJedi.get(g.id)!) <= 2.85 / 60 + 1e-6, 'Jedi relocated');
      sawDeflection ||= g.deflections > 0; sawStrike ||= g.swing > 0;
    }
    lastTroopers = new Map(f.combat.enemies.map(e => [e.id, { x: e.x, z: e.z }]));
    lastJedi = new Map(f.battle.guardians.map(g => [g.id, { x: g.x, z: g.z }]));
    assert.equal(f.combat.shield, 100);
  }
  assert.ok(sawArrival && sawSkirmish && sawDeparture && sawDeflection && sawStrike);
  assert.equal(f.battle.completedEncounters, 1);
  assert.equal(f.battle.phase, 'cooldown');
  assert.equal(f.combat.kills, 0, 'spectating does not receive credit for Jedi strikes');
});

test('automatic Jedi appearances wait for an unseen threshold, then enter continuously', () => {
  const f = fixture();
  f.battle.setVisibilityTest(() => true);
  advance(f, 43);
  assert.equal(f.battle.guardians.length, 0);
  f.battle.setVisibilityTest(() => false);
  advance(f, 2.1);
  assert.equal(f.battle.guardians.length, 2);
  assert.ok(f.battle.guardians.every(g => gap(g, f.player) > 8));
});

test('hitting a stormtrooper opts in; stand down protects against bolts already airborne', () => {
  const f = fixture(false, { x: -4, z: 0 });
  const e = f.combat.enemies[0]; f.combat.enemies = [e]; e.x = 3; e.z = 0;
  f.combat.toggleEquip();
  assert.equal(f.combat.fire(f.player, e), true);
  advance(f, 0.25);
  assert.equal(f.battle.joined, true);
  assert.equal(e.health, 33);
  f.combat.projectiles.push({ id: 998, owner: 'enemy', x: -3.4, z: 0, dx: -1, dz: 0, speed: 13.5, age: 0 });
  advance(f, 0.05);
  assert.equal(f.combat.shield, 86);
  f.combat.projectiles.push({ id: 999, owner: 'enemy', x: -3.4, z: 0, dx: -1, dz: 0, speed: 13.5, age: 0 });
  f.battle.standDown();
  advance(f, 0.05);
  assert.equal(f.combat.shield, 100);
  assert.equal(f.battle.joined, false);
  assert.ok(f.combat.enemies.length, 'observer mode preserves the street patrol');
});

test('Jedi intercept trooper bolts and defeat troopers through shared combat damage', () => {
  const f = fixture(false);
  assert.equal(f.battle.requestEncounter(f.player), true);
  const g = f.battle.guardians[0], e = f.combat.enemies[0];
  f.combat.projectiles.push({ id: 998, owner: 'enemy', x: g.x + 0.65, z: g.z, dx: -1, dz: 0, speed: 13.5, age: 0 });
  f.combat.tick(1 / 60, f.player);
  assert.equal(g.deflections, 1);
  assert.equal(g.health, 100);
  assert.ok(f.combat.drainEvents().some(e => e.type === 'ally-block' && e.allyId === g.id));
  f.combat.damageEnemy(e.id, 34); f.combat.damageEnemy(e.id, 34);
  assert.equal(e.health, 0); assert.equal(e.state, 'down');
  assert.equal(f.combat.kills, 0);
});

test('indoor scenes pause automatic encounter scheduling and reject manual street incidents', () => {
  for (const interior of INTERIORS) {
    const f = fixture(true, interior.center);
    assert.equal(f.battle.requestEncounter(f.player), false);
    advance(f, 40, true);
    assert.equal(f.battle.guardians.length, 0);
    assert.equal(f.battle.nextEncounterIn, 38);
    assert.equal(f.combat.shield, 100);
  }
});

test('trooper toggle clears every battle actor and threat and can restore ambient patrols', () => {
  const f = fixture();
  assert.equal(f.battle.requestEncounter(f.player), true);
  f.battle.join(f.player); advance(f, 3);
  f.battle.setEnabled(false, f.player);
  assert.equal(f.battle.guardians.length, 0);
  assert.equal(f.combat.enemies.length, 0);
  assert.equal(f.combat.projectiles.length, 0);
  assert.equal(f.combat.shield, 100);
  assert.equal(f.battle.joined, false);
  advance(f, 160);
  assert.equal(f.combat.enemies.length, 0);
  f.battle.setEnabled(true, f.player);
  assert.ok(f.combat.enemies.length > 0);
  assert.equal(f.battle.joined, false);
});

test('requested encounters enter through reachable gates in every large city district', () => {
  for (const district of WORLD.districts.filter(d => !['passage', 'ridge'].includes(d.id))) {
    const f = fixture(true, district.center);
    assert.equal(f.battle.requestEncounter(f.player), true, `${district.id} cannot create its encounter`);
    assert.equal(f.battle.guardians.length, 2);
    for (const g of f.battle.guardians) {
      const path = f.nav.path(g, f.player);
      assert.ok(path.length && gap(path[path.length - 1], f.player) < 0.4, `${district.id} gate is disconnected`);
    }
    advance(f, 50);
    assert.equal(f.combat.shield, 100);
    assert.ok(f.battle.completedEncounters >= 1, `${district.id} encounter did not resolve`);
  }
});

test('clearing a patrol before Jedi arrive resolves participation and schedules a peaceful interval', () => {
  const f=fixture();
  f.battle.join(f.player);
  for(const enemy of f.combat.enemies)f.combat.damageEnemy(enemy.id,enemy.maxHealth);
  f.combat.projectiles.push({id:998,owner:'enemy',x:f.player.x+.65,z:f.player.z,dx:-1,dz:0,speed:13.5,age:0});
  advance(f,1);
  assert.equal(f.battle.joined,false);
  assert.equal(f.battle.phase,'cooldown');
  assert.ok(f.battle.nextEncounterIn>100);
  assert.equal(f.combat.shield,100);
  assert.ok(f.battle.drainEvents().some(e=>e.type==='victory'));
  assert.ok(!f.combat.projectiles.some(p=>p.owner==='enemy'));
});
