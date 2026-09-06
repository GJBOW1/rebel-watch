import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GroguFollower } from '../src/grogu.ts';
import { CAMPAIGN_LOCATIONS as P } from '../src/campaign.ts';
import { Navigation, Simulation, type Obstacle, type Vec2 } from '../src/simulation.ts';

const manifest=JSON.parse(readFileSync(new URL('../public/assets/models/manifest.json',import.meta.url),'utf8')) as {obstacles:Obstacle[]};
const nav=new Navigation(manifest.obstacles,.51);
const gap=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.z-b.z);
function party(){
 const sim=new Simulation(manifest.obstacles),grogu=new GroguFollower(nav);
 Object.assign(sim.player,{x:0,z:-64});Object.assign(sim.droid,{x:0,z:-66});grogu.settle({x:.2,z:-66});
 return {sim,grogu};
}
function frame(sim:Simulation,grogu:GroguFollower,run=false){
 const before={x:grogu.x,z:grogu.z};sim.tick(1/60,{x:0,z:0,run});grogu.tick(1/60,sim.player,sim.droid,true);
 assert.ok(nav.isFree(grogu),`pram stays clear at ${JSON.stringify(before)}`);
 assert.ok(gap(before,grogu)<9/60,'follower motion stays continuous');
}
function wait(sim:Simulation,grogu:GroguFollower,seconds:number){for(let i=0;i<seconds*60;i++)frame(sim,grogu);}
function walk(sim:Simulation,grogu:GroguFollower,target:Vec2,run=false){
 sim.walkTo(target);let arrived=false;
 for(let i=0;i<3000;i++){frame(sim,grogu,run);if(gap(sim.player,target)<.16){arrived=true;break;}}
 assert.ok(arrived,`hunter reaches ${JSON.stringify(target)}`);wait(sim,grogu,6);
 assert.ok(gap(sim.player,grogu)<2.75,`Grogu catches up at ${JSON.stringify(target)}; actual ${JSON.stringify({x:grogu.x,z:grogu.z})}`);
}

test('stopped companions separate on real refuge ground and remain still after settling',()=>{
 const {sim,grogu}=party();wait(sim,grogu,5);
 assert.ok(gap(grogu,sim.droid)>=1.2,'resting pram no longer overlaps Tallow');
 assert.ok(gap(grogu,sim.player)<2.6,'separation keeps Grogu within escort reach');
 const stopped={x:grogu.x,z:grogu.z};wait(sim,grogu,5);assert.ok(gap(stopped,grogu)<.025,'idle slot does not drift or jitter');
 sim.command('call');wait(sim,grogu,5);
 assert.ok(gap(grogu,sim.droid)>=1.2,'Tallow can recall past the pram and settle separately');
});

test('seeded refuge stops keep distinct silhouettes while real Tallow pursuit changes direction',()=>{
 const {sim,grogu}=party();let seed=21974;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 const targets=Array.from({length:32},()=>({x:(random()-.5)*14,z:-64+(random()-.5)*14})).filter(p=>nav.isFree(p,2));
 assert.ok(targets.length>=8);
 for(const [i,target] of targets.entries()){
  walk(sim,grogu,target,i%2===0);assert.ok(gap(grogu,sim.droid)>=1.2,`distinct silhouettes after seeded stop ${i}`);
  const stopped={x:grogu.x,z:grogu.z};wait(sim,grogu,2);assert.ok(gap(stopped,grogu)<.025,`stable stop ${i}`);
 }
});

test('continuous escort survives actual narrow thresholds, archive arrival and fighter boarding',()=>{
 const {sim,grogu}=party();
 for(const point of [{x:0,z:-45},{x:0,z:-28},{x:0,z:-12},{x:10,z:0},{x:18,z:0},{x:27,z:0},{x:47,z:0},P.archive])walk(sim,grogu,point,true);
 assert.ok(gap(grogu,P.archive)<3,'Grogu reaches the archive mission radius');
 for(const point of [{x:47,z:0},{x:27,z:0},{x:10,z:0},{x:-30,z:0},{x:-50,z:0},P.boarding])walk(sim,grogu,point,true);
 assert.ok(gap(grogu,P.boarding)<5,'Grogu reaches the boarding mission radius');
});
