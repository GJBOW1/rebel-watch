import { Navigation, type Vec2 } from './simulation';
import { WEAPONS, type Weapon, type WeaponId } from './campaign';

export type BossKind = 'warden' | 'vader';
export type BossStatus = 'idle' | 'active' | 'defeated' | 'victory' | 'paused';
export interface CampaignBoss extends Vec2 {
  kind: BossKind;
  name: string;
  yaw: number;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  state: 'advance' | 'telegraph' | 'attack' | 'stunned' | 'recover' | 'retreat';
  stateTime: number;
  minimumTier: number;
  speed: number;
}
export interface BossProjectile extends Vec2 {
  id: number;
  dx: number;
  dz: number;
  speed: number;
  age: number;
  owner: 'player' | 'boss';
  damage: number;
  ionDamage: number;
  tier: number;
  color: number;
}
export interface BossTelegraph extends Vec2 {
  id: number;
  kind: 'circle' | 'cone' | 'line';
  radius: number;
  length: number;
  angle: number;
  yaw: number;
  duration: number;
  remaining: number;
  progress: number;
  damage: number;
}
export interface CampaignCombatEvent extends Vec2 {
  type: 'start' | 'fire' | 'impact' | 'blocked' | 'shield-break' | 'boss-hit' | 'player-hit' | 'attack' | 'defeat' | 'victory' | 'retry';
  title?: string;
  text?: string;
  boss?: BossKind;
  owner?: 'player' | 'boss';
  value?: number;
}
export const BOSS_ARENA = { x: 54, z: 34 };
export const BOSS_LIMITS = Object.freeze({ projectiles: 48, events: 96, maxPlayerShield: 100, projectileRange: 40 });
const gap = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const finite = (p: Vec2) => !!p && Number.isFinite(p.x) && Number.isFinite(p.z);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const validWeapon = (weapon: Weapon | WeaponId): Weapon => WEAPONS[typeof weapon === 'string' ? weapon : weapon.id] ?? WEAPONS.cairn;
function circleHit(a: Vec2, b: Vec2, target: Vec2, radius: number): number | null {
  const x = a.x - target.x, z = a.z - target.z, dx = b.x - a.x, dz = b.z - a.z;
  const c = x * x + z * z - radius * radius;
  if (c <= 0) return 0;
  const aa = dx * dx + dz * dz; if (aa < 1e-10) return null;
  const bb = 2 * (x * dx + z * dz), discriminant = bb * bb - 4 * aa * c;
  if (discriminant < 0) return null;
  const t = (-bb - Math.sqrt(discriminant)) / (2 * aa); return t >= 0 && t <= 1 ? t : null;
}
function slab(a: Vec2, b: Vec2, box: { x: number; z: number; hx: number; hz: number }): number | null {
  let near = 0, far = 1;
  for (const [p, d, lo, hi] of [[a.x, b.x - a.x, box.x - box.hx - .06, box.x + box.hx + .06], [a.z, b.z - a.z, box.z - box.hz - .06, box.z + box.hz + .06]]) {
    if (Math.abs(d) < 1e-10) { if (p < lo || p > hi) return null; }
    else { const x = (lo - p) / d, y = (hi - p) / d; near = Math.max(near, Math.min(x, y)); far = Math.min(far, Math.max(x, y)); if (near > far) return null; }
  }
  return near;
}

/** Independent, checkpointed boss encounters. No ambient Combat state is changed.
 * Boss shots and authored attack warnings resolve against the real navigation
 * walls. Weapon power is captured at firing time; switching cannot upgrade a bolt. */
export class CampaignCombat {
  boss: CampaignBoss | null = null;
  status: BossStatus = 'idle';
  projectiles: BossProjectile[] = [];
  telegraphs: BossTelegraph[] = [];
  shield = 100;
  maxShield = 100;
  cooldown = 0;
  private checkpoint: BossKind | null = null;
  private events: CampaignCombatEvent[] = [];
  private nextId = 1;
  private nextAttack = 2;
  private attackIndex = 0;
  private path: Vec2[] = [];
  private replanIn = 0;
  private quietTime = 0;
  private feedbackIn = 0;
  get active(): boolean { return this.status === 'active'; }
  get victory(): BossKind | null { return this.status === 'victory' ? this.boss?.kind ?? null : null; }
  get defeated(): boolean { return this.status === 'defeated'; }

  start(kind: BossKind, player: Vec2, weapon: Weapon | WeaponId = 'cairn', shieldUpgrade = 0): boolean {
    if (!['warden', 'vader'].includes(kind) || !finite(player) || gap(player, BOSS_ARENA) > 28) return false;
    this.checkpoint = kind; this.maxShield = BOSS_LIMITS.maxPlayerShield + clamp(Number.isFinite(shieldUpgrade) ? shieldUpgrade : 0, 0, 20);
    this.shield = this.maxShield; this.status = 'active'; this.projectiles = []; this.telegraphs = []; this.events = [];
    this.cooldown = 0; this.nextAttack = 2.1; this.attackIndex = 0; this.path = []; this.replanIn = 0; this.quietTime = 0; this.feedbackIn = 0;
    this.boss = { ...BOSS_ARENA, kind, name: kind === 'warden' ? 'The Warden' : 'Darth Vader', yaw: Math.atan2(player.x - BOSS_ARENA.x, player.z - BOSS_ARENA.z),
      health: kind === 'warden' ? 1040 : 1560, maxHealth: kind === 'warden' ? 1040 : 1560, shield: kind === 'warden' ? 216 : 288, maxShield: kind === 'warden' ? 216 : 288,
      state: 'advance', stateTime: 0, minimumTier: kind === 'warden' ? 2 : 3, speed: 0 };
    this.emit({ type: 'start', ...BOSS_ARENA, boss: kind, title: this.boss.name, text: kind === 'warden' ? 'Ion fire breaks the core. Leave marked areas before the strike.' : 'The Ember Arc overloads his guard. Dodge the red warnings and hold the line.' });
    if (validWeapon(weapon).tier < this.boss.minimumTier) this.blocked();
    return true;
  }

  retry(player: Vec2, weapon: Weapon | WeaponId = 'cairn'): boolean {
    const kind = this.checkpoint; if (!kind || !finite(player)) return false;
    // A defeated player may have retreated beyond the initial challenge radius.
    // Reset the boss at its arena while leaving the player and companions where they are.
    const restartAnchor = gap(player, BOSS_ARENA) > 28 ? BOSS_ARENA : player;
    const started = this.start(kind, restartAnchor, weapon, this.maxShield - 100);
    if (started) this.emit({ type: 'retry', ...player, boss: kind, title: 'Checkpoint restored', text: 'Your shield and the boss encounter are restored. Campaign objectives remain unchanged.' });
    return started;
  }
  cancel(): void { this.status = 'idle'; this.projectiles = []; this.telegraphs = []; this.boss = null; this.cooldown = 0; }
  setEnabled(enabled: boolean): void {
    if (!enabled && this.status === 'active') { this.status = 'paused'; this.projectiles = []; this.telegraphs = []; if (this.boss) this.boss.speed = 0; }
    else if (enabled && this.status === 'paused') { this.status = 'active'; this.nextAttack = 1.7; if (this.boss) { this.boss.state = 'advance'; this.boss.stateTime = 0; } }
  }
  drainEvents(): CampaignCombatEvent[] { const events = this.events; this.events = []; return events; }

  fire(origin: Vec2, aim: Vec2, weapon: Weapon | WeaponId = 'cairn'): boolean {
    if (!this.active || !this.boss || !finite(origin) || !finite(aim) || this.cooldown > 1e-7 || gap(origin, aim) < .01) return false;
    const gun = validWeapon(weapon);
    if (this.projectiles.length + gun.pellets > BOSS_LIMITS.projectiles) return false;
    this.cooldown = gun.fireInterval;
    const yaw = Math.atan2(aim.x - origin.x, aim.z - origin.z);
    for (let pellet = 0; pellet < gun.pellets; pellet++) {
      const angle = yaw + (pellet - (gun.pellets - 1) / 2) * .09;
      this.projectiles.push({ id: this.nextId++, ...origin, dx: Math.sin(angle), dz: Math.cos(angle), speed: 35, age: 0,
        owner: 'player', damage: gun.damage, ionDamage: gun.ionDamage, tier: gun.tier, color: gun.color });
    }
    this.emit({ type: 'fire', ...origin, owner: 'player' }); return true;
  }

  tick(dt: number, player: Vec2, nav: Navigation, _weapon: Weapon | WeaponId = 'cairn'): void {
    if (!this.active || !this.boss || !Number.isFinite(dt) || dt <= 0 || !finite(player)) return;
    let remaining = Math.min(.25, dt);
    while (remaining > 1e-8 && this.active) { const step = Math.min(remaining, 1 / 60); this.step(step, player, nav); remaining -= step; }
  }

  private step(dt: number, player: Vec2, nav: Navigation): void {
    const b = this.boss!;
    this.cooldown = Math.max(0, this.cooldown - dt); this.feedbackIn = Math.max(0, this.feedbackIn - dt); this.quietTime += dt;
    if (this.quietTime > 8) this.shield = Math.min(this.maxShield, this.shield + dt * 6);
    b.stateTime += dt; b.speed = 0;
    if (b.state === 'stunned') {
      if (b.stateTime >= (b.kind === 'warden' ? 3.2 : 2.4)) { b.state = 'recover'; b.stateTime = 0; this.nextAttack = 1; }
    } else if (b.state === 'telegraph') {
      const warning = this.telegraphs[0];
      if (warning) {
        warning.remaining = Math.max(0, warning.remaining - dt); warning.progress = 1 - warning.remaining / warning.duration;
        if (warning.remaining <= 1e-8) { this.resolveAttack(warning, player, nav); this.telegraphs = []; b.state = 'attack'; b.stateTime = 0; }
      } else { b.state = 'advance'; b.stateTime = 0; }
    } else if (b.state === 'attack') {
      if (b.stateTime >= .5) { b.state = 'recover'; b.stateTime = 0; }
    } else {
      this.nextAttack -= dt;
      if (b.state === 'recover' && b.stateTime > 1) { b.state = 'advance'; b.stateTime = 0; }
      const range = gap(b, player);
      if (this.nextAttack <= 0 && range < 19) this.warn(player);
      else if (b.state === 'advance' && range > (b.kind === 'warden' ? 6.3 : 4.5)) this.moveBoss(dt, player, nav);
    }
    this.updateProjectiles(dt, player, nav);
  }

  private moveBoss(dt: number, player: Vec2, nav: Navigation): void {
    const b = this.boss!; this.replanIn -= dt;
    if (this.replanIn <= 0 || !this.path.length) { this.path = nav.path(b, player); this.replanIn = .65; }
    while (this.path.length && gap(b, this.path[0]) < .15) this.path.shift();
    const next = this.path[0]; if (!next) return;
    const d = gap(b, next), before = { x: b.x, z: b.z }, step = Math.min(d, (b.kind === 'warden' ? 1.35 : 1.85) * dt);
    if (d < 1e-8) return;
    nav.move(b, (next.x - b.x) / d * step, (next.z - b.z) / d * step);
    b.speed = gap(before, b) / dt;
    const yaw = Math.atan2(player.x - b.x, player.z - b.z);
    b.yaw += Math.atan2(Math.sin(yaw - b.yaw), Math.cos(yaw - b.yaw)) * Math.min(1, dt * 8);
  }

  private warn(player: Vec2): void {
    const b = this.boss!, index = this.attackIndex++ % 3;
    const kind: BossTelegraph['kind'] = index === 1 ? 'circle' : index === 2 ? 'line' : 'cone';
    const duration = b.kind === 'warden' ? 1.2 : 1.05;
    b.yaw = Math.atan2(player.x - b.x, player.z - b.z); b.state = 'telegraph'; b.stateTime = 0;
    this.telegraphs = [{ id: this.nextId++, ...(kind === 'circle' ? player : b), kind, radius: kind === 'circle' ? 3.2 : kind === 'line' ? .95 : b.kind === 'warden' ? 8 : 6.8,
      length: 12, angle: b.kind === 'warden' ? .64 : .9, yaw: b.yaw, duration, remaining: duration, progress: 0, damage: b.kind === 'warden' ? 27 : 34 }];
    this.nextAttack = b.kind === 'warden' ? 2.5 : 2.05;
  }

  private resolveAttack(warning: BossTelegraph, player: Vec2, nav: Navigation): void {
    const b = this.boss!, delta = { x: player.x - warning.x, z: player.z - warning.z }, distance = Math.hypot(delta.x, delta.z);
    let hit = false;
    if (warning.kind === 'circle') hit = distance < warning.radius + .42;
    else if (warning.kind === 'cone') {
      const yaw = Math.atan2(delta.x, delta.z), angle = Math.abs(Math.atan2(Math.sin(yaw - warning.yaw), Math.cos(yaw - warning.yaw)));
      hit = distance < warning.radius + .42 && angle < warning.angle;
    } else {
      const along = delta.x * Math.sin(warning.yaw) + delta.z * Math.cos(warning.yaw);
      const across = Math.abs(delta.x * Math.cos(warning.yaw) - delta.z * Math.sin(warning.yaw));
      hit = along >= 0 && along < warning.length && across < warning.radius + .42;
      // A physical, dodgeable volley accompanies the locked line warning.
      for (const angle of [-.12, 0, .12]) if (this.projectiles.length < BOSS_LIMITS.projectiles) this.projectiles.push({ id: this.nextId++, x: b.x, z: b.z,
        dx: Math.sin(warning.yaw + angle), dz: Math.cos(warning.yaw + angle), speed: 12.5, age: 0, owner: 'boss', damage: 14, ionDamage: 0, tier: 1, color: 0xff4738 });
    }
    this.emit({ type: 'attack', x: warning.x, z: warning.z, boss: b.kind, title: warning.kind === 'circle' ? 'Force pressure' : warning.kind === 'line' ? 'Locked strike' : 'Sweeping strike' });
    if (hit && this.worldHit(b, player, nav) === null) this.hurt(warning.damage, player);
  }

  private updateProjectiles(dt: number, player: Vec2, nav: Navigation): void {
    const survivors: BossProjectile[] = [], b = this.boss!;
    for (const bolt of this.projectiles) {
      const remaining = Math.max(0, BOSS_LIMITS.projectileRange - bolt.age * bolt.speed), travel = Math.min(bolt.speed * dt, remaining);
      const next = { x: bolt.x + bolt.dx * travel, z: bolt.z + bolt.dz * travel };
      const wall = this.worldHit(bolt, next, nav), entity = circleHit(bolt, next, bolt.owner === 'player' ? b : player, bolt.owner === 'player' ? .88 : .48);
      if (wall !== null && (entity === null || wall <= entity)) this.emit({ type: 'impact', x: bolt.x + (next.x - bolt.x) * wall, z: bolt.z + (next.z - bolt.z) * wall, owner: bolt.owner });
      else if (entity !== null) {
        if (bolt.owner === 'boss') this.hurt(bolt.damage, player); else this.hitBoss(bolt);
        if (!this.active) break;
      } else if (remaining > 0 && bolt.age + dt < BOSS_LIMITS.projectileRange / bolt.speed) { bolt.x = next.x; bolt.z = next.z; bolt.age += dt; survivors.push(bolt); }
    }
    this.projectiles = this.active ? survivors : [];
  }

  private hitBoss(bolt: BossProjectile): void {
    const b = this.boss!;
    if (bolt.tier < b.minimumTier && (b.shield > 0 || b.kind === 'vader')) { this.blocked(); return; }
    if (b.shield > 0) {
      if (!bolt.ionDamage) { this.blocked(); return; }
      b.shield = Math.max(0, b.shield - bolt.ionDamage);
      this.emit({ type: 'boss-hit', x: b.x, z: b.z, boss: b.kind, value: b.shield, title: 'Guard disrupted' });
      if (b.shield === 0) {
        b.state = 'stunned'; b.stateTime = 0; this.telegraphs = [];
        this.emit({ type: 'shield-break', x: b.x, z: b.z, boss: b.kind, title: b.kind === 'warden' ? 'Ion core broken' : 'Vader’s guard is open', text: 'Press your attack before the next warning.' });
      }
      return;
    }
    b.health = Math.max(0, b.health - bolt.damage);
    this.emit({ type: 'boss-hit', x: b.x, z: b.z, boss: b.kind, value: b.health, title: 'A hit finds its mark' });
    if (b.health === 0) {
      b.state = 'retreat'; b.stateTime = 0; b.speed = 0; this.status = 'victory'; this.telegraphs = []; this.projectiles = [];
      this.emit({ type: 'victory', x: b.x, z: b.z, boss: b.kind, title: b.kind === 'warden' ? 'The Warden falls silent' : 'The convoy is clear', text: b.kind === 'vader' ? 'Vader withdraws as the convoy escapes. Return to the mission marker and signal the last transport.' : 'The command shield is down. Claim the mission reward at the bastion marker.' });
    }
  }
  private blocked(): void {
    if (!this.boss || this.feedbackIn > 0) return;
    this.feedbackIn = 1.2; this.emit({ type: 'blocked', x: this.boss.x, z: this.boss.z, boss: this.boss.kind,
      title: this.boss.kind === 'warden' ? 'Command shield · ion weapon required' : 'Vader deflects the bolt · Ember Arc required',
      text: this.boss.kind === 'warden' ? 'Ordinary bolts cannot break the core. Equip the Ionlance earned from the relay mission.' : 'Use the tier-three Ember Arc earned from Skybreak. Earlier weapons cannot break his guard.' });
  }
  private hurt(damage: number, player: Vec2): void {
    if (!this.active) return;
    this.shield = Math.max(0, this.shield - damage); this.quietTime = 0; this.emit({ type: 'player-hit', ...player, owner: 'boss', value: this.shield });
    if (this.shield === 0) { this.status = 'defeated'; this.projectiles = []; this.telegraphs = []; if (this.boss) this.boss.speed = 0; this.emit({ type: 'defeat', ...player, boss: this.boss?.kind, title: 'A breath. Then another try.', text: 'Retry this checkpoint. Your campaign rewards and objectives are safe.' }); }
  }
  private worldHit(a: Vec2, b: Vec2, nav: Navigation): number | null {
    let earliest: number | null = null;
    for (const obstacle of nav.obstacles) { const t = slab(a, b, obstacle); if (t !== null && (earliest === null || t < earliest)) earliest = t; }
    const samples = Math.max(1, Math.ceil(gap(a, b) / .07));
    for (let i = 0; i <= samples; i++) { const t = i / samples; if (earliest !== null && t >= earliest) break; if (!nav.isFree({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, .06)) { earliest = t; break; } }
    return earliest;
  }
  private emit(event: CampaignCombatEvent): void { this.events.push(event); if (this.events.length > BOSS_LIMITS.events) this.events.splice(0, this.events.length - BOSS_LIMITS.events); }
}
