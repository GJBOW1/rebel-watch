import * as THREE from 'three';
import { Campaign, type CampaignContext, type CampaignMarker } from './campaign';
import { CampaignCombat } from './campaign-combat';
import { CampaignUI } from './campaign-ui';
import { CampaignView } from './campaign-view';
import { Cinematics } from './cinematics';
import { GroguFollower } from './grogu';
import { Pilot, FLIGHT_PADS } from './pilot';
import { PilotView } from './pilot-view';
import { Navigation, type Simulation, type Vec2, type Obstacle } from './simulation';
import type { Combat } from './combat';
import type { CombatView } from './combat-view';
import type { StreetBattle } from './street-battle';
import type { HUD } from './hud';
import type { Soundscape } from './audio';

const SAVE_KEY='rebelwatch-operation-emberline-v1';
const gap=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.z-b.z);
interface Hooks {
  scene:THREE.Scene;camera:THREE.PerspectiveCamera;hunter:THREE.Group;tallow:THREE.Group;models:Record<string,THREE.Group>;keys:Set<string>;
  sim:()=>Simulation;combat:()=>Combat;battle:()=>StreetBattle;combatView:CombatView;obstacles:Obstacle[];hud:HUD;sound:Soundscape;
  route:(point:Vec2)=>void;closePanels:()=>void;resetCamera:()=>void;clearFire:()=>void;
}
/** Coordinates campaign, combat and flight through the same live scene and controls. */
export class Expedition {
  campaign:Campaign;boss=new CampaignCombat();pilot=new Pilot();grogu:GroguFollower;
  readonly ui:CampaignUI;readonly cinematic=new Cinematics();readonly view:CampaignView;readonly pilotView:PilotView;
  private nav:Navigation;private lastLanding:Vec2|null=null;private saveAge=0;private lastWeapon='';private lastPad='drydock';private aboardBefore=false;
  constructor(private h:Hooks){
    this.nav=new Navigation(h.obstacles,.51);this.grogu=new GroguFollower(this.nav);
    const saved=this.readSave();this.campaign=new Campaign(saved?.campaign);
    this.view=new CampaignView(h.scene,h.models);this.pilotView=new PilotView(h.scene,{fighter:h.models['rebel-fighter'],tie:h.models['tie-fighter']});
    this.ui=new CampaignUI({route:m=>this.route(m),equip:id=>this.equip(id),pause:()=>{h.keys.clear();h.clearFire();h.sim().cancelWalk();},retry:()=>this.retryBoss(),retreat:()=>{this.boss.cancel();h.battle().standDown();h.hud.note('A road remains','Your progress is safe. Return prepared and challenge the boss again.',5);},land:()=>this.pilot.requestLanding(),repair:()=>this.repair()});
    this.restorePosition(saved);this.applyWeapon();
  }
  get aboard(){return this.pilot.aboard;}
  get locked(){return this.ui.open||this.cinematic.active||this.aboard||this.boss.defeated;}
  get paused(){return this.ui.open||this.cinematic.active;}
  get bossEncounter(){return this.boss.boss!==null&&this.boss.status!=='idle'&&this.boss.status!=='victory';}
  get suppressAmbient(){return this.aboard||this.bossEncounter;}
  get context():CampaignContext{return{player:this.h.sim().player,grogu:this.grogu,flying:this.aboard,flightKills:this.pilot.kills,landedAt:this.lastLanding,bossVictory:this.boss.victory,bossActive:this.bossEncounter};}
  get prompt():{id:string;title:string;detail:string}|null{
    if(this.aboard||this.cinematic.active||this.bossEncounter)return null;
    const p=this.h.sim().player,m=this.ui.nearbyMarker(p);
    if(m&&m.id!=='skybreak-flight')return{id:`mission:${m.id}`,title:m.label,detail:m.kind==='side'?'Optional contract · resources and equipment':m.kind==='boss'?'Enter a boss encounter · stronger weapon required':'Operation Emberline · E to continue'};
    if(gap(p,this.pilot.boardingPoint)<3.4)return{id:'pilot:board',title:'Board Wayfarer One',detail:this.pilot.boardingHint(p,this.h.sim().droid)};
    return m?{id:`mission:${m.id}`,title:m.label,detail:'Operation Emberline'}:null;
  }
  route(marker:CampaignMarker):void{
    if(this.aboard||this.bossEncounter||this.cinematic.active)return;
    this.h.closePanels();this.h.combat().equipped=false;this.h.clearFire();this.h.route(marker);this.h.hud.note('Route marked',marker.label,4);
  }
  routeToShip():void{this.route({id:'pilot',questId:'pilot',kind:'main',label:'Your fighter at the drydock',...this.pilot.boardingPoint});}
  equip(id:string):void{if(this.campaign.equip(id)){this.applyWeapon();this.h.sound.play('equip');this.save();}}
  retryBoss():boolean{
    if(!this.boss.retry(this.h.sim().player,this.campaign.equippedWeapon))return false;
    this.boss.setEnabled(this.h.battle().enabled);this.h.combat().equipped=true;return true;
  }
  private applyWeapon():void{
    const w=this.campaign.equippedWeapon,c=this.h.combat();c.weaponDamage=w.damage;c.weaponInterval=w.fireInterval;c.weaponPellets=w.pellets;
    const maximum=100+this.campaign.shieldUpgrade;
    if(c.maxShield!==maximum){const added=Math.max(0,maximum-c.maxShield);c.maxShield=maximum;c.shield=Math.min(maximum,c.shield+(c.defeated?0:added));}
    const asset:Record<string,string>={scatter:'scatter-blaster',ionlance:'ion-lance','arc-repeater':'arc-repeater','overcharged-arc':'arc-repeater'};
    if(this.lastWeapon!==w.id){this.h.combatView.setWeaponModel(this.h.models[asset[w.id]],w.color);this.lastWeapon=w.id;}
  }
  interact():boolean{
    if(this.paused||this.aboard)return true;
    const p=this.prompt;if(!p)return false;
    if(p.id==='pilot:board'){
      if(this.campaign.groguRescued&&gap(this.grogu,this.h.sim().player)>5){this.h.hud.note('Two small passengers','Wait for Grogu to reach the boarding ramp.',4);return true;}
      if(this.pilot.board(this.h.sim().player,this.h.sim().droid)){this.h.sim().cancelWalk();this.h.battle().standDown();this.h.combat().equipped=false;this.h.clearFire();this.h.keys.clear();this.h.closePanels();}
      else this.h.hud.note('Boarding clearance',this.pilot.boardingHint(this.h.sim().player,this.h.sim().droid),5);
    }else this.campaign.interact(p.id.slice(8),this.context);
    this.processCampaignEvents();this.applyWeapon();this.save();return true;
  }
  handleEscape():boolean{if(this.cinematic.active){this.cinematic.finish();return true;}if(this.ui.open){this.ui.setOpen(false);return true;}return false;}
  handleKey(event:KeyboardEvent):boolean{
    if(this.cinematic.active)return true;
    if(event.code==='KeyK'&&!event.repeat){event.preventDefault();if(!this.aboard){this.h.closePanels();this.ui.setOpen(!this.ui.open);}return true;}
    if(this.ui.open)return true;
    if(this.aboard){
      if(event.code==='KeyN')return false;
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
      this.h.keys.add(event.code);if(event.code==='KeyL'&&!event.repeat)this.pilot.requestLanding();return true;
    }
    if(/^Digit[1-5]$/.test(event.code)&&!event.repeat){const w=this.campaign.weapons[Number(event.code.slice(5))-1];if(w){this.equip(w.id);this.h.hud.note('Loadout',w.name,3);}return true;}
    return false;
  }
  setEnemies(enabled:boolean):void{this.pilot.setEnemiesEnabled(enabled);this.boss.setEnabled(enabled);}
  fire(origin:Vec2,aim:Vec2):boolean{
    if(this.locked)return true;
    if(this.boss.active){if(this.h.combat().equipped)this.boss.fire(origin,aim,this.campaign.equippedWeapon);return true;}
    if(this.bossEncounter)return true;return false;
  }
  tick(dt:number,fireHeld:boolean):void{
    if(this.paused)return;
    const keys=this.h.keys;
    this.pilot.tick(dt,{throttle:Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),turn:Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),rise:Number(keys.has('KeyQ'))-Number(keys.has('KeyE')),boost:keys.has('ShiftLeft')||keys.has('ShiftRight'),fire:this.aboard&&(fireHeld||keys.has('Space'))});
    const events=this.pilot.drainEvents();this.pilotView.events(events);
    for(const e of events){
      if(e.type==='fire')this.h.sound.play(e.owner==='player'?'blaster':'enemy-blaster');
      else if(e.type==='hit')this.h.sound.play(e.owner==='player'?'impact':'hit');
      else if(e.type==='enemy-down'){this.h.sound.play('down');this.h.hud.note('Imperial fighter down',`${this.pilot.kills} confirmed. Keep the route open.`,3);}
      else if(e.type==='takeoff')this.h.sound.play('ship-takeoff');
      else if(e.type==='landed'&&e.disembarkPoint){
        const p=this.safePoint(e.disembarkPoint);Object.assign(this.h.sim().player,p,{speed:0});Object.assign(this.h.sim().droid,this.safePoint({x:p.x-1.6,z:p.z}),{speed:0});if(this.campaign.groguRescued)this.grogu.settle(this.safePoint({x:p.x+1.6,z:p.z}));this.h.sim().cancelWalk();
        const pad=FLIGHT_PADS.find(v=>v.id===e.padId)!;this.lastLanding=e.emergency?null:{x:pad.x,z:pad.z};this.lastPad=pad.id;this.h.keys.clear();this.h.clearFire();this.h.resetCamera();this.h.sound.play('ship-land');this.save();
      }
      if(e.text&&['notice','emergency','landed','boarded'].includes(e.type))this.h.hud.note(e.type==='emergency'?'Emergency return':'Flight control',e.text,5);
    }
    if(!this.aboard){this.grogu.tick(dt,this.h.sim().player,this.h.sim().droid,this.campaign.groguRescued);this.boss.tick(dt,this.h.sim().player,this.h.sim().playerNav,this.campaign.equippedWeapon);}
    this.campaign.tick(dt,this.context);this.processCampaignEvents();this.applyWeapon();
    this.saveAge+=dt;if(this.saveAge>=4){this.saveAge=0;this.save();}
  }
  private processCampaignEvents():void{
    for(const e of this.campaign.drainEvents()){
      if(e.type==='cutscene'&&e.beats){this.h.closePanels();this.h.sim().cancelWalk();this.h.keys.clear();this.h.clearFire();this.cinematic.play(e.title,e.beats,()=>{this.campaign.skipCutscene();this.h.resetCamera();this.save();});}
      else if(e.type==='start-boss'&&e.boss){
        if(!this.h.battle().enabled){this.h.hud.note('A choice to fight','Enable enemies with N, then challenge the boss.',4);continue;}
        this.h.battle().standDown();this.h.combat().projectiles=[];this.h.combat().equipped=true;this.h.sim().cancelWalk();this.boss.start(e.boss,this.h.sim().player,this.campaign.equippedWeapon,this.campaign.shieldUpgrade);
      }else{this.h.hud.note(e.title,e.text??'',e.type==='reward'?8:6);this.h.sound.play(e.type==='reward'?'success':'chirp',this.h.sim().bond);}
    }
    const won=this.boss.victory;
    if(won&&this.campaign.quests.some(q=>q.id===won&&q.status==='complete'))this.boss.cancel();
  }
  frame(dt:number,time:number,started:boolean):void{
    if(started)this.cinematic.tick(dt);
    const events=this.boss.drainEvents();this.view.events(events);
    for(const e of events){if(e.type==='fire'){this.h.sound.play('blaster');this.h.combatView.events([{type:'fire',owner:'player',x:e.x,z:e.z}]);}else if(e.type==='player-hit')this.h.sound.play('hit');else if(e.type==='attack')this.h.sound.play(e.boss==='vader'?'saber':'enemy-blaster');else if(e.type==='shield-break')this.h.sound.play('deflect');else if(['victory','defeat','blocked','start','retry'].includes(e.type)&&e.title)this.h.hud.note(e.title,e.text??'',6);}
    this.h.hunter.visible=!this.aboard;this.h.tallow.visible=!this.aboard;
    this.view.update(this.campaign,this.grogu,this.boss,time,dt,this.aboard,this.ui.trackedMarker?.id??null);this.pilotView.update(this.pilot,time);
  }
  updateUI(started:boolean):void{this.ui.update(this.campaign,this.h.sim().player,this.boss,this.pilot,started);}
  applyCamera(dt:number,target:THREE.Vector3):boolean{
    let pose=this.cinematic.cameraPose()??(this.aboard?this.pilot.cameraPose():null);
    const boss=this.boss.boss;
    if(!pose&&this.bossEncounter&&boss){
      const player=this.h.sim().player,center=new THREE.Vector3((player.x+boss.x)/2,1,(player.z+boss.z)/2);
      // Preserve the exploration camera direction, but center the encounter and
      // leave room around both actors even on narrow screens or during retreat.
      const offset=new THREE.Vector3(12,20,23);
      const halfFov=Math.atan(Math.tan(THREE.MathUtils.degToRad(this.h.camera.fov/2))*Math.min(1,this.h.camera.aspect));
      offset.setLength(Math.max(offset.length(),(gap(player,boss)/2+4)/Math.sin(halfFov)));
      pose={position:center.clone().add(offset),target:center};
    }
    if(!pose)return false;
    const p=new THREE.Vector3(pose.position.x,pose.position.y,pose.position.z),t=new THREE.Vector3(pose.target.x,pose.target.y,pose.target.z);
    this.h.camera.position.lerp(p,1-Math.exp(-dt*(this.cinematic.active?5:7)));target.lerp(t,1-Math.exp(-dt*8));this.h.camera.lookAt(target);return true;
  }
  repair():void{
    if(this.boss.defeated){this.h.hud.note('Checkpoint ready','Retry the checkpoint to restore your shield for free.',4);return;}
    const combat=this.h.combat();
    const ground=!this.aboard&&(combat.shield<combat.maxShield||combat.defeated);
    const boss=!this.aboard&&(this.boss.active||this.boss.status==='paused')&&this.boss.shield<this.boss.maxShield;
    const ship=!this.aboard&&this.pilot.state.shield<100;
    if(!ground&&!boss&&!ship){this.h.hud.note('Field service',this.aboard?'Land at a pad before using field repairs.':'Your shields are already restored.',4);return;}
    if(!this.campaign.spendRepair())return;
    if(ground){combat.shield=combat.maxShield;combat.defeated=false;}
    if(boss)this.boss.shield=this.boss.maxShield;
    if(ship)this.pilot.repair();this.h.sound.play('success');this.save();this.updateUI(true);
  }
  private safePoint(p:Vec2):Vec2{
    if(this.nav.isFree(p))return p;
    for(let r=.4;r<4;r+=.4)for(let i=0;i<16;i++){const q={x:p.x+Math.sin(i*Math.PI/8)*r,z:p.z+Math.cos(i*Math.PI/8)*r};if(this.nav.isFree(q))return q;}
    return{x:3,z:6};
  }
  private readSave():any{try{const s=localStorage.getItem(SAVE_KEY);if(!s)return null;const parsed=JSON.parse(s);return parsed&&parsed.version===1?parsed:null;}catch{return null;}}
  private restorePosition(saved:any):void{
    const valid=(p:any)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&this.h.sim().playerNav.isFree(p);
    if(valid(saved?.player))Object.assign(this.h.sim().player,{x:saved.player.x,z:saved.player.z,speed:0});
    if(valid(saved?.droid))Object.assign(this.h.sim().droid,{x:saved.droid.x,z:saved.droid.z,speed:0});
    if(this.campaign.groguRescued)this.grogu.settle(valid(saved?.grogu)?saved.grogu:this.safePoint({x:this.h.sim().player.x+1.7,z:this.h.sim().player.z}));
    const pad=FLIGHT_PADS.find(p=>p.id===saved?.pad);if(pad){Object.assign(this.pilot.state,pad,{padId:pad.id,phase:'parked',speed:0});this.lastPad=pad.id;}
    if(Number.isInteger(saved?.flightKills)&&saved.flightKills>=0&&saved.flightKills<1e6)this.pilot.kills=saved.flightKills;
    if(valid(saved?.lastLanding))this.lastLanding={x:saved.lastLanding.x,z:saved.lastLanding.z};
  }
  save():void{try{const s=this.h.sim();localStorage.setItem(SAVE_KEY,JSON.stringify({version:1,campaign:this.campaign.save(),player:{x:s.player.x,z:s.player.z},droid:{x:s.droid.x,z:s.droid.z},grogu:{x:this.grogu.x,z:this.grogu.z},pad:this.lastPad,flightKills:this.pilot.kills,lastLanding:this.lastLanding}));}catch{/* Private browsing can disable storage; the live campaign remains playable. */}}
  reset():void{try{localStorage.removeItem(SAVE_KEY);}catch{}this.cinematic.finish();this.campaign=new Campaign();this.boss=new CampaignCombat();this.pilot=new Pilot();this.grogu=new GroguFollower(this.nav);this.lastPad='drydock';this.lastLanding=null;this.lastWeapon='';this.ui.selectedMarkerId=null;this.applyWeapon();this.save();}
  evidence(){return{campaign:this.campaign.save(),quest:this.campaign.currentQuest,markers:this.campaign.markers,grogu:{x:this.grogu.x,z:this.grogu.z,rescued:this.campaign.groguRescued},cinematic:this.cinematic.evidence,journal:this.ui.open,boss:{status:this.boss.status,boss:this.boss.boss,shield:this.boss.shield,telegraphs:this.boss.telegraphs,projectiles:this.boss.projectiles},pilot:{...this.pilot.state,kills:this.pilot.kills,landings:this.pilot.landings,enemies:this.pilot.ships,projectiles:this.pilot.projectiles,boardingPoint:this.pilot.boardingPoint,landingHint:this.pilot.landingHint}};}
}
