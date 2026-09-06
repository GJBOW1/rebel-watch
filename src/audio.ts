import { GentleScore } from './music';

/** Original synthesized ambience and companion voice; no recordings or downloads. */
export class Soundscape {
  private context:AudioContext|null=null;
  private master:GainNode|null=null;
  private ambience:GainNode|null=null;
  private inside=false;
  private music:GentleScore|null=null;
  musicEnabled=true;
  musicVolume=.45;
  private battleMood=false;
  enabled=true;
  volume=.55;
  async start():Promise<void>{
    if(this.context){await this.context.resume();this.music?.resume();return;}
    const ctx=new AudioContext();this.context=ctx;this.master=ctx.createGain();this.master.gain.value=this.enabled?this.volume:0;this.master.connect(ctx.destination);
    const bed=ctx.createGain();bed.gain.value=this.inside?.015:.028;bed.connect(this.master);this.ambience=bed;
    const buffer=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate);const data=buffer.getChannelData(0);let brown=0;
    for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.035)/1.018;data[i]=brown;}
    const noise=ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=900;noise.connect(low);low.connect(bed);noise.start();
    for(const f of [73.42,110,146.83]){const osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=f;const g=ctx.createGain();g.gain.value=.032;osc.connect(g);g.connect(bed);osc.start();}
    this.music=new GentleScore(ctx,this.master);this.music.setVolume(this.musicVolume);this.music.setEnabled(this.musicEnabled);this.music.setBattleMood(this.battleMood);
  }
  setMusicEnabled(enabled:boolean):void{this.musicEnabled=enabled;this.music?.setEnabled(enabled);}
  toggleMusic():boolean{this.setMusicEnabled(!this.musicEnabled);return this.musicEnabled;}
  setMusicVolume(volume:number):void{if(!Number.isFinite(volume))return;this.musicVolume=Math.max(0,Math.min(1,volume));this.music?.setVolume(this.musicVolume);}
  setBattleMood(battle:boolean):void{this.battleMood=battle;this.music?.setBattleMood(battle);}
  get musicVoices():number{return this.music?.activeVoiceCount??0;}
  setInterior(inside:boolean):void{if(inside===this.inside)return;this.inside=inside;if(this.context&&this.ambience)this.ambience.gain.setTargetAtTime(inside?.015:.028,this.context.currentTime,.4);}
  setVolume(volume:number):void{if(!Number.isFinite(volume))return;this.volume=Math.max(0,Math.min(1,volume));this.applyVolume();}
  toggle():boolean{this.enabled=!this.enabled;this.applyVolume();return this.enabled;}
  private applyVolume():void{if(this.context&&this.master)this.master.gain.setTargetAtTime(this.enabled?this.volume:0,this.context.currentTime,.08);}
  private weaponSound(kind:string):void{
    const ctx=this.context!,t=ctx.currentTime;const enemy=kind.startsWith('enemy');const shot=kind.includes('blaster');const duration=shot?.24:kind==='down'?.42:.14;
    const bus=ctx.createGain();bus.gain.setValueAtTime(0,t);bus.gain.linearRampToValueAtTime(shot?.18:.09,t+.004);bus.gain.exponentialRampToValueAtTime(.0001,t+duration);bus.connect(this.master!);
    const osc=ctx.createOscillator();osc.type=shot?'sawtooth':'triangle';osc.frequency.setValueAtTime(shot?(enemy?970:1550):kind==='equip'?320:180,t);osc.frequency.exponentialRampToValueAtTime(shot?(enemy?72:110):55,t+duration);
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.setValueAtTime(3200,t);filter.frequency.exponentialRampToValueAtTime(450,t+duration);osc.connect(filter);filter.connect(bus);osc.start(t);osc.stop(t+duration);
    const noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.06),ctx.sampleRate),data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length)*.28;const burst=ctx.createBufferSource();burst.buffer=noise;burst.connect(filter);burst.start(t);setTimeout(()=>{bus.disconnect();filter.disconnect();},(duration+.1)*1000);
  }
  private cinematicSound(kind:string):void{
    const ctx=this.context!,t=ctx.currentTime,ship=kind.startsWith('ship-'),launch=kind==='ship-takeoff',deflect=kind==='deflect',duration=ship?3.8:deflect?.21:.65;
    const bus=ctx.createGain(),filter=ctx.createBiquadFilter();filter.type=ship?'lowpass':'bandpass';filter.frequency.setValueAtTime(ship?280:deflect?1800:640,t);filter.frequency.exponentialRampToValueAtTime(ship?(launch?950:130):deflect?500:1300,t+duration);filter.Q.value=ship?.5:1.3;filter.connect(bus);bus.connect(this.master!);
    bus.gain.setValueAtTime(0,t);bus.gain.linearRampToValueAtTime(ship?.12:deflect?.1:.075,t+(ship?.6:.018));bus.gain.exponentialRampToValueAtTime(.0001,t+duration);
    const sources:AudioScheduledSourceNode[]=[],nodes:AudioNode[]=[filter,bus];
    for(const [frequency,level] of (ship?[[46,.7],[68,.35],[94,.18]]:[[deflect?1220:92,.55],[deflect?710:185,.35]])){
      const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type=ship?'sawtooth':'triangle';oscillator.frequency.setValueAtTime(frequency*(launch?.8:1.3),t);oscillator.frequency.exponentialRampToValueAtTime(frequency*(ship?(launch?2.7:.6):deflect?.45:2.5),t+duration);gain.gain.value=level;oscillator.connect(gain);gain.connect(filter);sources.push(oscillator);nodes.push(gain);
    }
    const noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=noise.getChannelData(0);let low=0;for(let i=0;i<data.length;i++){low=low*.72+(Math.random()*2-1)*.28;data[i]=low*.35;}
    const hiss=ctx.createBufferSource();hiss.buffer=noise;hiss.connect(filter);sources.push(hiss);
    sources[0].onended=()=>{for(const source of sources)source.disconnect();for(const node of nodes)node.disconnect();};
    for(const source of sources){source.start(t);source.stop(t+duration+.03);}
  }
  play(kind:string,bond=35):void{
    const ctx=this.context;if(!ctx||!this.master||!this.enabled)return;
    if(['ship-land','ship-takeoff','saber','deflect'].includes(kind)){this.cinematicSound(kind);return;}
    if(kind.includes('blaster')||['impact','hit','down','equip'].includes(kind)){this.weaponSound(kind);return;}
    if(kind==='door'){const t=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();osc.type='sawtooth';osc.frequency.setValueAtTime(95,t);osc.frequency.exponentialRampToValueAtTime(210,t+.12);osc.frequency.exponentialRampToValueAtTime(65,t+.48);filter.type='lowpass';filter.frequency.value=440;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.055,t+.07);gain.gain.exponentialRampToValueAtTime(.0001,t+.5);osc.connect(filter);filter.connect(gain);gain.connect(this.master);osc.start(t);osc.stop(t+.52);return;}
    const t=ctx.currentTime;const warm=bond/100;const f=kind.includes('growl')?92:kind.includes('threat')?360:kind.includes('scan')?1150:kind.includes('call')?720:kind.includes('step')?95:490-warm*95;
    const step=kind.includes('step');const tones=step?[f]:kind.includes('chirp')||kind.includes('success')?[f,f*1.25,f*1.5]:[f,f*(kind.includes('threat')?.75:1.12)];
    tones.forEach((hz,i)=>{const osc=ctx.createOscillator();const gain=ctx.createGain();osc.type=kind.includes('growl')?'sawtooth':'sine';osc.frequency.setValueAtTime(hz,t+i*.1);osc.frequency.exponentialRampToValueAtTime(hz*(step?.5:1.08),t+i*.1+.13);gain.gain.setValueAtTime(0,t+i*.1);gain.gain.linearRampToValueAtTime(step?.012:.10,t+i*.1+.015);gain.gain.exponentialRampToValueAtTime(.0001,t+i*.1+(step?.07:.23+warm*.08));osc.connect(gain);gain.connect(this.master!);osc.start(t+i*.1);osc.stop(t+i*.1+.35);});
  }
}
