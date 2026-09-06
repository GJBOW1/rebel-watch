import { Combat, type CombatAlly, type CombatDirector, type CombatEnemy, type EnemyIntent } from './combat';
import { Navigation, WORLD, getZone, type Vec2 } from './simulation';
import { getInterior } from './interiors';

export type BattlePhase = 'patrol' | 'arrival' | 'skirmish' | 'departure' | 'cooldown';
export interface Guardian extends CombatAlly {
  yaw: number;
  speed: number;
  state: 'arriving' | 'advance' | 'guard' | 'strike' | 'leaving';
  saberColor: 'blue' | 'green';
  /** Seconds remaining in the strike animation. */
  swing: number;
  visible: boolean;
}
export interface StreetBattleEvent {
  type: 'notice' | 'join' | 'stand-down' | 'saber' | 'victory';
  title: string;
  text: string;
  x?: number;
  z?: number;
}
interface GuardianBrain { path: Vec2[]; replanIn: number; strikeIn: number; exit: Vec2; blocked: number }
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const finite = (p: Vec2) => Number.isFinite(p.x) && Number.isFinite(p.z);
const alive = (e: CombatEnemy) => e.health > 0;

/** An ambient skirmish that is safe to watch. It owns intentions only: the same
 * collision-aware Combat implementation moves and fires every stormtrooper.
 * Call tick before Combat.tick, once per simulation frame. No actor is relocated
 * after creation; arrivals and departures use the connected street navigation. */
export class StreetBattle implements CombatDirector {
  enabled = false;
  joined = false;
  phase: BattlePhase = 'patrol';
  guardians: Guardian[] = [];
  nextEncounterIn = 38;
  completedEncounters = 0;
  private guardianBrains = new Map<number, GuardianBrain>();
  private routePoints: Vec2[] = [];
  private routeIndices = new Map<number, number>();
  private events: StreetBattleEvent[] = [];
  private phaseTime = 0;
  private elapsed = 0;
  private player: Vec2 = { x: 3, z: 6 };
  private anchor: Vec2 = { x: 0, z: 0 };
  private pendingEncounter = false;
  private nextGuardianId = 1001;
  private isVisible: ((p: Vec2) => boolean) | null = null;

  constructor(public readonly nav: Navigation, public readonly combat: Combat) {
    combat.director = this;
  }

  get playerHostile(): boolean { return this.joined; }
  get allies(): Guardian[] { return this.guardians.filter(g => g.visible && g.health > 0); }

  /** Renderer visibility is optional; it lets automatic gate arrivals defer
   * until their entry threshold is outside the current camera view. */
  setVisibilityTest(test: (p: Vec2) => boolean): void { this.isVisible = test; }

  setEnabled(enabled: boolean, player: Vec2): void {
    if (!finite(player) || !this.nav.isFree(player)) return;
    this.player = { ...player };
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.joined = false;
    this.guardians = [];
    this.guardianBrains.clear();
    this.routeIndices.clear();
    this.phase = 'patrol'; this.phaseTime = 0; this.nextEncounterIn = 38;
    this.pendingEncounter = false;
    this.combat.setEnabled(false, player);
    if (enabled) {
      this.spawnPatrol(player);
      this.emit('notice', 'Imperial patrols', 'The patrol is passing through. Keep your distance, or choose a side.');
    } else this.emit('stand-down', 'Quiet streets', 'Patrols and skirmishes disabled.');
  }

  join(player: Vec2): boolean {
    if (!this.enabled || this.combat.defeated || !finite(player) || !this.combat.enemies.some(alive)) return false;
    this.player = { ...player };
    if (!this.joined) {
      this.joined = true;
      this.combat.equipped = true;
      this.emit('join', 'You have chosen a side', 'Stormtroopers now return your fire. J returns you to observer mode.');
    }
    return true;
  }

  /** Stop participating without removing the ambient encounter. Incoming bolts
   * cannot harm observers, including bolts already in flight when standing down. */
  standDown(): void {
    this.joined = false;
    this.combat.defeated = false;
    this.combat.shield = 100;
    this.combat.projectiles = this.combat.projectiles.filter(p => p.owner !== 'player');
    for (const e of this.combat.enemies) { e.telegraph = 0; e.state = e.health > 0 ? 'advance' : 'down'; }
    this.emit('stand-down', 'Observer mode', 'Let the street settle. You are safe from the crossfire.');
  }

  onPlayerAttack(_enemy: CombatEnemy): void { this.join(this.player); }

  requestEncounter(player: Vec2): boolean {
    if (!finite(player) || !this.nav.isFree(player)) return false;
    if (getInterior(player)) {
      this.emit('notice', 'The street is outside', 'Step outside to call in an encounter.');
      return false;
    }
    if (!this.enabled) this.setEnabled(true, player);
    if (this.phase === 'arrival' || this.phase === 'skirmish' || this.phase === 'departure') return false;
    this.player = { ...player };
    this.pendingEncounter = true;
    this.nextEncounterIn = 0;
    return this.beginEncounter(player, true);
  }

  drainEvents(): StreetBattleEvent[] { const events = this.events; this.events = []; return events; }

  intent(enemy: CombatEnemy, player: Vec2): EnemyIntent | null {
    if (!this.enabled) return null;
    const opponents: Vec2[] = [];
    if (this.joined && !this.combat.defeated && !getInterior(player)) opponents.push(player);
    if (this.phase === 'arrival' || this.phase === 'skirmish') opponents.push(...this.allies);
    if (opponents.length) {
      const nearest = opponents.sort((a, b) => distance(enemy, a) - distance(enemy, b))[0];
      return { target: nearest, aggressive: true };
    }
    if (!this.routePoints.length) return null;
    let index = this.routeIndices.get(enemy.id) ?? enemy.id % this.routePoints.length;
    if (distance(enemy, this.routePoints[index]) < 0.65 || distance(player, this.routePoints[index]) < 1.7) index = (index + 1) % this.routePoints.length;
    this.routeIndices.set(enemy.id, index);
    return { target: this.routePoints[index], aggressive: false };
  }

  tick(dt: number, player: Vec2, indoors = false): void {
    if (!Number.isFinite(dt) || dt <= 0 || !finite(player)) return;
    this.player = { ...player };
    if (!this.enabled) return;
    // Do not schedule absent gameplay time after browser suspension.
    let remaining = Math.min(dt, 0.25);
    while (remaining > 1e-8) {
      const step = Math.min(remaining, 1 / 60);
      this.step(step, player, indoors || !!getInterior(player));
      remaining -= step;
    }
  }

  private step(dt: number, player: Vec2, indoors: boolean): void {
    this.elapsed += dt; this.phaseTime += dt;
    if (this.combat.defeated && this.joined) {
      this.standDown();
      this.emit('notice', 'Take a breath', 'Your shield has recovered. The Jedi will hold the line.');
    }
    if (this.joined && (this.phase === 'patrol' || this.phase === 'cooldown') && !this.combat.enemies.some(alive)) {
      this.joined = false; this.phase = 'cooldown'; this.phaseTime = 0; this.nextEncounterIn = 105;
      this.combat.projectiles = this.combat.projectiles.filter(b => b.owner !== 'enemy');
      this.emit('victory', 'The patrol is defeated', 'Your part is done. The street settles around you.');
    }
    if (this.phase === 'patrol' || this.phase === 'cooldown') {
      if (!indoors) this.nextEncounterIn = Math.max(0, this.nextEncounterIn - dt);
      if (this.phase === 'cooldown' && this.phaseTime > 28 && !this.combat.enemies.length && !indoors) this.spawnPatrol(player, true);
      if (!indoors && this.nextEncounterIn <= 0) this.beginEncounter(player, this.pendingEncounter);
    }
    for (const guardian of this.guardians) this.updateGuardian(guardian, dt, player);
    if (this.phase === 'arrival' && this.guardians.some(g => this.combat.enemies.some(e => alive(e) && distance(e, g) < 11))) {
      this.phase = 'skirmish'; this.phaseTime = 0;
    }
    if ((this.phase === 'arrival' || this.phase === 'skirmish') && !this.combat.enemies.some(alive)) {
      this.phase = 'departure'; this.phaseTime = 0; this.completedEncounters++;
      this.joined = false;
      this.combat.projectiles = this.combat.projectiles.filter(b => b.owner !== 'enemy');
      for (const g of this.guardians) { g.state = 'leaving'; const brain = this.guardianBrains.get(g.id)!; brain.path = []; brain.replanIn = 0; }
      this.emit('victory', 'The street is clear', 'The Jedi lower their blades. For a little while, the road belongs to everyone.');
    }
    if (this.phase === 'departure' && this.guardians.every(g => !g.visible)) {
      this.guardians = []; this.guardianBrains.clear();
      this.phase = 'cooldown'; this.phaseTime = 0;
      this.nextEncounterIn = 105 + (this.completedEncounters % 3) * 11;
    }
  }

  private spawnPatrol(player: Vec2, offscreen = false): void {
    this.anchor = this.nearestOutdoorCenter(player);
    this.routePoints = this.ringPoints(this.anchor, [6.5, 4.1, 2.6], 12).slice(0, 12);
    // A request while indoors still stations the patrol in the surrounding street.
    const points = this.gatePoints(this.anchor).flatMap(g => this.ringPoints(g, [0, 1.2, 2.4], 8));
    const chosen: Vec2[] = [];
    for (const p of points) {
      if (distance(p, player) < (offscreen ? 13 : 4) || (offscreen && this.isVisible?.(p)) || chosen.some(q => distance(q, p) < 1.4)) continue;
      chosen.push(p); if (chosen.length === 6) break;
    }
    if (chosen.length < 6) for (const p of this.routePoints) {
      if (distance(p, player) < (offscreen ? 13 : 4) || (offscreen && this.isVisible?.(p)) || chosen.some(q => distance(q, p) < 1.4)) continue;
      chosen.push(p); if (chosen.length === 6) break;
    }
    this.combat.spawnPatrol(chosen, player);
  }

  private beginEncounter(player: Vec2, explicitlyRequested: boolean): boolean {
    if (getInterior(player)) return false;
    // A new patrol only appears at a gate after the previous group has gone.
    // Existing patrols walk toward the encounter; they are never repositioned.
    if (!this.combat.enemies.some(alive)) {
      if (this.combat.enemies.length) return false;
      this.spawnPatrol(player, !explicitlyRequested);
    }
    if (!this.combat.enemies.some(alive)) return false;
    const live = this.combat.enemies.filter(alive);
    const nearest = [...live].sort((a, b) => distance(a, player) - distance(b, player))[0];
    // Let a distant patrol walk back into the user's district before its incident.
    // Moving route destinations changes intention, never existing actor positions.
    if (distance(nearest, player) > 27) {
      const center = this.nearestOutdoorCenter(player);
      this.routePoints = this.ringPoints(center, [5, 3], 8);
      this.routeIndices.clear();
      return false;
    }
    const center = this.nearestOutdoorCenter(nearest);
    const gates = this.gatePoints(center).sort((a, b) => distance(a, nearest) - distance(b, nearest));
    const choices = gates.flatMap(g => this.ringPoints(g, [0, 1.15, 2.3], 8));
    const selected: Vec2[] = [];
    for (const p of choices) {
      if (distance(p, player) < (explicitlyRequested ? 5 : 13)) continue;
      if (!explicitlyRequested && this.isVisible?.(p)) continue;
      if (selected.some(q => distance(q, p) < 1.2) || live.some(e => distance(e, p) < 1.4)) continue;
      const path = this.nav.path(p, nearest);
      if (!path.length || distance(path[path.length - 1], nearest) > 0.4) continue;
      selected.push(p); if (selected.length === 2) break;
    }
    // Re-evaluate at a modest cadence while the camera covers every threshold.
    if (selected.length < 2) { this.nextEncounterIn = 2; return false; }
    this.guardians = selected.map((p, index) => ({ id: this.nextGuardianId++, ...p,
      yaw: Math.atan2(nearest.x - p.x, nearest.z - p.z), speed: 0, health: 100,
      deflect: true, deflections: 0, state: 'arriving', saberColor: index ? 'green' : 'blue', swing: 0, visible: true }));
    for (const guardian of this.guardians) this.guardianBrains.set(guardian.id, {
      path: [], replanIn: 0, strikeIn: 0.8, exit: { x: guardian.x, z: guardian.z }, blocked: 0,
    });
    this.phase = 'arrival'; this.phaseTime = 0; this.pendingEncounter = false;
    this.emit('notice', 'Two lights at the gate', 'Jedi have arrived. Watch from safety, or press J to stand with them.');
    return true;
  }

  private updateGuardian(g: Guardian, dt: number, player: Vec2): void {
    if (!g.visible || g.health <= 0) return;
    const brain = this.guardianBrains.get(g.id)!;
    brain.replanIn -= dt; brain.strikeIn = Math.max(0, brain.strikeIn - dt);
    g.swing = Math.max(0, g.swing - dt); g.speed = 0;
    const enemies = this.combat.enemies.filter(alive);
    const target = this.phase === 'departure' ? brain.exit : enemies.sort((a, b) => distance(g, a) - distance(g, b))[0];
    if (!target) { g.state = 'guard'; return; }
    const gap = distance(g, target);
    g.yaw += Math.atan2(Math.sin(Math.atan2(target.x - g.x, target.z - g.z) - g.yaw), Math.cos(Math.atan2(target.x - g.x, target.z - g.z) - g.yaw)) * Math.min(1, dt * 10);
    if (this.phase === 'departure' && gap < 0.4) {
      // Leave through the same threshold used for arrival. Holding at a visible
      // threshold is preferable to making an actor disappear under inspection.
      g.state = 'leaving';
      if (!this.isVisible || !this.isVisible(g) || distance(g, player) > 24) g.visible = false;
      return;
    }
    if (this.phase !== 'departure' && gap < 1.6 && this.combat.lineOfSight(g, target)) {
      g.state = g.swing > 0 ? 'strike' : 'guard';
      if (brain.strikeIn <= 0) {
        brain.strikeIn = 1.35 + g.id % 2 * 0.15;
        g.swing = 0.5; g.state = 'strike';
        this.combat.damageEnemy((target as CombatEnemy).id, 34);
        this.emit('saber', '', '', g);
      }
      return;
    }
    g.state = this.phase === 'departure' ? 'leaving' : this.phase === 'arrival' ? 'arriving' : 'advance';
    if (brain.replanIn <= 0 || !brain.path.length) {
      brain.replanIn = 0.65;
      brain.path = this.nav.path(g, target);
    }
    while (brain.path.length && distance(g, brain.path[0]) < 0.13) brain.path.shift();
    const p = brain.path[0]; if (!p) return;
    const d = distance(g, p), step = Math.min(d, (this.phase === 'departure' ? 1.8 : 2.85) * dt), before = { x: g.x, z: g.z };
    const dx = (p.x - g.x) / d * step, dz = (p.z - g.z) / d * step;
    const clear = (next: Vec2) => distance(next, player) > 0.9 && !this.guardians.some(other => other.id !== g.id && other.visible && distance(other, next) < 0.82)
      && !this.combat.enemies.some(e => alive(e) && distance(e, next) < 0.94);
    let next = { ...before }; this.nav.move(next, dx, dz);
    if (!clear(next)) {
      // Short lateral yields prevent two guardians from deadlocking in a gap.
      let yielded = false;
      for (const sign of [g.id % 2 ? 1 : -1, g.id % 2 ? -1 : 1]) {
        next = { ...before }; this.nav.move(next, (dx * 0.25 - dz * sign * 0.96), (dz * 0.25 + dx * sign * 0.96));
        if (clear(next) && distance(before, next) > dt * 0.1) { yielded = true; break; }
      }
      if (!yielded) { brain.blocked += dt; if (brain.blocked > 0.5) brain.replanIn = 0; return; }
    }
    brain.blocked = 0; g.x = next.x; g.z = next.z; g.speed = distance(before, g) / dt;
  }

  private nearestOutdoorCenter(p: Vec2): Vec2 {
    const zone = getZone(p), district = WORLD.districts.find(d => d.id === zone)!;
    const valid = this.ringPoints(district.center, [0, 2, 4], 8);
    if (valid.length) return valid[0];
    return WORLD.districts.map(d => d.center).filter(q => this.nav.isFree(q)).sort((a, b) => distance(p, a) - distance(p, b))[0] ?? { ...p };
  }

  /** Architectural connection mouths are the physical arrival/exit thresholds. */
  private gatePoints(center: Vec2): Vec2[] {
    const zone = getZone(center);
    const candidates: Vec2[] = [];
    for (const c of WORLD.connections) {
      if (c.from !== zone && c.to !== zone) continue;
      const mouth = { x: (c.minX + c.maxX) / 2, z: (c.minZ + c.maxZ) / 2 };
      candidates.push(mouth);
      const length = Math.max(0.1, distance(mouth, center));
      candidates.push({ x: mouth.x + (mouth.x - center.x) / length * 8, z: mouth.z + (mouth.z - center.z) / length * 8 });
    }
    const district = WORLD.districts.find(d => d.id === zone)!;
    const b = district.bounds;
    candidates.push({ x: district.center.x, z: b.minZ + 2 }, { x: district.center.x, z: b.maxZ - 2 },
      { x: b.minX + 2, z: district.center.z }, { x: b.maxX - 2, z: district.center.z });
    return candidates.filter(p => this.nav.isFree(p) && !getInterior(p));
  }

  private ringPoints(center: Vec2, radii: number[], count: number): Vec2[] {
    const points: Vec2[] = [];
    for (const radius of radii) for (let i = 0; i < (radius ? count : 1); i++) {
      const angle = i * Math.PI * 2 / count;
      const p = { x: center.x + Math.sin(angle) * radius, z: center.z + Math.cos(angle) * radius };
      if (this.nav.isFree(p) && !getInterior(p)) points.push(p);
    }
    return points;
  }

  private emit(type: StreetBattleEvent['type'], title: string, text: string, p?: Vec2): void {
    this.events.push({ type, title, text, ...(p ? { x: p.x, z: p.z } : {}) });
    if (this.events.length > 64) this.events.splice(0, this.events.length - 64);
  }
}
