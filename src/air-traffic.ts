import type { Vec2 } from './simulation';
export const DOCKS=[{id:'customs',name:'Customs rooftop',x:-10.2,z:19.7,y:6.6,yaw:Math.PI/2,kind:'shuttle',scale:.72},{id:'exchange',name:'Exchange skyport',x:6.5,z:-39.7,y:8.1,yaw:Math.PI/2,kind:'freighter',scale:.60}] as const;
export type FlightPhase='waiting'|'approach'|'holding'|'landing'|'docked'|'takeoff'|'departure';
export interface Flight extends Vec2{id:number;y:number;yaw:number;bank:number;kind:string;phase:FlightPhase;time:number;thrust:number;dock:typeof DOCKS[number];landings:number;departures:number}
export interface AirEvent{type:'landing'|'takeoff';x:number;y:number;z:number;name:string}
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export class AirTraffic{
 enabled=true;flights:Flight[]=DOCKS.map((dock,id)=>({id,kind:dock.kind,phase:'waiting',time:id===0?4:32,x:dock.x,y:dock.y+24,z:dock.z,yaw:dock.yaw,bank:0,thrust:0,dock,landings:0,departures:0}));private events:AirEvent[]=[];
 requestArrival(player:Vec2):void{this.enabled=true;const f=[...this.flights].sort((a,b)=>Math.hypot(a.dock.x-player.x,a.dock.z-player.z)-Math.hypot(b.dock.x-player.x,b.dock.z-player.z))[0];if(f.phase==='waiting')f.time=0;else if(f.phase==='docked')f.time=Math.min(f.time,2);}
 drainEvents():AirEvent[]{return this.events.splice(0);}
 tick(dt:number,bodies:{x:number;z:number;y?:number}[]=[]):void{if(!this.enabled)return;dt=Math.min(.05,Math.max(0,dt));for(const f of this.flights){const d=f.dock;f.time-=dt;const obstructed=bodies.some(p=>Math.abs((p.y||0)-d.y)<2&&Math.abs(p.x-d.x)<4.5&&Math.abs(p.z-d.z)<3.5);
  const go=(phase:FlightPhase,time:number)=>{f.phase=phase;f.time=time;};
  if(f.phase==='waiting'){f.thrust=0;if(f.time<=0)go('approach',14);}
  if(f.phase==='approach'){const t=smooth(1-f.time/14);f.x=d.x+(f.id===0?-58:-60)*(1-t);f.z=d.z+18*(1-t);f.y=d.y+12+16*(1-t);f.bank=Math.sin(t*Math.PI)*.13*(f.id===0?-1:1);f.thrust=.7;f.yaw=d.yaw;if(f.time<=0)go('holding',1);}
  else if(f.phase==='holding'){f.x=d.x;f.z=d.z;f.y=Math.min(d.y+12,f.y+dt*4);f.bank=0;f.thrust=.6;if(f.time<=0&&!obstructed&&f.y>=d.y+11.99)go('landing',8);}
  else if(f.phase==='landing'){if(obstructed){go('holding',1);continue;}const t=smooth(1-f.time/8);f.y=d.y+12*(1-t);f.thrust=.28+.35*(1-t);if(f.time<=0){f.y=d.y;f.landings++;this.events.push({type:'landing',...d});go('docked',18);}}
  else if(f.phase==='docked'){f.y=d.y;f.thrust=.04;if(f.time<=0){f.departures++;this.events.push({type:'takeoff',...d});go('takeoff',7);}}
  else if(f.phase==='takeoff'){const t=smooth(1-f.time/7);f.y=d.y+12*t;f.thrust=.6;if(f.time<=0)go('departure',13);}
  else if(f.phase==='departure'){const t=smooth(1-f.time/13);f.x=d.x+75*t;f.z=d.z-26*t;f.y=d.y+12+22*t;f.thrust=.9;f.bank=-Math.sin(t*Math.PI)*.10;if(f.time<=0)go('waiting',30+f.id*12);}
 }}
}
