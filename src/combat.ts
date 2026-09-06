import { Navigation, type Vec2 } from './simulation';

/** Local, deterministic light combat. It never changes companion state or navigation. */
export type CombatOwner = 'player' | 'enemy';
export interface CombatEnemy extends Vec2 {
  id: number;
  yaw: number;
  speed: number;
  health: number;
  maxHealth: number;
  state: 'advance' | 'aim' | 'recover' | 'down';
  /** Telegraph progress from zero to one. aimX/aimZ lock when the warning begins. */
  telegraph: number;
  aimX: number;
  aimZ: number;
}
export interface Projectile extends Vec2 {
  id: number;
  owner: CombatOwner;
  dx: number;
  dz: number;
  speed: number;
  age: number;
  damage?: number;
}
export interface CombatEvent extends Vec2 {
  type: 'fire' | 'impact' | 'enemy-down' | 'player-hit' | 'defeat' | 'spawn' | 'ally-block' | 'ally-hit';
  owner?: CombatOwner;
  enemyId?: number;
  allyId?: number;
  value?: number;
}

/** A director may provide patrol destinations and battle targets. Vanilla combat
 * keeps its original hostile behavior unless a director is explicitly attached. */
export interface EnemyIntent { target: Vec2; aggressive: boolean }
export interface CombatAlly extends Vec2 {
  id: number;
  health: number;
  deflect: boolean;
  deflections: number;
}
export interface CombatDirector {
  playerHostile: boolean;
  allies: CombatAlly[];
  intent(enemy: CombatEnemy, player: Vec2): EnemyIntent | null;
  onPlayerAttack(enemy: CombatEnemy): void;
}

export const COMBAT_LIMITS = Object.freeze({
  enemies: 6, projectiles: 48, events: 128, fireInterval: 0.22,
  enemySpeed: 2.1, playerBoltSpeed: 32, enemyBoltSpeed: 13.5,
  enemyRange: 16, playerRange: 36, enemyHealth: 66,
  shotDamage: 33, incomingDamage: 14, telegraphDuration: 0.85,
  shieldRecoveryDelay: 8, shieldRecoveryRate: 10,
});

interface EnemyBrain {
  path: Vec2[];
  replanIn: number;
  fireIn: number;
  warningTime: number;
  downTime: number;
  side: number;
}
const BOLT_RADIUS = 0.065;
const ENEMY_RADIUS = 0.43;
const PLAYER_RADIUS = 0.42;
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const finite = (p: Vec2) => Number.isFinite(p.x) && Number.isFinite(p.z);

/** Earliest segment-circle contact, including a segment that starts inside. */
function circleHit(a: Vec2, b: Vec2, target: Vec2, radius: number): number | null {
  const x = a.x - target.x, z = a.z - target.z;
  const vx = b.x - a.x, vz = b.z - a.z;
  const c = x * x + z * z - radius * radius;
  if (c <= 0) return 0;
  const aa = vx * vx + vz * vz;
  if (aa <= 1e-12) return null;
  const bb = 2 * (x * vx + z * vz), discriminant = bb * bb - 4 * aa * c;
  if (discriminant < 0) return null;
  const t = (-bb - Math.sqrt(discriminant)) / (2 * aa);
  return t >= 0 && t <= 1 ? t : null;
}

/** Exact slab intersection stops shots even on extremely thin collision walls. */
function boxHit(a: Vec2, b: Vec2, x: number, z: number, hx: number, hz: number): number | null {
  let enter = 0, leave = 1;
  for (const [p, d, lo, hi] of [
    [a.x, b.x - a.x, x - hx, x + hx],
    [a.z, b.z - a.z, z - hz, z + hz],
  ]) {
    if (Math.abs(d) < 1e-12) { if (p < lo || p > hi) return null; }
    else {
      const t1 = (lo - p) / d, t2 = (hi - p) / d;
      enter = Math.max(enter, Math.min(t1, t2));
      leave = Math.min(leave, Math.max(t1, t2));
      if (enter > leave) return null;
    }
  }
  return enter;
}

export class Combat {
  enabled = false;
  equipped = false;
  maxShield = 100;
  shield = this.maxShield;
  defeated = false;
  kills = 0;
  cooldown = 0;
  weaponDamage: number = COMBAT_LIMITS.shotDamage;
  weaponInterval: number = COMBAT_LIMITS.fireInterval;
  weaponPellets = 1;
  enemies: CombatEnemy[] = [];
  projectiles: Projectile[] = [];
  private brains = new Map<number, EnemyBrain>();
  private events: CombatEvent[] = [];
  private nextId = 1;
  private quietTime = 0;
  director: CombatDirector | null = null;

  constructor(public readonly nav: Navigation) {}

  toggleEquip(): boolean {
    if (!this.defeated) this.equipped = !this.equipped;
    return this.equipped;
  }

  /** Stand down is immediate and clears every threat, including airborne shots. */
  setEnabled(enabled: boolean, player: Vec2): void {
    if (enabled === this.enabled) {
      if (!enabled) this.standDown();
      return;
    }
    if (!enabled) { this.standDown(); return; }
    if (!finite(player) || !this.nav.isFree(player)) return;
    this.enabled = true;
    this.startWave(player);
  }

  /** A deliberate retry starts a new local patrol without relocating the player. */
  restart(player: Vec2): void {
    if (!finite(player) || !this.nav.isFree(player)) return;
    this.enabled = true;
    this.startWave(player);
  }

  private standDown(): void {
    this.enabled = false;
    this.enemies = [];
    this.projectiles = [];
    this.brains.clear();
    this.events = [];
    this.shield = this.maxShield;
    this.defeated = false;
    this.quietTime = 0;
    this.cooldown = 0;
    this.kills = 0;
  }

  private startWave(player: Vec2): void {
    this.enemies = [];
    this.projectiles = [];
    this.brains.clear();
    this.events = [];
    this.shield = this.maxShield;
    this.defeated = false;
    this.kills = 0;
    this.quietTime = 0;
    this.cooldown = 0;
    // A fixed golden-angle sequence gives varied, reproducible local encounters.
    // Validate the actual endpoint: Navigation.path may legitimately return a
    // closest reachable point when its requested destination is disconnected.
    for (let i = 0; i < 128 && this.enemies.length < COMBAT_LIMITS.enemies; i++) {
      const radius = [7.2, 9.5, 11.8, 6][Math.floor(i / 32)];
      const angle = i * 2.399963229728653 + 0.37;
      const p = { x: player.x + Math.sin(angle) * radius, z: player.z + Math.cos(angle) * radius };
      if (!this.nav.isFree(p) || this.enemies.some(e => distance(e, p) < 2.1)) continue;
      const path = this.nav.path(player, p);
      if (!path.length || distance(path[path.length - 1], p) > 0.3) continue;
      const id = this.nextId++, index = this.enemies.length;
      this.enemies.push({
        id, ...p, yaw: Math.atan2(player.x - p.x, player.z - p.z), speed: 0,
        health: COMBAT_LIMITS.enemyHealth, maxHealth: COMBAT_LIMITS.enemyHealth,
        state: 'advance', telegraph: 0, aimX: player.x, aimZ: player.z,
      });
      this.brains.set(id, {
        path: [], replanIn: index * 0.08, fireIn: 1.8 + index * 0.38,
        warningTime: 0, downTime: 0, side: index % 2 ? -1 : 1,
      });
      this.emit({ type: 'spawn', ...p, enemyId: id });
    }
  }

  /** Spawn a bounded patrol at validated gate/route points. Existing patrols are
   * never moved by this operation; the director only calls it after they leave. */
  spawnPatrol(points: Vec2[], player: Vec2): number {
    if (!finite(player) || !this.nav.isFree(player)) return 0;
    this.enabled = true;
    let added = 0;
    for (const p of points) {
      if (this.enemies.length >= COMBAT_LIMITS.enemies) break;
      if (!finite(p) || !this.nav.isFree(p) || this.enemies.some(e => distance(e, p) < 0.95)) continue;
      const id = this.nextId++, index = this.enemies.length;
      this.enemies.push({ id, ...p, yaw: 0, speed: 0, health: COMBAT_LIMITS.enemyHealth,
        maxHealth: COMBAT_LIMITS.enemyHealth, state: 'advance', telegraph: 0, aimX: p.x, aimZ: p.z });
      this.brains.set(id, { path: [], replanIn: 0, fireIn: 1.2 + index * 0.35,
        warningTime: 0, downTime: 0, side: index % 2 ? -1 : 1 });
      this.emit({ type: 'spawn', ...p, enemyId: id });
      added++;
    }
    return added;
  }

  /** Guardian strikes share the same fall, cleanup, and impact path as blaster hits. */
  damageEnemy(id: number, damage: number, playerCredit = false): boolean {
    const enemy = this.enemies.find(e => e.id === id);
    if (!enemy || enemy.health <= 0 || !Number.isFinite(damage) || damage <= 0) return false;
    if (playerCredit) this.director?.onPlayerAttack(enemy);
    enemy.health = Math.max(0, enemy.health - damage);
    if (!enemy.health) {
      enemy.state = 'down'; enemy.telegraph = 0; enemy.speed = 0;
      if (playerCredit) this.kills++;
      this.emit({ type: 'enemy-down', ...enemy, owner: playerCredit ? 'player' : undefined, enemyId: id, value: this.kills });
    }
    return true;
  }

  lineOfSight(a: Vec2, b: Vec2): boolean { return this.worldHit(a, b) === null; }

  /** aimPoint is a world target, not a unit direction. Safe target practice works
   * with enemies disabled; holstering always prevents new shots. */
  fire(origin: Vec2, aimPoint: Vec2): boolean {
    if (!this.equipped || this.defeated || this.cooldown > 1e-8 || !finite(origin) || !finite(aimPoint)) return false;
    if (distance(origin, aimPoint) < 0.001 || this.projectiles.length >= COMBAT_LIMITS.projectiles) return false;
    this.cooldown = Math.max(.08, Math.min(1, Number.isFinite(this.weaponInterval) ? this.weaponInterval : COMBAT_LIMITS.fireInterval));
    const pellets = Math.max(1, Math.min(3, Math.floor(this.weaponPellets)));
    const angle = Math.atan2(aimPoint.x-origin.x,aimPoint.z-origin.z);
    for(let i=0;i<pellets;i++) {
      const spread = pellets===1?0:(i-(pellets-1)/2)*.11;
      this.launch('player', origin, {x:origin.x+Math.sin(angle+spread)*20,z:origin.z+Math.cos(angle+spread)*20});
    }
    return true;
  }

  drainEvents(): CombatEvent[] { const events = this.events; this.events = []; return events; }

  tick(dt: number, player: Vec2): void {
    if (!Number.isFinite(dt) || dt <= 0 || !finite(player)) return;
    // The same catch-up policy as exploration prevents leaps after a suspended tab.
    let remaining = Math.min(dt, 0.25);
    while (remaining > 1e-8) {
      const step = Math.min(remaining, 1 / 60);
      this.step(step, player);
      remaining -= step;
    }
  }

  private step(dt: number, player: Vec2): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.defeated) return;
    this.quietTime += dt;
    if (this.quietTime > COMBAT_LIMITS.shieldRecoveryDelay) {
      this.shield = Math.min(this.maxShield, this.shield + dt * COMBAT_LIMITS.shieldRecoveryRate);
    }
    if (this.enabled) {
      for (const enemy of this.enemies) this.updateEnemy(enemy, dt, player);
      this.enemies = this.enemies.filter(e => {
        const expired = e.health <= 0 && this.brains.get(e.id)!.downTime > 0.85;
        if (expired) this.brains.delete(e.id);
        return !expired;
      });
    }
    this.updateProjectiles(dt, player);
  }

  private updateEnemy(enemy: CombatEnemy, dt: number, player: Vec2): void {
    const brain = this.brains.get(enemy.id)!;
    enemy.speed = 0;
    if (enemy.health <= 0) { brain.downTime += dt; return; }
    brain.fireIn = Math.max(0, brain.fireIn - dt);
    brain.replanIn -= dt;
    const intent = this.director?.intent(enemy, player);
    if (this.director && (!intent || !intent.aggressive)) {
      // Neutral patrols never arm a warning or fire at the observer.
      enemy.state = 'advance'; enemy.telegraph = 0; brain.warningTime = 0;
      if (intent && finite(intent.target)) this.patrolMove(enemy, brain, intent.target, player, dt);
      return;
    }
    const target = intent?.target ?? player;
    const range = distance(enemy, target);
    if (enemy.state === 'aim') {
      brain.warningTime += dt;
      enemy.telegraph = Math.min(1, brain.warningTime / COMBAT_LIMITS.telegraphDuration);
      enemy.yaw = Math.atan2(enemy.aimX - enemy.x, enemy.aimZ - enemy.z);
      if (brain.warningTime >= COMBAT_LIMITS.telegraphDuration) {
        if (range <= COMBAT_LIMITS.enemyRange && this.worldHit(enemy, { x: enemy.aimX, z: enemy.aimZ }) === null) {
          this.launch('enemy', enemy, { x: enemy.aimX, z: enemy.aimZ }, enemy.id);
        }
        enemy.state = 'recover'; enemy.telegraph = 0;
        brain.fireIn = 2.4 + (enemy.id % 3) * 0.32;
      }
      return;
    }
    const sight = range <= COMBAT_LIMITS.enemyRange && this.worldHit(enemy, target) === null;
    if (brain.fireIn <= 0 && sight && range >= 2.2) {
      enemy.state = 'aim'; enemy.telegraph = 0.001;
      enemy.aimX = target.x; enemy.aimZ = target.z;
      brain.warningTime = 0;
      return;
    }
    enemy.state = brain.fireIn > 0 && sight ? 'recover' : 'advance';
    enemy.yaw = Math.atan2(target.x - enemy.x, target.z - enemy.z);
    // Hold a readable firing line at range; otherwise travel to a reachable
    // staggered flank. World collision movement remains continuous at all times.
    if (sight && range >= 4.8 && range <= 10.5) return;
    if (brain.replanIn <= 0) {
      brain.replanIn = 0.72 + (enemy.id % 3) * 0.09;
      const base = Math.atan2(enemy.x - target.x, enemy.z - target.z);
      let flank: Vec2 | undefined;
      for (const offset of [0.42 * brain.side, 0, -0.42 * brain.side, 0.9 * brain.side]) {
        const candidate = { x: target.x + Math.sin(base + offset) * 5.6, z: target.z + Math.cos(base + offset) * 5.6 };
        if (this.nav.isFree(candidate)) { flank = candidate; break; }
      }
      brain.path = this.nav.path(enemy, flank ?? target);
    }
    while (brain.path.length && distance(enemy, brain.path[0]) < 0.14) brain.path.shift();
    if (!brain.path.length) return;
    const waypoint = brain.path[0], d = distance(enemy, waypoint);
    const step = Math.min(d, COMBAT_LIMITS.enemySpeed * dt);
    const before = { x: enemy.x, z: enemy.z }, proposed = { ...before };
    this.nav.move(proposed, (waypoint.x - enemy.x) / d * step, (waypoint.z - enemy.z) / d * step);
    if (distance(proposed, player) < 1.3) return;
    if (this.enemies.some(other => other.id !== enemy.id && other.health > 0 && distance(other, proposed) < ENEMY_RADIUS * 2 + 0.05)) {
      brain.replanIn = Math.min(brain.replanIn, 0.18);
      return;
    }
    enemy.x = proposed.x; enemy.z = proposed.z;
    enemy.speed = distance(before, enemy) / dt;
    if (enemy.speed > 0.01) enemy.yaw = Math.atan2(enemy.x - before.x, enemy.z - before.z);
  }

  private patrolMove(enemy: CombatEnemy, brain: EnemyBrain, destination: Vec2, player: Vec2, dt: number): void {
    if (distance(enemy, destination) < 0.2) return;
    if (brain.replanIn <= 0 || !brain.path.length) {
      brain.path = this.nav.path(enemy, destination);
      brain.replanIn = 1.4 + (enemy.id % 3) * 0.17;
    }
    while (brain.path.length && distance(enemy, brain.path[0]) < 0.12) brain.path.shift();
    const waypoint = brain.path[0];
    if (!waypoint) return;
    const d = distance(enemy, waypoint), step = Math.min(d, 1.35 * dt), before = { x: enemy.x, z: enemy.z }, next = { ...before };
    this.nav.move(next, (waypoint.x - enemy.x) / d * step, (waypoint.z - enemy.z) / d * step);
    if (distance(next, player) < 1 || this.enemies.some(e => e.id !== enemy.id && e.health > 0 && distance(e, next) < 0.91)) {
      brain.replanIn = Math.min(brain.replanIn, 0.2); return;
    }
    enemy.x = next.x; enemy.z = next.z;
    enemy.speed = distance(before, next) / dt;
    if (enemy.speed > 0.001) enemy.yaw = Math.atan2(next.x - before.x, next.z - before.z);
  }

  private launch(owner: CombatOwner, origin: Vec2, aim: Vec2, enemyId?: number): void {
    if (this.projectiles.length >= COMBAT_LIMITS.projectiles) return;
    const range = distance(origin, aim);
    if (range < 1e-6) return;
    this.projectiles.push({
      id: this.nextId++, owner, x: origin.x, z: origin.z,
      dx: (aim.x - origin.x) / range, dz: (aim.z - origin.z) / range,
      speed: owner === 'player' ? COMBAT_LIMITS.playerBoltSpeed : COMBAT_LIMITS.enemyBoltSpeed,
      damage: owner === 'player' && Number.isFinite(this.weaponDamage) ? Math.max(1,this.weaponDamage) : COMBAT_LIMITS.shotDamage,
      age: 0,
    });
    this.emit({ type: 'fire', x: origin.x, z: origin.z, owner, enemyId });
  }

  private updateProjectiles(dt: number, player: Vec2): void {
    const survivors: Projectile[] = [];
    for (const bolt of this.projectiles) {
      const maxRange = bolt.owner === 'player' ? COMBAT_LIMITS.playerRange : COMBAT_LIMITS.enemyRange;
      const remainingDistance = Math.max(0, maxRange - bolt.age * bolt.speed);
      const travel = Math.min(bolt.speed * dt, remainingDistance);
      const next = { x: bolt.x + bolt.dx * travel, z: bolt.z + bolt.dz * travel };
      let earliest = this.worldHit(bolt, next);
      let hitEnemy: CombatEnemy | undefined;
      let hitPlayer = false;
      let hitAlly: CombatAlly | undefined;
      if (bolt.owner === 'player' && this.enabled) {
        for (const enemy of this.enemies) {
          if (enemy.health <= 0) continue;
          const t = circleHit(bolt, next, enemy, ENEMY_RADIUS + BOLT_RADIUS);
          if (t !== null && (earliest === null || t < earliest)) { earliest = t; hitEnemy = enemy; }
        }
      } else if (bolt.owner === 'enemy' && this.enabled) {
        if (!this.director || this.director.playerHostile) {
          const t = circleHit(bolt, next, player, PLAYER_RADIUS + BOLT_RADIUS);
          if (t !== null && (earliest === null || t < earliest)) { earliest = t; hitPlayer = true; }
        }
        for (const ally of this.director?.allies ?? []) {
          if (ally.health <= 0) continue;
          const t = circleHit(bolt, next, ally, 0.72 + BOLT_RADIUS);
          if (t !== null && (earliest === null || t < earliest)) { earliest = t; hitAlly = ally; hitPlayer = false; }
        }
      }
      if (earliest !== null) {
        const contact = { x: bolt.x + (next.x - bolt.x) * earliest, z: bolt.z + (next.z - bolt.z) * earliest };
        this.emit({ type: 'impact', ...contact, owner: bolt.owner, enemyId: hitEnemy?.id });
        if (hitEnemy) this.damageEnemy(hitEnemy.id, bolt.damage ?? COMBAT_LIMITS.shotDamage, true);
        if (hitAlly) {
          if (hitAlly.deflect) {
            hitAlly.deflections++;
            this.emit({ type: 'ally-block', ...contact, allyId: hitAlly.id });
          } else {
            hitAlly.health = Math.max(0, hitAlly.health - COMBAT_LIMITS.incomingDamage);
            this.emit({ type: 'ally-hit', ...contact, allyId: hitAlly.id, value: hitAlly.health });
          }
        }
        if (hitPlayer) {
          this.shield = Math.max(0, this.shield - COMBAT_LIMITS.incomingDamage);
          this.quietTime = 0;
          this.emit({ type: 'player-hit', ...contact, owner: 'enemy', value: this.shield });
          if (this.shield === 0) {
            this.defeated = true;
            this.emit({ type: 'defeat', ...player, value: 0 });
            break;
          }
        }
      } else if (travel > 0 && bolt.age + dt < maxRange / bolt.speed) {
        bolt.x = next.x; bolt.z = next.z; bolt.age += dt; survivors.push(bolt);
      }
    }
    this.projectiles = this.defeated ? [] : survivors;
  }

  private worldHit(a: Vec2, b: Vec2): number | null {
    let earliest: number | null = null;
    for (const obstacle of this.nav.obstacles) {
      const t = boxHit(a, b, obstacle.x, obstacle.z, obstacle.hx + BOLT_RADIUS, obstacle.hz + BOLT_RADIUS);
      if (t !== null && (earliest === null || t < earliest)) earliest = t;
    }
    // Exact rectangles above prevent thin-wall tunnelling; these short samples
    // additionally stop shots at the union of the city's walkable districts.
    const n = Math.max(1, Math.ceil(distance(a, b) / 0.08));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (earliest !== null && t > earliest) break;
      if (this.nav.isFree({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, BOLT_RADIUS)) continue;
      let lo = Math.max(0, (i - 1) / n), hi = t;
      for (let k = 0; k < 7; k++) {
        const mid = (lo + hi) / 2;
        if (this.nav.isFree({ x: a.x + (b.x - a.x) * mid, z: a.z + (b.z - a.z) * mid }, BOLT_RADIUS)) lo = mid; else hi = mid;
      }
      earliest = earliest === null ? hi : Math.min(earliest, hi);
      break;
    }
    return earliest;
  }

  private emit(event: CombatEvent): void {
    this.events.push(event);
    if (this.events.length > COMBAT_LIMITS.events) this.events.splice(0, this.events.length - COMBAT_LIMITS.events);
  }
}
