import * as THREE from 'three';
import { Combat, COMBAT_LIMITS, type CombatEnemy, type CombatEvent } from './combat';
import type { Vec2 } from './simulation';

interface Articulation { object: THREE.Object3D; rest: THREE.Euler }
interface RaiderView {
  root: THREE.Group;
  actor: THREE.Group;
  arm: THREE.Object3D | undefined;
  weapon: THREE.Group;
  muzzle: THREE.Object3D;
  joints: Articulation[];
  parts: THREE.Mesh[];
  healthRing: THREE.Mesh<THREE.RingGeometry, THREE.ShaderMaterial>;
  warning: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  aimRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  downAge: number;
}
interface Spark {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  age: number;
  life: number;
  size: number;
}

const GRIP = new THREE.Vector3(0.048, -0.513, 0.087);
const LOCAL_MUZZLE = new THREE.Vector3(0, 0.11, 0.718);
const CYAN = new THREE.Color(0x78e9ff).multiplyScalar(2.3);
const ORANGE = new THREE.Color(0xff673b).multiplyScalar(2.3);
const UP = new THREE.Vector3(0, 1, 0);
const EFFECT_CAP = 48;

/** Original Blender actors and weapon, with pooled, locally authored shot effects. */
export class CombatView {
  private readonly enemyTemplate: THREE.Group;
  private readonly enemyWeaponTemplate: THREE.Group;
  private readonly playerArm: THREE.Object3D | undefined;
  private readonly playerMuzzle = new THREE.Object3D();
  private readonly raiders = new Map<number, RaiderView>();
  private readonly raiderParts: THREE.InstancedMesh[] = [];
  private readonly playerBolts: THREE.InstancedMesh;
  private readonly playerHalos: THREE.InstancedMesh;
  private readonly enemyBolts: THREE.InstancedMesh;
  private readonly enemyHalos: THREE.InstancedMesh;
  private readonly sparkMesh: THREE.InstancedMesh;
  private readonly effects: Spark[] = [];
  private readonly ringGeometry = new THREE.RingGeometry(0.57, 0.602, 40);
  private readonly aimGeometry = new THREE.RingGeometry(0.23, 0.25, 24);
  private readonly matrix = new THREE.Matrix4();
  private readonly rotation = new THREE.Quaternion();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly muzzlePosition = new THREE.Vector3();
  private effectSequence = 0;
  private recoil = 0;

  constructor(private readonly scene: THREE.Scene, private readonly hunter: THREE.Group, private readonly blaster: THREE.Group, trooper?:THREE.Group) {
    // Clone before attaching the player's gun: otherwise each raider inherits
    // that exact object as well as its own weapon, doubling guns and materials.
    this.enemyTemplate = (trooper??hunter).clone(true);
    this.enemyTemplate.position.set(0, 0, 0);
    this.enemyTemplate.rotation.set(0, 0, 0);
    this.enemyTemplate.name = trooper?'Stormtrooper patrol':'Ashen levy';
    if(!trooper)this.tintRaider(this.enemyTemplate);
    this.enemyWeaponTemplate = blaster.clone(true);
    this.tintRaider(this.enemyWeaponTemplate);

    this.playerArm = hunter.getObjectByName('Hunter_Arm_R');
    if (!this.playerArm) throw new Error('The original hunter rig is missing Hunter_Arm_R.');
    blaster.name = 'Cairn pulse carbine';
    blaster.position.copy(GRIP);
    blaster.rotation.set(Math.PI / 2, 0, 0);
    blaster.visible = false;
    this.playerArm.add(blaster);
    this.playerMuzzle.name = 'Cairn physical muzzle';
    this.playerMuzzle.position.copy(LOCAL_MUZZLE);
    blaster.add(this.playerMuzzle);

    const boltGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.playerBolts = this.boltPool(boltGeometry, CYAN, false);
    this.playerHalos = this.boltPool(boltGeometry, CYAN, true);
    this.enemyBolts = this.boltPool(boltGeometry, ORANGE, false);
    this.enemyHalos = this.boltPool(boltGeometry, ORANGE, true);
    this.sparkMesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      EFFECT_CAP,
    );
    this.sparkMesh.name = 'Pooled carbine muzzle and impact sparks';
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.count = 0;
    scene.add(this.sparkMesh);
  }

  /** Cloned material objects keep every player's armor/optic material unchanged. */
  private tintRaider(group: THREE.Group): void {
    const replacements = new Map<THREE.Material, THREE.Material>();
    group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const tint = (original: THREE.Material) => {
        let material = replacements.get(original);
        if (material) return material;
        material = original.clone();
        if (material instanceof THREE.MeshStandardMaterial) {
          if (/cyan|optic|amber|cell/i.test(material.name)) {
            material.emissive.setHex(0xff4427);
            material.emissiveIntensity = 2.8;
            material.color.setHex(0xa3442e);
          } else if (/stormsteel|white metal|ceramic/i.test(material.name)) {
            material.color.setHex(0x896f5e);
            material.roughness = Math.max(0.52, material.roughness);
          } else if (/canvas|seam/i.test(material.name)) {
            material.color.setHex(0x42414a);
          }
        }
        replacements.set(original, material);
        return material;
      };
      object.material = Array.isArray(object.material) ? object.material.map(tint) : tint(object.material);
      object.castShadow = true;
      object.receiveShadow = true;
    });
  }

  private boltPool(geometry: THREE.BoxGeometry, color: THREE.Color, halo: boolean): THREE.InstancedMesh {
    const pool = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({
      color, transparent: halo, opacity: halo ? 0.14 : 1,
      depthWrite: !halo, toneMapped: false,
      blending: halo ? THREE.AdditiveBlending : THREE.NormalBlending,
    }), COMBAT_LIMITS.projectiles);
    pool.name = halo ? 'Pooled energy bolt halo' : 'Pooled energy bolt core';
    pool.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    pool.frustumCulled = false;
    pool.count = 0;
    this.scene.add(pool);
    return pool;
  }

  private createRaider(id: number): RaiderView {
    const root = new THREE.Group(); root.name = `Ashen levy ${id}`;
    const actor = this.enemyTemplate.clone(true);
    const arm = actor.getObjectByName('Actor_Arm_R')??actor.getObjectByName('Hunter_Arm_R');
    const weapon = this.enemyWeaponTemplate.clone(true);
    weapon.position.copy(arm?.name.startsWith('Actor_')?new THREE.Vector3(0,-.60,.10):GRIP); weapon.rotation.set(Math.PI / 2, 0, 0);
    if (!arm) throw new Error('Raider animation requires the original hunter shoulder pivot.');
    arm.add(weapon);
    const muzzle = new THREE.Object3D(); muzzle.position.copy(LOCAL_MUZZLE); weapon.add(muzzle);
    const joints: Articulation[] = [];
    const parts: THREE.Mesh[] = [];
    actor.traverse(object => {
      if (!(object instanceof THREE.Mesh) && /^(Hunter|Actor)_(Leg|Arm|Head|Cloak)/.test(object.name)) joints.push({ object, rest: object.rotation.clone() });
      if (object instanceof THREE.Mesh) parts.push(object);
    });
    // Blender has already merged every static parent/material pair. Each of the
    // 34 remaining meshes belongs to an articulated part or a distinct material.
    // Instance corresponding parts across the squad instead of merging joints:
    // 6 x 34 model submissions become 34, with the exact same world transforms.
    if (!this.raiderParts.length) for (const part of parts) {
      const pool = new THREE.InstancedMesh(part.geometry, part.material, COMBAT_LIMITS.enemies);
      pool.name = `Instanced levy part · ${part.name}`;
      pool.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      pool.castShadow = part.castShadow; pool.receiveShadow = part.receiveShadow;
      pool.frustumCulled = false; pool.count = 0; pool.visible = false;
      this.raiderParts.push(pool); this.scene.add(pool);
    }
    // Keep the original hierarchy for joint and muzzle transforms, but render
    // its meshes only through the shared instance batches below.
    actor.visible = false;
    const healthRing = new THREE.Mesh(this.ringGeometry, new THREE.ShaderMaterial({
      uniforms: { health: { value: 1 }, alpha: { value: 0.65 } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 p; void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform float health; uniform float alpha; varying vec2 p; void main(){float a=mod(atan(p.y,p.x)+6.2831853,6.2831853)/6.2831853;float filled=step(a,health);gl_FragColor=vec4(mix(vec3(.18,.20,.22),vec3(.95,.35,.19),filled),alpha*mix(.28,1.,filled));}',
    }));
    healthRing.rotation.x = -Math.PI / 2; healthRing.position.y = 0.052;
    const warningGeometry = new THREE.BufferGeometry();
    warningGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3).setUsage(THREE.DynamicDrawUsage));
    const warning = new THREE.Line(warningGeometry, new THREE.LineBasicMaterial({ color: 0xff7055, transparent: true, opacity: 0.35, depthWrite: false }));
    warning.frustumCulled = false; warning.visible = false;
    const aimRing = new THREE.Mesh(this.aimGeometry, new THREE.MeshBasicMaterial({ color: 0xff8064, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
    aimRing.rotation.x = -Math.PI / 2; aimRing.visible = false;
    root.add(actor, healthRing); this.scene.add(root, warning, aimRing);
    const view = { root, actor, arm, weapon, muzzle, joints, parts, healthRing, warning, aimRing, downAge: 0 };
    this.raiders.set(id, view);
    return view;
  }

  update(combat: Combat, aim: Vec2, elapsed: number, dt: number): void {
    this.recoil = Math.max(0, this.recoil - Math.max(0, dt));
    this.blaster.visible = combat.equipped;
    if (combat.equipped && this.playerArm) {
      if (Number.isFinite(aim.x) && Number.isFinite(aim.z) && Math.hypot(aim.x - this.hunter.position.x, aim.z - this.hunter.position.z) > 0.01) {
        this.hunter.rotation.y = Math.atan2(aim.x - this.hunter.position.x, aim.z - this.hunter.position.z);
      }
      // These run after exploration's joint animation, and cancel one another's
      // pitch so the modeled hand grips the carbine with its barrel facing +Z.
      this.playerArm.rotation.set(-Math.PI / 2, 0, 0);
      this.blaster.rotation.set(Math.PI / 2, 0, 0);
      this.blaster.position.copy(GRIP);
      // Recoil is along the posed barrel's world axis, kept small enough that
      // the hand still visually surrounds the grip during the kick.
      this.blaster.position.y += this.recoil / 0.11 * 0.022;
    }
    this.hunter.updateMatrixWorld(true);

    const alive = new Set(combat.enemies.map(enemy => enemy.id));
    for (const [id, view] of this.raiders) if (!alive.has(id)) this.removeRaider(id, view);
    for (const enemy of combat.enemies) this.updateRaider(this.raiders.get(enemy.id) ?? this.createRaider(enemy.id), enemy, elapsed, dt,!!combat.director&&!combat.director.playerHostile&&combat.director.allies.length===0);
    for(const view of this.raiders.values())view.healthRing.material.uniforms.alpha.value=combat.director&&!combat.director.playerHostile?.2:.65;
    this.updateInstancedRaiders();
    this.updateBolts(combat);
    this.updateEffects(dt);
  }

  /** The actual Blender muzzle after hierarchy and aim transforms are applied. */
  muzzle(): Vec2 {
    this.playerMuzzle.getWorldPosition(this.muzzlePosition);
    return { x: this.muzzlePosition.x, z: this.muzzlePosition.z };
  }

  private updateRaider(view: RaiderView, enemy: CombatEnemy, elapsed: number, dt: number, peaceful:boolean): void {
    view.root.position.set(enemy.x, 0, enemy.z);
    view.actor.rotation.set(0, enemy.yaw, 0);
    view.actor.position.y = 0;
    view.actor.scale.setScalar(1);
    for (const joint of view.joints) {
      joint.object.rotation.copy(joint.rest);
      if (/Leg/.test(joint.object.name)) {
        joint.object.rotation.x += Math.sin(elapsed * 8 + enemy.id * 0.7) * Math.min(enemy.speed / 4, 1) * 0.32 * (/_L$/.test(joint.object.name) ? 1 : -1);
      } else if (/Arm_L/.test(joint.object.name)) {
        joint.object.rotation.x += Math.sin(elapsed * 8 + enemy.id * 0.7) * Math.min(enemy.speed / 4, 1) * 0.2;
      } else if (/Cloak/.test(joint.object.name)) joint.object.rotation.x += Math.sin(elapsed * 3 + enemy.id) * 0.025;
    }
    if (view.arm) view.arm.rotation.set(peaceful?-.42:-Math.PI / 2, 0, 0);
    view.healthRing.material.uniforms.health.value = Math.max(0, enemy.health / enemy.maxHealth);
    view.healthRing.visible = enemy.health > 0;
    view.warning.visible = enemy.state === 'aim';
    view.aimRing.visible = view.warning.visible;
    if (view.warning.visible) {
      const positions = view.warning.geometry.getAttribute('position') as THREE.BufferAttribute;
      positions.setXYZ(0, enemy.x, 0.064, enemy.z);
      positions.setXYZ(1, enemy.aimX, 0.064, enemy.aimZ);
      positions.needsUpdate = true;
      view.warning.material.opacity = 0.15 + enemy.telegraph * 0.45;
      view.aimRing.position.set(enemy.aimX, 0.063, enemy.aimZ);
      view.aimRing.scale.setScalar(1.6 - enemy.telegraph * 0.6);
      view.aimRing.material.opacity = 0.3 + enemy.telegraph * 0.45;
    }
    if (enemy.state === 'down') {
      view.downAge += Math.max(0, dt);
      const fall = Math.min(1, view.downAge / 0.38);
      const eased = fall * fall * (3 - 2 * fall);
      view.actor.rotation.z = -Math.PI / 2 * eased;
      view.actor.position.y = 0.25 * eased;
      view.actor.scale.setScalar(Math.max(0.01, 1 - Math.max(0, view.downAge - 0.58) / 0.27));
    }
    view.root.updateMatrixWorld(true);
  }

  private removeRaider(id: number, view: RaiderView): void {
    this.scene.remove(view.root, view.warning, view.aimRing);
    // Geometry and cloned armor materials are shared by the six actor views.
    // Only these per-actor warning/HUD resources are owned by an individual.
    view.warning.geometry.dispose(); view.warning.material.dispose();
    view.aimRing.material.dispose(); view.healthRing.material.dispose();
    this.raiders.delete(id);
  }

  private updateInstancedRaiders(): void {
    let slot = 0;
    for (const view of this.raiders.values()) {
      if (slot >= COMBAT_LIMITS.enemies) break;
      // updateRaider has updated every joint's matrix, including defeated actors
      // folding to the ground. No pose approximation is introduced by batching.
      for (let part = 0; part < view.parts.length; part++) this.raiderParts[part].setMatrixAt(slot, view.parts[part].matrixWorld);
      slot++;
    }
    for (const pool of this.raiderParts) {
      pool.count = slot; pool.visible = slot > 0; pool.instanceMatrix.needsUpdate = true;
    }
  }

  private updateBolts(combat: Combat): void {
    let cyanCount = 0, orangeCount = 0;
    for (const bolt of combat.projectiles) {
      const friendly = bolt.owner === 'player';
      const index = friendly ? cyanCount++ : orangeCount++;
      const core = friendly ? this.playerBolts : this.enemyBolts;
      const halo = friendly ? this.playerHalos : this.enemyHalos;
      const length = Math.min(0.9, 0.2 + bolt.age * bolt.speed);
      this.position.set(bolt.x - bolt.dx * length * 0.5, 1.565, bolt.z - bolt.dz * length * 0.5);
      this.rotation.setFromAxisAngle(UP, Math.atan2(bolt.dx, bolt.dz));
      this.scale.set(0.042, 0.042, length);
      this.matrix.compose(this.position, this.rotation, this.scale); core.setMatrixAt(index, this.matrix);
      this.scale.set(0.115, 0.115, length * 1.08);
      this.matrix.compose(this.position, this.rotation, this.scale); halo.setMatrixAt(index, this.matrix);
    }
    for (const [pool, count] of [[this.playerBolts, cyanCount], [this.playerHalos, cyanCount], [this.enemyBolts, orangeCount], [this.enemyHalos, orangeCount]] as const) {
      pool.count = count; pool.visible = count > 0; pool.instanceMatrix.needsUpdate = true;
    }
  }

  events(events: CombatEvent[]): void {
    for (const event of events) {
      if (event.type !== 'fire' && event.type !== 'impact' && event.type !== 'enemy-down') continue;
      const color = event.owner === 'player' ? CYAN : ORANGE;
      this.position.set(event.x, 1.565, event.z);
      if (event.type === 'fire') {
        if (event.owner === 'player') { this.playerMuzzle.getWorldPosition(this.position); this.recoil = 0.11; }
        else if (event.enemyId !== undefined) this.raiders.get(event.enemyId)?.muzzle.getWorldPosition(this.position);
      } else if (event.type === 'enemy-down') this.position.y = 1.1;
      const count = event.type === 'fire' ? 3 : event.type === 'enemy-down' ? 7 : 5;
      for (let i = 0; i < count; i++) {
        const n = ++this.effectSequence;
        const angle = n * 2.39996323;
        const speed = event.type === 'fire' ? 0.35 : 1.2;
        this.effects.push({
          position: this.position.clone(),
          velocity: new THREE.Vector3(Math.sin(angle) * speed, 0.2 + (n % 4) * 0.2, Math.cos(angle) * speed),
          color: color.clone(), age: 0,
          life: event.type === 'fire' ? 0.085 + i * 0.02 : 0.23 + (n % 3) * 0.035,
          size: event.type === 'fire' ? 0.115 - i * 0.023 : 0.065,
        });
      }
      if (this.effects.length > EFFECT_CAP) this.effects.splice(0, this.effects.length - EFFECT_CAP);
    }
  }

  private updateEffects(dt: number): void {
    let count = 0;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.age += Math.max(0, dt);
      if (effect.age >= effect.life) { this.effects.splice(i, 1); continue; }
      effect.position.addScaledVector(effect.velocity, Math.max(0, dt));
      effect.velocity.y -= Math.max(0, dt) * 2.4;
      const fade = 1 - effect.age / effect.life;
      this.scale.setScalar(effect.size * fade);
      this.rotation.identity();
      this.matrix.compose(effect.position, this.rotation, this.scale);
      this.sparkMesh.setMatrixAt(count, this.matrix);
      this.sparkMesh.setColorAt(count, effect.color);
      count++;
    }
    this.sparkMesh.count = count; this.sparkMesh.visible = count > 0;
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
  }
}
