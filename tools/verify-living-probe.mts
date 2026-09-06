import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Combat } from '../src/combat.ts';
import { StreetBattle } from '../src/street-battle.ts';
import { Navigation, WORLD, Simulation } from '../src/simulation.ts';
import { CityLife } from '../src/city-life.ts';
const manifest=JSON.parse(readFileSync(new URL('../public/assets/models/manifest.json',import.meta.url),'utf8'));
let report:any[]=[];
for(const district of WORLD.districts){
 const nav=new Navigation(manifest.obstacles,.43),combat=new Combat(nav),battle=new StreetBattle(nav,combat);
 const player=nav.isFree(district.center)?{...district.center}:nav.path({x:3,z:6},district.center).at(-1)!;
 battle.setEnabled(true,player);const requested=battle.requestEncounter(player);let allDeadAt=-1,completeAt=-1;
 for(let i=0;i<300*60;i++){battle.tick(1/60,player);combat.tick(1/60,player);battle.drainEvents();combat.drainEvents();if(!combat.enemies.some(e=>e.health>0)&&allDeadAt<0)allDeadAt=i/60;if(battle.completedEncounters>0&&completeAt<0)completeAt=i/60;}
 report.push({district:district.id,player,requested,phase:battle.phase,completed:battle.completedEncounters,allDeadAt,completeAt,guardians:battle.guardians,enemies:combat.enemies.map(e=>({id:e.id,x:e.x,z:e.z,health:e.health}))});
}
const nav=new Navigation(manifest.obstacles,.43),combat=new Combat(nav),battle=new StreetBattle(nav,combat),player={x:3,z:6};battle.setEnabled(true,player);battle.join(player);for(const e of combat.enemies)combat.damageEnemy(e.id,66,true);for(let i=0;i<10*60;i++){battle.tick(1/60,player);combat.tick(1/60,player);}report.push({case:'player clears patrol before Jedi',joined:battle.joined,phase:battle.phase,alive:combat.enemies.length,completed:battle.completedEncounters,events:battle.drainEvents()});
const life=new CityLife(manifest.obstacles);let minimum=10,which:any=null;for(let i=0;i<300*60;i++){life.tick(1/60,{x:3,z:6},{x:1.5,z:7});for(const a of life.citizens)for(const b of life.citizens){if(a.id>=b.id)continue;const d=Math.hypot(a.x-b.x,a.z-b.z);if(d<minimum){minimum=d;which={time:i/60,a:{...a,path:undefined,route:undefined},b:{...b,path:undefined,route:undefined}}}}}report.push({case:'closest civilian overlap',minimum,which});
mkdirSync(new URL('../outputs/',import.meta.url),{recursive:true});
writeFileSync(new URL('../outputs/living-review-reproduced.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
