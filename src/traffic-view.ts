import * as THREE from 'three';
import { DOCKS, type AirTraffic } from './air-traffic';
export class TrafficView{
 private ships:THREE.Group[]=[];private glow:THREE.Mesh[][]=[];private pads:THREE.Group[]=[];
 constructor(scene:THREE.Scene,models:Record<string,THREE.Group>){
  for(const dock of DOCKS){const pad=models['landing-dock'].clone(true);pad.position.set(dock.x,dock.y,dock.z);scene.add(pad);this.pads.push(pad);
   const ship=models[dock.kind].clone(true);ship.scale.setScalar(dock.scale);scene.add(ship);this.ships.push(ship);const flames:THREE.Mesh[]=[];
   for(const name of ['Engine_L','Engine_R']){const node=ship.getObjectByName(name);if(!node)continue;const flare=new THREE.Mesh(new THREE.ConeGeometry(.35,2.1,12,1,true),new THREE.MeshBasicMaterial({color:0x82ddff,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false}));flare.rotation.x=Math.PI;flare.position.y=-.8;node.add(flare);flames.push(flare);}
   this.glow.push(flames);
  }
 }
 update(traffic:AirTraffic,time:number):void{traffic.flights.forEach((f,i)=>{const ship=this.ships[i];ship.visible=traffic.enabled&&f.phase!=='waiting';ship.position.set(f.x,f.y,f.z);ship.rotation.set(0,f.yaw,f.bank);this.glow[i].forEach((glow,j)=>{glow.visible=f.thrust>.1;glow.scale.y=f.thrust*(1.1+Math.sin(time*22+j)*.1);(glow.material as THREE.MeshBasicMaterial).opacity=.13+f.thrust*.2;});});}
}
