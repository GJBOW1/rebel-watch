import test from 'node:test';
import assert from 'node:assert/strict';
import { AirTraffic, DOCKS, type Flight, type FlightPhase } from '../src/air-traffic.ts';
const gap3 = (a: Pick<Flight, 'x' | 'y' | 'z'>, b: Pick<Flight, 'x' | 'y' | 'z'>) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function tick(traffic: AirTraffic, seconds: number, bodies: { x: number; z: number; y?: number }[] = []) {
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) traffic.tick(1 / 60, bodies);
}
function until(traffic: AirTraffic, flight: Flight, phase: FlightPhase, bodies: { x: number; z: number; y?: number }[] = [], limit = 100) {
  for (let frame = 0; frame < limit * 60 && flight.phase !== phase; frame++) traffic.tick(1 / 60, bodies);
  assert.equal(flight.phase, phase, `flight never reached ${phase}`);
}

test('two staggered ships complete repeated approach, landing, docking and departure cycles continuously', () => {
  const traffic = new AirTraffic(), phases = traffic.flights.map(() => new Set<FlightPhase>());
  let last = traffic.flights.map(f => ({ ...f }));
  const landed = [0, 0], departed = [0, 0];
  for (let frame = 0; frame < 300 * 60; frame++) {
    traffic.tick(1 / 60);
    assert.equal(traffic.flights.length, 2);
    for (const [i, flight] of traffic.flights.entries()) {
      assert.ok([flight.x, flight.y, flight.z, flight.bank, flight.yaw, flight.thrust].every(Number.isFinite));
      assert.ok(flight.y >= flight.dock.y - 1e-7);
      assert.ok(flight.thrust >= 0 && flight.thrust <= 1);
      phases[i].add(flight.phase);
      // Waiting ships are not rendered. Continuous movement is required between
      // every pair of visible frames, including landing/takeoff phase transitions.
      if (flight.phase !== 'waiting' && last[i].phase !== 'waiting') assert.ok(gap3(flight, last[i]) < .17, `ship ${i} jumped during ${last[i].phase} -> ${flight.phase}`);
      if (flight.phase === 'docked') {
        assert.equal(flight.x, flight.dock.x); assert.equal(flight.z, flight.dock.z); assert.equal(flight.y, flight.dock.y);
      }
    }
    for (const event of traffic.drainEvents()) {
      const index = DOCKS.findIndex(d => d.name === event.name);
      assert.ok(index >= 0);
      if (event.type === 'landing') landed[index]++; else departed[index]++;
    }
    last = traffic.flights.map(f => ({ ...f }));
  }
  for (const [i, flight] of traffic.flights.entries()) {
    assert.deepEqual(phases[i], new Set(['waiting', 'approach', 'holding', 'landing', 'docked', 'takeoff', 'departure']));
    assert.ok(flight.landings >= 2 && flight.departures >= 2);
    assert.equal(landed[i], flight.landings); assert.equal(departed[i], flight.departures);
  }
});

test('an occupied rooftop delays landing until clear while street traffic below stays open', () => {
  const traffic = new AirTraffic(), flight = traffic.flights[0], dock = flight.dock;
  traffic.requestArrival(dock);
  const rooftopBody = { x: dock.x, y: dock.y, z: dock.z };
  tick(traffic, 35, [rooftopBody]);
  assert.equal(flight.phase, 'holding'); assert.equal(flight.landings, 0);
  assert.equal(flight.y, dock.y + 12);
  tick(traffic, 9, [{ x: dock.x, y: 0, z: dock.z }]);
  assert.equal(flight.phase, 'docked'); assert.equal(flight.landings, 1);
  assert.equal(flight.y, dock.y);
});

test('an obstruction that arrives during descent triggers a continuous climb and a fresh landing', () => {
  const traffic = new AirTraffic(), flight = traffic.flights[0], dock = flight.dock;
  traffic.requestArrival(dock);
  until(traffic, flight, 'landing');
  tick(traffic, 4);
  const body = { x: dock.x, y: dock.y, z: dock.z };
  const low = flight.y;
  assert.ok(low < dock.y + 8 && low > dock.y);
  let last = { ...flight };
  for (let frame = 0; frame < 7 * 60; frame++) {
    traffic.tick(1 / 60, [body]);
    assert.ok(gap3(flight, last) <= 4 / 60 + 1e-7, 'go-around jumped vertically');
    assert.ok(flight.y >= last.y - 1e-7, 'go-around continued descending into an occupant');
    last = { ...flight };
  }
  assert.equal(flight.phase, 'holding'); assert.equal(flight.landings, 0);
  tick(traffic, 9);
  assert.equal(flight.phase, 'docked'); assert.equal(flight.landings, 1);
  assert.equal(traffic.drainEvents().filter(e => e.type === 'landing' && e.name === dock.name).length, 1);
});

test('traffic toggle freezes every ship and arrival requests select the nearest dock', () => {
  const traffic = new AirTraffic();
  tick(traffic, 9);
  traffic.enabled = false;
  const snapshot = JSON.stringify(traffic.flights);
  tick(traffic, 80);
  assert.equal(JSON.stringify(traffic.flights), snapshot);
  traffic.enabled = true;
  tick(traffic, 2);
  assert.notEqual(JSON.stringify(traffic.flights), snapshot);
  const requested = new AirTraffic();
  requested.enabled = false;
  requested.requestArrival(DOCKS[1]);
  assert.equal(requested.enabled, true);
  assert.equal(requested.flights[1].time, 0);
  assert.equal(requested.flights[0].time, 4);
  tick(requested, 1 / 60);
  assert.equal(requested.flights[1].phase, 'approach');
  assert.equal(requested.flights.length, 2);
});

test('calling a docked ship expedites departure without duplicating its flight or events', () => {
  const traffic = new AirTraffic(), flight = traffic.flights[0];
  traffic.requestArrival(flight.dock);
  until(traffic, flight, 'docked');
  assert.equal(flight.time, 18);
  traffic.requestArrival(flight.dock);
  assert.equal(flight.time, 2);
  traffic.requestArrival(flight.dock);
  tick(traffic, 2.1);
  assert.equal(flight.phase, 'takeoff');
  assert.equal(flight.departures, 1);
  assert.equal(traffic.flights.length, 2);
  assert.equal(traffic.drainEvents().filter(e => e.type === 'takeoff' && e.name === flight.dock.name).length, 1);
});
