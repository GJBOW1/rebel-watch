import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type Node={name?:string;children?:number[]};
type Accessor={count:number;min?:number[];max?:number[]};
type Glb={nodes:Node[];meshes:{primitives:{attributes:Record<string,number>;indices?:number}[]}[];accessors:Accessor[];images?:unknown[]};
function asset(name:string):Glb{
 const bytes=readFileSync(new URL(`../public/assets/models/${name}.glb`,import.meta.url));
 assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString()) as Glb;
}
function named(glb:Glb,name:string){const i=glb.nodes.findIndex(node=>node.name===name);assert.ok(i>=0,`${name} exists`);return i;}

test('campaign actors and ships retain color data within their geometry budgets',()=>{
 for(const name of ['grogu','vader','imperial-warden','rebel-fighter','tie-fighter']){
  const glb=asset(name);let triangles=0;
  for(const mesh of glb.meshes)for(const primitive of mesh.primitives){
   const position=glb.accessors[primitive.attributes.POSITION];assert.ok(position.count>0);assert.ok(position.min?.every(Number.isFinite));assert.ok(position.max?.every(Number.isFinite));
   assert.notEqual(primitive.attributes.COLOR_0,undefined,`${name} exports authored vertex colors`);
   triangles+=(primitive.indices===undefined?position.count:glb.accessors[primitive.indices].count)/3;
  }
  assert.ok(triangles>500&&triangles<12000,`${name} geometry budget`);assert.ok(glb.meshes.length<=18,`${name} draw budget`);
 }
});

test('campaign animation pivots survive GLB export with their required hierarchy',()=>{
 const vader=asset('vader');const arm=named(vader,'Actor_Arm_R'),hilt=named(vader,'Saber_Hilt'),blade=named(vader,'Saber_Blade');
 assert.ok(vader.nodes[arm].children?.includes(hilt));assert.ok(vader.nodes[hilt].children?.includes(blade));
 const grogu=asset('grogu');for(const name of ['Pram_Body','Pram_Canopy','Actor_Head','Actor_Arm_L','Actor_Arm_R'])named(grogu,name);
 for(const ship of ['rebel-fighter','tie-fighter'])for(const name of ['Engine_L','Engine_R','Muzzle_L','Muzzle_R'])named(asset(ship),name);
});

test('weapon exports stay small and provide a forward muzzle attachment',()=>{
 for(const name of ['ion-lance','scatter-blaster','arc-repeater']){
  const glb=asset(name);assert.equal(glb.images?.length??0,0);assert.ok(glb.meshes.length<=2);named(glb,'Muzzle');named(glb,'Weapon_Body');
 }
});
