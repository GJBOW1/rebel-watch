import test from 'node:test';
import assert from 'node:assert/strict';
import { Soundscape } from '../src/audio.ts';

/** Contract-level Web Audio probe: checks synthesis and routing, not audible output. */
type Automation = { kind: string; value: number; time: number };
class Parameter {
  value = 0;
  events: Automation[] = [];
  setValueAtTime(value: number, time: number) { this.events.push({ kind: 'set', value, time }); }
  linearRampToValueAtTime(value: number, time: number) { this.events.push({ kind: 'linear', value, time }); }
  exponentialRampToValueAtTime(value: number, time: number) {
    assert.ok(value > 0, 'Web Audio exponential ramps require a positive target');
    this.events.push({ kind: 'exponential', value, time });
  }
  setTargetAtTime(value: number, time: number) { this.events.push({ kind: 'target', value, time }); }
  cancelScheduledValues(time:number) { this.events=this.events.filter(event=>event.time<time); }
}
class AudioNodeProbe {
  connections: AudioNodeProbe[] = [];
  disconnected = false;
  connect(destination: AudioNodeProbe) { this.connections.push(destination); return destination; }
  disconnect() { this.disconnected = true; }
}
class GainProbe extends AudioNodeProbe { gain = new Parameter(); }
class FilterProbe extends AudioNodeProbe { type = ''; frequency = new Parameter(); Q = new Parameter(); }
class PanProbe extends AudioNodeProbe { pan = new Parameter(); }
class ConvolverProbe extends AudioNodeProbe { buffer:unknown; }
class SourceProbe extends AudioNodeProbe {
  onended: (()=>void) | null = null;
  starts: number[] = [];
  stops: number[] = [];
  start(time = 0) { this.starts.push(time); }
  stop(time = 0) { this.stops.push(time); }
}
class OscillatorProbe extends SourceProbe { type = ''; frequency = new Parameter(); detune = new Parameter(); setPeriodicWave(_wave: unknown) { this.type='custom'; } }
class BufferSourceProbe extends SourceProbe { loop = false; buffer: unknown; }
class ContextProbe {
  static instances: ContextProbe[] = [];
  currentTime = 12;
  state = 'running';
  sampleRate = 8000;
  destination = new AudioNodeProbe();
  gains: GainProbe[] = [];
  filters: FilterProbe[] = [];
  oscillators: OscillatorProbe[] = [];
  sources: BufferSourceProbe[] = [];
  resumes = 0;
  constructor() { ContextProbe.instances.push(this); }
  async resume() { this.resumes++; }
  createPeriodicWave(real: Float32Array, imaginary: Float32Array) { assert.equal(real.length,imaginary.length);return {real,imaginary}; }
  createConvolver() { return new ConvolverProbe(); }
  createStereoPanner() { return new PanProbe(); }
  createGain() { const node = new GainProbe(); this.gains.push(node); return node; }
  createBiquadFilter() { const node = new FilterProbe(); this.filters.push(node); return node; }
  createOscillator() { const node = new OscillatorProbe(); this.oscillators.push(node); return node; }
  createBufferSource() { const node = new BufferSourceProbe(); this.sources.push(node); return node; }
  createBuffer(_channels: number, length: number) {
    const samples = new Float32Array(length);
    return { getChannelData: () => samples };
  }
}
async function probe(run: (sound: Soundscape, timers: { run: () => void; delay: number }[]) => Promise<void>) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const originalTimeout = globalThis.setTimeout;
  const timers: { run: () => void; delay: number }[] = [];
  ContextProbe.instances = [];
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: ContextProbe });
  globalThis.setTimeout = ((callback: () => void, delay: number) => {
    timers.push({ run: callback, delay }); return timers.length;
  }) as typeof setTimeout;
  try { await run(new Soundscape(), timers); }
  finally {
    globalThis.setTimeout = originalTimeout;
    if (descriptor) Object.defineProperty(globalThis, 'AudioContext', descriptor);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  }
}

test('audio starts once, routes ambience through the master, and resumes without duplicate sources', async () => {
  await probe(async sound => {
    sound.play('blaster');
    assert.equal(ContextProbe.instances.length, 0, 'effects do not create unsolicited audio contexts');
    await sound.start();
    const ctx = ContextProbe.instances[0], master = ctx.gains[0];
    assert.deepEqual(master.connections, [ctx.destination]);
    assert.equal(master.gain.value, sound.volume);
    assert.deepEqual(ctx.gains[1].connections, [master]);
    assert.ok(ctx.sources.some(source => source.loop), 'ambient noise is a looping source');
    const counts = [ctx.oscillators.length, ctx.sources.length, ctx.gains.length];
    await sound.start();
    assert.equal(ContextProbe.instances.length, 1);
    assert.equal(ctx.resumes, 1);
    assert.deepEqual([ctx.oscillators.length, ctx.sources.length, ctx.gains.length], counts);
  });
});

test('player and enemy blasters have bounded descending envelopes distinct from companion chirps', async () => {
  await probe(async (sound, timers) => {
    await sound.start();
    const ctx = ContextProbe.instances[0], master = ctx.gains[0];
    const shots: OscillatorProbe[] = [];
    for (const kind of ['blaster', 'enemy-blaster']) {
      const before = ctx.oscillators.length, beforeSources = ctx.sources.length;
      sound.play(kind);
      assert.equal(ctx.oscillators.length, before + 1);
      assert.equal(ctx.sources.length, beforeSources + 1, 'each shot includes its transient noise burst');
      const oscillator = ctx.oscillators.at(-1)!, filter = ctx.filters.at(-1)!, bus = ctx.gains.at(-1)!;
      shots.push(oscillator);
      assert.equal(oscillator.type, 'sawtooth');
      assert.deepEqual(oscillator.connections, [filter]);
      assert.deepEqual(filter.connections, [bus]);
      assert.deepEqual(bus.connections, [master]);
      assert.ok(oscillator.frequency.events[0].value > oscillator.frequency.events.at(-1)!.value);
      assert.equal(oscillator.starts.length, 1); assert.equal(oscillator.stops.length, 1);
      assert.ok(oscillator.stops[0] > oscillator.starts[0] && oscillator.stops[0] - oscillator.starts[0] < 0.5);
      const amplitude = bus.gain.events;
      assert.equal(amplitude[0].value, 0);
      assert.ok(amplitude[1].value > amplitude.at(-1)!.value, 'attack fades before the voice ends');
      const cleanup = timers.at(-1)!;
      assert.ok(cleanup.delay / 1000 > oscillator.stops[0] - oscillator.starts[0]);
      cleanup.run();
      assert.ok(bus.disconnected && filter.disconnected, 'transient routing is released after the voice ends');
    }
    assert.notEqual(shots[0].frequency.events[0].value, shots[1].frequency.events[0].value);
    const beforeChirp = ctx.oscillators.length;
    sound.play('chirp');
    const chirp = ctx.oscillators.slice(beforeChirp);
    assert.ok(chirp.length > 1 && chirp.every(voice => voice.type === 'sine'));
    assert.ok(chirp.every(voice => voice.frequency.events.at(-1)!.value > voice.frequency.events[0].value));
  });
});

test('muting gates new sounds and master output while retaining the chosen volume for unmute', async () => {
  await probe(async sound => {
    await sound.start();
    const ctx = ContextProbe.instances[0], master = ctx.gains[0];
    sound.setVolume(0.3);
    assert.equal(master.gain.events.at(-1)!.value, 0.3);
    assert.equal(sound.toggle(), false);
    assert.equal(master.gain.events.at(-1)!.value, 0);
    const voices = ctx.oscillators.length, sources = ctx.sources.length;
    for (const kind of ['blaster', 'enemy-blaster', 'impact', 'chirp']) sound.play(kind);
    assert.equal(ctx.oscillators.length, voices); assert.equal(ctx.sources.length, sources);
    sound.setVolume(0.7);
    assert.equal(master.gain.events.at(-1)!.value, 0, 'moving the volume slider does not unmute');
    assert.equal(sound.toggle(), true);
    assert.equal(master.gain.events.at(-1)!.value, 0.7);
    sound.play('blaster');
    assert.equal(ctx.oscillators.length, voices + 1);
  });
});

test('a mute selected before audio initialization also silences the ambient master', async () => {
  await probe(async sound => {
    sound.toggle();
    await sound.start();
    assert.equal(ContextProbe.instances[0].gains[0].gain.value, 0);
  });
});


test('music has independent controls while remaining downstream of the single master', async () => {
  await probe(async sound => {
    sound.setMusicVolume(.28);
    await sound.start();
    const ctx = ContextProbe.instances[0], master = ctx.gains[0];
    const scoreOutput = ctx.gains.find((gain,index) => index > 1 && gain.connections.includes(master))!;
    assert.ok(scoreOutput, 'music routes through the shared master');
    assert.equal(scoreOutput.gain.events.at(-1)!.value,.28);
    assert.ok(sound.musicVoices > 0, 'the original score schedules musical voices');
    assert.equal(sound.toggleMusic(),false);
    assert.equal(scoreOutput.gain.events.at(-1)!.value,0);
    sound.setMusicVolume(.8);
    assert.equal(scoreOutput.gain.events.at(-1)!.value,0,'volume does not override music mute');
    assert.equal(sound.toggleMusic(),true);
    assert.equal(scoreOutput.gain.events.at(-1)!.value,.8);
    sound.toggle();
    assert.equal(master.gain.events.at(-1)!.value,0,'master mute silences music and effects');
    assert.equal(sound.musicEnabled,true,'master mute retains independent music preference');
    sound.setMusicVolume(4);assert.equal(sound.musicVolume,1);
    sound.setMusicVolume(-4);assert.equal(sound.musicVolume,0);
    sound.setMusicVolume(NaN);assert.equal(sound.musicVolume,0);
  });
});

test('ship and energy-blade effects release every source and routing node', async () => {
  await probe(async sound => {
    await sound.start();
    const ctx = ContextProbe.instances[0];
    for (const kind of ['ship-land','ship-takeoff','saber','deflect']) {
      const oscStart=ctx.oscillators.length, sourceStart=ctx.sources.length;
      sound.play(kind);
      const sources=[...ctx.oscillators.slice(oscStart),...ctx.sources.slice(sourceStart)];
      assert.ok(sources.length>=3);
      for(const source of sources){
        assert.equal(source.starts.length,1);assert.equal(source.stops.length,1);
        assert.ok(source.stops[0]-source.starts[0] <= 4,'all cinematic effects are bounded');
      }
      sources[0].onended?.();
      assert.ok(sources.every(source=>source.disconnected),'all effect sources disconnect on completion');
    }
  });
});

import { GentleScore, ScoreOrchestra, SCORE, EIGHTH_SECONDS, scoreAtTick } from '../src/music.ts';

test('the original score has a complete phrase cycle, real rests, and bounded musical pitch ranges', () => {
  let melodies=0, rests=0, harp=0;
  for(let tick=0;tick<SCORE.bars*8;tick++){
    const notes=scoreAtTick(tick);
    assert.deepEqual(notes,scoreAtTick(tick+SCORE.bars*8),'the 32-bar arrangement loops coherently');
    assert.ok(notes.length<=6);
    if(!notes.length)rests++;
    for(const note of notes){
      assert.ok(note.midi>=33 && note.midi<=79);
      assert.ok(note.beats>0 && note.beats<=8);
      assert.ok(note.velocity>0 && note.velocity<=.085);
      if(note.instrument==='horn'||note.instrument==='flute')melodies++;
      if(note.instrument==='harp')harp++;
    }
  }
  assert.ok(melodies>35 && melodies<65,'sparse composed melody spans the full arrangement');
  assert.ok(rests>100 && harp>50);
  assert.ok(SCORE.bars*8*EIGHTH_SECONDS>110);
  const quiet=scoreAtTick(2),battle=scoreAtTick(2,true);
  assert.equal(battle.length,quiet.length+1,'battle adds a restrained pulse without replacing the harmony');
});

test('music schedules a complete cycle without unbounded voices or a catch-up burst, and pauses when hidden', async () => {
  await probe(async (_sound,timers)=>{
    const ctx=new ContextProbe(),music=new GentleScore(ctx as unknown as AudioContext,ctx.destination as unknown as AudioNode);
    let maximum=music.activeVoiceCount;
    const finishDue=()=>{for(const osc of ctx.oscillators){if(osc.stops.at(-1)!<=ctx.currentTime && !osc.disconnected)osc.onended?.();}};
    for(let step=0;step<1200;step++){
      ctx.currentTime+=.1;finishDue();timers.at(-1)!.run();maximum=Math.max(maximum,music.activeVoiceCount);
    }
    assert.ok(maximum>5 && maximum<22,`musical polyphony stays bounded: ${maximum}`);
    const count=ctx.oscillators.length;
    ctx.currentTime+=300;finishDue();timers.at(-1)!.run();
    assert.ok(ctx.oscillators.length-count<=28,'throttled time skips missed music instead of replaying it');
    music.setHidden(true);const hiddenCount=ctx.oscillators.length;
    ctx.currentTime+=20;finishDue();timers.at(-1)!.run();
    assert.equal(ctx.oscillators.length,hiddenCount,'hidden tabs schedule no new voices');
    music.setHidden(false);assert.ok(ctx.oscillators.length>hiddenCount,'returning to the tab resumes gently');
    music.dispose();assert.equal(music.activeVoiceCount,0);
  });
});

test('orchestra sources have finite ends and an enforced voice ceiling', async () => {
  await probe(async ()=>{
    const ctx=new ContextProbe(),orchestra=new ScoreOrchestra(ctx as unknown as AudioContext,ctx.destination as unknown as AudioNode);
    for(let i=0;i<80;i++)orchestra.note({instrument:'strings',midi:62,beats:2,velocity:.03,pan:0},ctx.currentTime+.1);
    assert.equal(orchestra.activeVoiceCount,48);
    for(const source of ctx.oscillators){assert.equal(source.starts.length,1);assert.equal(source.stops.length,1);assert.ok(source.stops[0]>source.starts[0]);}
    orchestra.dispose();assert.equal(orchestra.activeVoiceCount,0);
    assert.ok(ctx.oscillators.every(source=>source.disconnected));
  });
});
