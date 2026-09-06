/** 10 cm / 5 cm sampling compares the new map to the saved seven-district baseline. */
import {readFileSync,writeFileSync} from 'node:fs';
import {Navigation,WALK_AREAS,type Obstacle,type WalkArea} from '../src/simulation.ts';
const baseline=JSON.parse(readFileSync(new URL('../tests/fixtures/campaign-baseline.json',import.meta.url),'utf8'));
const current=JSON.parse(readFileSync(new URL('../public/assets/models/manifest.json',import.meta.url),'utf8'));
const oldAreas:WalkArea[]=[...baseline.districts.map((d:{bounds:WalkArea})=>d.bounds),...baseline.connections];
function measure(obstacles:Obstacle[],areas:WalkArea[],radius:number,step:number){
 const nav=new Navigation(obstacles,radius,areas),minX=Math.min(...areas.map(r=>r.minX)),maxX=Math.max(...areas.map(r=>r.maxX)),minZ=Math.min(...areas.map(r=>r.minZ)),maxZ=Math.max(...areas.map(r=>r.maxZ));
 const nx=Math.ceil((maxX-minX)/step),nz=Math.ceil((maxZ-minZ)/step),free=new Uint8Array(nx*nz);let count=0;
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++)if(nav.isFree({x:minX+(x+.5)*step,z:minZ+(z+.5)*step})){free[z*nx+x]=1;count++;}
 const origin=Math.floor((6-minZ)/step)*nx+Math.floor((3-minX)/step);if(!free[origin])throw Error('Starting point blocked');
 const q=new Int32Array(nx*nz);let head=0,tail=1;q[0]=origin;free[origin]=2;
 while(head<tail){const id=q[head++],x=id%nx,z=Math.floor(id/nx);for(const n of [x?id-1:-1,x+1<nx?id+1:-1,z?id-nx:-1,z+1<nz?id+nx:-1])if(n>=0&&free[n]===1){free[n]=2;q[tail++]=n;}}
 return{total:count*step*step,connected:tail*step*step};
}
const results=[];for(const radius of [.42,.48])for(const step of [.10,.05]){
 const old=measure(baseline.obstacles,oldAreas,radius,step),now=measure(current.obstacles,WALK_AREAS,radius,step);
 results.push({radius,step,baselineSquareMetres:old,newSquareMetres:now,connectedAreaRatio:now.connected/old.connected});
}
const report={method:'Actor-radius Navigation.isFree samples plus four-neighbor flood fill from(3,6). Comparison is saved seven-district game versus ten-district campaign. Values approximate square metres.',results};
writeFileSync(new URL('../outputs/campaign-area.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(results.some(r=>r.connectedAreaRatio<2))process.exitCode=1;
