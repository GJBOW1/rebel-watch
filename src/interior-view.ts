import * as THREE from 'three';
import { INTERIORS, getInterior, type Interior } from './interiors';
import type { Vec2 } from './simulation';

type RoomView={room:Interior;roof:THREE.Mesh[];walls:Record<string,THREE.Mesh[]>;leaves:THREE.Mesh[][];shadows:THREE.Mesh[];open:number;wanted:boolean;revealed:boolean};
/** Cut away authored roofs, preserving their shadows, and slide the two physical door leaves. */
export class InteriorView {
  private rooms:RoomView[]=[];
  blend=0;
  constructor(world:THREE.Group,private onDoor:()=>void){
    for(const room of INTERIORS){
      const prefix=`World_Interior_${room.id}_`;
      const view:RoomView={room,roof:[],walls:{N:[],E:[],S:[],W:[]},leaves:[[],[]],shadows:[],open:0,wanted:false,revealed:false};
      world.traverse(o=>{if(!(o instanceof THREE.Mesh)||!o.name.startsWith(prefix))return;
        if(o.name.startsWith(prefix+'Roof'))view.roof.push(o);
        for(const side of ['N','E','S','W'])if(o.name.startsWith(prefix+'Wall_'+side))view.walls[side].push(o);
        if(o.name.startsWith(prefix+'Door_L'))view.leaves[0].push(o);
        if(o.name.startsWith(prefix+'Door_R'))view.leaves[1].push(o);
      });
      // The invisible ceiling still shades the room. Transparent proxies are excluded
      // from our SSAO depth capture, so they cannot cover the playable cutaway.
      for(const roof of view.roof){
        const shadow=new THREE.Mesh(roof.geometry,new THREE.MeshBasicMaterial({transparent:true,opacity:0,colorWrite:false,depthWrite:false}));
        shadow.name=prefix+'CeilingShadow';shadow.position.copy(roof.position);shadow.rotation.copy(roof.rotation);shadow.scale.copy(roof.scale);shadow.castShadow=true;shadow.visible=false;
        roof.parent!.add(shadow);view.shadows.push(shadow);
      }
      this.rooms.push(view);
    }
  }
  update(dt:number,player:Vec2,droid:Vec2,camera:THREE.Camera,others:Vec2[]):void{
    const active=getInterior(player);this.blend=THREE.MathUtils.lerp(this.blend,active?1:0,1-Math.exp(-dt*4));
    for(const v of this.rooms){
      const {door,bounds}=v.room;
      const distance=(p:Vec2)=>Math.hypot(p.x-door.x,p.z-door.z);
      const close=(p:Vec2)=>Math.abs(p.x-door.x)<door.width/2+1&&distance(p)<3.6;
      const wanted=[player,droid,...others].some(close);
      if(wanted!==v.wanted&&distance(player)<9)this.onDoor();v.wanted=wanted;
      v.open=THREE.MathUtils.lerp(v.open,wanted?1:0,1-Math.exp(-dt*13));
      v.leaves.forEach((leaves,i)=>leaves.forEach(leaf=>leaf.position.x=(i===0?-1:1)*v.open*(door.width/2+.16)));
      v.revealed=getInterior(player)?.id===v.room.id||getInterior(droid)?.id===v.room.id||(close(player)&&distance(player)<2.2);
      v.roof.forEach(o=>o.visible=!v.revealed);v.shadows.forEach(o=>o.visible=v.revealed);
      const centerX=(bounds.minX+bounds.maxX)/2,centerZ=(bounds.minZ+bounds.maxZ)/2;
      const hideX=camera.position.x>centerX?'E':'W',hideZ=camera.position.z>centerZ?'S':'N';
      // Open leaves retract into their wall pockets. Hide those pockets together
      // with the near upper wall so they cannot cover the small companion.
      const doorSide=door.normalZ>0?'S':'N';
      v.leaves.flat().forEach(leaf=>leaf.visible=!(v.revealed&&doorSide===hideZ&&v.open>.9));
      for(const side of ['N','E','S','W'])v.walls[side].forEach(o=>o.visible=!v.revealed||(side!==hideX&&side!==hideZ));
    }
  }
  evidence(){return this.rooms.map(v=>({id:v.room.id,open:Math.round(v.open*100)/100,revealed:v.revealed,roofMeshes:v.roof.length,doorMeshes:v.leaves.flat().length}));}
}
