import * as THREE from 'three';
import type { CityLife } from './city-life';
import type { StreetBattle, Guardian } from './street-battle';
interface Actor{root:THREE.Group;parts:THREE.Mesh[];joints:{node:THREE.Object3D;rest:THREE.Euler}[]}
interface Batch{template:THREE.Group;actors:Map<number,Actor>;pools:THREE.InstancedMesh[];materials:THREE.Material[]}
/** One instance batch per authored joint/material, shared by all matching citizens. */
export class PopulationView{
 private batches=new Map<string,Batch>();private mat=new THREE.Matrix4();private frustum=new THREE.Frustum();private projection=new THREE.Matrix4();private sphere=new THREE.Sphere(new THREE.Vector3(),1.7);
 constructor(private scene:THREE.Scene,templates:Record<string,THREE.Group>){
  for(const [kind,template] of Object.entries(templates)){
   if(kind!=='jedi'){this.batches.set(kind,{template,actors:new Map(),pools:[],materials:[]});continue;}
   for(const hue of ['blue','green']){const variant=template.clone(true);variant.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const recolor=(m:THREE.Material)=>{if(!/luminous saber/i.test(m.name))return m;const material=(m as THREE.MeshStandardMaterial).clone();material.color.setHex(hue==='green'?0xddffdd:0xddefff);material.emissive.setHex(hue==='green'?0x54ff76:0x66cfff);material.emissiveIntensity=4;return material;};o.material=Array.isArray(o.material)?o.material.map(recolor):recolor(o.material);});this.batches.set(`jedi-${hue}`,{template:variant,actors:new Map(),pools:[],materials:[]});}
  }
 }
 private actor(batch:Batch,id:number):Actor{const known=batch.actors.get(id);if(known)return known;const root=batch.template.clone(true),parts:THREE.Mesh[]=[],joints:Actor['joints']=[];root.traverse(o=>{if(o instanceof THREE.Mesh)parts.push(o);else if(/^Actor_|Saber_/.test(o.name))joints.push({node:o,rest:o.rotation.clone()});});
  if(!batch.pools.length)for(const part of parts){const m=new THREE.InstancedMesh(part.geometry,part.material,20);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.name='City population · '+part.name;this.scene.add(m);batch.pools.push(m);}
  const actor={root,parts,joints};batch.actors.set(id,actor);return actor;
 }
 update(life:CityLife,battle:StreetBattle,camera:THREE.Camera,time:number):void{
  camera.updateMatrixWorld();this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const records=[...(life.enabled?life.citizens.map(n=>({...n,kind:n.kind,guardian:null as Guardian|null})):[]),...battle.guardians.filter(g=>g.visible&&g.health>0).map(g=>({...g,kind:`jedi-${g.saberColor}`,talking:0,guardian:g}))];
  for(const [kind,batch]of this.batches){let count=0;for(const n of records.filter(n=>n.kind===kind)){this.sphere.center.set(n.x,.85,n.z);if(!this.frustum.intersectsSphere(this.sphere))continue;const a=this.actor(batch,n.id);a.root.position.set(n.x,0,n.z);a.root.rotation.set(0,n.yaw,0);
    for(const {node,rest}of a.joints){node.rotation.copy(rest);if(/Leg/.test(node.name)&&kind!=='droid-astromech')node.rotation.x+=Math.sin(time*(kind==='droid-astromech'?4:6)+n.id)*Math.min(n.speed,1)*.26*(/_L$/.test(node.name)?1:-1);if(/Arm/.test(node.name))node.rotation.x+=Math.sin(time*6+n.id)*Math.min(n.speed,1)*.18*(/_L$/.test(node.name)?-1:1);if(/Head/.test(node.name)&&n.speed<.1)node.rotation.y+=Math.sin(time*.8+n.id)*.07;if(/Cloak/.test(node.name))node.rotation.x+=Math.sin(time*2+n.id)*.025;}
    const g=n.guardian;if(g){const arm=a.root.getObjectByName('Actor_Arm_R');if(arm){arm.rotation.x=.25+Math.sin(Math.max(0,g.swing)*Math.PI/.42)*1.05;arm.rotation.z=-.25-Math.sin(Math.max(0,g.swing)*Math.PI/.42)*1.2;arm.rotation.y=Math.sin(Math.max(0,g.swing)*Math.PI/.42)*.8;}}
    a.root.updateMatrixWorld(true);
    a.parts.forEach((part,i)=>{this.mat.copy(part.matrixWorld);if(g){let node:THREE.Object3D|null=part;let blade=false;while(node){if(node.name.startsWith('Saber_Blade'))blade=true;node=node.parent;}if(blade&&(g.state==='arriving'||g.state==='leaving'))this.mat.scale(new THREE.Vector3(0,0,0));}batch.pools[i].setMatrixAt(count,this.mat);if(g)batch.pools[i].setColorAt(count,new THREE.Color(0xffffff));else batch.pools[i].setColorAt(count,new THREE.Color(n.id%3===0?0xf6eddb:n.id%3===1?0xe3eeed:0xffffff));});count++;
   }
   for(const pool of batch.pools){pool.count=count;pool.visible=count>0;pool.instanceMatrix.needsUpdate=true;if(pool.instanceColor)pool.instanceColor.needsUpdate=true;}
   const active=new Set(records.filter(n=>n.kind===kind).map(n=>n.id));for(const id of batch.actors.keys())if(!active.has(id))batch.actors.delete(id);
  }
 }
}
