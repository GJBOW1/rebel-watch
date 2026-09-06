import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { Simulation, Navigation, WORLD, type Obstacle, type Emote } from './simulation';
import { Combat } from './combat';
import { CombatView } from './combat-view';
import { StreetBattle } from './street-battle';
import { CityLife } from './city-life';
import { AirTraffic, DOCKS } from './air-traffic';
import { PopulationView } from './population-view';
import { TrafficView } from './traffic-view';
import { InteriorView } from './interior-view';
import { INTERIORS, INTERIOR_LANDMARKS, getInterior, getNearbyDoor } from './interiors';
import { CityUI } from './city-ui';
import { HUD } from './hud';
import { Soundscape } from './audio';
import { createEnvironment, createRainPools, createLanternHaze, createMotes } from './atmosphere';
import { Expedition } from './expedition';
import './style.css';

interface Manifest {
  obstacles:Obstacle[];
  lights:{x:number;y:number;z:number;color:string|number;intensity:number;interior?:string}[];
  interactables:{id:string;x:number;z:number}[];
}
interface Evidence {
  expedition:ReturnType<Expedition['evidence']>|null;
  residentsEnabled:boolean;citizens:{id:number;name:string;kind:string;x:number;z:number;talking:number}[];conversations:number;
  trafficEnabled:boolean;flights:{id:number;phase:string;x:number;y:number;z:number;landings:number;departures:number}[];
  battlePhase:string;joined:boolean;guardians:{id:number;x:number;z:number;health:number;state:string}[];completedEncounters:number;
  musicEnabled:boolean;musicVolume:number;musicVoices:number;
  interior:string|null;visitedInteriors:string[];doors:ReturnType<InteriorView['evidence']>;
  ready:boolean;started:boolean;zone:string;mode:string;player:{x:number;z:number};droid:{x:number;z:number};
  bond:number;objectives:{token:boolean;escort:boolean;ridge:boolean};ridgeProgress:number;freeCam:boolean;
  visited:number;weapon:boolean;enemiesEnabled:boolean;shield:number;kills:number;enemies:{id:number;x:number;z:number;health:number;state:string}[];projectiles:number;
  scanTime:number;frameCount:number;fps:number;p95ms:number;drawCalls:number;triangles:number;resolution:string;
}
declare global {interface Window {__ashfall:{snapshot:()=>Evidence}}}
const canvas=document.querySelector<HTMLCanvasElement>('#game')!;
const hud=new HUD();
const sound=new Soundscape();
const scene=new THREE.Scene();scene.background=new THREE.Color(0x273b49);scene.fog=new THREE.FogExp2(0x35434a,.010);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.info.autoReset=false;
scene.environment=createEnvironment(renderer);scene.environmentIntensity=.55;
const camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,.15,500);
const offset=new THREE.Vector3(12,20,23);const cameraTarget=new THREE.Vector3(0,0,0);camera.position.copy(offset);camera.lookAt(cameraTarget);
const orbit=new OrbitControls(camera,canvas);orbit.target.copy(cameraTarget);orbit.enableDamping=true;orbit.dampingFactor=.07;orbit.enabled=false;orbit.minDistance=9;orbit.maxDistance=145;orbit.minPolarAngle=.25;orbit.maxPolarAngle=1.32;orbit.screenSpacePanning=false;
const sun=new THREE.DirectionalLight(0xffd6a0,1.8);sun.position.set(-14,24,-8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-36,right:36,top:28,bottom:-28,near:.5,far:70});sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;sun.shadow.radius=3;scene.add(sun);scene.add(sun.target);
const hemi=new THREE.HemisphereLight(0x91bbdd,0x4d3a25,.85);scene.add(hemi);
const rim=new THREE.DirectionalLight(0x719bc8,.9);rim.position.set(15,10,14);scene.add(rim);
const pools=createRainPools(scene);const motes=createMotes(scene);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const ao=new SSAOPass(scene,camera,innerWidth,innerHeight,16);ao.kernelRadius=7;ao.minDistance=.003;ao.maxDistance=.10;composer.addPass(ao);const aoRender=ao.render.bind(ao);ao.render=(...args)=>{const hidden:THREE.Object3D[]=[];scene.traverse(o=>{if(o instanceof THREE.Mesh&&o.visible){const m=Array.isArray(o.material)?o.material:[o.material];if(m.some(v=>v.transparent)){hidden.push(o);o.visible=false;}}});try{aoRender(...args);}finally{hidden.forEach(o=>o.visible=true);}};const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.24,.6,1.1);composer.addPass(bloom);composer.addPass(new OutputPass());
let expedition:Expedition|null=null;
let life:CityLife;let traffic:AirTraffic;let battle:StreetBattle;let populationView:PopulationView;let trafficView:TrafficView;
let interiorView:InteriorView;let combat:Combat;let combatView:CombatView;let simulation:Simulation;let manifest:Manifest;let hunter:THREE.Group;let droid:THREE.Group;let token:THREE.Group;let machine:THREE.Group;let patrol:THREE.Group;
let mapOpen=false;let fireHeld=false;const aim={x:0,z:6};
const lampPool:THREE.PointLight[]=[];let lightUpdate=-1;let threatAt=-10;
let ready=false;let started=false;let freeCam=false;let settings=false;let emoteOpen=false;let reducedMotion=false;let elapsed=0;let frameCount=0;
let previousZone='';let stepTimer=0;let promptId:string|null=null;let lastUi=0;let lastFrame=performance.now();let accumulator=0;
const keys=new Set<string>();const timings:number[]=[];let fps=60;
const preparedMaterials=new WeakSet<THREE.Material>();
const jointRest=new WeakMap<THREE.Object3D,THREE.Euler>();const positionRest=new WeakMap<THREE.Object3D,THREE.Vector3>();
const locator=new THREE.Raycaster();const floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);const aimPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-1.15);
const targetPoint=new THREE.Vector3();const pointer=new THREE.Vector2();const mouseStart=new THREE.Vector2();
let targetAge=20;
const targetRing=new THREE.Mesh(new THREE.RingGeometry(.25,.28,40),new THREE.MeshBasicMaterial({color:0xbaddec,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));targetRing.rotation.x=-Math.PI/2;targetRing.position.y=.05;targetRing.visible=false;scene.add(targetRing);
const droidRing=new THREE.Mesh(new THREE.RingGeometry(.52,.54,40),new THREE.MeshBasicMaterial({color:0x93cbd7,transparent:true,opacity:.34,side:THREE.DoubleSide,depthWrite:false}));droidRing.rotation.x=-Math.PI/2;scene.add(droidRing);
const scanGeometry=new THREE.CircleGeometry(6.2,48,-Math.PI/3,Math.PI*2/3);
const scan=new THREE.Mesh(scanGeometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:{value:0}},vertexShader:'varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float time;varying vec2 p;void main(){float r=length(p)/6.2;float ring=pow(max(0.,cos(r*42.-time*10.)),22.);gl_FragColor=vec4(.24,.78,.95,(1.-r)*(.075+ring*.12));}'}));
scan.rotation.x=-Math.PI/2;scan.visible=false;scene.add(scan);
const markerMaterial=new THREE.MeshBasicMaterial({color:0xa5e4f4,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false});
const markers=new Map<string,THREE.Mesh>();
const zones=Object.fromEntries(WORLD.districts.map(d=>[d.id,d]));
const cityUI=new CityUI(point=>{if(!ready||combat.defeated||expedition?.locked||expedition?.bossEncounter)return;simulation.walkTo(point);targetRing.position.set(point.x,.06,point.z);targetAge=0;},open=>{mapOpen=open;keys.clear();fireHeld=false;if(ready)simulation.cancelWalk();if(open){emoteOpen=false;hud.toggleEmotes(false);}},toggleWeapon,toggleEnemies);
function toggleWeapon():void{if(!ready||!started||combat.defeated)return;combat.toggleEquip();simulation.cancelWalk();fireHeld=false;aim.x=simulation.player.x+Math.sin(simulation.player.yaw)*8;aim.z=simulation.player.z+Math.cos(simulation.player.yaw)*8;sound.play('equip');canvas.focus();updateHud();}
function toggleEnemies():void{if(!ready||!started)return;const enabled=!battle.enabled;battle.setEnabled(enabled,simulation.player);expedition?.setEnemies(enabled);fireHeld=false;canvas.focus();updateHud();}
function joinBattle():void{if(!ready||!started||expedition?.bossEncounter||expedition?.aboard)return;if(freeCam)setFreeCam(false);if(battle.joined)battle.standDown();else if(!battle.join(simulation.player)){hud.note('Quiet streets','Enable patrols with N to choose a side.',4);}fireHeld=false;canvas.focus();updateHud();}
function initializeSystems():void{
 simulation=new Simulation(manifest.obstacles);const nav=new Navigation(manifest.obstacles,.43);combat=new Combat(nav);battle=new StreetBattle(nav,combat);life=new CityLife(manifest.obstacles);traffic=new AirTraffic();
 battle.setVisibilityTest(p=>{const v=new THREE.Vector3(p.x,.9,p.z).project(camera);return v.z<1&&Math.abs(v.x)<1.15&&Math.abs(v.y)<1.15;});
 battle.setEnabled(true,simulation.player);
 expedition?.reset();
}
function watchTraffic():void{if(!ready)return;traffic.requestArrival(simulation.player);const dock=[...DOCKS].sort((a,b)=>Math.hypot(a.x-simulation.player.x,a.z-simulation.player.z)-Math.hypot(b.x-simulation.player.x,b.z-simulation.player.z))[0];setFreeCam(true);orbit.target.set(dock.x,dock.y+1,dock.z);cameraTarget.copy(orbit.target);camera.position.copy(orbit.target).add(new THREE.Vector3(18,14,23));orbit.update();hud.note(dock.name,'Scheduled arrivals. Orbit to follow a ship. C returns to the street.',5);}
function pointerAim(event:PointerEvent):void{const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);locator.setFromCamera(pointer,camera);if(locator.ray.intersectPlane(aimPlane,targetPoint)){aim.x=targetPoint.x;aim.z=targetPoint.z;}}
function shoot():void{if(!ready||!started||settings||mapOpen||freeCam||emoteOpen||combat.defeated||expedition?.locked)return;combatView.update(combat,aim,elapsed,0);const muzzle=combatView.muzzle();const origin=simulation.playerNav.segmentClear(simulation.player,muzzle)?muzzle:simulation.player;if(!expedition?.fire(origin,aim))combat.fire(origin,aim);}

function weatherStone(material:THREE.MeshStandardMaterial):void{
  if(!/masonry|mortar|plaster|ochre|flagstone|silt/i.test(material.name))return;
  const floor=/flagstone|silt/.test(material.name);
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 ashWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nashWorld=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader=`varying vec3 ashWorld;
      float ah(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float an(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(ah(i),ah(i+vec2(1,0)),f.x),mix(ah(i+vec2(0,1)),ah(i+vec2(1)),f.x),f.y);}
      `+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec2 ap=ashWorld.xz+vec2(ashWorld.y*.71,ashWorld.y*.39);
      float grit=an(ap*37.);float broad=an(ap*.85);
      diffuseColor.rgb*=mix(.64,1.12,broad)*mix(.82,1.08,grit);
      ${floor?'':'diffuseColor.rgb*=mix(.55,1.,smoothstep(.1,2.8,ashWorld.y));'}
      `);
  };
  material.customProgramCacheKey=()=>floor?'ashfloor-v1':'ashstone-v1';
}

function prepareModel(model:THREE.Group):THREE.Group{
  model.traverse(obj=>{
    jointRest.set(obj,obj.rotation.clone());positionRest.set(obj,obj.position.clone());
    if(obj instanceof THREE.Mesh){obj.castShadow=true;obj.receiveShadow=true;
      const materials=Array.isArray(obj.material)?obj.material:[obj.material];
      for(const material of materials){if(material instanceof THREE.MeshStandardMaterial&&!preparedMaterials.has(material)){
        preparedMaterials.add(material);
        weatherStone(material);
        if(/Sunbleached|Ochre cut/.test(material.name))material.color.multiplyScalar(.6);
        if(material.map){material.map.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);if(/stone|ground|flag|masonry/i.test(material.name)){material.bumpMap=material.map;material.bumpScale=.033;}}
        if(/ground|flagstone|pavement/i.test(material.name)){material.roughness=.34;material.metalness=.12;}
        if(/warm|amber|lantern/i.test(material.name)&&material.emissive.getHex()>0)material.emissiveIntensity=3.5;
        if(/cyan|screen|optic/i.test(material.name)&&material.emissive.getHex()>0)material.emissiveIntensity=2.4;
      }}
    }
  });return model;
}

async function load():Promise<void>{
  try{
    const response=await fetch('/assets/models/manifest.json?v=emberline-1');if(!response.ok)throw new Error(`World manifest: ${response.status}`);manifest=await response.json() as Manifest;
    const loader=new GLTFLoader();const modelNames=['world','hunter','tallow','machine','token','blaster','citizen-human','citizen-twilek','droid-protocol','droid-astromech','stormtrooper','jedi','shuttle','freighter','landing-dock','grogu','vader','imperial-warden','rebel-fighter','tie-fighter','ion-lance','scatter-blaster','arc-repeater'];const models=await Promise.all(modelNames.map(name=>loader.loadAsync(`/assets/models/${name}.glb?v=emberline-1`)));
    const world=prepareModel(models[0].scene);world.name='The Ninth Courtyard — Blender';scene.add(world);interiorView=new InteriorView(world,()=>sound.play('door'));
    hunter=prepareModel(models[1].scene);droid=prepareModel(models[2].scene);machine=prepareModel(models[3].scene);token=prepareModel(models[4].scene);patrol=prepareModel(models[2].scene.clone(true));
    hunter.name='Traveler';droid.name='Tallow';machine.position.set(8,0,-7);scene.add(hunter,droid,machine,token,patrol);
    patrol.scale.setScalar(.9);patrol.traverse(o=>{if(o instanceof THREE.Mesh){const m=(o.material as THREE.MeshStandardMaterial).clone();if(m.emissive&&m.emissive.getHex()>0){m.emissive.setHex(0xe67643);m.emissiveIntensity=1.8;}o.material=m;}});
    initializeSystems();combatView=new CombatView(scene,hunter,prepareModel(models[5].scene),prepareModel(models[10].scene));
    populationView=new PopulationView(scene,Object.fromEntries(['citizen-human','citizen-twilek','droid-protocol','droid-astromech','jedi'].map((name,i)=>[name,prepareModel(models[i===4?11:i+6].scene)])));
    trafficView=new TrafficView(scene,Object.fromEntries(['shuttle','freighter','landing-dock'].map((name,i)=>[name,prepareModel(models[i+12].scene)])));
    expedition=new Expedition({scene,camera,hunter,tallow:droid,models:Object.fromEntries(modelNames.map((name,i)=>[name,i>=15?prepareModel(models[i].scene):models[i].scene])),keys,sim:()=>simulation,combat:()=>combat,battle:()=>battle,combatView,obstacles:manifest.obstacles,hud,sound,
      route:point=>{simulation.walkTo(point);targetRing.position.set(point.x,.06,point.z);targetAge=0;},
      closePanels:()=>{if(freeCam)setFreeCam(false);if(mapOpen)cityUI.setMap(false);if(emoteOpen){emoteOpen=false;hud.toggleEmotes(false);}fireHeld=false;},resetCamera:()=>recenter(),clearFire:()=>{fireHeld=false;}});
    for(let i=0;i<12;i++){const light=new THREE.PointLight(0xffbc72,0,10,2);scene.add(light);lampPool.push(light);}
    for(const lamp of manifest.lights)createLanternHaze(scene,lamp.x,lamp.y,lamp.z,lamp.color);
    const scoutLight=new THREE.PointLight(0xffbb6b,2.2,2.5,2);scoutLight.position.set(0,.45,.32);droid.add(scoutLight);
    for(const [x,y,z,power] of [[14,2.7,0,18],[22,1.6,0,12],[0,.8,-1,3]]){const light=new THREE.PointLight(0x5baacb,power,7,2);light.position.set(x,y,z);scene.add(light);}
    for(const item of [{id:'token',x:-8,z:-6},...WORLD.landmarks,...INTERIOR_LANDMARKS]){
      const marker=new THREE.Mesh(new THREE.RingGeometry(.48,.51,4),markerMaterial.clone());marker.rotation.x=-Math.PI/2;marker.position.set(item.x,.065,item.z);scene.add(marker);markers.set(item.id,marker);
    }
    setPortrait();ready=true;hud.setReady();updateModels(0);updateHud();
    if(new URLSearchParams(location.search).has('play'))startGame();
  }catch(error){const message=error instanceof Error?error.message:String(error);console.error(error);hud.note('Unable to enter the courtyard',message,60);const loading=document.querySelector('#loading-status');if(loading)loading.textContent=message;}
}

function setPortrait():void{
  const portraitScene=new THREE.Scene();portraitScene.background=new THREE.Color(0x15252b);portraitScene.environment=scene.environment;portraitScene.add(new THREE.HemisphereLight(0xc7e4f1,0x756249,3));const key=new THREE.DirectionalLight(0xffdfae,4);key.position.set(-2,4,3);portraitScene.add(key);
  const portrait=droid.clone(true);portraitScene.add(portrait);const cam=new THREE.PerspectiveCamera(34,1,.1,20);cam.position.set(1.6,1.3,2.1);cam.lookAt(0,.4,0);
  const r=new THREE.WebGLRenderer({antialias:true});r.setSize(220,220);r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.2;r.render(portraitScene,cam);hud.setPortrait(r.domElement.toDataURL());r.dispose();
}

function startGame():void{if(!ready)return;started=true;hud.dismissIntro();void sound.start().catch(error=>console.warn('Audio start',error));hud.note('Operation Emberline', 'A Rebel courier waits inside the Still Ember. K opens your mission journal. Your next chapter is marked in gold.',8);canvas.focus();}
function setFreeCam(active:boolean):void{if(active&&(expedition?.aboard||expedition?.bossEncounter||expedition?.cinematic.active)){hud.note('Hold the field','Return from flight or withdraw from the boss encounter before entering free camera.',4);return;}if(active&&ready&&battle.joined)battle.standDown();freeCam=active;orbit.enabled=active;fireHeld=false;if(cityUI.mapOpen)cityUI.setMap(false);if(active&&ready)simulation.cancelWalk();emoteOpen=false;hud.toggleEmotes(false);hud.setFreeCam(active);keys.clear();if(active){orbit.target.copy(cameraTarget);orbit.update();}else{cameraTarget.copy(orbit.target);camera.zoom=1;camera.updateProjectionMatrix();}canvas.focus();}
function cameraMode(mode:'orbit'|'pan'):void{orbit.mouseButtons.LEFT=mode==='pan'?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;document.querySelectorAll<HTMLElement>('[data-camera]').forEach(b=>{if(b.dataset.camera!=='recenter'){b.classList.toggle('selected',b.dataset.camera===mode);b.setAttribute('aria-pressed',String(b.dataset.camera===mode));}});}
function recenter():void{if(!ready)return;const room=getInterior(simulation.player);if(room)cameraTarget.set(room.center.x-.8,.4,room.center.z-1);else cameraTarget.set(simulation.player.x-1.5,0,simulation.player.z-3);orbit.target.copy(cameraTarget);camera.position.copy(cameraTarget).add((room?.id==='archive'?new THREE.Vector3(12,20,-23):room?.id==='workshop'?new THREE.Vector3(-12,20,23):offset.clone()).multiplyScalar(room?.68:1));camera.zoom=1;camera.updateProjectionMatrix();orbit.update();}
function setSettings(active:boolean):void{settings=active;fireHeld=false;if(active&&cityUI.mapOpen)cityUI.setMap(false);if(active){emoteOpen=false;hud.toggleEmotes(false);}hud.setSettings(active);keys.clear();if(!active)canvas.focus();}
function toggleEmotes():void{emoteOpen=!emoteOpen;fireHeld=false;if(emoteOpen)simulation.cancelWalk();hud.toggleEmotes(emoteOpen);keys.clear();}
function interact():void{
  if(!ready||!started)return;
  if(expedition?.interact())return;
  if(promptId?.startsWith('citizen:')){const note=life.talk(Number(promptId.split(':')[1]),simulation.player);if(note){simulation.cancelWalk();hud.note(note.title,note.text,10);sound.play('chirp',simulation.bond);}return;}
  if(promptId?.startsWith('door:')){const approach=getNearbyDoor(simulation.player);if(approach&&!combat.defeated){simulation.walkTo(approach.destination);sound.play('chirp',simulation.bond);}return;}
  const entry=[...WORLD.landmarks,...INTERIOR_LANDMARKS].find(item=>item.id===promptId);
  if(entry){hud.note(entry.title,entry.text,10);sound.play('chirp',simulation.bond);}
  else if(promptId==='token'){simulation.command('fetch');}
  else hud.note('Nothing within reach','Move close to a door, marked relic, or someone with a story.',3);
}

function dispatchCommand(command:string):void{
  if(!started||settings||mapOpen||freeCam||expedition?.locked)return;
  if(command==='emote'){toggleEmotes();return;}
  if(['call','stay','scan','overwatch'].includes(command))simulation.command(command as 'call'|'stay'|'scan'|'overwatch');
}
function photo():void{if(!ready)return;const link=document.createElement('a');link.download=`rebel-watch-${simulation.zone}.png`;composer.render();link.href=canvas.toDataURL('image/png');link.click();hud.note('A moment, kept','The photograph has been saved from the game camera.',3);}

function bindControls():void{
  document.querySelector('#start-button')?.addEventListener('click',startGame);
  document.querySelectorAll<HTMLElement>('[data-command]').forEach(button=>button.addEventListener('click',()=>{dispatchCommand(button.dataset.command!);canvas.focus();}));
  document.querySelectorAll<HTMLElement>('[data-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.action;if(action==='camera')setFreeCam(!freeCam);if(action==='sound'){const on=sound.toggle();button.setAttribute('aria-pressed',String(on));button.innerHTML=on?'Sound on':'Sound off';}if(action==='settings')setSettings(!settings);}));
  document.querySelectorAll<HTMLElement>('[data-camera]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.camera==='recenter')recenter();else cameraMode(button.dataset.camera==='pan'?'pan':'orbit');canvas.focus();}));
  document.querySelectorAll<HTMLElement>('[data-emote]').forEach(button=>button.addEventListener('click',()=>{simulation.emoteAction(button.dataset.emote as Emote);emoteOpen=false;hud.toggleEmotes(false);canvas.focus();}));
  document.querySelector('#emote-close')?.addEventListener('click',()=>{emoteOpen=false;hud.toggleEmotes(false);canvas.focus();});
  document.querySelector('#settings-close')?.addEventListener('click',()=>setSettings(false));
  document.querySelector('#join-battle')?.addEventListener('click',joinBattle);
  document.querySelector('#encounter-button')?.addEventListener('click',()=>{if(ready){battle.requestEncounter(simulation.player);canvas.focus();}});
  document.querySelector('#traffic-watch')?.addEventListener('click',watchTraffic);
  document.querySelector('#pilot-route')?.addEventListener('click',()=>expedition?.routeToShip());
  document.querySelector('#traffic-arrival')?.addEventListener('click',()=>{if(ready){traffic.requestArrival(simulation.player);hud.note('Landing clearance','The nearest skyport has received your signal.',4);canvas.focus();}});
  document.querySelector<HTMLInputElement>('#residents-toggle')?.addEventListener('change',e=>{if(ready)life.enabled=(e.target as HTMLInputElement).checked;});
  document.querySelector<HTMLInputElement>('#traffic-toggle')?.addEventListener('change',e=>{if(ready)traffic.enabled=(e.target as HTMLInputElement).checked;});
  document.querySelector<HTMLInputElement>('#music-toggle')?.addEventListener('change',e=>{sound.setMusicEnabled((e.target as HTMLInputElement).checked);void sound.start();});
  document.querySelector<HTMLInputElement>('#music-volume')?.addEventListener('input',e=>sound.setMusicVolume(Number((e.target as HTMLInputElement).value)/100));
  document.querySelector('#photo-button')?.addEventListener('click',photo);
  document.querySelector('#reset-button')?.addEventListener('click',()=>{if(!ready)return;initializeSystems();fireHeld=false;previousZone='';setSettings(false);recenter();hud.note('A vow renewed','The token waits in the west court.',5);});
  document.querySelector<HTMLSelectElement>('#quality')?.addEventListener('change',event=>{const high=(event.target as HTMLSelectElement).value==='high';ao.enabled=high;renderer.setPixelRatio(Math.min(devicePixelRatio,high?1.5:1));bloom.enabled=high;pools.getRenderTarget().setSize(high?1536:1024,high?1024:768);resize();});
  document.querySelector<HTMLInputElement>('#volume')?.addEventListener('input',event=>{const input=event.target as HTMLInputElement;sound.setVolume(Number(input.value)/(Number(input.max)>1?100:1));});
  document.querySelector<HTMLInputElement>('#reduced-motion')?.addEventListener('change',event=>{reducedMotion=(event.target as HTMLInputElement).checked;document.documentElement.classList.toggle('reduced-motion',reducedMotion);});
  window.addEventListener('keydown',event=>{
    if(event.code==='Escape'){event.preventDefault();if(!ready)return;if(expedition?.handleEscape())return;if(mapOpen){cityUI.setMap(false);return;}if(settings){setSettings(false);return;}if(emoteOpen){emoteOpen=false;hud.toggleEmotes(false);}else if(freeCam)setFreeCam(false);else setSettings(!settings);return;}
    if(event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement)return;
    if(!started){if(event.code==='Enter')startGame();return;}
    if(settings)return;
    if(!emoteOpen&&expedition?.handleKey(event))return;
    if(event.code==='KeyM'&&!event.repeat){cityUI.setMap(!mapOpen);return;}
    if(mapOpen)return;
    if(event.code==='KeyN'&&!event.repeat){toggleEnemies();return;}
    void sound.start();
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(event.code)&&event.target===canvas)event.preventDefault();
    keys.add(event.code);if(event.repeat)return;
    if(event.code==='KeyC'){setFreeCam(!freeCam);return;}
    if(freeCam){if(event.code==='KeyR')recenter();return;}
    if(emoteOpen){const mapping:Record<string,Emote>={Digit1:'salute',Digit2:'spin',Digit3:'growl',Digit4:'chirp'};if(mapping[event.code]){simulation.emoteAction(mapping[event.code]);emoteOpen=false;hud.toggleEmotes(false);}else if(event.code==='KeyR')toggleEmotes();return;}
    if(event.code==='KeyB'){toggleWeapon();return;}
    if(event.code==='KeyJ'){joinBattle();return;}
    if(event.code==='Space'&&combat.equipped){event.preventDefault();shoot();}
    const commands:Record<string,string>={KeyF:'call',KeyX:'stay',KeyV:'scan',KeyQ:'overwatch',KeyR:'emote'};if(commands[event.code])dispatchCommand(commands[event.code]);if(event.code==='KeyE')interact();
  });
  window.addEventListener('keyup',event=>keys.delete(event.code));window.addEventListener('blur',()=>{keys.clear();fireHeld=false;});window.addEventListener('pointerup',()=>fireHeld=false);
  document.addEventListener('visibilitychange',()=>{keys.clear();fireHeld=false;lastFrame=performance.now();accumulator=0;});
  canvas.tabIndex=0;
  canvas.addEventListener('pointerdown',event=>{mouseStart.set(event.clientX,event.clientY);canvas.focus();if(started)void sound.start();pointerAim(event);if(event.button===0&&(combat?.equipped||expedition?.aboard)){fireHeld=true;if(!expedition?.aboard)shoot();}});
  canvas.addEventListener('pointermove',pointerAim);
  canvas.addEventListener('pointerup',event=>{
    if(expedition?.locked||freeCam||!started||settings||mapOpen||combat.equipped||combat.defeated||emoteOpen||event.button!==0||mouseStart.distanceTo(new THREE.Vector2(event.clientX,event.clientY))>5)return;
    const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);locator.setFromCamera(pointer,camera);
    if(locator.ray.intersectPlane(floorPlane,targetPoint)){simulation.walkTo({x:targetPoint.x,z:targetPoint.z});targetRing.position.set(targetPoint.x,.06,targetPoint.z);targetAge=0;}
  });
  canvas.addEventListener('contextmenu',event=>event.preventDefault());window.addEventListener('resize',resize);
}
function resize():void{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);}
function movement():{x:number;z:number;run:boolean}{
  let x=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  let z=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
  const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new THREE.Vector3(-forward.z,0,forward.x);
  const direction=right.multiplyScalar(x).addScaledVector(forward,-z);if(direction.lengthSq()>1)direction.normalize();return{x:direction.x,z:direction.z,run:keys.has('ShiftLeft')||keys.has('ShiftRight')};
}
function animateJoints(group:THREE.Group,speed:number,time:number,kind:'hunter'|'droid'):void{
  group.traverse(obj=>{const rest=jointRest.get(obj);if(!rest||obj instanceof THREE.Mesh)return;
    const name=obj.name.toLowerCase();if(!(/leg|arm|head|cloak/.test(name)))return;obj.rotation.copy(rest);
    if(/leg/.test(name)){const side=/_l$|_fl$|_br$/.test(name)?1:-1;obj.rotation.x+=Math.sin(time*(kind==='hunter'?8:13))*Math.min(speed/4,1)*.32*side;}
    if(kind==='hunter'&&/arm/.test(name)){obj.rotation.x+=Math.sin(time*8)*Math.min(speed/4,1)*.20*(/left|_l/.test(name)?-1:1);}
    if(/cloak/.test(name)&&!reducedMotion)obj.rotation.x+=Math.sin(time*3)*.035+speed*.014;
    if(/head/.test(name)&&speed<.1&&!reducedMotion)obj.rotation.y+=Math.sin(time*.65)*.12;
  });
}
function updateModels(dt:number):void{
  const s=simulation;hunter.position.set(s.player.x,0,s.player.z);hunter.rotation.y=s.player.yaw;droid.position.set(s.droid.x,0,s.droid.z);droid.rotation.y=s.droid.yaw;
  if(!reducedMotion){hunter.position.y=Math.abs(Math.sin(elapsed*8))*.028*Math.min(s.player.speed,1);droid.position.y=Math.sin(elapsed*(s.droid.speed>.1?13:2))*.02;}
  animateJoints(hunter,s.player.speed,elapsed,'hunter');animateJoints(droid,s.droid.speed,elapsed,'droid');
  if(s.emote){if(s.emote==='salute')droid.traverse(o=>{if(!(o instanceof THREE.Mesh)&&/leg.*(front|fl)|arm/i.test(o.name))o.rotation.x-=.9;});
    if(s.emote==='growl')droid.rotation.z=Math.sin(elapsed*32)*.04;
    if(s.emote==='chirp')droid.position.y+=Math.abs(Math.sin(elapsed*7))*.14;
  }else droid.rotation.z=0;
  patrol.position.set(s.patrol.x,0,s.patrol.z);patrol.rotation.y=s.patrol.yaw;animateJoints(patrol,s.patrol.speed,elapsed,'droid');
  token.visible=!s.token.collected;if(s.token.carried)token.position.set(s.droid.x,.7,s.droid.z);else token.position.set(s.token.x,.16+Math.sin(elapsed*2)*.055,s.token.z);token.rotation.y=elapsed*.6;
  droidRing.position.set(s.droid.x,.05,s.droid.z);droidRing.visible=['hold','overwatch','call'].includes(s.mode);(droidRing.material as THREE.MeshBasicMaterial).color.setHex(s.mode==='overwatch'?0xf5bc6c:0x9bd8e8);
  scan.visible=s.scanTime>0;scan.position.set(s.droid.x,.07,s.droid.z);scan.rotation.set(-Math.PI/2,0,s.droid.yaw-Math.PI/2);(scan.material as THREE.ShaderMaterial).uniforms.time.value=elapsed;
  for(const [id,marker] of markers){const p=marker.position;const dist=Math.hypot(p.x-s.droid.x,p.z-s.droid.z);const dot=dist>0?((p.x-s.droid.x)*Math.sin(s.droid.yaw)+(p.z-s.droid.z)*Math.cos(s.droid.yaw))/dist:1;const detected=s.scanTime>0&&dist<6.2&&dot>.5;
    const interiorMark=INTERIOR_LANDMARKS.find(l=>l.id===id);marker.visible=interiorMark?getInterior(s.player)?.id===interiorMark.interiorId:id!=='token'||(!s.token.collected&&!s.token.carried);(marker.material as THREE.MeshBasicMaterial).opacity=detected?.95:id==='token'?.6:.14;marker.scale.setScalar(detected?1.35:1);
  }
  targetAge+=dt;targetRing.visible=targetAge<1.8;(targetRing.material as THREE.MeshBasicMaterial).opacity=Math.max(0,.7-targetAge*.4);
  combatView.update(combat,aim,elapsed,dt);
  stepTimer+=dt;if(s.player.speed>.1&&stepTimer>(s.player.speed>4?.22:.36)){stepTimer=0;sound.play('step',s.bond);}
}

function updateHud():void{
  const s=simulation;
  const hour=Math.floor(s.timeOfDay);const minute=Math.floor((s.timeOfDay-hour)*60);
  hud.update({zone:getInterior(s.player)?.name||zones[s.zone].name,time:`${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}`,mode:s.mode,bond:s.bond,objectives:s.objectives,ridgeProgress:s.ridgeProgress/18,fps});
  if(started&&s.zone!==previousZone)previousZone=s.zone;
  promptId=null;let promptTitle:string|null=null;let detail='';
  const room=getInterior(s.player);const door=getNearbyDoor(s.player);
  if(door){promptId=`door:${door.building.id}`;promptTitle=door.entering?`Enter ${door.building.name}`:'Return to the street';detail=door.entering?'A door open to you and your companion':'The road is waiting';}
  const citizen=life.nearby(s.player);if(citizen&&!door){promptId=`citizen:${citizen.id}`;promptTitle=citizen.name;detail=`Talk · ${citizen.role}`;}
  for(const item of [...INTERIOR_LANDMARKS.filter(l=>l.interiorId===room?.id).map(l=>({...l,title:l.name,detail:'Listen · a memory under shelter'})),...WORLD.landmarks.map(l=>({...l,title:l.name,detail:'Inspect · a story kept in iron'})),{id:'token',x:s.token.x,z:s.token.z,title:'Tallow, retrieve',detail:'Foundling token · bring it home'}]){
    if(promptId)break;
    if(item.id==='token'&&(s.token.collected||s.token.carried||s.mode==='fetch'||s.mode==='return'))continue;
    if(Math.hypot(item.x-s.player.x,item.z-s.player.z)<(item.id==='token'?3.2:2.8)){promptId=item.id;promptTitle=item.title;detail=item.detail;break;}
  }
  if(!promptTitle&&s.mode==='hold'){promptTitle=null;}
  expedition?.updateUI(started);const missionPrompt=expedition?.prompt;if(missionPrompt){promptId=missionPrompt.id;promptTitle=missionPrompt.title;detail=missionPrompt.detail;}
  hud.setPrompt(started&&!emoteOpen&&!settings&&!mapOpen&&!freeCam&&!expedition?.locked?promptTitle:null,detail);
  cityUI.campaignMarkers=expedition?.campaign.markers??[];cityUI.selectedMarker=expedition?.ui.trackedMarker?.id??null;
  cityUI.update(s,combat,manifest.obstacles,freeCam,battle,life);
  const q=(id:string)=>document.getElementById(id)!;
  q('life-status').textContent=life.enabled?`${life.citizens.length} residents · ${life.conversations} conversations`:'Residents paused';
  q('battle-status').textContent=!battle.enabled?'Patrols disabled':battle.joined?'You are fighting with the Jedi':battle.phase==='arrival'?'Two Jedi enter the district':battle.phase==='skirmish'?'Jedi engage the patrol · safe to watch':battle.phase==='departure'?'The Jedi leave the district':'Imperial patrols · observer mode';
  q('traffic-status').textContent=traffic.enabled?traffic.flights.map(f=>`${f.kind==='shuttle'?'Shuttle':'Freighter'} ${f.phase}`).join(' · '):'Ship traffic paused';
  q('join-battle').textContent=battle.joined?'J · Return to observer':'J · Join against troopers';q('join-battle').setAttribute('aria-pressed',String(battle.joined));
  (q('encounter-button') as HTMLButtonElement).disabled=!!room||['arrival','skirmish','departure'].includes(battle.phase);
  (q('residents-toggle') as HTMLInputElement).checked=life.enabled;(q('traffic-toggle') as HTMLInputElement).checked=traffic.enabled;
  (q('music-toggle') as HTMLInputElement).checked=sound.musicEnabled;
  canvas.dataset.state=JSON.stringify(snapshot());
  const points:Record<string,{x:number;y:number}>={};for(const item of [{id:'token',x:-8,z:-6},{id:'center',x:3,z:0},{id:'gate',x:12,z:0},...WORLD.landmarks,...INTERIOR_LANDMARKS,...INTERIORS.map(b=>({id:`door-${b.id}`,x:b.door.x,z:b.door.z})),...WORLD.districts.map(d=>({id:d.id,...d.center})),...(expedition?.campaign.markers.map(m=>({id:`mission-${m.id}`,x:m.x,z:m.z}))??[]),...(expedition?.boss.boss?[{id:'boss',x:expedition.boss.boss.x,z:expedition.boss.boss.z}]:[]),...combat.enemies.map(e=>({id:`enemy-${e.id}`,x:e.x,z:e.z})),...life.citizens.map(n=>({id:`citizen-${n.id}`,x:n.x,z:n.z})),...battle.guardians.map(g=>({id:`jedi-${g.id}`,x:g.x,z:g.z}))]){const p=new THREE.Vector3(item.x,/^(enemy|citizen|jedi)-/.test(item.id)?1.15:0,item.z).project(camera);points[item.id]={x:(p.x*.5+.5)*innerWidth,y:(-p.y*.5+.5)*innerHeight};}canvas.dataset.points=JSON.stringify(points);
  for(const event of s.drainEvents()){
    if(event.type==='sound')sound.play(event.sound||'chirp',s.bond);
    else if(event.type==='note'||event.type==='threat'||event.type==='objective'){hud.note(event.title||'Field note',event.text||'',event.type==='objective'?8:5);if(event.type==='objective')sound.play('success',s.bond);}
  }
}
function snapshot():Evidence{
  const sorted=[...timings].sort((a,b)=>a-b);return{expedition:expedition?.evidence()??null,residentsEnabled:ready&&life.enabled,citizens:ready?life.citizens.map(n=>({id:n.id,name:n.name,kind:n.kind,x:n.x,z:n.z,talking:n.talking})):[],conversations:ready?life.conversations:0,trafficEnabled:ready&&traffic.enabled,flights:ready?traffic.flights.map(f=>({id:f.id,phase:f.phase,x:f.x,y:f.y,z:f.z,landings:f.landings,departures:f.departures})):[],battlePhase:ready?battle.phase:'patrol',joined:ready&&battle.joined,guardians:ready?battle.guardians.map(g=>({id:g.id,x:g.x,z:g.z,health:g.health,state:g.state})):[],completedEncounters:ready?battle.completedEncounters:0,musicEnabled:sound.musicEnabled,musicVolume:sound.musicVolume,musicVoices:sound.musicVoices,interior:ready?simulation.interior:null,visitedInteriors:ready?[...simulation.visitedInteriors]:[],doors:ready?interiorView.evidence():[],ready,started,zone:ready?simulation.zone:'loading',mode:ready?simulation.mode:'loading',player:ready?{x:simulation.player.x,z:simulation.player.z}:{x:0,z:0},droid:ready?{x:simulation.droid.x,z:simulation.droid.z}:{x:0,z:0},bond:ready?simulation.bond:0,objectives:ready?{...simulation.objectives}:{token:false,escort:false,ridge:false},ridgeProgress:ready?simulation.ridgeProgress:0,freeCam,visited:ready?simulation.visitedCount:0,weapon:ready?combat.equipped:false,enemiesEnabled:ready?combat.enabled:false,shield:ready?combat.shield:100,kills:ready?combat.kills:0,enemies:ready?combat.enemies.map(e=>({id:e.id,x:e.x,z:e.z,health:e.health,state:e.state})):[],projectiles:ready?combat.projectiles.length:0,scanTime:ready?simulation.scanTime:0,frameCount,fps,p95ms:sorted[Math.floor(sorted.length*.95)]||0,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,resolution:`${canvas.width}×${canvas.height}`};
}
window.__ashfall={snapshot};
function frame(now:number):void{
  requestAnimationFrame(frame);const rawDt=(now-lastFrame)/1000;lastFrame=now;const dt=Math.min(rawDt,.05);
  if(document.hidden)return;
  elapsed+=dt;frameCount++;
  if(ready&&started&&rawDt>0){timings.push(rawDt*1000);if(timings.length>360)timings.shift();fps=1000/(timings.reduce((a,b)=>a+b,0)/Math.max(1,timings.length));}
  if(ready){
    if(started&&!settings&&!mapOpen&&!emoteOpen&&!expedition?.paused){
      const input=(!freeCam&&!combat.defeated&&!expedition?.locked)?movement():{x:0,z:0,run:false};if(combat.defeated||expedition?.boss.defeated)simulation.cancelWalk();
      if((fireHeld||keys.has('Space'))&&!freeCam&&!expedition?.aboard)shoot();
      accumulator=Math.min(accumulator+dt,.1);while(accumulator>=1/60){
        if(!expedition?.aboard)simulation.tick(1/60,input);
        if(!expedition?.suppressAmbient){battle.tick(1/60,simulation.player,!!getInterior(simulation.player));combat.tick(1/60,simulation.player);}
        life.tick(1/60,simulation.player,simulation.droid,battle.joined?combat.enemies.filter(e=>e.health>0):[]);traffic.tick(1/60,[simulation.player,simulation.droid,...life.citizens]);
        expedition?.tick(1/60,fireHeld);accumulator-=1/60;
      }
    }
    const combatEvents=combat.drainEvents();combatView.events(combatEvents);for(const event of combatEvents){if(event.type==='fire')sound.play(event.owner==='player'?'blaster':'enemy-blaster');if(event.type==='impact')sound.play('impact');if(event.type==='ally-block')sound.play('deflect');if(event.type==='enemy-down')sound.play('down');if(event.type==='player-hit'){sound.play('hit');document.querySelector('#combat-panel')?.classList.add('combat-hit');setTimeout(()=>document.querySelector('#combat-panel')?.classList.remove('combat-hit'),160);}if(event.type==='defeat')hud.note('The shield gives way','Press N to stand down. No vow ends here.',8);}
    for(const event of battle.drainEvents()){if(event.type==='saber')sound.play('saber');else hud.note(event.title,event.text,event.type==='victory'?7:5);}
    for(const event of traffic.drainEvents()){if(Math.hypot(event.x-simulation.player.x,event.z-simulation.player.z)<30){sound.play(event.type==='landing'?'ship-land':'ship-takeoff');if(!freeCam)hud.note(event.type==='landing'?'Ship arrival':'Departure clearance',`${event.name} · ${event.type==='landing'?'A traveler finds shelter.':'Another light leaves the city.'}`,4);}}
    sound.setBattleMood(!!expedition?.boss.active||!!expedition?.aboard||(battle.phase==='skirmish'&&!simulation.interior));
    if(simulation.mode==='overwatch'&&combat.enemies.some(e=>e.health>0&&Math.hypot(e.x-simulation.droid.x,e.z-simulation.droid.z)<8)&&elapsed-threatAt>7){threatAt=elapsed;hud.note('Tallow · contact','A hostile signal. I hold your flank.',4);sound.play('threat',simulation.bond);}
    updateModels(dt);expedition?.frame(settings?0:dt,elapsed,started);
    if(expedition?.applyCamera(dt,cameraTarget)){}else if(!freeCam){const room=getInterior(simulation.player);const target=room?new THREE.Vector3(room.center.x*.7+simulation.player.x*.3-.8,.4,room.center.z*.7+simulation.player.z*.3-1):started?new THREE.Vector3(simulation.player.x-1.5,0,simulation.player.z-3):new THREE.Vector3(0,0,0);cameraTarget.lerp(target,1-Math.exp(-dt*(reducedMotion?12:3)));camera.position.lerp(cameraTarget.clone().add((room?.id==='archive'?new THREE.Vector3(12,20,-23):room?.id==='workshop'?new THREE.Vector3(-12,20,23):offset.clone()).multiplyScalar(room?.68:1)),1-Math.exp(-dt*5));camera.lookAt(cameraTarget);}
    else{if(!settings&&!mapOpen){const input=movement();const shift=new THREE.Vector3(input.x,0,input.z).multiplyScalar(dt*9);orbit.target.add(shift);camera.position.add(shift);}orbit.update();cameraTarget.copy(orbit.target);}
    const cinematicFocus=expedition?.cinematic.cameraPose()?.target;interiorView.update(dt,cinematicFocus??simulation.player,cinematicFocus??simulation.droid,camera,[...combat.enemies.filter(e=>e.health>0),...(life.enabled?life.citizens:[]),...battle.guardians]);
    populationView.update(life,battle,camera,elapsed);trafficView.update(traffic,elapsed);
    bloom.strength=.24-interiorView.blend*.10;hemi.intensity=.85-interiorView.blend*.44;rim.intensity=.9-interiorView.blend*.58;scene.environmentIntensity=.55-interiorView.blend*.23;sound.setInterior(!!simulation.interior);
    if(elapsed-lastUi>.1){updateHud();lastUi=elapsed;}
    if(elapsed-lightUpdate>.25){lightUpdate=elapsed;const room=simulation.interior;const nearby=manifest.lights.filter(l=>room?l.interior===room:!l.interior).sort((a,b)=>Math.hypot(a.x-cameraTarget.x,a.z-cameraTarget.z)-Math.hypot(b.x-cameraTarget.x,b.z-cameraTarget.z));lampPool.forEach((light,i)=>{const lamp=nearby[i];if(lamp){light.position.set(lamp.x,lamp.y,lamp.z);light.color.set(lamp.color);light.intensity=Math.min((lamp.intensity||30)*(room?1.2:1),55);}else light.intensity=0;});}
    sun.position.set(cameraTarget.x-14,24,cameraTarget.z-8);sun.target.position.set(cameraTarget.x,0,cameraTarget.z);motes.position.set(cameraTarget.x,0,cameraTarget.z);
    const dusk=THREE.MathUtils.clamp(simulation.ridgeProgress/18,0,1);sun.intensity=1.8-dusk*.65;sun.color.setRGB(1,.80-dusk*.17,.54-dusk*.18);
  }
  (pools.material as THREE.ShaderMaterial).uniforms.time.value=reducedMotion?0:elapsed;motes.rotation.y=reducedMotion?0:Math.sin(elapsed*.03)*.025;
  renderer.info.reset();renderer.shadowMap.needsUpdate=true;composer.render();
}
bindControls();void load();requestAnimationFrame(frame);
