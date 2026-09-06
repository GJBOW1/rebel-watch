import * as THREE from 'three';
import { FLIGHT_LIMITS, FLIGHT_PADS, type Pilot, type PilotEvent } from './pilot';

interface EnemyPose { root: THREE.Group; parts: THREE.Mesh[] }
interface Spark { position: THREE.Vector3; velocity: THREE.Vector3; age: number; life: number; size: number; color: THREE.Color }
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const SPARK_LIMIT = 96;

/** Authored ships remain in their Blender hierarchy; TIE parts and effects are pooled. */
export class PilotView {
  readonly fighter: THREE.Group;
  private readonly enemyTemplate: THREE.Group;
  private readonly enemies = new Map<number, EnemyPose>();
  private readonly enemyPools: THREE.InstancedMesh[] = [];
  private readonly playerBolts: THREE.InstancedMesh;
  private readonly enemyBolts: THREE.InstancedMesh;
  private readonly sparks: THREE.InstancedMesh;
  private readonly particles: Spark[] = [];
  private readonly padRings: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly padBeacons: THREE.Mesh[] = [];
  private readonly flames: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private lastTime: number | null = null;
  private sequence = 0;

  constructor(private readonly scene: THREE.Scene, models: { fighter: THREE.Group; tie: THREE.Group }) {
    this.fighter = models.fighter.clone(true); this.fighter.name = 'Your Rebel starfighter'; scene.add(this.fighter);
    this.enemyTemplate = models.tie;
    this.fighter.traverse(node => { if (node instanceof THREE.Mesh) { node.castShadow = true; node.receiveShadow = true; } });
    const engineNodes: THREE.Object3D[] = [];
    this.fighter.traverse(node => { if (/^Engine(?:_[LR]|_\d+)?$/.test(node.name) && !(node instanceof THREE.Mesh)) engineNodes.push(node); });
    if (!engineNodes.length) for (const x of [-1.5, 1.5]) {
      const mount = new THREE.Object3D(); mount.position.set(x, .75, -3.5); this.fighter.add(mount); engineNodes.push(mount);
    }
    for (const node of engineNodes) {
      const flare = new THREE.Mesh(new THREE.ConeGeometry(.24, 2.5, 10, 1, true), new THREE.MeshBasicMaterial({
        color: 0x62d9ff, transparent: true, opacity: .48, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
      }));
      // The nozzle is a rear plane; +Z is the authored nose direction.
      flare.rotation.x = -Math.PI / 2; flare.position.z = -1.1; node.add(flare); this.flames.push(flare);
    }
    const boltGeometry = new THREE.BoxGeometry(.12, .12, 1);
    this.playerBolts = this.pool(boltGeometry, 0xff7755, FLIGHT_LIMITS.projectiles, 'Rebel fighter laser bolts');
    this.enemyBolts = this.pool(boltGeometry, 0x79ff6b, FLIGHT_LIMITS.projectiles, 'Imperial fighter laser bolts');
    this.sparks = this.pool(new THREE.OctahedronGeometry(1, 0), 0xffffff, SPARK_LIMIT, 'Pooled starfighter impacts');
    for (const pad of FLIGHT_PADS) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(5.25, 5.5, 64), new THREE.MeshBasicMaterial({
        color: 0x7af1d0, transparent: true, opacity: .54, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(pad.x, pad.y + .09, pad.z);
      ring.name = `${pad.name} landing clearance ring`; scene.add(ring); this.padRings.push(ring);
      const beacon = new THREE.Mesh(new THREE.ConeGeometry(.35, 1.5, 6), new THREE.MeshBasicMaterial({ color: 0x8dffe0, toneMapped: false }));
      beacon.rotation.x = Math.PI; beacon.position.set(pad.x, pad.y + 8, pad.z); beacon.name = `${pad.name} approach marker`;
      scene.add(beacon); this.padBeacons.push(beacon);
    }
  }
  private pool(geometry: THREE.BufferGeometry, color: number, limit: number, name: string): THREE.InstancedMesh {
    const pool = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ color, toneMapped: false }), limit);
    pool.name = name; pool.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pool.frustumCulled = false; pool.count = 0;
    this.scene.add(pool); return pool;
  }
  private enemy(id: number): EnemyPose {
    const known = this.enemies.get(id); if (known) return known;
    const root = this.enemyTemplate.clone(true), parts: THREE.Mesh[] = [];
    root.traverse(node => { if (node instanceof THREE.Mesh) parts.push(node); });
    if (!this.enemyPools.length) for (const part of parts) {
      const pool = new THREE.InstancedMesh(part.geometry, part.material, FLIGHT_LIMITS.enemies);
      pool.name = `Imperial flight · ${part.name}`; pool.frustumCulled = false;
      pool.castShadow = true; pool.receiveShadow = true; pool.count = 0;
      pool.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.scene.add(pool); this.enemyPools.push(pool);
    }
    const actor = { root, parts }; this.enemies.set(id, actor); return actor;
  }
  /** Feed drained events here as well as the HUD/audio handler; this method never drains Pilot itself. */
  events(events: readonly PilotEvent[]): void {
    for (const event of events) {
      if (!['fire', 'hit', 'enemy-down'].includes(event.type)) continue;
      const burst = event.type === 'enemy-down', count = burst ? 25 : event.type === 'hit' ? 8 : 2;
      for (let i = 0; i < count; i++) {
        const sequence = ++this.sequence, angle = sequence * 2.39996323, speed = burst ? 7 : event.type === 'hit' ? 3 : .8;
        this.particles.push({ position: new THREE.Vector3(event.x, event.y, event.z),
          velocity: new THREE.Vector3(Math.sin(angle) * speed, ((sequence % 7) / 3 - 1) * speed, Math.cos(angle) * speed),
          age: 0, life: burst ? .9 + sequence % 4 * .1 : .24, size: burst ? .35 : .15,
          color: new THREE.Color(burst ? 0xffba57 : event.owner === 'empire' ? 0x8dff78 : 0xff795f) });
      }
      if (this.particles.length > SPARK_LIMIT) this.particles.splice(0, this.particles.length - SPARK_LIMIT);
    }
  }
  update(pilot: Pilot, time: number): void {
    const dt = this.lastTime === null ? 0 : Math.max(0, Math.min(.05, time - this.lastTime)); this.lastTime = time;
    const s = pilot.state;
    this.fighter.position.set(s.x, s.y, s.z); this.fighter.rotation.set(s.pitch, s.yaw, s.bank, 'YXZ');
    this.flames.forEach((flame, i) => {
      flame.visible = pilot.airborne; flame.scale.y = (s.phase === 'flying' ? .5 + s.speed / 28 : .8) * (1 + Math.sin(time * 23 + i) * .065);
      flame.material.opacity = s.phase === 'emergency' ? .19 : .38;
    });
    const ids = new Set(pilot.ships.map(ship => ship.id));
    for (const id of this.enemies.keys()) if (!ids.has(id)) this.enemies.delete(id);
    let count = 0;
    for (const ship of pilot.ships) {
      const actor = this.enemy(ship.id);
      actor.root.position.set(ship.x, ship.y, ship.z); actor.root.rotation.set(ship.pitch, ship.yaw, ship.bank, 'YXZ'); actor.root.updateMatrixWorld(true);
      actor.parts.forEach((part, i) => this.enemyPools[i].setMatrixAt(count, part.matrixWorld)); count++;
    }
    for (const pool of this.enemyPools) { pool.count = count; pool.visible = count > 0; pool.instanceMatrix.needsUpdate = true; }
    let playerCount = 0, enemyCount = 0;
    for (const bolt of pilot.projectiles) {
      const pool = bolt.owner === 'player' ? this.playerBolts : this.enemyBolts;
      const slot = bolt.owner === 'player' ? playerCount++ : enemyCount++;
      const length = Math.min(2.9, .7 + bolt.age * bolt.speed);
      this.position.set(bolt.x - bolt.dx * length * .5, bolt.y - bolt.dy * length * .5, bolt.z - bolt.dz * length * .5);
      this.direction.set(bolt.dx, bolt.dy, bolt.dz); this.quaternion.setFromUnitVectors(FORWARD, this.direction);
      this.scale.set(1, 1, length); this.matrix.compose(this.position, this.quaternion, this.scale); pool.setMatrixAt(slot, this.matrix);
    }
    for (const [pool, slots] of [[this.playerBolts, playerCount], [this.enemyBolts, enemyCount]] as const) {
      pool.count = slots; pool.visible = slots > 0; pool.instanceMatrix.needsUpdate = true;
    }
    this.padRings.forEach((ring, i) => { ring.material.opacity = pilot.aboard ? .65 : .23; ring.material.color.setHex(pilot.nearestPad.pad.id === FLIGHT_PADS[i].id ? 0x89ffcc : 0x6dbdcb); });
    this.padBeacons.forEach((beacon, i) => { beacon.visible = pilot.aboard; beacon.rotation.y = time * .7; beacon.position.y = FLIGHT_PADS[i].y + 8 + Math.sin(time * 1.8) * .3; });
    let particles = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i]; particle.age += dt;
      if (particle.age >= particle.life) { this.particles.splice(i, 1); continue; }
      particle.position.addScaledVector(particle.velocity, dt); particle.velocity.y -= dt * 1.4;
      this.quaternion.setFromAxisAngle(UP, particle.age * 4); this.scale.setScalar(particle.size * (1 - particle.age / particle.life));
      this.matrix.compose(particle.position, this.quaternion, this.scale); this.sparks.setMatrixAt(particles, this.matrix); this.sparks.setColorAt(particles, particle.color); particles++;
    }
    this.sparks.count = particles; this.sparks.visible = particles > 0; this.sparks.instanceMatrix.needsUpdate = true;
    if (this.sparks.instanceColor) this.sparks.instanceColor.needsUpdate = true;
  }
}
