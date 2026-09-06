import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Navigation, WALK_AREAS, WORLD, type Obstacle } from '../src/simulation';

const manifest=JSON.parse(readFileSync(new URL('../public/assets/models/manifest.json',import.meta.url),'utf8')) as {obstacles:Obstacle[]};
const anchors=[
 {name:'Grogu',x:0,z:-65},{name:'west sanctuary relay',x:-10,z:-66},{name:'east sanctuary relay',x:10,z:-66},{name:'north sanctuary relay',x:0,z:-78},
 {name:'refuge landing',x:10,z:-55},{name:'fighter pad',x:-61,z:1},{name:'fighter boarding',x:-61,z:6},
 {name:'east cache',x:-58,z:-8},{name:'central cache',x:-70,z:-8},{name:'west cache',x:-77,z:7},{name:'repair drone',x:-74,z:0},
 {name:'boss arena',x:54,z:34},{name:'west bastion relay',x:45,z:24},{name:'east bastion relay',x:57,z:24},
];
test('campaign preserves ten districts and three traversable new thresholds',()=>{
 assert.equal(WORLD.districts.length,10);
 const nav=new Navigation(manifest.obstacles,.48,WALK_AREAS);
 for(const [a,b] of [[{x:0,z:-41},{x:0,z:-49}],[{x:-42,z:0},{x:-50,z:0}],[{x:47,z:13},{x:47,z:21}]])assert.ok(nav.segmentClear(a,b),`threshold ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
});
for(const radius of [.42,.48])test(`all campaign objective points have complete continuous paths with radius ${radius}`,()=>{
 const nav=new Navigation(manifest.obstacles,radius,WALK_AREAS);
 for(const target of anchors){
  assert.ok(nav.isFree(target),target.name+' is collision free');
  const path=nav.path({x:3,z:6},target);assert.ok(path.length,target.name+' has a route');
  let last={x:3,z:6};for(const point of path){assert.ok(nav.segmentClear(last,point),target.name+' has no clipped path segment');last=point;}
  assert.ok(Math.hypot(last.x-target.x,last.z-target.z)<.02,target.name+' reaches its exact mission point');
 }
});
test('boss arena keeps the full eight-metre combat radius free',()=>{
 const nav=new Navigation(manifest.obstacles,.48,WALK_AREAS);
 for(let x=-8;x<=8;x+=.5)for(let z=-8;z<=8;z+=.5)if(Math.hypot(x,z)<=8)assert.ok(nav.isFree({x:54+x,z:34+z}),`arena offset ${x},${z}`);
});
