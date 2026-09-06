import * as THREE from 'three';

export interface CinematicBeat { speaker: string; text: string; focus: {x:number;z:number}; duration: number }
/** Real scene cameras with readable subtitles; skipping changes no quest objective. */
export class Cinematics {
  active=false;
  private beats:CinematicBeat[]=[];
  private index=0;
  private age=0;
  private completion:()=>void=()=>{};
  private root=document.createElement('section');
  private title=document.createElement('span');
  private speaker=document.createElement('strong');
  private subtitle=document.createElement('p');
  private count=document.createElement('span');
  private skip=document.createElement('button');
  constructor(){
    this.root.id='cinematic';this.root.className='cinematic';this.root.hidden=true;
    this.root.setAttribute('aria-label','Story cinematic');this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');
    this.root.innerHTML='<div class="cinematic-top"></div><div class="cinematic-bottom"><div class="cinematic-subtitle"></div></div>';
    this.title.className='cinematic-title';this.count.className='cinematic-count';
    this.skip.id='skip-cinematic';this.skip.textContent='Skip scene · Esc';this.skip.addEventListener('click',()=>this.finish());
    this.root.querySelector('.cinematic-top')!.append(this.title,this.skip);
    this.root.querySelector('.cinematic-subtitle')!.append(this.speaker,this.subtitle,this.count);
    document.body.append(this.root);
    this.root.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();this.skip.focus();}});
  }
  play(title:string,beats:CinematicBeat[],done:()=>void):void{
    if(!beats.length){done();return;}
    this.beats=beats;this.index=0;this.age=0;this.completion=done;this.active=true;
    this.root.hidden=false;this.title.textContent=title;document.documentElement.classList.add('cinematic-active');this.showBeat();this.skip.focus();
  }
  private showBeat():void{const b=this.beats[this.index];this.speaker.textContent=b.speaker;this.subtitle.textContent=b.text;this.count.textContent=`${this.index+1} / ${this.beats.length}`;}
  tick(dt:number):void{
    if(!this.active)return;
    this.age+=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0));
    if(this.age>=Math.max(2,this.beats[this.index].duration)){this.age=0;this.index++;if(this.index>=this.beats.length){this.finish();return;}this.showBeat();}
  }
  cameraPose():{position:THREE.Vector3;target:THREE.Vector3}|null{
    if(!this.active)return null;const b=this.beats[this.index];
    const angle=.38+this.index*.62+Math.min(this.age/Math.max(2,b.duration),1)*.15;
    const indoor=(Math.abs(b.focus.x+8.1)<4&&Math.abs(b.focus.z+38.1)<5)||(Math.abs(b.focus.x-53.1)<5&&Math.abs(b.focus.z-10.5)<5);
    const radius=indoor?12:19;const target=new THREE.Vector3(b.focus.x,1,b.focus.z);
    const direction=indoor&&b.focus.z>0?-1:1;
    return{position:target.clone().add(new THREE.Vector3(Math.sin(angle)*radius,indoor?12:13,Math.cos(angle)*radius*direction)),target};
  }
  finish():void{if(!this.active)return;this.active=false;this.root.hidden=true;document.documentElement.classList.remove('cinematic-active');this.completion();document.querySelector<HTMLElement>('#game')?.focus();}
  get evidence(){return{active:this.active,beat:this.index,title:this.title.textContent,speaker:this.speaker.textContent};}
}
