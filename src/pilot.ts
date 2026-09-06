/** Continuous arcade flight in the same city. All distances are world metres. */
export interface FlightPoint { x: number; y: number; z: number }
export interface GroundPoint { x: number; z: number }
export interface FlightPad extends FlightPoint { id: string; name: string; yaw: number; exit: GroundPoint }
export const FLIGHT_PADS: readonly FlightPad[] = Object.freeze([
  { id: 'drydock', name: 'Rebel Drydock', x: -61, y: .025, z: 1, yaw: Math.PI, exit: { x: -61, z: 6 } },
  { id: 'refuge', name: 'Rebel Refuge', x: 10, y: .025, z: -55, yaw: Math.PI, exit: { x: 10, z: -50 } },
]);
export const FLIGHT_LIMITS = Object.freeze({
  minX: -105, maxX: 90, minZ: -105, maxZ: 65,
  cruiseFloor: 18, ceiling: 60, maxSpeed: 40, cruiseSpeed: 26, climbSpeed: 8,
  turnRate: 1.3, enemies: 4, projectiles: 64, events: 96,
  playerBoltSpeed: 90, enemyBoltSpeed: 43, playerFireInterval: .23,
  landingRange: 32, landingSpeed: 18, enemyHealth: 68, playerDamage: 34, enemyDamage: 12,
});
export type PilotPhase = 'parked' | 'boarding' | 'takeoff' | 'flying' | 'landing' | 'emergency';
export interface PilotState extends FlightPoint {
  yaw: number; pitch: number; bank: number; speed: number; shield: number;
  phase: PilotPhase; padId: string | null;
}
export interface PilotInput { throttle?: number; turn?: number; rise?: number; boost?: boolean; fire?: boolean }
export interface ImperialShip extends FlightPoint {
  id: number; yaw: number; pitch: number; bank: number; speed: number;
  health: number; maxHealth: number; state: 'patrol' | 'attack';
}
export interface FlightProjectile extends FlightPoint {
  id: number; owner: 'player' | 'empire'; dx: number; dy: number; dz: number;
  speed: number; age: number; lifetime: number;
}
export interface PilotEvent extends FlightPoint {
  type: 'boarded' | 'takeoff' | 'fire' | 'hit' | 'enemy-down' | 'emergency' | 'landed' | 'repaired' | 'notice';
  owner?: 'player' | 'empire'; shipId?: number; shield?: number; padId?: string;
  disembarkPoint?: GroundPoint; emergency?: boolean; text?: string;
}
interface EnemyBrain { fireIn: number; orbit: number; anchor: FlightPoint }
const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));
const inputAxis = (value?: number) => Number.isFinite(value) ? clamp(value!, -1, 1) : 0;
const finite = (p: GroundPoint) => Number.isFinite(p.x) && Number.isFinite(p.z);
const gap = (a: GroundPoint, b: GroundPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const gap3 = (a: FlightPoint, b: FlightPoint) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const heading = (yaw: number) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const approach = (value: number, target: number, delta: number) => value + clamp(target - value, -delta, delta);

/** Earliest segment/sphere hit. Fast bolts cannot tunnel through either fighter. */
function sphereContact(from: FlightPoint, to: FlightPoint, center: FlightPoint, radius: number): number | null {
  const x = from.x - center.x, y = from.y - center.y, z = from.z - center.z;
  const vx = to.x - from.x, vy = to.y - from.y, vz = to.z - from.z;
  const c = x * x + y * y + z * z - radius * radius;
  if (c <= 0) return 0;
  const a = vx * vx + vy * vy + vz * vz;
  if (a < 1e-12) return null;
  const b = 2 * (x * vx + y * vy + z * vz), discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

export class Pilot {
  readonly state: PilotState = { x: FLIGHT_PADS[0].x, y: FLIGHT_PADS[0].y, z: FLIGHT_PADS[0].z, yaw: FLIGHT_PADS[0].yaw, pitch: 0, bank: 0,
    speed: 0, shield: 100, phase: 'parked', padId: FLIGHT_PADS[0].id };
  ships: ImperialShip[] = [];
  projectiles: FlightProjectile[] = [];
  enemiesEnabled = true;
  kills = 0;
  landings = 0;
  private events: PilotEvent[] = [];
  private brains = new Map<number, EnemyBrain>();
  private respawns: number[] = [];
  private nextId = 1;
  private phaseTime = 0;
  private fireIn = 0;
  private landingPad: FlightPad | null = null;
  private landingStage: 'approach' | 'descent' = 'approach';
  private landingAltitude: number = FLIGHT_LIMITS.cruiseFloor;

  constructor() { this.populate(); }

  get aboard(): boolean { return this.state.phase !== 'parked'; }
  get airborne(): boolean { return this.aboard && this.state.phase !== 'boarding'; }
  get boardingPoint(): GroundPoint {
    const pad = FLIGHT_PADS.find(p => p.id === this.state.padId) ?? this.nearestPad.pad;
    return { ...pad.exit };
  }
  get nearestPad(): { pad: FlightPad; distance: number } {
    const pad = [...FLIGHT_PADS].sort((a, b) => gap(this.state, a) - gap(this.state, b))[0];
    return { pad, distance: gap(this.state, pad) };
  }
  get landingHint(): string {
    if (this.state.phase === 'parked') return `${this.nearestPad.pad.name} · E to board with your companion`;
    if (this.state.phase === 'boarding') return 'Boarding · your companions are coming aboard';
    if (this.state.phase === 'takeoff') return 'Lifting above the rooftops';
    if (this.state.phase === 'landing' || this.state.phase === 'emergency') return `${this.state.phase === 'emergency' ? 'Emergency return' : 'Autoland'} · ${this.landingPad?.name}`;
    const { pad, distance } = this.nearestPad;
    if (distance > FLIGHT_LIMITS.landingRange) return `${pad.name} · ${Math.round(distance)} m · approach within ${FLIGHT_LIMITS.landingRange} m to land`;
    if (this.state.speed > FLIGHT_LIMITS.landingSpeed) return `${pad.name} · hold S to slow below ${FLIGHT_LIMITS.landingSpeed} m/s`;
    return `L · Land at ${pad.name} · ${Math.round(distance)} m`;
  }
  boardingHint(player: GroundPoint, companion: GroundPoint): string {
    if (this.state.phase !== 'parked') return this.landingHint;
    if (!finite(player) || gap(player, this.boardingPoint) > 3.2) return `Approach the boarding ramp · ${Math.round(gap(player, this.boardingPoint))} m`;
    if (!finite(companion) || gap(player, companion) > 4.8 || gap(companion, this.boardingPoint) > 7) return 'Call your companion close before boarding';
    return 'E · Board your starfighter · companions travel with you';
  }
  canBoard(player: GroundPoint, companion: GroundPoint): boolean {
    return this.state.phase === 'parked' && finite(player) && finite(companion)
      && gap(player, this.boardingPoint) <= 3.2 && gap(player, companion) <= 4.8 && gap(companion, this.boardingPoint) <= 7;
  }
  board(player: GroundPoint, companion: GroundPoint): boolean {
    if (!this.canBoard(player, companion)) return false;
    this.repair(); this.state.phase = 'boarding'; this.phaseTime = 0; this.state.speed = 0;
    this.emit('boarded', { padId: this.state.padId!, text: 'Companions aboard. Preparing for takeoff.' });
    return true;
  }
  repair(): boolean {
    if (this.state.phase !== 'parked' || this.state.shield >= 100) return false;
    this.state.shield = 100;
    this.emit('repaired', { shield: 100, text: 'Drydock service restored your shields.' });
    return true;
  }
  requestLanding(): boolean {
    if (this.state.phase !== 'flying') return false;
    const { pad, distance } = this.nearestPad;
    if (distance > FLIGHT_LIMITS.landingRange || this.state.speed > FLIGHT_LIMITS.landingSpeed) {
      this.emit('notice', { text: this.landingHint }); return false;
    }
    this.beginLanding(pad, false); return true;
  }
  setEnemiesEnabled(enabled: boolean): void {
    if (enabled === this.enemiesEnabled) return;
    this.enemiesEnabled = enabled;
    this.ships = []; this.brains.clear(); this.respawns = [];
    this.projectiles = this.projectiles.filter(p => p.owner !== 'empire');
    if (enabled) this.populate();
  }
  drainEvents(): PilotEvent[] { const result = this.events; this.events = []; return result; }
  cameraPose(): { position: FlightPoint; target: FlightPoint } {
    const s = this.state, forward = heading(s.yaw);
    // A nearby aim point keeps the whole fighter above the flight controls and
    // tilts the chase view down toward the city instead of filling it with sky.
    return { position: { x: s.x - forward.x * 24, y: s.y + 17, z: s.z - forward.z * 24 },
      target: { x: s.x + forward.x * 4, y: s.y, z: s.z + forward.z * 4 } };
  }
  /** Call only while gameplay is active. Hidden-tab elapsed time is never replayed. */
  tick(dt: number, input: PilotInput = {}): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    let remaining = Math.min(dt, .1);
    const clean = { throttle: inputAxis(input.throttle), turn: inputAxis(input.turn), rise: inputAxis(input.rise),
      boost: input.boost === true, fire: input.fire === true };
    while (remaining > 1e-8) { const step = Math.min(1 / 60, remaining); this.step(step, clean); remaining -= step; }
  }
  private step(dt: number, input: Required<PilotInput>): void {
    this.phaseTime += dt; this.fireIn = Math.max(0, this.fireIn - dt);
    const s = this.state;
    if (s.phase === 'boarding' && this.phaseTime >= .85) {
      s.phase = 'takeoff'; this.phaseTime = 0;
      this.emit('takeoff', { text: 'Takeoff clearance. W accelerates; A and D steer.' });
    }
    if (s.phase === 'takeoff') {
      s.y = approach(s.y, FLIGHT_LIMITS.cruiseFloor, 6.8 * dt); s.speed = 6.8;
      s.pitch = 0; s.bank = 0;
      if (s.y >= FLIGHT_LIMITS.cruiseFloor) { s.phase = 'flying'; s.padId = null; s.speed = 8; this.phaseTime = 0; }
    } else if (s.phase === 'flying') this.fly(dt, input);
    else if (s.phase === 'landing' || s.phase === 'emergency') this.autoland(dt);
    if (this.enemiesEnabled) {
      for (const ship of this.ships) this.moveEnemy(ship, dt);
      this.respawns = this.respawns.map(t => t - dt);
      while (this.respawns.length && this.respawns[0] <= 0) { this.respawns.shift(); this.spawnEnemy(this.nextId, true); }
    }
    this.moveProjectiles(dt);
  }
  private fly(dt: number, input: Required<PilotInput>): void {
    const s = this.state, maximum = input.boost ? FLIGHT_LIMITS.maxSpeed : FLIGHT_LIMITS.cruiseSpeed;
    // Releasing W holds the selected speed; S can brake all the way to a hover.
    s.speed = clamp(s.speed + input.throttle * (input.throttle < 0 ? 17 : 11) * dt, 0, FLIGHT_LIMITS.maxSpeed);
    if (s.speed > maximum) s.speed = approach(s.speed, maximum, dt * 9);
    if (input.boost && input.throttle >= 0) s.speed = approach(s.speed, maximum, 9 * dt);
    s.yaw += input.turn * FLIGHT_LIMITS.turnRate * dt;
    s.yaw = Math.atan2(Math.sin(s.yaw), Math.cos(s.yaw));
    s.bank = approach(s.bank, -input.turn * .48, dt * 1.5);
    s.pitch = approach(s.pitch, -input.rise * .23 + input.throttle * -.025, dt);
    const forward = heading(s.yaw), dy = input.rise * FLIGHT_LIMITS.climbSpeed;
    const scale = Math.min(1, FLIGHT_LIMITS.maxSpeed / Math.max(1, Math.hypot(s.speed, dy)));
    s.x = clamp(s.x + forward.x * s.speed * scale * dt, FLIGHT_LIMITS.minX, FLIGHT_LIMITS.maxX);
    s.z = clamp(s.z + forward.z * s.speed * scale * dt, FLIGHT_LIMITS.minZ, FLIGHT_LIMITS.maxZ);
    s.y = clamp(s.y + dy * scale * dt, FLIGHT_LIMITS.cruiseFloor, FLIGHT_LIMITS.ceiling);
    if (input.fire && this.fireIn <= 0) this.firePlayer();
  }
  private beginLanding(pad: FlightPad, emergency: boolean): void {
    this.landingPad = pad; this.landingStage = 'approach';
    this.landingAltitude = Math.max(FLIGHT_LIMITS.cruiseFloor, this.state.y);
    this.state.phase = emergency ? 'emergency' : 'landing'; this.phaseTime = 0;
    // Entering the landing corridor removes old hostile bolts, preserving a safe return.
    this.projectiles = this.projectiles.filter(p => p.owner !== 'empire');
    if (emergency) this.emit('emergency', { padId: pad.id, text: `Shields failed. Returning to ${pad.name}.` });
    else this.emit('notice', { padId: pad.id, text: `Autoland engaged for ${pad.name}.` });
  }
  private autoland(dt: number): void {
    const s = this.state, pad = this.landingPad!;
    s.bank = approach(s.bank, 0, dt * 1.2); s.pitch = approach(s.pitch, 0, dt);
    const before = { x: s.x, y: s.y, z: s.z };
    if (this.landingStage === 'approach') {
      const distance = gap(s, pad), targetYaw = distance > .2 ? Math.atan2(pad.x - s.x, pad.z - s.z) : pad.yaw;
      s.yaw += clamp(angleDelta(s.yaw, targetYaw), -dt * 1.5, dt * 1.5);
      const step = Math.min(distance, (s.phase === 'emergency' ? 18 : 13) * dt);
      if (distance > 1e-8) { s.x += (pad.x - s.x) / distance * step; s.z += (pad.z - s.z) / distance * step; }
      s.y = approach(s.y, this.landingAltitude, dt * 5);
      if (gap(s, pad) < 1e-7 && Math.abs(s.y - this.landingAltitude) < .001) this.landingStage = 'descent';
    } else {
      s.yaw += clamp(angleDelta(s.yaw, pad.yaw), -dt * 1.2, dt * 1.2);
      s.y = approach(s.y, pad.y, dt * 4.8);
      if (s.y <= pad.y && Math.abs(angleDelta(s.yaw, pad.yaw)) < .01) {
        const emergency = s.phase === 'emergency';
        s.phase = 'parked'; s.padId = pad.id; s.bank = 0; s.pitch = 0; s.speed = 0;
        this.landings++; this.phaseTime = 0; this.landingPad = null;
        this.emit('landed', { padId: pad.id, disembarkPoint: { ...pad.exit }, emergency,
          text: emergency ? 'Safe on the deck. Board again when ready; the dock will repair your ship.' : `${pad.name}. Companions are ready to disembark.` });
      }
    }
    if (s.phase !== 'parked') s.speed = gap3(before, s) / dt;
  }
  private firePlayer(): void {
    if (this.projectiles.length >= FLIGHT_LIMITS.projectiles) return;
    this.fireIn = FLIGHT_LIMITS.playerFireInterval;
    const s = this.state, forward = heading(s.yaw);
    const muzzle = { x: s.x + forward.x * 3.8, y: s.y + .7, z: s.z + forward.z * 3.8 };
    let direction: FlightPoint = { x: forward.x, y: 0, z: forward.z };
    let selected: ImperialShip | undefined, best = Infinity;
    for (const ship of this.ships) {
      const distance = gap3(muzzle, ship), dot = ((ship.x - muzzle.x) * forward.x + (ship.z - muzzle.z) * forward.z) / Math.max(.001, distance);
      if (distance < 105 && distance > 2 && dot > Math.cos(.22) && distance < best) { selected = ship; best = distance; }
    }
    if (selected) {
      const enemyForward = heading(selected.yaw), lead = Math.min(.55, best / FLIGHT_LIMITS.playerBoltSpeed);
      direction = { x: selected.x + enemyForward.x * selected.speed * lead - muzzle.x,
        y: selected.y + .55 - muzzle.y, z: selected.z + enemyForward.z * selected.speed * lead - muzzle.z };
    }
    this.launch('player', muzzle, direction);
  }
  private launch(owner: FlightProjectile['owner'], origin: FlightPoint, direction: FlightPoint, shipId?: number): void {
    if (this.projectiles.length >= FLIGHT_LIMITS.projectiles) return;
    const length = Math.hypot(direction.x, direction.y, direction.z); if (length < .001) return;
    this.projectiles.push({ id: this.nextId++, owner, ...origin, dx: direction.x / length, dy: direction.y / length,
      dz: direction.z / length, speed: owner === 'player' ? FLIGHT_LIMITS.playerBoltSpeed : FLIGHT_LIMITS.enemyBoltSpeed,
      age: 0, lifetime: owner === 'player' ? 1.8 : 3 });
    this.emit('fire', { ...origin, owner, shipId });
  }
  private populate(): void { for (let i = 0; i < FLIGHT_LIMITS.enemies; i++) this.spawnEnemy(i, false); }
  private spawnEnemy(index: number, atEdge: boolean): void {
    if (!this.enemiesEnabled || this.ships.length >= FLIGHT_LIMITS.enemies) return;
    const anchors = [{ x: -43, y: 26, z: -16 }, { x: -20, y: 31, z: -49 }, { x: 22, y: 25, z: -28 }, { x: 44, y: 34, z: 13 }];
    const anchor = anchors[index % anchors.length], id = this.nextId++;
    let position = { ...anchor };
    if (atEdge) {
      const corners = [{ x: -101, z: -101 }, { x: 86, z: -101 }, { x: 86, z: 61 }, { x: -101, z: 61 }];
      const point = corners.sort((a, b) => gap(this.state, b) - gap(this.state, a))[0];
      position = { ...point, y: 32 + index % 4 * 3 };
    }
    this.ships.push({ id, ...position, yaw: Math.atan2(anchor.x - position.x, anchor.z - position.z), pitch: 0, bank: 0,
      speed: 17, health: FLIGHT_LIMITS.enemyHealth, maxHealth: FLIGHT_LIMITS.enemyHealth, state: 'patrol' });
    this.brains.set(id, { fireIn: 3 + index % 4 * .7, orbit: id * 1.7, anchor });
  }
  private moveEnemy(ship: ImperialShip, dt: number): void {
    const brain = this.brains.get(ship.id)!; brain.fireIn = Math.max(0, brain.fireIn - dt); brain.orbit += dt * .22;
    const s = this.state, hunting = s.phase === 'flying' && gap3(ship, s) < 115;
    ship.state = hunting ? 'attack' : 'patrol';
    let target: FlightPoint;
    if (hunting) {
      const forward = heading(s.yaw), distance = gap3(ship, s), escape = distance < 18;
      target = escape ? { x: ship.x + Math.sin(ship.yaw + .7) * 25, y: clamp(s.y + 6, 20, 55), z: ship.z + Math.cos(ship.yaw + .7) * 25 }
        : { x: s.x + forward.x * s.speed * .55, y: s.y + 1.2, z: s.z + forward.z * s.speed * .55 };
    } else target = { x: brain.anchor.x + Math.sin(brain.orbit) * 22, y: brain.anchor.y + Math.sin(brain.orbit * .7) * 3,
      z: brain.anchor.z + Math.cos(brain.orbit) * 22 };
    const turn = clamp(angleDelta(ship.yaw, Math.atan2(target.x - ship.x, target.z - ship.z)), -dt * 1.1, dt * 1.1);
    ship.yaw += turn; ship.bank = approach(ship.bank, -turn / dt * .4, dt * 1.8);
    ship.speed = approach(ship.speed, hunting ? 22 : 17, dt * 5);
    const forward = heading(ship.yaw), dy = clamp(target.y - ship.y, -5, 5);
    ship.pitch = approach(ship.pitch, -dy * .035, dt);
    ship.x = clamp(ship.x + forward.x * ship.speed * dt, FLIGHT_LIMITS.minX, FLIGHT_LIMITS.maxX);
    ship.z = clamp(ship.z + forward.z * ship.speed * dt, FLIGHT_LIMITS.minZ, FLIGHT_LIMITS.maxZ);
    ship.y = clamp(ship.y + dy * dt, 20, 57);
    const range = gap3(ship, s), alignment = ((s.x - ship.x) * forward.x + (s.z - ship.z) * forward.z) / Math.max(.01, range);
    if (hunting && range < 74 && range > 11 && alignment > .92 && brain.fireIn <= 0) {
      brain.fireIn = 2.8 + ship.id % 3 * .45;
      const playerForward = heading(s.yaw), lead = Math.min(.6, range / FLIGHT_LIMITS.enemyBoltSpeed * .55);
      this.launch('empire', { x: ship.x + forward.x * 2, y: ship.y + .5, z: ship.z + forward.z * 2 },
        { x: s.x + playerForward.x * s.speed * lead - ship.x, y: s.y + .6 - ship.y,
          z: s.z + playerForward.z * s.speed * lead - ship.z }, ship.id);
    }
  }
  private moveProjectiles(dt: number): void {
    const survivors: FlightProjectile[] = [];
    for (const bolt of this.projectiles) {
      const travel = bolt.speed * Math.min(dt, bolt.lifetime - bolt.age);
      const next = { x: bolt.x + bolt.dx * travel, y: bolt.y + bolt.dy * travel, z: bolt.z + bolt.dz * travel };
      let contact: number | null = null, enemy: ImperialShip | undefined;
      if (bolt.owner === 'player') {
        for (const ship of this.ships) {
          const t = sphereContact(bolt, next, { ...ship, y: ship.y + .6 }, 2.35);
          if (t !== null && (contact === null || t < contact)) { contact = t; enemy = ship; }
        }
      } else if (this.state.phase === 'flying') contact = sphereContact(bolt, next, { ...this.state, y: this.state.y + .6 }, 2.1);
      if (contact !== null) {
        const at = { x: bolt.x + (next.x - bolt.x) * contact, y: bolt.y + (next.y - bolt.y) * contact, z: bolt.z + (next.z - bolt.z) * contact };
        if (enemy) {
          enemy.health = Math.max(0, enemy.health - FLIGHT_LIMITS.playerDamage);
          this.emit('hit', { ...at, owner: 'player', shipId: enemy.id, shield: enemy.health });
          if (!enemy.health) {
            this.kills++; this.ships = this.ships.filter(ship => ship.id !== enemy!.id); this.brains.delete(enemy.id);
            this.respawns.push(24); this.emit('enemy-down', { ...enemy, owner: 'player', shipId: enemy.id });
          }
        } else {
          this.state.shield = Math.max(0, this.state.shield - FLIGHT_LIMITS.enemyDamage);
          this.emit('hit', { ...at, owner: 'empire', shield: this.state.shield });
          if (!this.state.shield) this.beginLanding(this.nearestPad.pad, true);
        }
      } else if (bolt.age + dt < bolt.lifetime && (bolt.owner === 'player' || this.state.phase === 'flying')) {
        Object.assign(bolt, next); bolt.age += dt; survivors.push(bolt);
      }
    }
    this.projectiles = survivors.filter(bolt => bolt.owner === 'player' || this.state.phase === 'flying');
  }
  private emit(type: PilotEvent['type'], detail: Partial<PilotEvent> = {}): void {
    this.events.push({ x: this.state.x, y: this.state.y, z: this.state.z, ...detail, type });
    if (this.events.length > FLIGHT_LIMITS.events) this.events.splice(0, this.events.length - FLIGHT_LIMITS.events);
  }
}
