import { Navigation, type Vec2, type Entity } from './simulation';
import { getInterior } from './interiors';
export type CitizenKind='citizen-human'|'citizen-twilek'|'droid-protocol'|'droid-astromech';
export interface Citizen extends Entity{id:number;kind:CitizenKind;name:string;role:string;tint:number;talking:number;line:number;route:Vec2[];path:Vec2[];waypoint:number;pause:number;blocked:number}
const gap=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.z-b.z);
const DATA:{name:string;role:string;kind:CitizenKind;points:number[][];lines:string[]}[]=[
 {name:'Mira Venn',role:'Courier',kind:'citizen-human',points:[[4,5],[6,-3],[3,-8],[-3,-4]],lines:['The evening shuttle is running light. Someone up there finally learned to pack.','The customs roof takes the small transports. The larger freighter docks above Lantern Exchange.','Keep your scout close. The white armor is never here for the weather.']},
 {name:'Sela Renn',role:'Twi’lek trader',kind:'citizen-twilek',points:[[-5,3],[-7,-2],[-4,-8],[3,5]],lines:['A good market is like a good crew. Different faces, the same promise.','Two Jedi passed the relay. They asked after the patrols, not the prices.','That little droid has chosen you. Treat that as the honor it is.']},
 {name:'IX-7',role:'Protocol liaison',kind:'droid-protocol',points:[[8,3],[4,8],[-3,6],[-5,1]],lines:['Welcome. I speak forty-three trade dialects and tolerate forty-four kinds of delay.','Please observe the rooftop landing signals. The streets remain open during arrivals.','You are not required to participate in a patrol incident. Watching is entirely acceptable.']},
 {name:'Pip',role:'Astromech runner',kind:'droid-astromech',points:[[2,-6],[5,-4],[5,3],[1,8]],lines:['A bright trill. Pip projects a tiny shuttle, followed by an emphatic landing arrow.','Three warm beeps. Tallow answers with one. Apparently, that settled something.','A suspicious little whistle. The scanner points toward the white-armored patrol.']},
 {name:'Joren Vale',role:'Dock mechanic',kind:'citizen-human',points:[[-7,7],[-5,3],[1,5],[6,7]],lines:['A ship can fly with a scar. It cannot fly with a lie in its maintenance book.','The sound of a landing engine means someone has made it home.','I repair ships. Your little friend looks like they repair people.']},
 {name:'Tavi Nemm',role:'Twi’lek navigator',kind:'citizen-twilek',points:[[-5,-20],[0,-23],[5,-25],[1,-30]],lines:['The freighter approaches over the northern roofs. You can see its running lights before you hear it.','I plot routes through stars for a living. This market is still harder.','The Jedi carry their light openly. I am not sure whether that is courage or a warning.']},
 {name:'Bex Oran',role:'Spice merchant',kind:'citizen-human',points:[[-8,-31],[-8.1,-38.1],[-3,-32],[-1,-24]],lines:['The Still Ember keeps a seat warm for travelers. It keeps two for a traveler with a droid.','No, the price does not include the story. The story is free.','Patrols come and go. The people who sweep the street are the ones who keep it.']},
 {name:'A-12',role:'Market protocol',kind:'droid-protocol',points:[[6,-29],[2,-23],[-2,-31],[7,-35]],lines:['The market is open. The argument at the next stall has been open considerably longer.','Today’s exchange rate favors patience. This is not official financial advice.','I have translated the astromech’s complaint. You may wish to cover Tallow’s auditory sensors.']},
 {name:'Nook',role:'Astromech surveyor',kind:'droid-astromech',points:[[-1,-20],[1,-25],[-2,-34],[0,-39]],lines:['Nook draws a neat blue line through a map of the city. The route ends at the cantina.','A low hum. A green light. Whatever was broken is not broken now.','The little projector draws two lightsabers, then a very large exclamation mark.']},
 {name:'Rook Den',role:'Salvage foreman',kind:'citizen-human',points:[[-23,0],[-29,1],[-36,0],[-33,7]],lines:['Nothing is scrap until you have tried to fix it twice.','That repair house has kept this district alive longer than any garrison.','If the shooting starts, step behind stone. Steel remembers every mistake.']},
 {name:'Keeva Sol',role:'Twi’lek technician',kind:'citizen-twilek',points:[[-34,-3],[-40.4,-10.4],[-33,0],[-23,-3]],lines:['Come by the repair bench. I can show you where a machine keeps its heartbeat.','The Jedi deflect the bolts. The rest of us still have to duck.','Tallow’s gait is a little uneven. That is personality, not a fault.']},
 {name:'Patch',role:'Astromech salvager',kind:'droid-astromech',points:[[-21,3],[-29,4],[-34,10],[-25,1]],lines:['A proud chime. Patch displays a bolt that is definitely too large for the compartment it came from.','The dome turns toward the sky. An engine answers from beyond the wall.','Patch offers Tallow a charging cable. The gesture is apparently ceremonial.']},
 {name:'Nera Dax',role:'Shuttle pilot',kind:'citizen-human',points:[[1,20],[-5,22],[-8,27],[6,25]],lines:['The customs roof is the local shuttle dock. The old ship on the ground has earned its rest.','My favorite part of flight is the moment the landing struts take the weight.','The engines sound angry. They are only concentrating.']},
 {name:'C-8',role:'Port liaison',kind:'droid-protocol',points:[[7,30],[8,36],[1,38],[-7,35]],lines:['Arrivals are staggered to keep the landing approaches clear. A rare triumph for scheduling.','The next departure will leave when the captain says, or slightly after.','Please keep your companion away from the fuel stores. This one looks curious.']},
 {name:'Eris Taal',role:'Archive attendant',kind:'citizen-human',points:[[43,2],[49,3],[53.1,10.5],[56,4]],lines:['The archive keeps names. It does not ask which side of a border they came from.','Two guardians sometimes visit the watchline. Their robes carry more dust than ceremony.','Stay with your small friend. The road is easier when someone remembers you.']},
 {name:'Renn',role:'Twi’lek lookout',kind:'citizen-twilek',points:[[39,-2],[43,-3],[48,-1],[51,2]],lines:['From here you can see the patrol before it sees the city.','If you choose to join the Jedi, make that choice with your eyes open.','Look up occasionally. There is more to this place than the ground beneath us.']}
];
export class CityLife{
 citizens:Citizen[]=[];enabled=true;conversations=0;
 private nav:Navigation;
 constructor(obstacles:ConstructorParameters<typeof Navigation>[0]){this.nav=new Navigation(obstacles,.34);this.citizens=DATA.map((d,id)=>{const route=d.points.map(([x,z])=>this.clear({x,z}));return{id,kind:d.kind,name:d.name,role:d.role,tint:id%3,...route[0],yaw:(id*1.7)%(Math.PI*2),speed:0,talking:0,line:0,route,path:[],waypoint:1,pause:id%3,blocked:0};});}
 private clear(p:Vec2):Vec2{if(this.nav.isFree(p))return{...p};for(let r=.4;r<6;r+=.4)for(let a=0;a<16;a++){const q={x:p.x+Math.cos(a*Math.PI/8)*r,z:p.z+Math.sin(a*Math.PI/8)*r};if(this.nav.isFree(q))return q;}throw new Error('No clear civilian route at '+JSON.stringify(p));}
 nearby(player:Vec2):Citizen|undefined{if(!this.enabled)return;return this.citizens.filter(n=>gap(n,player)<2.35&&getInterior(n)?.id===getInterior(player)?.id&&this.nav.segmentClear(n,player)).sort((a,b)=>gap(a,player)-gap(b,player))[0];}
 talk(id:number,player:Vec2):{title:string;text:string}|null{const n=this.citizens.find(n=>n.id===id);if(!n||!this.enabled||gap(n,player)>2.7||!this.nav.segmentClear(n,player))return null;n.talking=9;n.speed=0;n.yaw=Math.atan2(player.x-n.x,player.z-n.z);this.conversations++;const lines=DATA[id].lines;return{title:`${n.name} · ${n.role}`,text:lines[n.line++%lines.length]};}
 tick(dt:number,player:Vec2,droid:Vec2,threats:Vec2[]=[]):void{if(!this.enabled)return;dt=Math.min(.05,Math.max(0,dt));if(!dt)return;
  for(const n of this.citizens){n.speed=0;if(n.talking>0&&gap(n,player)<4){n.talking-=dt;n.yaw=Math.atan2(player.x-n.x,player.z-n.z);continue;}n.talking=0;
   n.pause-=dt;if(n.pause>0)continue;
   if(!n.path.length){n.path=this.nav.path(n,n.route[n.waypoint%n.route.length]);if(!n.path.length){n.waypoint++;n.pause=.5;continue;}}
   while(n.path.length&&gap(n,n.path[0])<.14)n.path.shift();if(!n.path.length){n.waypoint++;n.pause=1.8+n.id%4;continue;}
   const goal=n.path[0],dist=gap(n,goal),pace=n.kind==='droid-astromech'?1.22:1.02;let dx=(goal.x-n.x)/dist,dz=(goal.z-n.z)/dist;
   for(const body of [player,droid,...threats,...this.citizens.filter(o=>o.id!==n.id)]){const d=gap(n,body);if(d>1.3||d<.01)continue;dx+=(n.x-body.x)/d*(1.3-d)*2.3;dz+=(n.z-body.z)/d*(1.3-d)*2.3;}
   const len=Math.hypot(dx,dz),before={x:n.x,z:n.z};if(len>.001){
    const step=Math.min(dist,pace*dt),vx=dx/len*step,vz=dz/len*step;
    const clear=(p:Vec2)=>this.citizens.every(o=>{if(o.id===n.id)return true;const radius=(n.kind==='droid-astromech'?.49:.40)+(o.kind==='droid-astromech'?.49:.40);return gap(p,o)>=Math.min(radius,gap(before,o)-1e-6);});
    for(const [mx,mz] of [[vx,vz],[-vz,vx],[vz,-vx]]){const next={...before};this.nav.move(next,mx,mz);if(gap(next,before)>.0001&&clear(next)){n.x=next.x;n.z=next.z;break;}}
   }n.speed=gap(before,n)/dt;
   if(n.speed>.04){const yaw=Math.atan2(n.x-before.x,n.z-before.z);n.yaw+=Math.atan2(Math.sin(yaw-n.yaw),Math.cos(yaw-n.yaw))*Math.min(1,dt*8);n.blocked=0;}else n.blocked+=dt;
   if(n.blocked>2.5){n.path=[];n.waypoint++;n.pause=.4;n.blocked=0;}
  }
 }
}
