import * as THREE from 'three';
import type { Campaign, CampaignMarker } from './campaign';
import { BOSS_LIMITS, type CampaignCombat, type CampaignCombatEvent } from './campaign-combat';
import type { GroguFollower } from './grogu';

/** Authored characters and lightweight, bounded mission/encounter presentation. */
export class CampaignView {
  readonly grogu:THREE.Group;
  private bosses:Record<string,THREE.Group>;
  private markerViews=new Map<string,THREE.Group>();
  private shield:THREE.Mesh<THREE.SphereGeometry,THREE.MeshBasicMaterial>;
  private warning:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  private warningId=-1;
  private bolts:THREE.InstancedMesh;
  private impact:THREE.Mesh<THREE.SphereGeometry,THREE.MeshBasicMaterial>;
  private impactLife=0;
  private matrix=new THREE.Matrix4();private quat=new THREE.Quaternion();private pos=new THREE.Vector3();private scale=new THREE.Vector3();
  private civilians:THREE.Group[]=[];
  private rest=new WeakMap<THREE.Object3D,THREE.Euler>();
  private endTime:number|null=null;
  constructor(private scene:THREE.Scene,models:Record<string,THREE.Group>){
    this.grogu=models.grogu.clone(true);this.grogu.name='Grogu · floating pram';scene.add(this.grogu);
    this.bosses={warden:models['imperial-warden'].clone(true),vader:models.vader.clone(true)};
    const saber=this.bosses.vader.getObjectByName('Saber_Blade');
    saber?.traverse(o=>{if(o instanceof THREE.Mesh)o.material=new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(3,.006,.016),toneMapped:false});});
    if(saber){const glow=new THREE.PointLight(0xff2434,3,3,2);glow.position.y=.5;saber.add(glow);}

    for(const actor of Object.values(this.bosses)){actor.visible=false;actor.traverse(o=>this.rest.set(o,o.rotation.clone()));scene.add(actor);}
    for(const [kind,x,z,yaw] of [['citizen-human',-6.75,-38.8,-.7],['jedi',53.1,9.2,0],['citizen-human',8.3,-70,-1.3],['droid-astromech',-74,0,0]] as const){const person=models[kind].clone(true);person.position.set(x,0,z);person.rotation.y=yaw;person.traverse(o=>{if(/Saber_Blade/.test(o.name))o.visible=false;});this.civilians.push(person);scene.add(person);}
    this.shield=new THREE.Mesh(new THREE.SphereGeometry(1.65,24,16),new THREE.MeshBasicMaterial({color:0x55c4ea,transparent:true,opacity:.09,wireframe:true,depthWrite:false,toneMapped:false}));scene.add(this.shield);
    this.warning=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0xff5144,transparent:true,opacity:.25,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));this.warning.renderOrder=6;scene.add(this.warning);
    this.bolts=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),BOSS_LIMITS.projectiles);this.bolts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.bolts.frustumCulled=false;this.bolts.count=0;scene.add(this.bolts);
    this.impact=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),new THREE.MeshBasicMaterial({color:0xffd7a0,transparent:true,opacity:.5,wireframe:true,depthWrite:false,toneMapped:false}));this.impact.visible=false;scene.add(this.impact);
  }
  private marker(m:CampaignMarker):THREE.Group{
    const existing=this.markerViews.get(m.id);if(existing)return existing;
    const color=m.kind==='side'?0x85d9d6:m.kind==='boss'?0xee886d:0xe7c782;
    const group=new THREE.Group();const ring=new THREE.Mesh(new THREE.RingGeometry(.58,.62,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.06;
    const icon=new THREE.Mesh(new THREE.OctahedronGeometry(.17),new THREE.MeshBasicMaterial({color,wireframe:true,toneMapped:false}));icon.position.y=1.3;group.add(ring,icon);group.position.set(m.x,0,m.z);this.scene.add(group);this.markerViews.set(m.id,group);return group;
  }
  update(campaign:Campaign,grogu:GroguFollower,boss:CampaignCombat,time:number,dt:number,aboard:boolean,tracked:string|null):void{
    this.grogu.visible=!aboard;this.grogu.position.set(grogu.x,.15+Math.sin(time*1.7)*.035,grogu.z);this.grogu.rotation.y=grogu.yaw;
    const head=this.grogu.getObjectByName('Actor_Head');if(head)head.rotation.y=Math.sin(time*.8)*.10;
    const visible=new Set(campaign.markers.map(m=>m.id));for(const [id,view]of this.markerViews)view.visible=visible.has(id)&&!aboard;
    for(const m of campaign.markers){const view=this.marker(m);view.position.set(m.x,0,m.z);view.visible=!aboard;view.children[1].rotation.y=time*.55;view.children[1].position.y=1.35+Math.sin(time*2)*.08;view.scale.setScalar(m.id===tracked?1.16:1);}
    for(const actor of Object.values(this.bosses))actor.visible=false;
    this.shield.visible=false;
    const b=boss.boss;
    // Let the briefing camera show the antagonist already waiting in the arena.
    if(!b||boss.status==='idle'){
      const id=campaign.currentQuest?.id,kind=id==='warden'?'warden':id==='vader'?'vader':null;
      if(kind){const actor=this.bosses[kind];actor.visible=!aboard;actor.position.set(54,0,34);actor.rotation.set(0,Math.PI,0);actor.scale.setScalar(1);}
    }
    if(b&&boss.status!=='idle'){
      const actor=this.bosses[b.kind];actor.visible=!aboard;actor.position.set(b.x,0,b.z);actor.rotation.y=b.yaw;
      actor.traverse(o=>{const rest=this.rest.get(o);if(!rest||o instanceof THREE.Mesh)return;o.rotation.copy(rest);if(/Leg/.test(o.name))o.rotation.x+=Math.sin(time*7)*Math.min(b.speed,1)*.22*(/_L$/.test(o.name)?1:-1);if(/Arm_R/.test(o.name))o.rotation.x-=b.state==='attack'?1.2+Math.sin(b.stateTime*8)*.7:b.state==='telegraph'?.75:.15;if(/Cloak/.test(o.name))o.rotation.x+=Math.sin(time*2)*.035;});
      this.shield.visible=b.shield>0&&!aboard;this.shield.position.set(b.x,1.1,b.z);this.shield.scale.set(1,1.2,1);this.shield.rotation.y=time*.6;
      if(boss.victory){if(this.endTime===null)this.endTime=time;const t=Math.min(1,(time-this.endTime)/3.5);actor.scale.setScalar(1-t*.9);actor.position.y=-t*.8;actor.rotation.y+=t*.7;}else{this.endTime=null;actor.scale.setScalar(1);}
    }
    const warning=boss.telegraphs[0];this.warning.visible=!!warning&&!aboard;
    if(warning){
      if(warning.id!==this.warningId){this.warningId=warning.id;const vs:number[]=[];const point=(x:number,z:number)=>{vs.push(x,.055,z);};
        if(warning.kind==='line'){const w=warning.radius,l=warning.length;for(const p of [[-w,0],[w,0],[-w,l],[w,0],[w,l],[-w,l]])point(p[0],p[1]);}
        else{const opening=warning.kind==='circle'?Math.PI:warning.angle;const segments=48;for(let i=0;i<segments;i++){const a=-opening+i/segments*opening*2,b=-opening+(i+1)/segments*opening*2;point(0,0);point(Math.sin(a)*warning.radius,Math.cos(a)*warning.radius);point(Math.sin(b)*warning.radius,Math.cos(b)*warning.radius);}}
        this.warning.geometry.dispose();this.warning.geometry=new THREE.BufferGeometry();this.warning.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));
      }
      this.warning.position.set(warning.x,0,warning.z);this.warning.rotation.y=warning.yaw;this.warning.material.opacity=.14+warning.progress*.37;
    }
    let count=0;for(const bolt of boss.projectiles){if(count>=BOSS_LIMITS.projectiles)break;this.pos.set(bolt.x,1.45,bolt.z);this.quat.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(bolt.dx,bolt.dz));this.scale.set(.08,.08,.85);this.matrix.compose(this.pos,this.quat,this.scale);this.bolts.setMatrixAt(count,this.matrix);this.bolts.setColorAt(count,new THREE.Color(bolt.color).multiplyScalar(2.2));count++;}this.bolts.count=count;this.bolts.instanceMatrix.needsUpdate=true;if(this.bolts.instanceColor)this.bolts.instanceColor.needsUpdate=true;
    this.impactLife=Math.max(0,this.impactLife-dt);this.impact.visible=this.impactLife>0;this.impact.scale.setScalar((.5-this.impactLife)*4+.15);this.impact.material.opacity=this.impactLife;
  }
  events(events:CampaignCombatEvent[]):void{for(const e of events)if(['impact','shield-break','boss-hit','attack'].includes(e.type)){this.impact.position.set(e.x,1.2,e.z);this.impactLife=e.type==='shield-break'?.5:.2;this.impact.material.color.setHex(e.type==='shield-break'?0x79eaff:0xffbda0);}}
}
