/** Deterministic city gameplay. World units are metres; yaw 0 faces +Z. */
import layout from './world-layout.json';
import { INTERIOR_LANDMARKS, getInterior } from './interiors';

export const WORLD = layout;
export type Zone = 'courtyard' | 'passage' | 'ridge' | 'market' | 'salvage' | 'landing' | 'watch';
export interface WalkArea { minX: number; maxX: number; minZ: number; maxZ: number }
export const WALK_AREAS: WalkArea[] = [...layout.districts.map(d => d.bounds), ...layout.connections];
const inArea = (p: Vec2, r: WalkArea) => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ;
/** District overlaps favor the smaller downstream threshold; links change name halfway. */
export function getZone(p: Vec2): Zone {
  for (let i = layout.districts.length - 1; i >= 0; i--) {
    if (inArea(p, layout.districts[i].bounds)) return layout.districts[i].id as Zone;
  }
  const link = layout.connections.find(c => inArea(p, c));
  if (link) {
    const from = layout.districts.find(d => d.id === link.from)!, to = layout.districts.find(d => d.id === link.to)!;
    const axis = Math.abs(from.center.x - to.center.x) > Math.abs(from.center.z - to.center.z) ? 'x' : 'z';
    const middle = axis === 'x' ? (link.minX + link.maxX) / 2 : (link.minZ + link.maxZ) / 2;
    return ((p[axis] - middle) * (to.center[axis] - from.center[axis]) >= 0 ? link.to : link.from) as Zone;
  }
  // Public utility also handles camera/map probes just outside walkable boundaries.
  return [...layout.districts].sort((a, b) => {
    const d = (r: WalkArea) => Math.hypot(Math.max(r.minX - p.x, 0, p.x - r.maxX), Math.max(r.minZ - p.z, 0, p.z - r.maxZ));
    return d(a.bounds) - d(b.bounds);
  })[0].id as Zone;
}
export interface Vec2 { x: number; z: number }
export interface Obstacle extends Vec2 { id: string; hx: number; hz: number }
export interface Entity extends Vec2 { yaw: number; speed: number }
export interface SimInput { x: number; z: number; run: boolean }
export type Mode = 'follow' | 'call' | 'hold' | 'fetch' | 'return' | 'overwatch' | 'emote';
export type Emote = 'salute' | 'spin' | 'growl' | 'chirp';
export interface SimEvent { type: 'note' | 'sound' | 'bond' | 'objective' | 'threat'; title?: string; text?: string; sound?: string; value?: number }
const GRID = 0.4;
// Includes the hunter's shoulder plates and Tallow's widest stance, respectively.
const PLAYER_RADIUS = 0.42, DROID_RADIUS = 0.48;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const normalize = (x: number, z: number) => { const n = Math.hypot(x, z); return n > 1e-8 ? { x: x / n, z: z / n } : { x: 0, z: 0 }; };
const angularStep = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, t);
interface HeapEntry { id: number; priority: number }
class MinHeap {
  items: HeapEntry[] = [];
  push(item: HeapEntry) { let i = this.items.push(item) - 1; while (i > 0) { const p = (i - 1) >> 1; if (this.items[p].priority <= item.priority) break; this.items[i] = this.items[p]; i = p; } this.items[i] = item; }
  pop() { const first = this.items[0], tail = this.items.pop()!; if (this.items.length) { let i = 0; while (true) { let c = i * 2 + 1; if (c >= this.items.length) break; if (c + 1 < this.items.length && this.items[c + 1].priority < this.items[c].priority) c++; if (this.items[c].priority >= tail.priority) break; this.items[i] = this.items[c]; i = c; } this.items[i] = tail; } return first; }
}

/** Radius-aware A* on a static grid, followed by visibility pruning. */
export class Navigation {
  private free: Uint8Array;
  private nx: number;
  private nz: number;
  private originX: number;
  private originZ: number;
  constructor(public obstacles: Obstacle[], public radius: number, public walkAreas: WalkArea[] = WALK_AREAS) {
    this.originX = Math.min(...walkAreas.map(a => a.minX)); this.originZ = Math.min(...walkAreas.map(a => a.minZ));
    this.nx = Math.ceil((Math.max(...walkAreas.map(a => a.maxX)) - this.originX) / GRID) + 1;
    this.nz = Math.ceil((Math.max(...walkAreas.map(a => a.maxZ)) - this.originZ) / GRID) + 1;
    this.free = new Uint8Array(this.nx * this.nz);
    for (let z = 0; z < this.nz; z++) for (let x = 0; x < this.nx; x++) this.free[z * this.nx + x] = this.isFree(this.point(z * this.nx + x)) ? 1 : 0;
  }
  isFree(p: Vec2, radius = this.radius): boolean {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) return false;
    // Sample the capsule's circular cap against the union, including reentrant corners.
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8, x = p.x + Math.cos(a) * radius, z = p.z + Math.sin(a) * radius;
      if (!this.walkAreas.some(r => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)) return false;
    }
    for (const b of this.obstacles) if (Math.abs(p.x - b.x) < b.hx + radius && Math.abs(p.z - b.z) < b.hz + radius) return false;
    return true;
  }
  segmentClear(a: Vec2, b: Vec2, radius = this.radius): boolean {
    if (![a.x, a.z, b.x, b.z].every(Number.isFinite)) return false;
    const n = Math.max(1, Math.ceil(distance(a, b) / 0.09));
    for (let i = 0; i <= n; i++) { const t = i / n; if (!this.isFree({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, radius)) return false; }
    return true;
  }
  point(id: number): Vec2 { return { x: this.originX + (id % this.nx) * GRID, z: this.originZ + Math.floor(id / this.nx) * GRID }; }
  private nearestNode(p: Vec2, requireVisibility: boolean): number {
    const gx = clamp(Math.round((p.x - this.originX) / GRID), 0, this.nx - 1), gz = clamp(Math.round((p.z - this.originZ) / GRID), 0, this.nz - 1);
    let best = -1, score = Infinity;
    // Outside clicks still get clamped to a reachable point on the world.
    for (let ring = 0; ring < Math.max(this.nx, this.nz); ring++) {
      for (let z = Math.max(0, gz - ring); z <= Math.min(this.nz - 1, gz + ring); z++) for (let x = Math.max(0, gx - ring); x <= Math.min(this.nx - 1, gx + ring); x++) {
        if (Math.max(Math.abs(x - gx), Math.abs(z - gz)) !== ring) continue;
        const id = z * this.nx + x;
        if (!this.free[id]) continue;
        const q = this.point(id), d = distance(q, p);
        if (d < score && (!requireVisibility || this.segmentClear(p, q))) { best = id; score = d; }
      }
      if (best >= 0 && ring * GRID > score + GRID) return best;
    }
    return best;
  }
  path(start: Vec2, destination: Vec2): Vec2[] {
    if (![start.x, start.z, destination.x, destination.z].every(Number.isFinite)) return [];
    if (this.segmentClear(start, destination)) return [{ ...destination }];
    const a = this.nearestNode(start, true), b = this.nearestNode(destination, false);
    if (a < 0 || b < 0) return [];
    const target = this.point(b), g = new Float64Array(this.nx * this.nz).fill(Infinity), parent = new Int32Array(this.nx * this.nz).fill(-1), closed = new Uint8Array(this.nx * this.nz);
    const heap = new MinHeap(); g[a] = 0; heap.push({ id: a, priority: distance(this.point(a), target) });
    let closest = a, nearestDistance = distance(this.point(a), target);
    while (heap.items.length) {
      const current = heap.pop().id;
      if (closed[current]) continue;
      closed[current] = 1;
      const h = distance(this.point(current), target);
      if (h < nearestDistance) { closest = current; nearestDistance = h; }
      if (current === b) { closest = b; break; }
      const x = current % this.nx, z = Math.floor(current / this.nx);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dz) || x + dx < 0 || x + dx >= this.nx || z + dz < 0 || z + dz >= this.nz) continue;
        const next = (z + dz) * this.nx + x + dx;
        if (!this.free[next] || closed[next]) continue;
        if (dx && dz && (!this.free[z * this.nx + x + dx] || !this.free[(z + dz) * this.nx + x])) continue;
        const ng = g[current] + GRID * (dx && dz ? Math.SQRT2 : 1);
        if (ng < g[next]) { g[next] = ng; parent[next] = current; heap.push({ id: next, priority: ng + distance(this.point(next), target) }); }
      }
    }
    const raw: Vec2[] = []; let id = closest;
    while (id !== -1) { raw.push(this.point(id)); if (id === a) break; id = parent[id]; }
    raw.reverse();
    if (closest === b && this.segmentClear(target, destination)) raw.push({ ...destination });
    const output: Vec2[] = []; let anchor = start, i = 0;
    while (i < raw.length) { let far = i; while (far + 1 < raw.length && this.segmentClear(anchor, raw[far + 1])) far++; output.push(raw[far]); anchor = raw[far]; i = far + 1; }
    return output;
  }
  /** Continuous movement with collision subdivision and axis sliding; never snaps. */
  move(entity: Vec2, dx: number, dz: number): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.07)), sx = dx / steps, sz = dz / steps;
    for (let i = 0; i < steps; i++) {
      if (this.isFree({ x: entity.x + sx, z: entity.z + sz })) { entity.x += sx; entity.z += sz; }
      else {
        if (this.isFree({ x: entity.x + sx, z: entity.z })) entity.x += sx;
        if (this.isFree({ x: entity.x, z: entity.z + sz })) entity.z += sz;
      }
    }
  }
}

export class Simulation {
  player: Entity = { x: 3, z: 6, yaw: Math.PI, speed: 0 };
  droid: Entity = { x: 1.5, z: 7, yaw: Math.PI, speed: 0 };
  patrol: Entity = { x: 27.3, z: 3.2, yaw: Math.PI / 2, speed: 0.207 };
  mode: Mode = 'follow';
  bond = 18;
  token = { x: -8, z: -6, carried: false, collected: false };
  objectives = { token: false, escort: false, ridge: false };
  scanTime = 0;
  /** Targets inside the last scan cone; discovery rewards are once per target. */
  scanHits: string[] = [];
  scanned = new Set<string>();
  visitedZones = new Set<Zone>(['courtyard']);
  visitedInteriors = new Set<string>();
  emote: Emote | null = null;
  emoteTime = 0;
  ridgeProgress = 0;
  timeOfDay = 17.35;
  day = 1;
  elapsed = 0;
  readonly playerNav: Navigation;
  readonly droidNav: Navigation;
  private events: SimEvent[] = [];
  private playerPath: Vec2[] = [];
  private droidPath: Vec2[] = [];
  private lastTarget: Vec2 = { x: -999, z: -999 };
  private replanIn = 0;
  private velocity = { x: 0, z: 0 };
  private callHold = -1;
  private personalSpaceTarget: Vec2 | null = null;
  private overwatchPoint: Vec2 | null = null;
  private previousMode: 'hold' | 'follow' = 'follow';
  private lastZone: Zone = 'courtyard';
  private lastInterior: string | null = null;
  private threatCooldown = 0;
  private scanCooldown = 0;
  private emoteRewardCooldown = 0;
  private callRewardCooldown = 0;
  private ridgeNoteShown = false;
  constructor(obstacles: Obstacle[] = []) {
    this.playerNav = new Navigation(obstacles, PLAYER_RADIUS);
    this.droidNav = new Navigation(obstacles, DROID_RADIUS);
    const initial = layout.districts.find(d => d.id === this.zone)!;
    this.events.push({ type: 'note', title: initial.name, text: initial.note });
  }
  get zone(): Zone { return getZone(this.player); }
  get interior(): string | null { return getInterior(this.player)?.id ?? null; }
  get visitedCount() { return this.visitedZones.size; }
  get followDistance() { return 2.1 - this.bond * 0.007; }
  get ridgeFraction() { return Math.min(1, this.ridgeProgress / 18); }
  drainEvents(): SimEvent[] { const events = this.events; this.events = []; return events; }
  walkTo(point: Vec2) { this.playerPath = this.playerNav.path(this.player, point); }
  /** UI camera/emote modes call this when they take movement control. */
  cancelWalk(): void { this.playerPath = []; this.player.speed = 0; }
  private emitNote(title: string, text: string) { this.events.push({ type: 'note', title, text }); }
  private sound(sound: string) { this.events.push({ type: 'sound', sound }); }
  private trust(value: number) { const previous = this.bond; this.bond = clamp(this.bond + value, 0, 100); if (this.bond !== previous) this.events.push({ type: 'bond', value: this.bond - previous }); }
  private interrupt() {
    this.droidPath = []; this.replanIn = 0; this.callHold = -1; this.personalSpaceTarget = null;
    this.emote = null; this.emoteTime = 0;
    // A carried token remains physically on the droid. Follow resumes delivery.
  }
  command(command: 'call' | 'stay' | 'scan' | 'fetch' | 'overwatch') {
    if (command === 'scan') {
      if (this.scanCooldown > 0) return;
      this.scanTime = 2.25; this.scanCooldown = 2.7; this.sound('scan');
      this.scanHits = [];
      const targets = [
        { id: 'token', x: this.token.x, z: this.token.z, text: 'A lost ward-token answers beneath the rubble.' },
        ...layout.landmarks,
        ...INTERIOR_LANDMARKS.filter(landmark => landmark.interiorId === getInterior(this.droid)?.id),
      ];
      const found: string[] = [];
      for (const target of targets) {
        if (target.id === 'token' && (this.token.collected || this.token.carried)) continue;
        const dx = target.x - this.droid.x, dz = target.z - this.droid.z, range = Math.hypot(dx, dz);
        const facing = range < 0.01 ? 1 : (dx * Math.sin(this.droid.yaw) + dz * Math.cos(this.droid.yaw)) / range;
        if (range <= 6.2 && facing > 0.5) {
          this.scanHits.push(target.id); found.push(target.text);
          if (!this.scanned.has(target.id)) { this.scanned.add(target.id); this.trust(3); }
        }
      }
      this.emitNote('A Small Light, a Long Reach', found.length ? found.join(' ') : 'No signal in this arc. Turn my light toward what waits.');
      return;
    }
    if (command === 'fetch') {
      if (this.token.collected || this.mode === 'fetch' || this.mode === 'return') return;
      if (!this.token.carried && distance(this.player, this.token) > 3.25) { this.emitNote('Signal Too Faint', 'Come within reach of the marked scrap.'); return; }
      this.interrupt(); this.mode = this.token.carried ? 'return' : 'fetch'; this.sound('acknowledge');
      this.emitNote('Bring It Home', 'The smallest hands carry what the war forgot.'); return;
    }
    const oldMode = this.mode;
    this.interrupt();
    if (command === 'call') { this.mode = 'call'; this.sound('whistle'); }
    else if (command === 'stay') { this.mode = oldMode === 'hold' ? (this.token.carried ? 'return' : 'follow') : 'hold'; this.sound('acknowledge'); }
    else if (command === 'overwatch') {
      if (oldMode === 'overwatch') { this.mode = this.token.carried ? 'return' : 'follow'; this.overwatchPoint = null; return; }
      this.mode = 'overwatch';
      const forward = { x: Math.sin(this.player.yaw), z: Math.cos(this.player.yaw) };
      const candidates = [1, -1].flatMap(side => [2.1, 1.4, 0.8].map(r => ({ x: this.player.x + forward.z * side * r - forward.x * 0.4, z: this.player.z - forward.x * side * r - forward.z * 0.4 })));
      this.overwatchPoint = candidates.find(p => this.droidNav.isFree(p) && this.droidNav.path(this.droid, p).length > 0) ?? { x: this.droid.x, z: this.droid.z };
      this.sound('acknowledge'); this.emitNote('Eyes on the Silence', 'I keep the dark. You keep the road.');
    }
  }
  emoteAction(emote: Emote) {
    if (this.mode === 'emote') return;
    this.previousMode = this.mode === 'hold' ? 'hold' : 'follow';
    this.interrupt(); this.mode = 'emote'; this.emote = emote; this.emoteTime = emote === 'spin' ? 1.75 : 1.5;
    this.sound(emote);
  }
  tick(dt: number, input: SimInput = { x: 0, z: 0, run: false }) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Limit catchup after background-tab pauses without any position discontinuity.
    let remaining = Math.min(dt, 0.25);
    while (remaining > 1e-8) { const step = Math.min(remaining, 1 / 60); this.step(step, input); remaining -= step; }
  }
  private step(dt: number, input: SimInput) {
    this.elapsed += dt;
    this.scanTime = Math.max(0, this.scanTime - dt); this.scanCooldown = Math.max(0, this.scanCooldown - dt);
    this.threatCooldown = Math.max(0, this.threatCooldown - dt); this.emoteRewardCooldown = Math.max(0, this.emoteRewardCooldown - dt); this.callRewardCooldown = Math.max(0, this.callRewardCooldown - dt);
    this.replanIn -= dt;
    const before = { x: this.player.x, z: this.player.z };
    let direction = normalize(Number.isFinite(input.x) ? input.x : 0, Number.isFinite(input.z) ? input.z : 0);
    if (direction.x || direction.z) this.playerPath = [];
    else {
      while (this.playerPath.length && distance(this.player, this.playerPath[0]) < 0.12) this.playerPath.shift();
      if (this.playerPath.length) direction = normalize(this.playerPath[0].x - this.player.x, this.playerPath[0].z - this.player.z);
    }
    const speed = input.run ? 5.2 : 3;
    const travel = this.playerPath.length ? Math.min(speed * dt, distance(this.player, this.playerPath[0])) : speed * dt;
    this.playerNav.move(this.player, direction.x * travel, direction.z * travel);
    this.player.speed = distance(before, this.player) / dt;
    if (this.player.speed > 0.02) this.player.yaw = Math.atan2(this.player.x - before.x, this.player.z - before.z);
    this.updateDroid(dt);
    if (this.token.carried) { this.token.x = this.droid.x; this.token.z = this.droid.z; }
    const t = this.elapsed * 0.18;
    this.patrol.x = 27.3 + Math.sin(t) * 1.15; this.patrol.z = Math.cos(t) * 3.2; this.patrol.yaw = Math.atan2(Math.cos(t) * 1.15, -Math.sin(t) * 3.2);
    this.patrol.speed = Math.hypot(Math.cos(t) * 1.15, Math.sin(t) * 3.2) * 0.18;
    if (this.mode === 'overwatch' && distance(this.droid, this.patrol) < 8 && this.threatCooldown <= 0) {
      this.events.push({ type: 'threat', title: 'Movement on the Ridge', text: 'A watchman crosses the far light.' }); this.sound('threat'); this.threatCooldown = 8;
    }
    this.updateWorld(dt);
  }
  private updateDroid(dt: number) {
    if (this.mode === 'emote') {
      this.emoteTime = Math.max(0, this.emoteTime - dt);
      if (this.emote === 'spin') this.droid.yaw += dt * Math.PI * 3.1;
      this.velocity.x = 0; this.velocity.z = 0; this.droid.speed = 0;
      if (this.emoteTime <= 0) {
        this.emote = null; this.mode = this.previousMode === 'hold' ? 'hold' : this.token.carried ? 'return' : 'follow';
        if (this.emoteRewardCooldown <= 0) { this.trust(3); this.emoteRewardCooldown = 15; }
      }
      return;
    }
    if (this.token.carried && this.mode === 'follow') this.mode = 'return';
    if (this.mode === 'hold') { this.velocity.x = 0; this.velocity.z = 0; this.droid.speed = 0; return; }
    // A hunter can stop directly on a fetch pickup or walk into a resting droid.
    // Reserve a readable silhouette by stepping out of that overlap, never snapping.
    const playerGap = distance(this.player, this.droid);
    const playerSightline = playerGap < 2.5 && this.droidNav.segmentClear(this.droid, this.player, 0.04);
    const canSeparate = playerSightline && (this.mode === 'follow' || this.mode === 'call' || this.mode === 'return');
    if (canSeparate && (playerGap < 0.96 || (this.personalSpaceTarget && playerGap < 1.12))) {
      if (!this.personalSpaceTarget || distance(this.personalSpaceTarget, this.player) < 1.13) {
        this.personalSpaceTarget = this.findPersonalSpace(); this.replanIn = 0; this.droidPath = [];
      }
      if (this.personalSpaceTarget && this.mode === 'call' && this.callHold < 0) {
        this.callHold = 1.2; this.sound(this.bond >= 65 ? 'warm-chirp' : 'chirp');
      }
    } else this.personalSpaceTarget = null;
    const separating = this.personalSpaceTarget !== null && canSeparate;
    let target: Vec2 = this.player;
    let stop = 0.16, maximumSpeed = 4.6;
    if (this.mode === 'follow') {
      stop = this.followDistance;
      const gap = distance(this.player, this.droid);
      maximumSpeed = gap > stop + 0.7 ? 6.4 : clamp((gap - stop) * 4 + this.player.speed * 0.8, 0, 6.4);
    } else if (this.mode === 'call') { stop = 0.95; maximumSpeed = 6.7; }
    else if (this.mode === 'fetch') { target = this.token; stop = 0.22; maximumSpeed = 4.8; }
    else if (this.mode === 'return') { stop = 1.05; maximumSpeed = 6.4; }
    else if (this.mode === 'overwatch') { target = this.overwatchPoint ?? this.droid; stop = 0.18; maximumSpeed = 4.8; }
    if (separating) { target = this.personalSpaceTarget!; stop = 0.065; maximumSpeed = 1.65; }
    const gap = distance(this.droid, target), visible = this.droidNav.segmentClear(this.droid, target);
    // Hunter shoulders are narrower than Tallow's stance. Within arrival range,
    // a clear sightline is enough; stepping toward the hunter still uses full clearance.
    const arrivedBesideHunter = target === this.player && playerSightline;
    if (gap <= stop && (visible || arrivedBesideHunter)) {
      this.droid.speed = 0; this.velocity.x = 0; this.velocity.z = 0; this.droidPath = [];
      if (separating) { this.personalSpaceTarget = null; this.replanIn = 0; return; }
      if (this.mode === 'fetch') { this.token.carried = true; this.mode = 'return'; this.replanIn = 0; this.sound('pickup'); }
      else if (this.mode === 'return') this.deliver();
      else if (this.mode === 'call') {
        if (this.callHold < 0) { this.callHold = 1.2; this.sound(this.bond >= 65 ? 'warm-chirp' : 'chirp'); }
        this.callHold -= dt;
        if (this.callHold <= 0) { this.mode = this.token.carried ? 'return' : 'follow'; if (this.callRewardCooldown <= 0) { this.trust(2); this.callRewardCooldown = 20; } }
      } else if (this.mode === 'overwatch') this.droid.yaw = angularStep(this.droid.yaw, Math.atan2(this.patrol.x - this.droid.x, this.patrol.z - this.droid.z), dt * 4);
      return;
    }
    // A called droid holds its arrival point for a beat even if the hunter keeps moving.
    if (this.mode === 'call' && this.callHold >= 0 && !separating) {
      this.droid.speed = 0; this.velocity.x = this.velocity.z = 0; this.callHold -= dt;
      if (this.callHold <= 0) { this.mode = this.token.carried ? 'return' : 'follow'; if (this.callRewardCooldown <= 0) { this.trust(2); this.callRewardCooldown = 20; } }
      return;
    }
    if (this.replanIn <= 0 && (distance(target, this.lastTarget) > 0.35 || !this.droidPath.length)) {
      this.droidPath = this.droidNav.path(this.droid, target); this.lastTarget = { ...target }; this.replanIn = 0.28;
    }
    while (this.droidPath.length && distance(this.droid, this.droidPath[0]) < 0.11) this.droidPath.shift();
    // Direct visibility permits responsive pursuit between A* refreshes.
    const waypoint = visible ? target : this.droidPath[0];
    if (!waypoint) { this.droid.speed = 0; this.velocity.x = this.velocity.z = 0; this.replanIn = 0; return; }
    const heading = normalize(waypoint.x - this.droid.x, waypoint.z - this.droid.z);
    const acceleration = Math.min(1, dt * 14);
    this.velocity.x += (heading.x * maximumSpeed - this.velocity.x) * acceleration;
    this.velocity.z += (heading.z * maximumSpeed - this.velocity.z) * acceleration;
    let dx = this.velocity.x * dt, dz = this.velocity.z * dt;
    const moveLength = Math.hypot(dx, dz), waypointGap = distance(this.droid, waypoint), remaining = visible ? Math.max(0, gap - stop + 0.025) : waypointGap;
    if (moveLength > remaining) { dx *= remaining / moveLength; dz *= remaining / moveLength; }
    const before = { x: this.droid.x, z: this.droid.z };
    this.droidNav.move(this.droid, dx, dz);
    this.droid.speed = distance(this.droid, before) / dt;
    if (this.droid.speed > 0.02) this.droid.yaw = angularStep(this.droid.yaw, Math.atan2(this.droid.x - before.x, this.droid.z - before.z), dt * 12);
    if (this.droid.speed < 0.025 && maximumSpeed > 0.5) { this.replanIn = 0; this.droidPath = []; this.velocity.x = this.velocity.z = 0; }
  }
  private findPersonalSpace(): Vec2 | null {
    const gap = distance(this.player, this.droid);
    const away = gap > 0.04 ? Math.atan2(this.droid.x - this.player.x, this.droid.z - this.player.z) : this.player.yaw + Math.PI;
    const angles = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8].map(i => away + i * Math.PI / 8);
    const candidates: Vec2[] = [];
    for (const radius of [1.24, 1.5, 1.8]) for (const angle of angles) {
      const p = { x: this.player.x + Math.sin(angle) * radius, z: this.player.z + Math.cos(angle) * radius };
      if (!this.droidNav.isFree(p)) continue;
      if (this.droidNav.segmentClear(this.droid, p)) return p;
      candidates.push(p);
    }
    // Clutter can require a short path around a crate before opening the formation.
    for (const p of candidates) {
      const path = this.droidNav.path(this.droid, p);
      if (path.length && distance(path[path.length - 1], p) < 0.12) return p;
    }
    return null;
  }
  private deliver() {
    if (!this.token.carried || this.token.collected) { this.mode = 'follow'; return; }
    this.token.carried = false; this.token.collected = true; this.objectives.token = true; this.mode = 'follow';
    this.trust(24); this.sound('success');
    this.events.push({ type: 'objective', title: 'A Name Returned', text: 'Ward-token recovered. Take the service passage east.' });
  }
  private updateWorld(dt: number) {
    const zoneChanged = this.zone !== this.lastZone;
    const interior = getInterior(this.player), interiorChanged = (interior?.id ?? null) !== this.lastInterior;
    if (zoneChanged) {
      this.lastZone = this.zone;
      this.visitedZones.add(this.zone);
    }
    if (interiorChanged) {
      this.lastInterior = interior?.id ?? null;
      if (interior) this.visitedInteriors.add(interior.id);
    }
    if (interior && interiorChanged) this.emitNote(interior.name, interior.note);
    else if (!interior && (zoneChanged || interiorChanged)) {
      const district = layout.districts.find(d => d.id === this.zone)!;
      this.emitNote(district.name, district.note);
    }
    const throughGate = (p: Vec2) => p.x > 15.5 && p.x <= 29.5 && Math.abs(p.z) <= 2.6;
    if (this.objectives.token && !this.objectives.escort && throughGate(this.player) && throughGate(this.droid)) {
      this.objectives.escort = true; this.trust(18); this.sound('success');
      this.events.push({ type: 'objective', title: 'Two Through the Threshold', text: 'Companion escorted. Reach Emberwatch Ridge and hold until dusk.' });
    }
    const onRidge = (p: Vec2) => p.x > 25 && p.x <= 29.5 && Math.abs(p.z) <= 5.5;
    if (this.objectives.escort && !this.objectives.ridge && onRidge(this.player) && onRidge(this.droid)) {
      if (!this.ridgeNoteShown) { this.ridgeNoteShown = true; this.emitNote('Stand with the Fading Light', 'Eighteen breaths. No one stands watch alone.'); }
      this.ridgeProgress = Math.min(18, this.ridgeProgress + dt);
      if (this.ridgeProgress >= 18 - 1e-6) {
        this.objectives.ridge = true; this.ridgeProgress = 18; this.trust(25); this.sound('success');
        this.events.push({ type: 'objective', title: 'The Light We Keep', text: 'Dusk found two silhouettes. The watch is kept.' });
      }
    } else if (!this.objectives.ridge && this.ridgeProgress > 0) this.ridgeProgress = Math.max(0, this.ridgeProgress - dt * 0.5);
    this.timeOfDay = Math.min(18.5, 17.35 + this.elapsed / 3600 + this.ridgeFraction * 1.1);
    if (this.objectives.ridge) this.timeOfDay = 18.5;
  }
}
