import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Expedition } from '../src/expedition.ts';
import { Campaign, CAMPAIGN_LOCATIONS as P } from '../src/campaign.ts';
import { CampaignCombat } from '../src/campaign-combat.ts';
import { CampaignUI } from '../src/campaign-ui.ts';
import { Combat } from '../src/combat.ts';
import { CityUI } from '../src/city-ui.ts';
import { GroguFollower } from '../src/grogu.ts';
import { Pilot, FLIGHT_PADS } from '../src/pilot.ts';
import { StreetBattle } from '../src/street-battle.ts';
import { Navigation, Simulation, type Obstacle, type Vec2 } from '../src/simulation.ts';

const manifest = JSON.parse(readFileSync(new URL('../public/assets/models/manifest.json', import.meta.url), 'utf8')) as { obstacles: Obstacle[] };
const point = (p: Vec2): Vec2 => ({ x: p.x, z: p.z });
const noop = () => {};

function rescuedCampaign(): Campaign {
  const campaign = new Campaign();
  for (const id of ['main-emberline', 'main-emberline', 'main-foundling', 'rescue-grogu']) {
    const marker = campaign.markers.find(m => m.id === id)!;
    assert.equal(campaign.interact(id, { player: marker }), true);
    campaign.skipCutscene();
  }
  campaign.drainEvents();
  return campaign;
}

function mission(campaign: Campaign, id: string): void {
  const marker = campaign.markers.find(m => m.id === id)!;
  assert.ok(marker, `missing mission marker ${id}`);
  assert.equal(campaign.interact(id, { player: marker }), true);
  campaign.skipCutscene();
}

function wardenCampaign(): Campaign {
  const campaign = rescuedCampaign();
  campaign.tick(1 / 60, { player: P.archive, grogu: P.archive });
  for (const id of ['main-foundling', 'main-relays', ...P.relays.map(r => r.id), 'main-relays', 'main-warden']) mission(campaign, id);
  campaign.drainEvents();
  return campaign;
}

function vaderCampaign(): Campaign {
  const campaign = wardenCampaign();
  campaign.tick(1 / 60, { player: P.arena, bossVictory: 'warden' });
  mission(campaign, 'main-warden');
  mission(campaign, 'main-skybreak');
  campaign.tick(1 / 60, { player: P.landing, flightKills: 3, landedAt: P.landing });
  mission(campaign, 'main-skybreak');
  mission(campaign, 'main-vader');
  campaign.drainEvents();
  return campaign;
}

function medicineCampaign(): Campaign {
  const campaign = wardenCampaign();
  for (const id of ['side-medicine', 'deliver-medicine', 'side-medicine']) mission(campaign, id);
  campaign.drainEvents();
  return campaign;
}

/** Keep the real coordinator, flight, navigation and follower logic; only the
 * DOM, audio and render hooks are replaced for this integration probe. */
function expeditionHarness(campaign = new Campaign()) {
  const simulation = new Simulation(manifest.obstacles);
  const nav = new Navigation(manifest.obstacles, .51);
  const combat = new Combat(simulation.playerNav);
  const battle = { enabled: true, standDown: noop };
  const camera = new THREE.PerspectiveCamera(35, 16 / 9, .15, 500);
  const notes: { title: string; text: string }[] = [];
  const ui = Object.assign(Object.create(CampaignUI.prototype), { open: false, current: campaign, selectedMarkerId: null, update: noop });
  const expedition = Object.assign(Object.create(Expedition.prototype), {
    campaign, boss: new CampaignCombat(), pilot: new Pilot(), grogu: new GroguFollower(nav), nav,
    ui, cinematic: { active: false, cameraPose: () => null, finish: noop },
    pilotView: { events: noop }, saveAge: 0, lastWeapon: 'cairn', lastPad: 'drydock', lastLanding: null,
    h: {
      camera, models: {}, keys: new Set<string>(), sim: () => simulation, combat: () => combat,
      battle: () => battle,
      hud: { note: (title: string, text: string) => notes.push({ title, text }) }, sound: { play: noop }, combatView: { setWeaponModel: noop },
      clearFire: noop, resetCamera: noop, closePanels: noop,
    },
  }) as Expedition;
  // The real constructor applies saved equipment after restoring positions.
  (expedition as unknown as { applyWeapon(): void }).applyWeapon();
  return { expedition, simulation, combat, battle, camera, notes };
}

function interactMission(fixture: ReturnType<typeof expeditionHarness>, id: string): void {
  const { expedition, simulation } = fixture;
  const marker = expedition.campaign.markers.find(m => m.id === id)!;
  assert.ok(marker, `missing interaction ${id}`);
  const approach = simulation.playerNav.path(simulation.player, marker).at(-1)!;
  assert.ok(approach && Math.hypot(approach.x - marker.x, approach.z - marker.z) <= 3);
  Object.assign(simulation.player, point(approach));
  expedition.ui.selectedMarkerId = id;
  assert.equal(expedition.interact(), true);
}

function flyRoundTrip(expedition: Expedition, simulation: Simulation): void {
  const ramp = expedition.pilot.boardingPoint;
  Object.assign(simulation.player, ramp);
  Object.assign(simulation.droid, { x: ramp.x - 1.6, z: ramp.z });
  expedition.pilot.setEnemiesEnabled(false);
  assert.equal(expedition.interact(), true);
  assert.equal(expedition.pilot.state.phase, 'boarding');
  for (let i = 0; i < 8 * 60 && expedition.pilot.state.phase !== 'flying'; i++) expedition.tick(1 / 60, false);
  assert.equal(expedition.pilot.state.phase, 'flying');
  assert.equal(expedition.pilot.requestLanding(), true);
  for (let i = 0; i < 20 * 60 && expedition.aboard; i++) expedition.tick(1 / 60, false);
  assert.equal(expedition.aboard, false);
  assert.equal(expedition.pilot.landings, 1);
  assert.deepEqual(point(simulation.player), FLIGHT_PADS[0].exit);
}

test('free flight before rescue leaves Grogu at his refuge through actual takeoff and landing', () => {
  const { expedition, simulation } = expeditionHarness();
  assert.deepEqual(point(expedition.grogu), P.grogu);
  flyRoundTrip(expedition, simulation);
  assert.equal(expedition.campaign.groguRescued, false);
  assert.deepEqual(point(expedition.grogu), P.grogu);
});

test('a rescued Grogu boards nearby and disembarks with the player after actual landing', () => {
  const { expedition, simulation } = expeditionHarness(rescuedCampaign());
  const ramp = expedition.pilot.boardingPoint;
  expedition.grogu.settle({ x: ramp.x + 2.5, z: ramp.z });
  flyRoundTrip(expedition, simulation);
  assert.equal(expedition.campaign.groguRescued, true);
  assert.deepEqual(point(expedition.grogu), { x: simulation.player.x + 1.6, z: simulation.player.z });
  assert.ok(simulation.droidNav.isFree(simulation.droid));
});

test('position restoration copies validated coordinates without importing arbitrary actor fields', () => {
  const { expedition, simulation } = expeditionHarness();
  const playerYaw = simulation.player.yaw, droidYaw = simulation.droid.yaw;
  const restored = expedition as unknown as { restorePosition(saved: unknown): void };
  restored.restorePosition({
    player: { x: 3, z: 5, yaw: 'broken', speed: 999, hidden: true },
    droid: { x: 1.5, z: 6, yaw: null, speed: 999, injected: { health: 0 } },
  });
  assert.deepEqual(simulation.player, { x: 3, z: 5, yaw: playerYaw, speed: 0 });
  assert.deepEqual(simulation.droid, { x: 1.5, z: 6, yaw: droidYaw, speed: 0 });
});

test('field repair with full shields preserves supplies and explains that no repair is needed', () => {
  const { expedition, notes } = expeditionHarness(rescuedCampaign());
  const resources = expedition.campaign.resources;
  expedition.repair();
  assert.deepEqual(expedition.campaign.resources, resources);
  assert.match(notes.at(-1)!.text, /already restored/);
});

test('a defeated boss directs the player to free checkpoint retry without charging or reviving', () => {
  const { expedition, simulation, notes } = expeditionHarness(rescuedCampaign());
  Object.assign(simulation.player, { x: 54, z: 26 });
  assert.equal(expedition.boss.start('warden', simulation.player, 'ionlance'), true);
  for (let i = 0; i < 70 * 60 && !expedition.boss.defeated; i++) expedition.boss.tick(1 / 60, simulation.player, simulation.playerNav);
  assert.equal(expedition.boss.defeated, true);
  const resources = expedition.campaign.resources;
  expedition.repair();
  assert.deepEqual(expedition.campaign.resources, resources);
  assert.equal(expedition.boss.shield, 0);
  assert.equal(expedition.boss.defeated, true);
  assert.match(notes.at(-1)!.text, /checkpoint.*free/);
});

test('affordable repairs restore damaged shields once, including a paused boss encounter', () => {
  for (const paused of [false, true]) {
    const { expedition, combat } = expeditionHarness(rescuedCampaign());
    combat.shield = 35;
    assert.equal(expedition.boss.start('warden', { x: 54, z: 26 }, 'ionlance', 20), true);
    expedition.boss.shield = 27;
    if (paused) expedition.boss.setEnabled(false);
    expedition.pilot.state.shield = 18;
    const before = expedition.campaign.resources;
    expedition.repair();
    assert.deepEqual(expedition.campaign.resources, { ...before, credits: before.credits - 20, cells: before.cells - 2 });
    assert.equal(combat.shield, 100);
    assert.equal(expedition.boss.shield, 120);
    assert.equal(expedition.boss.status, paused ? 'paused' : 'active');
    assert.equal(expedition.pilot.state.shield, 100);
    const repaired = expedition.campaign.resources;
    expedition.repair();
    assert.deepEqual(expedition.campaign.resources, repaired, 'a repeated full-shield repair charged again');
  }
});

test('unaffordable repairs do not change supplies or heal damaged shields', () => {
  const { expedition, combat } = expeditionHarness();
  combat.shield = 25;
  const before = expedition.campaign.resources;
  expedition.repair();
  assert.deepEqual(expedition.campaign.resources, before);
  assert.equal(combat.shield, 25);
});

test('an airborne fighter cannot spend field-repair supplies without landing', () => {
  const { expedition, notes } = expeditionHarness(rescuedCampaign());
  const ramp = expedition.pilot.boardingPoint;
  assert.equal(expedition.pilot.board(ramp, ramp), true);
  for (let i = 0; i < 8 * 60 && expedition.pilot.state.phase !== 'flying'; i++) expedition.pilot.tick(1 / 60);
  assert.equal(expedition.pilot.state.phase, 'flying');
  expedition.pilot.state.shield = 30;
  const before = expedition.campaign.resources;
  expedition.repair();
  assert.deepEqual(expedition.campaign.resources, before);
  assert.equal(expedition.pilot.state.shield, 30);
  assert.match(notes.at(-1)!.text, /Land at a pad/);
});

test('claiming the Warden reward clears its victory presentation while preserving the next chapter', () => {
  const { expedition, simulation } = expeditionHarness(wardenCampaign());
  Object.assign(simulation.player, P.arena);
  assert.equal(expedition.boss.start('warden', simulation.player, 'ionlance'), true);
  expedition.boss.status = 'victory';
  expedition.boss.boss!.health = 0;
  expedition.tick(1 / 60, false);
  assert.equal(expedition.campaign.currentQuest?.status, 'ready');
  assert.equal(expedition.boss.victory, 'warden', 'victory was cleared before its reward was claimed');
  assert.equal(expedition.interact(), true);
  assert.equal(expedition.campaign.currentQuest?.id, 'skybreak');
  assert.equal(expedition.boss.status, 'idle');
  assert.equal(expedition.boss.boss, null);
  assert.equal(expedition.bossEncounter, false);
  assert.equal(expedition.applyCamera(1 / 60, new THREE.Vector3()), false);
});

test('processing a new boss challenge preserves it when an old completed boss still shows victory', () => {
  const { expedition, simulation } = expeditionHarness(vaderCampaign());
  Object.assign(simulation.player, P.arena);
  assert.equal(expedition.boss.start('warden', simulation.player, 'ionlance'), true);
  expedition.boss.status = 'victory';
  expedition.boss.boss!.health = 0;
  assert.equal(expedition.interact(), true);
  assert.equal(expedition.boss.status, 'active');
  assert.equal(expedition.boss.boss?.kind, 'vader');
  assert.equal(expedition.campaign.currentQuest?.id, 'vader');
});

test('boss camera centers both actors and keeps them clear of the screen edges', () => {
  const { expedition, simulation, camera } = expeditionHarness();
  Object.assign(simulation.player, P.arena);
  assert.equal(expedition.boss.start('warden', simulation.player, 'ionlance'), true);
  for (const aspect of [16 / 9, .75]) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    for (const player of [P.arena, { x: 39, z: 10 }]) {
      Object.assign(simulation.player, player);
      const target = new THREE.Vector3();
      for (let i = 0; i < 120; i++) assert.equal(expedition.applyCamera(1 / 60, target), true);
      const boss = expedition.boss.boss!;
      assert.ok(target.distanceTo(new THREE.Vector3((player.x + boss.x) / 2, 1, (player.z + boss.z) / 2)) < .01);
      camera.updateMatrixWorld(true);
      for (const actor of [player, boss]) {
        const projected = new THREE.Vector3(actor.x, 1, actor.z).project(camera);
        assert.ok(Math.abs(projected.x) < .8 && Math.abs(projected.y) < .8, `actor clipped at aspect ${aspect}: ${projected.toArray()}`);
        assert.ok(projected.z > -1 && projected.z < 1);
      }
    }
  }
});

test('checkpoint retry respects the global enemy toggle and readies the selected weapon', () => {
  for (const enabled of [true, false]) {
    const { expedition, simulation, combat, battle } = expeditionHarness(vaderCampaign());
    Object.assign(simulation.player, P.arena);
    const weapon = expedition.campaign.equippedWeapon;
    assert.equal(expedition.boss.start('vader', simulation.player, weapon), true);
    expedition.boss.status = 'defeated';
    expedition.boss.shield = 0;
    combat.equipped = false;
    battle.enabled = enabled;
    expedition.setEnemies(enabled);
    const resources = expedition.campaign.resources;
    assert.equal(expedition.retryBoss(), true);
    assert.equal(expedition.boss.status, enabled ? 'active' : 'paused');
    assert.equal(expedition.boss.shield, expedition.boss.maxShield);
    assert.equal(combat.equipped, true);
    assert.equal(expedition.campaign.equippedWeapon.id, weapon.id);
    assert.deepEqual(expedition.campaign.resources, resources);
    if (!enabled) {
      expedition.fire(simulation.player, expedition.boss.boss!);
      assert.equal(expedition.boss.projectiles.length, 0, 'enemy-off retry permitted a boss-combat shot');
      const before = { ...expedition.boss.boss };
      for (let i = 0; i < 180; i++) expedition.boss.tick(1 / 60, simulation.player, simulation.playerNav);
      assert.deepEqual(expedition.boss.boss, before, 'enemy-off retry advanced the boss');
      battle.enabled = true;
      expedition.setEnemies(true);
    }
    expedition.fire(simulation.player, expedition.boss.boss!);
    assert.equal(expedition.boss.projectiles.length, 1);
    assert.equal(expedition.boss.projectiles[0].tier, weapon.tier);
    assert.equal(expedition.boss.projectiles[0].damage, weapon.damage);
  }
});

test('an unavailable checkpoint does not alter enemy or weapon state', () => {
  const { expedition, combat, battle } = expeditionHarness();
  battle.enabled = false;
  combat.equipped = false;
  assert.equal(expedition.retryBoss(), false);
  assert.equal(expedition.boss.status, 'idle');
  assert.equal(expedition.boss.boss, null);
  assert.equal(combat.equipped, false);
  assert.equal(battle.enabled, false);
});

test('claiming medicine raises on-foot shield capacity once and survives campaign restoration', () => {
  const fixture = expeditionHarness(wardenCampaign());
  const { expedition, combat } = fixture;
  combat.shield = 62;
  interactMission(fixture, 'side-medicine');
  interactMission(fixture, 'deliver-medicine');
  assert.equal(combat.maxShield, 100, 'delivery granted the upgrade before reward claim');
  assert.equal(combat.shield, 62);
  interactMission(fixture, 'side-medicine');
  assert.equal(expedition.campaign.shieldUpgrade, 20);
  assert.equal(combat.maxShield, 120);
  assert.equal(combat.shield, 82, 'the upgrade should add 20 while preserving existing damage');
  expedition.equip('cairn');
  expedition.equip('ionlance');
  assert.equal(combat.shield, 82, 'equipment synchronization repeatedly healed the player');
  assert.equal(expedition.pilot.state.shield, 100);

  const restored = expeditionHarness(new Campaign(expedition.campaign.save()));
  assert.equal(restored.combat.maxShield, 120);
  assert.equal(restored.combat.shield, 120);
  assert.equal(restored.expedition.campaign.shieldUpgrade, 20);
  assert.equal(restored.expedition.pilot.state.shield, 100);
  restored.expedition.reset();
  assert.equal(restored.combat.maxShield, 100);
  assert.equal(restored.combat.shield, 100);
});

test('medicine capacity persists through ordinary damage, recovery, paid repair and patrol resets', () => {
  const { expedition, simulation, combat } = expeditionHarness(medicineCampaign());
  const player = simulation.player;
  combat.setEnabled(true, player);
  combat.enemies = [];
  assert.equal(combat.shield, 120);
  combat.projectiles.push({ id: 9000, owner: 'enemy', x: player.x + .6, z: player.z, dx: -1, dz: 0, speed: 13.5, age: 0 });
  combat.tick(1 / 60, player);
  assert.equal(combat.shield, 106);
  for (let i = 0; i < 7 * 60; i++) combat.tick(1 / 60, player);
  assert.equal(combat.shield, 106, 'shield recovered before the quiet interval');
  for (let i = 0; i < 4 * 60; i++) combat.tick(1 / 60, player);
  assert.equal(combat.shield, 120);

  combat.shield = 110;
  const resources = expedition.campaign.resources;
  expedition.repair();
  assert.equal(combat.shield, 120, 'damage above the original 100 cap was not repaired');
  assert.deepEqual(expedition.campaign.resources, { ...resources, credits: resources.credits - 20, cells: resources.cells - 2 });
  combat.shield = 0;
  combat.defeated = true;
  new StreetBattle(combat.nav, combat).standDown();
  assert.equal(combat.shield, 120);
  assert.equal(combat.defeated, false);
  combat.shield = 15;
  combat.setEnabled(false, player);
  assert.equal(combat.shield, 120);
  combat.shield = 15;
  combat.restart(player);
  assert.equal(combat.shield, 120);
  assert.equal(combat.maxShield, 120);
});

test('medicine grants the same capacity to a real boss challenge, repair and checkpoint retry', () => {
  const fixture = expeditionHarness(medicineCampaign());
  const { expedition, simulation, combat } = fixture;
  interactMission(fixture, 'boss-warden');
  assert.equal(expedition.boss.maxShield, 120);
  assert.equal(expedition.boss.shield, 120);
  assert.equal(combat.maxShield, 120);
  for (let i = 0; i < 4 * 60; i++) expedition.boss.tick(1 / 60, simulation.player, simulation.playerNav);
  assert.ok(expedition.boss.shield > 0 && expedition.boss.shield < 120);
  const resources = expedition.campaign.resources;
  expedition.repair();
  assert.equal(expedition.boss.shield, 120);
  assert.deepEqual(expedition.campaign.resources, { ...resources, credits: resources.credits - 20, cells: resources.cells - 2 });
  expedition.boss.status = 'defeated';
  expedition.boss.shield = 0;
  assert.equal(expedition.retryBoss(), true);
  assert.equal(expedition.boss.maxShield, 120);
  assert.equal(expedition.boss.shield, 120);
  assert.equal(expedition.pilot.state.shield, 100);
});

test('ordinary shield HUD reports upgraded capacity and fills by the current/max ratio', () => {
  const { simulation, combat } = expeditionHarness(medicineCampaign());
  combat.shield = 90;
  const nodes = new Map<string, any>();
  const node = (selector: string) => {
    if (!nodes.has(selector)) nodes.set(selector, { style: {}, attributes: new Map<string, string>(), classList: { toggle: noop }, querySelectorAll: () => [], setAttribute(name: string, value: string) { this.attributes.set(name, value); } });
    return nodes.get(selector);
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { querySelector: node, documentElement: { classList: { toggle: noop } } } });
  try {
    const ui = Object.assign(Object.create(CityUI.prototype), { draw: noop, mapOpen: false });
    ui.update(simulation, combat, manifest.obstacles, false, new StreetBattle(combat.nav, combat), {});
    assert.equal(node('#shield-value').textContent, '90 / 120');
    assert.equal(node('#shield-fill').style.width, '75%');
    assert.equal(node('#shield-meter').attributes.get('aria-valuenow'), '90');
    assert.equal(node('#shield-meter').attributes.get('aria-valuemax'), '120');
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else delete (globalThis as { document?: unknown }).document;
  }
});
