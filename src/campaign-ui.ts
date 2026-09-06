import { Campaign, type CampaignMarker } from './campaign';
import type { CampaignCombat } from './campaign-combat';
import type { Pilot } from './pilot';
import type { Vec2 } from './simulation';

export interface CampaignActions {route:(marker:CampaignMarker)=>void; equip:(id:string)=>void; pause:(open:boolean)=>void;retry:()=>void; retreat:()=>void;land:()=>void;repair:()=>void}
const el=(name:string,text?:string,className?:string)=>{const node=document.createElement(name);if(text)node.textContent=text;if(className)node.className=className;return node;};
const gap=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.z-b.z);
export class CampaignUI {
  open=false;selectedMarkerId:string|null=null;
  private tab='story';private lastSignature='';
  private card=el('section',undefined,'campaign-card');private chapter=el('span',undefined,'chapter');private title=el('h3');private objective=el('p');
  private waypoint=el('button',undefined,'mission-waypoint');private resources=el('div',undefined,'campaign-resources');private grogu=el('div','Grogu · under your protection','grogu-link');
  private modal=el('div',undefined,'journal-backdrop');private grid=el('div',undefined,'journal-grid');private stock=el('p');
  private chip=el('button',undefined,'loadout-chip');private boss=el('section',undefined,'boss-hud');private flight=el('section',undefined,'pilot-hud');
  private oath:HTMLElement|null=null;
  private current:Campaign|null=null;private player:Vec2={x:3,z:6};private paused=false;
  constructor(private actions:CampaignActions){
    document.documentElement.classList.add('campaign-ready');
    this.card.id='campaign-card';this.waypoint.id='mission-waypoint';this.card.append(this.chapter,this.title,this.objective,this.waypoint,this.resources,this.grogu);
    const journal=el('button','MISSION JOURNAL  ·  K','journal-link');journal.id='journal-button';journal.addEventListener('click',()=>this.setOpen(!this.open));this.card.append(journal);
    document.querySelector('.signal-panel')!.append(this.card);
    this.waypoint.addEventListener('click',()=>{const m=this.trackedMarker;if(m)this.route(m);});
    this.chip.id='loadout-button';this.chip.addEventListener('click',()=>{this.tab='armory';this.setOpen(true);});document.querySelector('#hud')!.append(this.chip);
    this.modal.id='mission-journal';this.modal.hidden=true;
    this.modal.innerHTML='<section class="journal-dialog" role="dialog" aria-modal="true" aria-labelledby="journal-title"><div class="journal-title"><div><span class="eyebrow">REBEL ALLIANCE // FIELD OPERATIONS</span><h2 id="journal-title">Operation Emberline</h2><p>Keep the Jedi route open. Leave no small light behind.</p></div><button id="journal-close" aria-label="Close mission journal">×</button></div><nav class="journal-tabs" role="tablist"><button data-tab="story" role="tab">MAIN STORY</button><button data-tab="contracts" role="tab">SIDE CONTRACTS</button><button data-tab="armory" role="tab">ARMORY</button></nav></section>';
    this.oath=document.querySelector<HTMLElement>('.objectives');
    this.stock.className='journal-stock';this.modal.querySelector('.journal-dialog')!.append(this.stock,this.grid,el('p','K / Esc · Close journal   |   Select a destination to walk there. Press E when you arrive to accept, act, or claim a reward. Campaign progress saves automatically in this browser.','journal-foot'));
    if(this.oath)this.modal.querySelector('.journal-dialog')!.insertBefore(this.oath,this.modal.querySelector('.journal-foot'));
    this.modal.querySelector('#journal-close')!.addEventListener('click',()=>this.setOpen(false));
    for(const button of this.modal.querySelectorAll<HTMLButtonElement>('[data-tab]'))button.addEventListener('click',()=>{this.tab=button.dataset.tab!;this.lastSignature='';this.render();});
    this.modal.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const controls=[...this.modal.querySelectorAll<HTMLElement>('button:not(:disabled)')];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}});
    document.body.append(this.modal);
    this.boss.id='boss-hud';this.boss.hidden=true;this.boss.innerHTML='<span class="eyebrow" id="boss-state"></span><h2 id="boss-name"></h2><div class="boss-health"><span id="boss-health-fill"></span></div><p id="boss-guard"></p><p id="boss-player-shield"></p><button class="boss-retry" id="boss-retry">Retry checkpoint</button><button class="boss-retry" id="boss-retreat">Withdraw</button>';
    this.boss.querySelector('#boss-retry')!.addEventListener('click',actions.retry);this.boss.querySelector('#boss-retreat')!.addEventListener('click',actions.retreat);document.body.append(this.boss);
    this.flight.id='pilot-hud';this.flight.hidden=true;this.flight.innerHTML='<div class="pilot-top"><span class="eyebrow">REBEL FLIGHT // EMBERLINE</span><h2>WAYFARER ONE</h2></div><div class="pilot-reticle"></div><div class="pilot-readout"><p id="pilot-speed"></p><p id="pilot-altitude"></p><p id="pilot-shield"></p><p id="pilot-kills"></p></div><div class="landing-hint" id="pilot-landing"></div><button class="pilot-land-button" id="pilot-land">L · Request landing</button><div class="pilot-controls">W accelerate · S brake · A / D steer · Q / E altitude · Shift boost · Space / Click fire · L land · N enemies</div>';
    this.flight.querySelector('#pilot-land')!.addEventListener('click',actions.land);document.body.append(this.flight);
  }
  get trackedMarker():CampaignMarker|null{
    if(!this.current)return null;const markers=this.current.markers;
    const selected=markers.find(m=>m.id===this.selectedMarkerId);if(selected)return selected;
    const main=markers.filter(m=>m.questId===this.current!.currentQuest?.id);
    return (main.length?main:markers).sort((a,b)=>gap(a,this.player)-gap(b,this.player))[0]??null;
  }
  nearbyMarker(player:Vec2):CampaignMarker|null{
    if(!this.current)return null;
    const markers=this.current.markers.filter(m=>gap(m,player)<=3);
    return markers.find(m=>m.id===this.selectedMarkerId)??markers.find(m=>m.kind!=='side')??markers[0]??null;
  }
  private route(marker:CampaignMarker):void{this.selectedMarkerId=marker.id;this.setOpen(false);this.actions.route(marker);}
  setOpen(open:boolean):void{this.open=open;this.modal.hidden=!open;this.actions.pause(open);if(open){this.lastSignature='';this.render();this.modal.querySelector<HTMLElement>('#journal-close')!.focus();}else document.querySelector<HTMLElement>('#game')?.focus();}
  update(campaign:Campaign,player:Vec2,boss:CampaignCombat,pilot:Pilot,started:boolean):void{
    this.current=campaign;this.player=player;const quest=campaign.currentQuest;const marker=this.trackedMarker;
    this.chapter.textContent=campaign.completed?'EMBERLINE // CONVOY CLEAR':`OPERATION EMBERLINE // ${quest?.number??1} OF 6`;
    this.title.textContent=quest?.title??'The watch continues';this.objective.textContent=quest?.objective??'The first convoy is safe. Explore, help your neighbors, and keep the next road open.';
    this.waypoint.textContent=marker?`◇ ${marker.label} · ${Math.round(gap(marker,player))} m`:'All signals answered';(this.waypoint as HTMLButtonElement).disabled=!marker||boss.active;
    const r=campaign.resources;this.resources.textContent=`${r.credits} CR  ·  ${r.scrap} SCRAP  ·  ${r.cells} CELLS`;this.grogu.hidden=!campaign.groguRescued;
    this.chip.replaceChildren(el('small','LOADOUT · 1–5'),el('strong',campaign.equippedWeapon.name),el('small','K ↗'));this.chip.hidden=!started;
    this.card.hidden=!started;
    document.documentElement.classList.toggle('boss-active',!!boss.boss&&boss.status!=='idle');this.boss.hidden=!started||!boss.boss||boss.status==='idle'||pilot.aboard;
    if(boss.boss){const b=boss.boss;this.boss.querySelector('#boss-name')!.textContent=b.name;this.boss.querySelector('#boss-state')!.textContent=boss.status==='paused'?'ENCOUNTER PAUSED · N RESUMES':boss.defeated?'SHIELD LOST · CHECKPOINT READY':boss.victory?'ESCAPE CORRIDOR OPEN':b.state==='telegraph'?'MOVE CLEAR OF THE RED WARNING':b.state==='stunned'?'GUARD OPEN · PRESS THE ATTACK':'IMPERIAL COMMAND';
      (this.boss.querySelector('#boss-health-fill') as HTMLElement).style.width=`${100*b.health/b.maxHealth}%`;
      this.boss.querySelector('#boss-guard')!.textContent=b.shield>0?`COMMAND GUARD ${Math.ceil(b.shield)} / ${b.maxShield} · ${b.minimumTier===3?'EMBER ARC':'ION WEAPON'} REQUIRED`:`Guard broken · ${Math.ceil(b.health)} / ${b.maxHealth}`;
      this.boss.querySelector('#boss-player-shield')!.textContent=`YOUR SHIELD ${Math.ceil(boss.shield)} / ${boss.maxShield}`;
      (this.boss.querySelector('#boss-retry') as HTMLElement).hidden=!boss.defeated;(this.boss.querySelector('#boss-retreat') as HTMLElement).hidden=!boss.defeated&&boss.status!=='paused';
    }
    this.flight.hidden=!started||!pilot.aboard;document.documentElement.classList.toggle('piloting',started&&pilot.aboard);
    if(pilot.aboard){this.flight.querySelector('#pilot-speed')!.textContent=`SPEED   ${Math.round(pilot.state.speed)} m/s`;this.flight.querySelector('#pilot-altitude')!.textContent=`ALTITUDE   ${Math.round(pilot.state.y)} m`;this.flight.querySelector('#pilot-shield')!.textContent=`SHIELD   ${Math.ceil(pilot.state.shield)}%`;this.flight.querySelector('#pilot-kills')!.textContent=`TIE FIGHTERS DOWN   ${pilot.kills}`;this.flight.querySelector('#pilot-landing')!.textContent=pilot.landingHint;(this.flight.querySelector('#pilot-land') as HTMLButtonElement).disabled=pilot.state.phase!=='flying';}
    if(this.open)this.render();
  }
  private render():void{
    const c=this.current;if(!c)return;const signature=JSON.stringify([this.tab,c.save(),this.selectedMarkerId]);if(signature===this.lastSignature)return;this.lastSignature=signature;
    for(const b of this.modal.querySelectorAll<HTMLButtonElement>('[data-tab]'))b.setAttribute('aria-selected',String(b.dataset.tab===this.tab));
    this.stock.textContent=`${c.resources.credits} credits   ·   ${c.resources.scrap} scrap   ·   ${c.resources.cells} energy cells`;
    this.grid.replaceChildren();if(this.oath)this.oath.hidden=this.tab!=='contracts';
    if(this.tab==='armory'){
      for(const weapon of c.weapons){const tile=el('article',undefined,`quest-tile ${weapon.id===c.equippedWeapon.id?'selected':''}`);tile.append(el('span',`POWER ${weapon.tier} // ${weapon.damage} DAMAGE`,'eyebrow'),el('h3',weapon.name),el('p',weapon.description));const b=el('button',weapon.id===c.equippedWeapon.id?'Equipped':'Equip weapon');b.setAttribute('data-weapon',weapon.id);b.addEventListener('click',()=>{this.actions.equip(weapon.id);this.lastSignature='';this.render();});tile.append(b);this.grid.append(tile);}
      const tile=el('article',undefined,'quest-tile');tile.append(el('span','FIELD SERVICE','eyebrow'),el('h3','Rebuild your shield'),el('p','Spend 20 credits and 2 cells to restore your shield. Main quest weapons never require a purchase.'));const b=el('button','Repair · 20 CR + 2 cells');b.id='field-repair';b.addEventListener('click',()=>this.actions.repair());tile.append(b);this.grid.append(tile);return;
    }
    for(const quest of c.quests.filter(q=>q.optional===(this.tab==='contracts'))){const tile=el('article',undefined,`quest-tile ${quest.status==='complete'?'completed':''}`);tile.append(el('span',`${quest.optional?'OPTIONAL CONTRACT':`CHAPTER ${quest.number}`} // ${quest.status.toUpperCase()}`,'eyebrow'),el('h3',quest.title),el('p',quest.summary),el('p',quest.objective,'quest-progress'));
      for(const marker of c.markers.filter(m=>m.questId===quest.id)){const b=el('button',`◇ ${marker.label}`);b.setAttribute('data-quest-marker',marker.id);b.addEventListener('click',()=>this.route(marker));tile.append(b);}this.grid.append(tile);}
  }
}
