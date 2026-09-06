import { Navigation, type Vec2 } from './simulation';
/** A hovering pram still follows a continuous, collision-clear ground route. */
export class GroguFollower {
  x=0;z=-65;yaw=0;speed=0;
  private path:Vec2[]=[];private replan=0;
  private idleSlot:Vec2|null=null;
  constructor(private nav:Navigation){}
  tick(dt:number,player:Vec2,tallow:Vec2,rescued:boolean):void{
    dt=Math.min(.05,Math.max(0,Number.isFinite(dt)?dt:0));this.speed=0;
    if(!rescued||!dt)return;
    const distance=Math.hypot(player.x-this.x,player.z-this.z);
    // Arrival still needs a sightline: a nearby hunter behind a wall is not a
    // reached destination. Resolve companion overlap before resting, too.
    if(distance<2.6&&this.nav.segmentClear(this,player,.04)){
      this.path=[];this.replan=0;
      const tallowGap=Math.hypot(this.x-tallow.x,this.z-tallow.z);
      if(tallowGap<1.2||(this.idleSlot&&tallowGap<1.31)){
        if(!this.idleSlot||Math.hypot(this.idleSlot.x-tallow.x,this.idleSlot.z-tallow.z)<1.28||Math.hypot(this.idleSlot.x-player.x,this.idleSlot.z-player.z)>2.5||!this.nav.segmentClear(this,this.idleSlot))this.idleSlot=this.findIdleSlot(player,tallow);
        if(this.idleSlot){
          const dx=this.idleSlot.x-this.x,dz=this.idleSlot.z-this.z,n=Math.hypot(dx,dz);
          if(n>.015)this.move(dt,dx/n*Math.min(n,1.4*dt),dz/n*Math.min(n,1.4*dt));
        }
      }else this.idleSlot=null;
      return;
    }
    this.idleSlot=null;
    this.replan-=dt;if(this.replan<=0||!this.path.length){this.path=this.nav.path(this,player);this.replan=.45;}
    while(this.path.length&&Math.hypot(this.path[0].x-this.x,this.path[0].z-this.z)<.16)this.path.shift();
    const goal=this.path[0];if(!goal)return;
    const dx=goal.x-this.x,dz=goal.z-this.z,n=Math.hypot(dx,dz);if(n<.001)return;
    const maxSpeed=distance>7?8:Math.min(6,1.5+(distance-2.6)*1.9),step=Math.min(n,maxSpeed*dt);
    let vx=dx/n*step,vz=dz/n*step;const td=Math.hypot(this.x-tallow.x,this.z-tallow.z);
    if(td<1.3&&td>.01){vx+=(this.x-tallow.x)/td*(1.3-td)*dt*1.6;vz+=(this.z-tallow.z)/td*(1.3-td)*dt*1.6;}
    this.move(dt,vx,vz);
  }
  private findIdleSlot(player:Vec2,tallow:Vec2):Vec2|null{
    let best:Vec2|null=null,score=Infinity;
    // Choose the shortest clear sidestep once, then hold that world-space slot.
    // A narrow passage may only admit a slot ahead/behind; never force a side.
    const away=Math.atan2(this.x-tallow.x,this.z-tallow.z);
    for(let i=0;i<24;i++){
      const angle=away+i*Math.PI/12,candidate={x:tallow.x+Math.sin(angle)*1.38,z:tallow.z+Math.cos(angle)*1.38};
      const playerGap=Math.hypot(candidate.x-player.x,candidate.z-player.z);
      if(playerGap<1.05||playerGap>2.45||!this.nav.isFree(candidate)||!this.nav.segmentClear(this,candidate))continue;
      const travel=Math.hypot(candidate.x-this.x,candidate.z-this.z);
      if(travel<score){best=candidate;score=travel;}
    }
    return best;
  }
  private move(dt:number,vx:number,vz:number):void{
    const before={x:this.x,z:this.z};this.nav.move(this,vx,vz);this.speed=Math.hypot(this.x-before.x,this.z-before.z)/dt;
    if(this.speed>.03){const target=Math.atan2(this.x-before.x,this.z-before.z);this.yaw+=Math.atan2(Math.sin(target-this.yaw),Math.cos(target-this.yaw))*Math.min(1,dt*8);}
  }
  settle(point:Vec2):void{this.x=point.x;this.z=point.z;this.path=[];this.replan=0;this.idleSlot=null;this.speed=0;}
}
