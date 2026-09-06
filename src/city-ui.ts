import { WORLD, WALK_AREAS, type Simulation, type Vec2, type Obstacle } from './simulation';
import { INTERIORS, getInterior } from './interiors';
import type { StreetBattle } from './street-battle';
import type { CityLife } from './city-life';
import type { Combat } from './combat';
import type { CampaignMarker } from './campaign';

const q=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
export class CityUI {
  mapOpen=false;
  campaignMarkers:CampaignMarker[]=[];
  selectedMarker:string|null=null;
  private sim:Simulation|null=null;
  private combat:Combat|null=null;private battle:StreetBattle|null=null;private life:CityLife|null=null;
  private obstacles:Obstacle[]=[];
  private map=q<HTMLCanvasElement>('#city-map-canvas');
  private small=q<HTMLCanvasElement>('#minimap');
  private minX=Math.min(...WALK_AREAS.map(r=>r.minX));private maxX=Math.max(...WALK_AREAS.map(r=>r.maxX));private minZ=Math.min(...WALK_AREAS.map(r=>r.minZ));private maxZ=Math.max(...WALK_AREAS.map(r=>r.maxZ));
  constructor(private walk:(point:Vec2)=>void,private pause:(active:boolean)=>void,private equip:()=>void,private enemies:()=>void){
    q('#map-button').addEventListener('click',()=>this.setMap(!this.mapOpen));
    this.small.addEventListener('click',()=>this.setMap(true));
    this.small.tabIndex=0;this.small.setAttribute('role','button');this.small.setAttribute('aria-label','Open city map');
    this.small.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.setMap(true);}});
    q('#city-map-close').addEventListener('click',()=>this.setMap(false));
    q('#equip-button').addEventListener('click',()=>this.equip());
    q('#enemies-button').addEventListener('click',()=>this.enemies());
    q('#interior-exit').addEventListener('click',()=>{const room=this.sim&&getInterior(this.sim.player);if(room&&!this.combat?.defeated)this.walk({x:room.door.outside.x,z:room.door.outside.z+room.door.normalZ*1.5});});
    q('#combat-recover').addEventListener('click',()=>this.enemies());
    this.map.addEventListener('click',e=>{const r=this.map.getBoundingClientRect();const p=this.unproject((e.clientX-r.left)/r.width*this.map.width,(e.clientY-r.top)/r.height*this.map.height,this.map);if(this.sim?.playerNav.isFree(p)){this.setMap(false);this.walk(p);}});
    const list=q('#district-destinations');
    for(const d of WORLD.districts){const b=document.createElement('button');b.dataset.district=d.id;b.textContent=d.name;b.addEventListener('click',()=>{this.setMap(false);this.walk(d.center);});list.append(b);}
    for(const room of INTERIORS){const b=document.createElement('button');b.dataset.building=room.id;b.textContent=room.name;b.addEventListener('click',()=>{this.setMap(false);this.walk(room.center);});q('#building-destinations').append(b);}
    q('#city-map').addEventListener('keydown',e=>{if(e.key!=='Tab')return;const controls=[...q('#city-map').querySelectorAll<HTMLElement>('button')];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
  }
  setMap(open:boolean):void{this.mapOpen=open;q('#city-map').hidden=!open;this.pause(open);if(open){this.draw(this.map,true);q('#city-map-close').focus();}else q('#game').focus();}
  update(sim:Simulation,combat:Combat,obstacles:Obstacle[],freeCam:boolean,battle:StreetBattle,life:CityLife):void{
    this.sim=sim;this.combat=combat;this.battle=battle;this.life=life;this.obstacles=obstacles;
    const room=getInterior(sim.player);q<HTMLButtonElement>('#interior-exit').hidden=!room;q<HTMLButtonElement>('#interior-exit').disabled=combat.defeated;
    q('#interior-count').textContent=`${sim.visitedInteriors.size} / 3 interiors`;
    q('#weather-label').textContent=room?'UNDER SHELTER':'RAIN RECEDED';document.documentElement.classList.toggle('inside-building',!!room);
    q('#district-count').textContent=`${sim.visitedCount} / ${WORLD.districts.length} districts`;
    q('#city-discovery').textContent=`${sim.visitedCount} of ${WORLD.districts.length} districts explored`;
    q('#equip-button').setAttribute('aria-pressed',String(combat.equipped));q('#equip-label').textContent=combat.equipped?'Holster':'Draw blaster';
    q('#enemies-button').setAttribute('aria-pressed',String(combat.enabled));q('#enemies-label').textContent=combat.enabled?'Patrols on':'Patrols off';
    q('#combat-panel').hidden=freeCam||(!combat.equipped&&!battle.joined&&battle.phase!=='skirmish');
    q('#combat-title').textContent=combat.defeated?'SHIELD BROKEN':battle.joined?'FIGHTING WITH THE JEDI':battle.phase==='skirmish'?'OBSERVER · SAFE':'BLASTER READY';
    q('#combat-hint').textContent=combat.defeated?'Stand down to restore your shield.':combat.equipped?'Mouse aim · Click / Space fire · B holster':'J join the Jedi · N disable patrols';
    q('#shield-value').textContent=`${Math.ceil(combat.shield)} / ${combat.maxShield}`;
    q('#shield-fill').style.width=`${Math.max(0,Math.min(100,combat.shield/combat.maxShield*100))}%`;
    q('#shield-meter').setAttribute('aria-valuenow',String(Math.ceil(combat.shield)));
    q('#shield-meter').setAttribute('aria-valuemax',String(combat.maxShield));
    q('#enemy-count').textContent=combat.enabled?`${combat.enemies.filter(e=>e.health>0).length} troopers · ${combat.kills} defeated`:'Quiet streets · N enables enemies';
    q('#combat-recover').hidden=!combat.defeated;
    q('#weapon-help').hidden=!combat.equipped;
    q('#walk-help').hidden=combat.equipped;
    document.documentElement.classList.toggle('weapon-drawn',combat.equipped&&!freeCam);
    this.draw(this.small,false);if(this.mapOpen)this.draw(this.map,true);
    for(const b of q('#building-destinations').querySelectorAll<HTMLButtonElement>('button'))b.classList.toggle('visited',sim.visitedInteriors.has(b.dataset.building!));
    for(const b of q('#district-destinations').querySelectorAll<HTMLButtonElement>('button'))b.classList.toggle('visited',sim.visitedZones.has(b.dataset.district as typeof sim.zone));
  }
  private transform(canvas:HTMLCanvasElement){const pad=canvas===this.small?18:38;const room=canvas===this.small&&this.sim?getInterior(this.sim.player):null;const {minX,maxX,minZ,maxZ}=room?room.bounds:{minX:this.minX,maxX:this.maxX,minZ:this.minZ,maxZ:this.maxZ};const scale=Math.min((canvas.width-pad*2)/(maxX-minX),(canvas.height-pad*2)/(maxZ-minZ));return{scale,ox:(canvas.width-(maxX-minX)*scale)/2-minX*scale,oz:(canvas.height-(maxZ-minZ)*scale)/2-minZ*scale};}
  private unproject(x:number,z:number,c:HTMLCanvasElement):Vec2{const t=this.transform(c);return{x:(x-t.ox)/t.scale,z:(z-t.oz)/t.scale};}
  private draw(c:HTMLCanvasElement,large:boolean):void{
    if(!this.sim)return;const ctx=c.getContext('2d')!,t=this.transform(c),mx=(x:number)=>t.ox+x*t.scale,mz=(z:number)=>t.oz+z*t.scale;
    ctx.clearRect(0,0,c.width,c.height);ctx.strokeStyle='rgba(148,185,194,.075)';ctx.lineWidth=1;
    for(let x=0;x<c.width;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,c.height);ctx.stroke();}for(let y=0;y<c.height;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(c.width,y);ctx.stroke();}
    for(const r of WALK_AREAS){ctx.fillStyle='rgba(113,151,164,.10)';ctx.fillRect(mx(r.minX),mz(r.minZ),(r.maxX-r.minX)*t.scale,(r.maxZ-r.minZ)*t.scale);ctx.strokeStyle='rgba(130,174,184,.45)';ctx.strokeRect(mx(r.minX),mz(r.minZ),(r.maxX-r.minX)*t.scale,(r.maxZ-r.minZ)*t.scale);}
    for(const d of WORLD.districts){const r=d.bounds;ctx.fillStyle=d.id===this.sim.zone?'rgba(162,211,218,.18)':'rgba(98,128,145,.02)';ctx.fillRect(mx(r.minX),mz(r.minZ),(r.maxX-r.minX)*t.scale,(r.maxZ-r.minZ)*t.scale);}
    ctx.fillStyle='rgba(14,21,27,.8)';for(const o of this.obstacles)ctx.fillRect(mx(o.x-o.hx),mz(o.z-o.hz),o.hx*2*t.scale,o.hz*2*t.scale);
    for(const room of INTERIORS){const r=room.bounds;ctx.strokeStyle='#d9ae74';ctx.lineWidth=large?1.5:1;ctx.strokeRect(mx(r.minX),mz(r.minZ),(r.maxX-r.minX)*t.scale,(r.maxZ-r.minZ)*t.scale);ctx.strokeStyle='#aff0e5';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(mx(room.door.x-room.door.width/2),mz(room.door.z));ctx.lineTo(mx(room.door.x+room.door.width/2),mz(room.door.z));ctx.stroke();}
    const dot=(p:Vec2,col:string,r:number)=>{ctx.fillStyle=col;ctx.beginPath();ctx.arc(mx(p.x),mz(p.z),r,0,Math.PI*2);ctx.fill();};
    if(!this.sim.token.collected)dot(this.sim.token,'#ecd09c',large?4:2);
    for(const item of WORLD.landmarks)dot(item,'#80bfda',large?3:1.3);
    if(this.life?.enabled)for(const n of this.life.citizens)dot(n,'#c4ccc0',large?2.8:1.1);
    for(const g of this.battle?.guardians||[])if(g.visible&&g.health>0)dot(g,g.saberColor==='green'?'#aff3b4':'#80dfff',large?4:2);
    for(const e of this.combat?.enemies||[])if(e.health>0)dot(e,this.battle?.joined?'#f48768':'#d8b592',large?4:2);
    for(const marker of this.campaignMarkers){dot(marker,marker.kind==='boss'?'#f48768':marker.kind==='side'?'#8bcfd9':'#efd393',large?4:2);if(marker.id===this.selectedMarker){ctx.strokeStyle='#f7e8b7';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(mx(marker.x),mz(marker.z),large?8:4,0,Math.PI*2);ctx.stroke();}}
    dot(this.sim.droid,'#abecdd',large?4:2.4);ctx.shadowColor='#ffe1ab';ctx.shadowBlur=12;dot(this.sim.player,'#ffdaa5',large?5:3);ctx.shadowBlur=0;
    if(large){ctx.font='12px system-ui';ctx.textAlign='center';for(const d of WORLD.districts){ctx.fillStyle=this.sim.visitedZones.has(d.id as typeof this.sim.zone)?'#d6e5df':'#a1b2b6';ctx.fillText(d.name.toUpperCase(),mx(d.center.x),mz(d.bounds.minZ)+18);}ctx.textAlign='left';}
  }
}
