import test from 'node:test';
import assert from 'node:assert/strict';
import { CampaignCombat, BOSS_ARENA, BOSS_LIMITS, type BossKind } from '../src/campaign-combat.ts';
import { WEAPONS, type WeaponId } from '../src/campaign.ts';
import { Navigation, type Vec2, type Obstacle } from '../src/simulation.ts';
const nav = (obstacles: Obstacle[] = []) => new Navigation(obstacles, .43, [{ minX: 30, maxX: 80, minZ: 12, maxZ: 60 }]);
const gap = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
function advance(combat: CampaignCombat, seconds: number, player: Vec2, navigation = nav(), weapon: WeaponId = 'cairn') { for (let i = 0; i < seconds * 60; i++) combat.tick(1 / 60, player, navigation, weapon); }
function win(kind: BossKind, weapon: WeaponId) {
  const combat = new CampaignCombat(), navigation = nav(), player = { x: 54, z: 23 };
  combat.start(kind, player, weapon);
  let hits = 0, breaks = 0;
  for (let i = 0; i < 90 * 60 && combat.active; i++) {
    const boss = combat.boss!;
    // Real movement around the arena: dodge telegraphed target positions instead
    // of editing health or injecting victory into the combat system.
    const angle = i / 60 * .72;
    const target = { x: BOSS_ARENA.x + Math.sin(angle) * 10, z: BOSS_ARENA.z - Math.cos(angle) * 10 };
    const d = gap(player, target); if (d > .001) navigation.move(player, (target.x - player.x) / d * Math.min(d, 7 / 60), (target.z - player.z) / d * Math.min(d, 7 / 60));
    combat.fire(player, boss, weapon);
    const before = { x: boss.x, z: boss.z };
    combat.tick(1 / 60, player, navigation, weapon);
    assert.ok(navigation.isFree(boss));
    assert.ok(gap(before, boss) <= 1.85 / 60 + 1e-6);
    assert.ok(combat.projectiles.length <= BOSS_LIMITS.projectiles);
    for (const e of combat.drainEvents()) { if (e.type === 'shield-break') breaks++; if (e.type === 'boss-hit') hits++; }
  }
  assert.equal(combat.victory, kind, `${kind} could not be beaten with ${weapon}`);
  assert.ok(combat.shield > 0); assert.equal(breaks, 1); assert.ok(hits > 10);
  return combat;
}

test('main-path Ionlance and Ember Arc beat their bosses through real shots and dodges', () => {
  const warden = win('warden', 'ionlance'), vader = win('vader', 'overcharged-arc');
  assert.equal(warden.boss!.health, 0); assert.equal(vader.boss!.state, 'retreat');
  assert.equal(warden.projectiles.length, 0); assert.equal(vader.telegraphs.length, 0);
});

test('ordinary blasters cannot break either boss; tier-two weapons cannot defeat Vader', () => {
  for (const [kind, weapon] of [['warden', 'cairn'], ['vader', 'ionlance']] as const) {
    const combat = new CampaignCombat(), player = { x: 54, z: 23 }, navigation = nav();
    combat.start(kind, player, weapon);
    const original = { health: combat.boss!.health, shield: combat.boss!.shield };
    for (let i = 0; i < 12 * 60 && combat.active; i++) {
      const angle = i / 60 * .8; player.x = 54 + Math.sin(angle) * 10; player.z = 34 - Math.cos(angle) * 10;
      combat.fire(player, combat.boss!, weapon); combat.tick(1 / 60, player, navigation, weapon);
    }
    assert.equal(combat.boss!.health, original.health); assert.equal(combat.boss!.shield, original.shield);
    assert.ok(combat.drainEvents().some(e => e.type === 'blocked'));
  }
});

test('swept boss-projectile collision respects a very thin wall and immutable weapon power', () => {
  const combat = new CampaignCombat(), player = { x: 54, z: 26 };
  const navigation = nav([{ id: 'foil', x: 54, z: 30, hx: 7, hz: .001 }]);
  combat.start('warden', player, 'ionlance');
  combat.fire(player, combat.boss!, 'ionlance');
  advance(combat, .3, player, navigation, 'overcharged-arc');
  assert.equal(combat.boss!.shield, combat.boss!.maxShield);
  assert.ok(combat.drainEvents().some(e => e.type === 'impact'));
  const open = nav(); combat.cancel(); combat.start('vader', player, 'ionlance');
  combat.fire(player, combat.boss!, 'ionlance');
  advance(combat, .3, player, open, 'overcharged-arc');
  assert.equal(combat.boss!.shield, combat.boss!.maxShield, 'changing equipped weapon upgraded an airborne shot');
});

test('boss attacks warn before damage, lock their shape, and can be escaped', () => {
  const combat = new CampaignCombat(), player = { x: 54, z: 26 }, navigation = nav();
  combat.start('warden', player, 'ionlance');
  advance(combat, 2.2, player, navigation);
  assert.equal(combat.boss!.state, 'telegraph'); assert.equal(combat.shield, 100);
  const warning = { ...combat.telegraphs[0] };
  player.x += 8;
  advance(combat, .5, player, navigation);
  assert.equal(combat.telegraphs[0].yaw, warning.yaw);
  advance(combat, 1, player, navigation);
  assert.equal(combat.shield, 100);
  assert.ok(combat.drainEvents().some(e => e.type === 'attack'));
  const stationary = new CampaignCombat(), still = { x: 54, z: 26 };
  stationary.start('warden', still, 'ionlance'); advance(stationary, 3.5, still, navigation);
  assert.ok(stationary.shield < 100, 'remaining in a marked strike did not hurt');
});

test('defeat and retry restore only the boss checkpoint and respect optional shield upgrades', () => {
  const combat = new CampaignCombat(), player = { x: 54, z: 26 }, navigation = nav();
  combat.start('vader', player, 'overcharged-arc', 20);
  assert.equal(combat.maxShield, 120);
  advance(combat, 70, player, navigation);
  assert.equal(combat.status, 'defeated'); assert.equal(combat.victory, null);
  assert.equal(combat.fire(player, combat.boss!, 'overcharged-arc'), false);
  assert.equal(combat.retry(player, 'overcharged-arc'), true);
  assert.equal(combat.status, 'active'); assert.equal(combat.shield, 120);
  assert.equal(combat.boss!.health, combat.boss!.maxHealth);
  assert.equal(combat.boss!.shield, combat.boss!.maxShield);
  assert.ok(combat.drainEvents().some(e => e.type === 'retry'));
});

test('enemy-off pauses and clears attacks; cancellation cannot accidentally report victory', () => {
  const combat = new CampaignCombat(), player = { x: 54, z: 26 }, navigation = nav();
  combat.start('warden', player, 'ionlance'); advance(combat, 2.2, player, navigation);
  combat.fire(player, combat.boss!, 'ionlance'); combat.setEnabled(false);
  const before = JSON.stringify(combat.boss);
  assert.equal(combat.telegraphs.length, 0); assert.equal(combat.projectiles.length, 0);
  advance(combat, 30, player, navigation);
  assert.equal(JSON.stringify(combat.boss), before); assert.equal(combat.victory, null);
  combat.setEnabled(true); assert.equal(combat.active, true); advance(combat, .3, player, navigation);
  combat.cancel(); assert.equal(combat.status, 'idle'); assert.equal(combat.boss, null); assert.equal(combat.victory, null);
});

test('invalid inputs and long suspended frames cannot create unbounded boss state', () => {
  const combat = new CampaignCombat(), player = { x: 54, z: 26 }, navigation = nav();
  assert.equal(combat.start('warden', { x: NaN, z: 0 }), false);
  combat.start('warden', player, 'ionlance');
  assert.equal(combat.fire(player, player, 'ionlance'), false);
  assert.equal(combat.fire(player, { x: Infinity, z: 0 }, 'ionlance'), false);
  const before = JSON.stringify(combat.boss); combat.tick(NaN, player, navigation); assert.equal(JSON.stringify(combat.boss), before);
  const origin = { x: combat.boss!.x, z: combat.boss!.z }; combat.tick(60, player, navigation);
  assert.ok(gap(origin, combat.boss!) <= .25 * 1.85 + 1e-7);
  for (let i = 0; i < 500; i++) combat.fire(player, combat.boss!, { ...WEAPONS.cairn, damage: Infinity });
  assert.ok(combat.projectiles.length <= BOSS_LIMITS.projectiles);
});

test('retry remains available after the player retreats outside the initial challenge radius', () => {
  const encounter = new CampaignCombat();
  const player = {x:39,z:10};
  assert.ok(encounter.start('vader',{x:54,z:26},'overcharged-arc'));
  encounter.status='defeated'; encounter.shield=0;
  assert.ok(encounter.retry(player,'overcharged-arc'));
  assert.equal(encounter.status,'active');
  assert.equal(encounter.shield,encounter.maxShield);
  assert.deepEqual(player,{x:39,z:10});
});
