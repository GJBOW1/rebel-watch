import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CityLife } from '../src/city-life.ts';
import { Navigation, type Vec2 } from '../src/simulation.ts';

const manifest = JSON.parse(readFileSync(new URL('../public/assets/models/manifest.json', import.meta.url), 'utf8'));
const gap = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const positions = (life: CityLife) => life.citizens.map(n => ({ id: n.id, x: n.x, z: n.z }));
function fixture() { return { life: new CityLife(manifest.obstacles), nav: new Navigation(manifest.obstacles, .34) }; }
function tick(life: CityLife, seconds: number, player: Vec2 = { x: 3, z: 6 }, droid: Vec2 = { x: 1.5, z: 7 }) {
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) life.tick(1 / 60, player, droid);
}
function talkPosition(nav: Navigation, n: Vec2) {
  for (let i = 0; i < 16; i++) {
    const p = { x: n.x + Math.cos(i * Math.PI / 8), z: n.z + Math.sin(i * Math.PI / 8) };
    if (nav.isFree(p) && nav.segmentClear(p, n)) return p;
  }
  throw new Error('No approach to citizen');
}

test('all 16 citizens wander collision-free with bounded continuous movement on the authored city', () => {
  const { life, nav } = fixture(), starting = positions(life);
  assert.equal(life.citizens.length, 16);
  assert.deepEqual(new Set(life.citizens.map(n => n.kind)), new Set(['citizen-human', 'citizen-twilek', 'droid-protocol', 'droid-astromech']));
  let last = positions(life);
  const maxTravel = new Map<number, number>();
  for (let frame = 0; frame < 120 * 60; frame++) {
    life.tick(1 / 60, { x: 3, z: 6 }, { x: 1.5, z: 7 }, [{ x: -2, z: -5 }, { x: -8, z: -34 }]);
    for (const [index, n] of life.citizens.entries()) {
      assert.ok(nav.isFree(n), `${n.name} crossed architecture at ${n.x}, ${n.z}`);
      const pace = n.kind === 'droid-astromech' ? 1.22 : 1.02;
      assert.ok(gap(n, last[index]) <= pace / 60 + 1e-7, `${n.name} snapped or exceeded walking speed`);
      maxTravel.set(n.id, Math.max(maxTravel.get(n.id) ?? 0, gap(n, starting[index])));
    }
    last = positions(life);
  }
  for (const n of life.citizens) assert.ok((maxTravel.get(n.id) ?? 0) > 2, `${n.name} never left their starting area`);
});

test('talking faces the player, stops locomotion, cycles the actual lines, and resumes', () => {
  const { life, nav } = fixture(), citizen = life.citizens[0], player = talkPosition(nav, citizen);
  const start = { x: citizen.x, z: citizen.z };
  const lines: string[] = [];
  for (let i = 0; i < 4; i++) {
    const result = life.talk(citizen.id, player);
    assert.ok(result);
    assert.match(result.title, new RegExp(citizen.name));
    lines.push(result.text);
  }
  assert.equal(new Set(lines.slice(0, 3)).size, 3);
  assert.equal(lines[0], lines[3]);
  assert.equal(life.conversations, 4);
  tick(life, 8.5, player);
  assert.equal(gap(citizen, start), 0);
  assert.equal(citizen.speed, 0);
  assert.ok(citizen.talking > 0);
  assert.ok(Math.abs(citizen.yaw - Math.atan2(player.x - citizen.x, player.z - citizen.z)) < 1e-7);
  tick(life, 5, { x: -10, z: 8 });
  assert.equal(citizen.talking, 0);
  assert.ok(gap(citizen, start) > 1, 'citizen never resumed their route');
});

test('a conversation expires while the player remains nearby, and leaving ends it early', () => {
  const { life, nav } = fixture(), citizen = life.citizens[0], player = talkPosition(nav, citizen);
  assert.ok(life.talk(citizen.id, player));
  tick(life, 9.1, player);
  assert.equal(citizen.talking, 0);
  assert.ok(life.talk(citizen.id, player));
  life.tick(1 / 60, { x: 25, z: 0 }, { x: 26, z: 0 });
  assert.equal(citizen.talking, 0);
});

test('civilian toggle freezes routes, hides interaction candidates, and rejects conversation', () => {
  const { life, nav } = fixture(), citizen = life.citizens[0], player = talkPosition(nav, citizen);
  assert.ok(life.nearby(player));
  tick(life, 3);
  const before = positions(life), conversations = life.conversations;
  life.enabled = false;
  tick(life, 30);
  assert.deepEqual(positions(life), before);
  assert.equal(life.nearby(player), undefined);
  assert.equal(life.talk(citizen.id, player), null);
  assert.equal(life.conversations, conversations);
  life.enabled = true;
  tick(life, 4);
  assert.ok(life.citizens.some((n, i) => gap(n, before[i]) > 1));
});

test('conversation requires a real citizen, proximity and an unobstructed route', () => {
  const { life } = fixture();
  assert.equal(life.talk(500, { x: 4, z: 5 }), null);
  assert.equal(life.talk(0, { x: 50, z: 0 }), null);
  const testLife = new CityLife([]), n = testLife.citizens[0];
  const wallLife = new CityLife([{ id: 'conversation-screen', x: n.x + .7, z: n.z, hx: .1, hz: 2 }]);
  assert.equal(wallLife.talk(0, { x: n.x + 1.4, z: n.z }), null);
  assert.equal(wallLife.conversations, 0);
});

test('suspended-frame input cannot cause civilian jumps', () => {
  const { life, nav } = fixture();
  tick(life, 3);
  const before = positions(life);
  life.tick(60, { x: 3, z: 6 }, { x: 1.5, z: 7 });
  for (const [i, n] of life.citizens.entries()) {
    assert.ok(gap(n, before[i]) <= 1.22 * .05 + 1e-7);
    assert.ok(nav.isFree(n));
  }
});

test('resident circulation keeps paused and walking bodies separated over repeated routes',()=>{
 const life=new CityLife(manifest.obstacles);
 for(let frame=0;frame<180*60;frame++){
  life.tick(1/60,{x:3,z:6},{x:1.5,z:7});
  for(const a of life.citizens)for(const b of life.citizens){
   if(a.id>=b.id)continue;
   const radius=(a.kind==='droid-astromech'?.49:.40)+(b.kind==='droid-astromech'?.49:.40);
   assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=radius-1e-4,`${a.name} overlaps ${b.name}`);
  }
 }
});
