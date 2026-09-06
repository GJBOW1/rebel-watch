import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Pilot, FLIGHT_PADS, FLIGHT_LIMITS, type PilotInput, type PilotEvent } from '../src/pilot.ts';
import { PilotView } from '../src/pilot-view.ts';

const gap = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const gap3 = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function advance(pilot: Pilot, seconds: number, input: PilotInput = {}) {
  for (let i = 0; i < Math.round(seconds * 60); i++) pilot.tick(1 / 60, input);
}
function launch(enemies = false) {
  const pilot = new Pilot(); pilot.setEnemiesEnabled(enemies);
  assert.ok(pilot.board(pilot.boardingPoint, pilot.boardingPoint));
  for (let i = 0; i < 6 * 60 && pilot.state.phase !== 'flying'; i++) pilot.tick(1 / 60);
  assert.equal(pilot.state.phase, 'flying'); return pilot;
}

test('the immediately available fighter only boards at its actual ramp with a nearby companion', () => {
  const pilot = new Pilot();
  assert.equal(pilot.state.phase, 'parked'); assert.equal(pilot.aboard, false);
  assert.equal(pilot.board({ x: 3, z: 6 }, { x: 3, z: 6 }), false);
  assert.equal(pilot.board(pilot.boardingPoint, { x: 50, z: 0 }), false);
  assert.match(pilot.boardingHint(pilot.boardingPoint, { x: 50, z: 0 }), /Call your companion/);
  assert.equal(pilot.board({ x: NaN, z: 0 }, pilot.boardingPoint), false);
  assert.equal(pilot.board(pilot.boardingPoint, pilot.boardingPoint), true);
  assert.equal(pilot.board(pilot.boardingPoint, pilot.boardingPoint), false);
  assert.equal(pilot.aboard, true); assert.equal(pilot.airborne, false);
  advance(pilot, .5); assert.equal(pilot.state.phase, 'boarding');
  assert.equal(pilot.state.y, FLIGHT_PADS[0].y);
  const events = pilot.drainEvents(); assert.equal(events.filter(e => e.type === 'boarded').length, 1);
});

test('takeoff and manual flight remain continuous, controllable and inside rooftop/sky bounds', () => {
  const pilot = new Pilot(); pilot.setEnemiesEnabled(false); pilot.board(pilot.boardingPoint, pilot.boardingPoint);
  let last = { ...pilot.state }, sawTakeoff = false;
  for (let frame = 0; frame < 40 * 60; frame++) {
    pilot.tick(1 / 60, { throttle: 1, turn: frame > 900 ? .23 : 0, rise: 1, boost: true });
    const s = pilot.state; sawTakeoff ||= s.phase === 'takeoff';
    assert.ok(gap3(last, s) <= FLIGHT_LIMITS.maxSpeed / 60 + 1e-7, 'fighter teleported');
    assert.ok([s.x, s.y, s.z, s.yaw, s.pitch, s.bank, s.speed].every(Number.isFinite));
    assert.ok(s.x >= FLIGHT_LIMITS.minX && s.x <= FLIGHT_LIMITS.maxX && s.z >= FLIGHT_LIMITS.minZ && s.z <= FLIGHT_LIMITS.maxZ);
    if (s.phase === 'flying') assert.ok(s.y >= FLIGHT_LIMITS.cruiseFloor && s.y <= FLIGHT_LIMITS.ceiling);
    last = { ...s };
  }
  assert.ok(sawTakeoff); assert.equal(pilot.state.y, FLIGHT_LIMITS.ceiling);
  advance(pilot, 6, { throttle: -1, rise: -1 });
  assert.equal(pilot.state.speed, 0); assert.equal(pilot.state.y, FLIGHT_LIMITS.cruiseFloor);
  const before = { ...pilot.state }; advance(pilot, 1, { turn: 1 });
  assert.ok(Math.abs(pilot.state.yaw - before.yaw) > 1); assert.equal(gap(before, pilot.state), 0, 'hover allows an in-place turn');
});

test('manual travel from drydock to refuge leads to a continuous landing and physical disembark event', () => {
  const pilot = launch(), pad = FLIGHT_PADS[1];
  let requested = false, landed: PilotEvent | undefined, last = { ...pilot.state };
  for (let frame = 0; frame < 45 * 60; frame++) {
    const desired = Math.atan2(pad.x - pilot.state.x, pad.z - pilot.state.z);
    const angle = Math.atan2(Math.sin(desired - pilot.state.yaw), Math.cos(desired - pilot.state.yaw));
    const distance = gap(pilot.state, pad);
    const input = { turn: Math.max(-1, Math.min(1, angle * 3)), throttle: Math.abs(angle) > .2 || distance < 30 ? -1 : 1 };
    if (!requested && distance < 30 && pilot.state.speed <= FLIGHT_LIMITS.landingSpeed) requested = pilot.requestLanding();
    pilot.tick(1 / 60, input);
    assert.ok(gap3(last, pilot.state) <= FLIGHT_LIMITS.maxSpeed / 60 + 1e-7);
    last = { ...pilot.state };
    landed = pilot.drainEvents().find(e => e.type === 'landed') ?? landed;
    if (landed) break;
  }
  assert.ok(requested && landed, 'could not navigate and land at refuge through normal inputs');
  assert.equal(landed.padId, 'refuge'); assert.equal(landed.emergency, false);
  assert.deepEqual(landed.disembarkPoint, { x: 10, z: -50 });
  assert.equal(pilot.state.phase, 'parked'); assert.equal(pilot.state.padId, 'refuge');
  assert.ok(gap3(pilot.state, pad) < 1e-7); assert.equal(pilot.aboard, false);
  assert.equal(pilot.landings, 1); assert.deepEqual(pilot.boardingPoint, pad.exit);
  assert.equal(pilot.kills, 0, 'landing does not fabricate a combat reward');
});

test('landing reports range and speed requirements and preserves the active controls after rejection', () => {
  const pilot = launch(); advance(pilot, 1.5, { throttle: 1 });
  assert.ok(pilot.state.speed > FLIGHT_LIMITS.landingSpeed);
  assert.equal(pilot.requestLanding(), false); assert.match(pilot.landingHint, /slow below/);
  advance(pilot, 2, { throttle: 1 });
  assert.ok(pilot.nearestPad.distance > FLIGHT_LIMITS.landingRange);
  assert.equal(pilot.requestLanding(), false); assert.match(pilot.landingHint, /approach within/);
  assert.equal(pilot.state.phase, 'flying');
  assert.ok(pilot.drainEvents().some(e => e.type === 'notice'));
});

test('two real forward laser hits destroy a moving Imperial fighter exactly once', () => {
  const pilot = launch(true), target = pilot.ships[0];
  pilot.ships = [target];
  Object.assign(target, { x: pilot.state.x, y: 20, z: pilot.state.z - 35, yaw: 0, speed: 17 });
  const events: PilotEvent[] = [];
  for (let frame = 0; frame < 3 * 60 && pilot.kills === 0; frame++) {
    pilot.tick(1 / 60, { throttle: -1, fire: true }); events.push(...pilot.drainEvents());
  }
  assert.equal(pilot.kills, 1); assert.equal(pilot.ships.length, 0);
  assert.equal(events.filter(e => e.type === 'enemy-down').length, 1);
  assert.equal(events.filter(e => e.type === 'hit' && e.owner === 'player').length, 2);
  assert.ok(events.filter(e => e.type === 'fire' && e.owner === 'player').length >= 2);
  advance(pilot, 3, { fire: true }); assert.equal(pilot.kills, 1, 'empty sky gives no kills');
  assert.ok(pilot.projectiles.length < 10);
});

test('the patrol does not attack a grounded ship and engages a real takeoff with bounded combat', () => {
  const pilot = new Pilot(); advance(pilot, 15);
  assert.equal(pilot.state.shield, 100); assert.equal(pilot.projectiles.length, 0);
  pilot.board(pilot.boardingPoint, pilot.boardingPoint);
  const events: PilotEvent[] = []; let last = new Map(pilot.ships.map(s => [s.id, { ...s }]));
  for (let frame = 0; frame < 50 * 60; frame++) {
    pilot.tick(1 / 60); events.push(...pilot.drainEvents());
    assert.ok(pilot.ships.length <= 4 && pilot.projectiles.length <= FLIGHT_LIMITS.projectiles);
    for (const s of pilot.ships) if (last.has(s.id)) assert.ok(gap3(s, last.get(s.id)!) < 24 / 60 + 1e-6, 'TIE teleported');
    last = new Map(pilot.ships.map(s => [s.id, { ...s }]));
  }
  assert.ok(events.some(e => e.type === 'fire' && e.owner === 'empire'), 'enemies never engaged the player');
  assert.ok(events.some(e => e.type === 'hit' && e.owner === 'empire'), 'enemy fire never damaged the ship');
});

test('enemy toggle clears sky combat and does not delete the player fighter, counters, or landings', () => {
  const pilot = launch(true); advance(pilot, 5, { fire: true });
  const state = { ...pilot.state }, kills = pilot.kills;
  pilot.setEnemiesEnabled(false);
  assert.equal(pilot.ships.length, 0); assert.equal(pilot.projectiles.filter(p => p.owner === 'empire').length, 0);
  assert.deepEqual(pilot.state, state); assert.equal(pilot.kills, kills);
  advance(pilot, 30); assert.equal(pilot.ships.length, 0);
  pilot.setEnemiesEnabled(true); pilot.setEnemiesEnabled(true);
  assert.equal(pilot.ships.length, FLIGHT_LIMITS.enemies);
});

test('shield failure returns continuously to a real dock, disembarks, and permits a repaired retry', () => {
  const pilot = launch(); advance(pilot, 4, { throttle: 1, turn: -.25 });
  const events: PilotEvent[] = [];
  for (let hit = 0; hit < 9; hit++) {
    pilot.projectiles.push({ id: 1000 + hit, owner: 'empire', x: pilot.state.x, y: pilot.state.y + .6, z: pilot.state.z,
      dx: 0, dy: 0, dz: 1, speed: 43, age: 0, lifetime: 2 });
    pilot.tick(1 / 60); events.push(...pilot.drainEvents());
  }
  assert.equal(pilot.state.shield, 0); assert.equal(pilot.state.phase, 'emergency');
  let last = { ...pilot.state };
  for (let frame = 0; frame < 40 * 60 && pilot.state.phase !== 'parked'; frame++) {
    pilot.tick(1 / 60, { throttle: 1, turn: 1, rise: 1, fire: true });
    assert.ok(gap3(last, pilot.state) < FLIGHT_LIMITS.maxSpeed / 60 + 1e-7); last = { ...pilot.state };
    events.push(...pilot.drainEvents());
  }
  assert.equal(pilot.state.phase, 'parked'); assert.equal(pilot.landings, 1); assert.equal(pilot.kills, 0);
  assert.equal(events.filter(e => e.type === 'emergency').length, 1);
  const landed = events.filter(e => e.type === 'landed'); assert.equal(landed.length, 1); assert.equal(landed[0].emergency, true);
  assert.ok(pilot.board(pilot.boardingPoint, pilot.boardingPoint)); assert.equal(pilot.state.shield, 100);
  advance(pilot, 4); assert.equal(pilot.state.phase, 'flying');
  assert.equal(pilot.drainEvents().filter(e => e.type === 'repaired').length, 1);
});

test('invalid timing, suspended tabs and repeated dock cycles cannot cause jumps or duplicate events', () => {
  const pilot = launch(), before = { ...pilot.state };
  for (const dt of [NaN, Infinity, -1, 0]) pilot.tick(dt, { throttle: 1 });
  assert.deepEqual(pilot.state, before);
  pilot.tick(300, { throttle: NaN, turn: Infinity, rise: NaN, fire: false });
  assert.ok(gap3(before, pilot.state) <= FLIGHT_LIMITS.maxSpeed * .1 + 1e-7);
  for (let cycle = 0; cycle < 6; cycle++) {
    advance(pilot, 1, { throttle: -1 }); assert.equal(pilot.requestLanding(), true);
    for (let frame = 0; frame < 15 * 60 && pilot.state.phase !== 'parked'; frame++) pilot.tick(1 / 60);
    assert.equal(pilot.state.phase, 'parked'); assert.equal(pilot.landings, cycle + 1);
    assert.equal(pilot.drainEvents().filter(e => e.type === 'landed').length, 1);
    assert.ok(pilot.board(pilot.boardingPoint, pilot.boardingPoint)); advance(pilot, 4);
  }
});

test('chase camera keeps the authored fighter above flight controls across headings and flight attitudes', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/assets/models/campaign-manifest.json', import.meta.url), 'utf8'));
  const bounds = manifest.assets['rebel-fighter'].bounds;
  const corners: THREE.Vector3[] = [];
  for (const x of [bounds.minX, bounds.maxX]) for (const y of [bounds.minY, bounds.maxY]) for (const z of [bounds.minZ, bounds.maxZ]) corners.push(new THREE.Vector3(x, y, z));
  const pilot = new Pilot();
  for (const aspect of [16 / 9, 4 / 3, .75]) {
    const camera = new THREE.PerspectiveCamera(35, aspect, .15, 500);
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) for (const altitude of [18, 25, 60]) {
      Object.assign(pilot.state, { x: -61, y: altitude, z: 1, yaw });
      const pose = pilot.cameraPose();
      camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
      camera.updateMatrixWorld(true);
      assert.ok(camera.getWorldDirection(new THREE.Vector3()).y < -.45, 'chase view points too close to the horizon to show the city');
      for (const pitch of [-.255, 0, .255]) for (const bank of [-.48, 0, .48]) {
        const transform = new THREE.Matrix4().compose(
          new THREE.Vector3(pilot.state.x, altitude, pilot.state.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, bank, 'YXZ')),
          new THREE.Vector3(1, 1, 1),
        );
        const level = pitch === 0 && bank === 0;
        for (const corner of corners) {
          const projected = corner.clone().applyMatrix4(transform).project(camera);
          const label = `aspect=${aspect}, yaw=${yaw}, pitch=${pitch}, bank=${bank}: ${projected.toArray()}`;
          assert.ok(Math.abs(projected.x) < .92, `fighter clipped at side: ${label}`);
          assert.ok(projected.y > -.8 && projected.y < .75, `fighter overlaps bottom controls or top HUD: ${label}`);
          // In level cruise, clear the landing hint as well as the bottom bar.
          if (level) assert.ok(projected.y > -.56, `level fighter overlaps landing HUD: ${label}`);
          assert.ok(projected.z > -1 && projected.z < 1, `fighter lies outside the camera depth range: ${label}`);
        }
      }
    }
  }
});

test('render pools remain bounded across fighter replacements, enemy toggles and repeated laser effects', () => {
  const scene = new THREE.Scene(), fighter = new THREE.Group(), tie = new THREE.Group();
  const engine = new THREE.Object3D(); engine.name = 'Engine_L'; fighter.add(engine);
  fighter.add(new THREE.Mesh(new THREE.BoxGeometry(3, 1, 8), new THREE.MeshStandardMaterial()));
  tie.add(new THREE.Mesh(new THREE.BoxGeometry(6, 4, 3), new THREE.MeshStandardMaterial()));
  const view = new PilotView(scene, { fighter, tie }), pilot = launch(true);
  view.update(pilot, 0); const initial = scene.children.length;
  for (let iteration = 0; iteration < 40; iteration++) {
    pilot.setEnemiesEnabled(false); view.update(pilot, iteration);
    pilot.setEnemiesEnabled(true); view.events(Array.from({ length: 20 }, () => ({ type: 'enemy-down' as const, x: 0, y: 20, z: 0 })));
    view.update(pilot, iteration + .01);
    assert.equal(scene.children.length, initial, 'TIE replacement leaked scene nodes');
    for (const node of scene.children) if (node instanceof THREE.InstancedMesh) assert.ok(node.count <= node.instanceMatrix.count);
  }
  pilot.setEnemiesEnabled(false); view.update(pilot, 45);
  assert.equal(scene.children.filter(node => node.name.startsWith('Imperial flight') && node.visible).length, 0);
});

test('normal flight inputs can defeat three unmodified patrol fighters and land at refuge', () => {
  const pilot = new Pilot(); pilot.board(pilot.boardingPoint, pilot.boardingPoint);
  const events: PilotEvent[] = []; let requested = false, last = { ...pilot.state };
  for (let frame = 0; frame < 90 * 60; frame++) {
    const fighting = pilot.kills < 3;
    const target = fighting ? [...pilot.ships].sort((a, b) => gap(a, pilot.state) - gap(b, pilot.state))[0] : FLIGHT_PADS[1];
    const desired = Math.atan2(target.x - pilot.state.x, target.z - pilot.state.z);
    const angle = Math.atan2(Math.sin(desired - pilot.state.yaw), Math.cos(desired - pilot.state.yaw));
    const distance = gap(target, pilot.state);
    if (!fighting && !requested && distance < 30 && pilot.state.speed <= FLIGHT_LIMITS.landingSpeed) requested = pilot.requestLanding();
    pilot.tick(1 / 60, { turn: Math.max(-1, Math.min(1, angle * 3)),
      throttle: Math.abs(angle) > (fighting ? .4 : .2) || distance < (fighting ? 32 : 30) ? -1 : 1,
      rise: fighting ? Math.max(-1, Math.min(1, (target.y - pilot.state.y) * .6)) : 0,
      fire: fighting && Math.abs(angle) < .3, boost: fighting && distance > 60 && Math.abs(angle) < .2 });
    assert.ok(gap3(last, pilot.state) <= FLIGHT_LIMITS.maxSpeed / 60 + 1e-7);
    assert.notEqual(pilot.state.phase, 'emergency'); last = { ...pilot.state };
    events.push(...pilot.drainEvents());
    if (pilot.landings) break;
  }
  assert.equal(pilot.kills, 3); assert.equal(pilot.landings, 1); assert.equal(pilot.state.padId, 'refuge');
  assert.equal(events.filter(e => e.type === 'enemy-down').length, 3);
  assert.equal(events.find(e => e.type === 'landed')?.emergency, false);
});
