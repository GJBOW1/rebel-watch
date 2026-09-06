/** “Lanterns Beyond the Rim” — an original, generated chamber-orchestra score.
 * No sampled instruments, recordings, imported MIDI, or borrowed themes.
 */
export type Instrument = 'strings' | 'horn' | 'flute' | 'harp' | 'bass';
export interface ScoreNote { instrument: Instrument; midi: number; beats: number; velocity: number; pan: number; }
export const SCORE = { title: 'Lanterns Beyond the Rim', bpm: 68, bars: 32, beatsPerBar: 4 } as const;
export const EIGHTH_SECONDS = 30 / SCORE.bpm;
const CHORDS = [
  [38,50,57,60,64], [34,50,57,58,65], [43,50,57,58,65], [33,52,57,62,67],
  [38,50,57,59,65], [36,48,55,59,64], [34,50,53,57,62], [33,49,55,59,64],
  [41,48,55,57,64], [40,48,55,60,64], [43,50,57,58,65], [38,50,57,60,65],
  [34,50,55,58,65], [36,50,55,60,67], [33,48,55,57,64], [38,50,57,60,64],
] as const;
// Each melody event is [eighth-note offset in its bar, MIDI pitch, length in beats].
const MELODY: [number, number, number][][] = [
  [], [], [[0,69,1.5],[4,65,1.5]], [[0,67,1],[2,64,2],[6,62,.75]],
  [[2,65,2.5]], [[0,69,1.5],[4,67,1.5]], [[0,64,2],[5,62,1]], [],
  [[0,71,2],[5,69,1]], [[1,65,1.5],[5,64,1]], [[0,67,1],[3,71,1],[6,69,.75]], [],
  [[1,65,2],[6,62,.75]], [[0,64,1.5],[4,69,1.5]], [[0,67,2],[5,64,1]], [],
  [[0,72,2],[5,69,1]], [[1,67,1.5],[5,64,1]], [[0,67,2.5]], [[0,72,1.5],[4,71,1.5]],
  [[1,69,2],[6,65,.75]], [[0,67,1.5],[4,62,1.5]], [[0,65,2],[5,64,1]], [],
  [[1,69,2],[6,65,.75]], [[0,67,1.5],[4,62,1.5]], [[0,67,2],[5,72,1]], [[0,69,3]],
  [[1,64,1.5],[5,60,1]], [[0,62,1],[3,64,1.5]], [[0,65,2],[5,62,1]], [],
];

/** Pure score data: an eighth-note clock allows rests and a bounded live scheduler. */
export function scoreAtTick(absoluteTick: number, battle = false): ScoreNote[] {
  const tick = ((Math.floor(absoluteTick) % 256) + 256) % 256;
  const bar = Math.floor(tick / 8), local = tick % 8, chord = CHORDS[Math.floor(bar / 2)];
  const notes: ScoreNote[] = [];
  if (local === 0 && bar % 2 === 0) {
    chord.slice(1).forEach((midi, index) => notes.push({ instrument: 'strings', midi, beats: 7.8, velocity: .031, pan: [-.55,-.2,.2,.55][index] }));
    notes.push({ instrument: 'bass', midi: chord[0], beats: 7.6, velocity: .057, pan: -.08 });
  }
  // Unhurried, changing arpeggios leave plenty of room for the world and dialogue.
  if ([1, 4, 6].includes(local) && (bar % 4 !== 3 || local === 1)) {
    const index = 1 + ((bar + local) % 4);
    notes.push({ instrument: 'harp', midi: chord[index] + 12, beats: 1.25, velocity: .044, pan: local === 4 ? .36 : -.3 });
  }
  for (const [offset, midi, beats] of MELODY[bar]) {
    if (local === offset) notes.push({ instrument: bar >= 16 && bar < 24 ? 'flute' : 'horn', midi, beats, velocity: .085, pan: bar >= 16 && bar < 24 ? .16 : -.12 });
  }
  // A restrained lower-string pulse, never a loud replacement track.
  if (battle && local % 2 === 0) notes.push({ instrument: 'strings', midi: chord[local === 4 ? 1 : 0] + 12, beats: .55, velocity: .036, pan: .1 });
  return notes;
}

interface Voice { sources: OscillatorNode[]; nodes: AudioNode[]; gain: GainNode; end: number; stopped: boolean; }

/** Orchestral tone generation shared by the real-time player and offline audio QA. */
export class ScoreOrchestra {
  readonly input: GainNode;
  private readonly dry: GainNode;
  private readonly wet: GainNode;
  private readonly reverb: ConvolverNode;
  private readonly waves: Record<Instrument, PeriodicWave>;
  private voices = new Set<Voice>();
  constructor(private readonly context: BaseAudioContext, destination: AudioNode) {
    this.input = context.createGain();
    this.dry = context.createGain(); this.dry.gain.value = .78;
    this.wet = context.createGain(); this.wet.gain.value = .36;
    this.reverb = context.createConvolver(); this.reverb.buffer = this.createRoom();
    this.input.connect(this.dry); this.dry.connect(destination);
    this.input.connect(this.reverb); this.reverb.connect(this.wet); this.wet.connect(destination);
    this.waves = {
      strings: this.wave(n => Math.pow(n, -1.35) * (n % 2 ? 1 : .8), 24),
      horn: this.wave(n => [0,1,.63,.39,.19,.08,.035,.013][n] || 0, 8),
      flute: this.wave(n => [0,1,.065,.15,.012,.028][n] || 0, 6),
      harp: this.wave(n => Math.pow(n, -1.9) * (n % 2 ? 1 : .62), 16),
      bass: this.wave(n => [0,1,.23,.1,.03][n] || 0, 5),
    };
  }
  get activeVoiceCount(): number { return this.voices.size; }
  private wave(amplitude: (harmonic: number) => number, size: number): PeriodicWave {
    const real = new Float32Array(size), imaginary = new Float32Array(size);
    for (let n = 1; n < size; n++) imaginary[n] = amplitude(n);
    return this.context.createPeriodicWave(real, imaginary);
  }
  private createRoom(): AudioBuffer {
    const ctx = this.context, length = Math.floor(ctx.sampleRate * 2.8), buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    let seed = 278173;
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel); let smoothed = 0;
      for (let i = 0; i < length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        smoothed = smoothed * .73 + (seed / 2147483648 - 1) * .27;
        const seconds = i / ctx.sampleRate;
        data[i] = seconds < .025 ? 0 : smoothed * Math.exp(-seconds * 2.7) * Math.min(1, (seconds - .025) * 40);
      }
      for (const [delay, gain] of [[.047,.2],[.081,.13],[.127,.075]]) {
        data[Math.floor((delay + channel * .007) * ctx.sampleRate)] += gain;
      }
    }
    return buffer;
  }
  note(note: ScoreNote, time: number): void {
    // Hard cap also protects suspended contexts from accumulating queued sources.
    if (this.voices.size >= 48) return;
    const ctx = this.context, held = note.beats * 60 / SCORE.bpm;
    const pluck = note.instrument === 'harp', string = note.instrument === 'strings';
    const attack = pluck ? .012 : string ? Math.min(.85, held * .25) : note.instrument === 'bass' ? .3 : .13;
    const release = pluck ? 1.3 : string ? .9 : .45;
    const end = time + held + release;
    const gain = ctx.createGain(), filter = ctx.createBiquadFilter(), pan = ctx.createStereoPanner();
    pan.pan.value = note.pan;
    filter.type = 'lowpass'; filter.Q.value = .35;
    const cutoff = pluck ? 2900 : string ? 1800 : note.instrument === 'horn' ? 1700 : 2800;
    filter.frequency.setValueAtTime(cutoff * .68, time);
    filter.frequency.linearRampToValueAtTime(cutoff, time + attack);
    filter.frequency.linearRampToValueAtTime(cutoff * .7, end);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(note.velocity, time + attack);
    if (pluck) {
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001, note.velocity * .13), time + held * .8);
      gain.gain.exponentialRampToValueAtTime(.0001, end);
    } else {
      gain.gain.linearRampToValueAtTime(note.velocity * (string ? .76 : .83), time + held * .7);
      gain.gain.linearRampToValueAtTime(note.velocity * .55, time + held);
      gain.gain.exponentialRampToValueAtTime(.0001, end);
    }
    filter.connect(gain); gain.connect(pan); pan.connect(this.input);
    const voice: Voice = { sources: [], nodes: [filter, gain, pan], gain, end, stopped: false };
    const frequency = 440 * Math.pow(2, (note.midi - 69) / 12);
    const detunes = string ? [-5, 0, 5] : [0];
    for (const cents of detunes) {
      const osc = ctx.createOscillator(), level = ctx.createGain();
      osc.setPeriodicWave(this.waves[note.instrument]); osc.frequency.value = frequency; osc.detune.value = cents;
      level.gain.value = 1 / detunes.length;
      osc.connect(level); level.connect(filter); voice.sources.push(osc); voice.nodes.push(level);
      if (!pluck && note.instrument !== 'bass') {
        const vibrato = ctx.createOscillator(), depth = ctx.createGain();
        vibrato.frequency.value = 4.7 + (note.midi % 5) * .12;
        depth.gain.setValueAtTime(0, time); depth.gain.linearRampToValueAtTime(string ? 3.5 : 5, time + Math.min(.6, held * .45));
        vibrato.connect(depth); depth.connect(osc.detune); voice.sources.push(vibrato); voice.nodes.push(depth);
      }
    }
    this.voices.add(voice);
    voice.sources[0].onended = () => this.release(voice);
    for (const source of voice.sources) { source.start(time); source.stop(end + .025); }
  }
  private release(voice: Voice): void {
    if (!this.voices.delete(voice)) return;
    for (const source of voice.sources) source.disconnect();
    for (const node of voice.nodes) node.disconnect();
  }
  silence(time: number): void {
    for (const voice of this.voices) {
      if (voice.stopped) continue;
      voice.stopped = true;
      voice.gain.gain.cancelScheduledValues(time);
      voice.gain.gain.setTargetAtTime(0, time, .07);
      for (const source of voice.sources) source.stop(time + .35);
    }
  }
  dispose(): void {
    this.silence(this.context.currentTime);
    for (const voice of [...this.voices]) this.release(voice);
    this.input.disconnect(); this.dry.disconnect(); this.wet.disconnect(); this.reverb.disconnect();
  }
}

export class GentleScore {
  private readonly output: GainNode;
  private readonly orchestra: ScoreOrchestra;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private tick = 0;
  private nextTime = 0;
  private enabled = true;
  private volume = .45;
  private battle = false;
  private hidden = false;
  private disposed = false;
  private readonly visibilityChanged = () => this.setHidden(document.hidden);
  constructor(private readonly context: AudioContext, destination: AudioNode) {
    this.output = context.createGain(); this.output.gain.value = 0; this.output.connect(destination);
    this.orchestra = new ScoreOrchestra(context, this.output);
    this.hidden = typeof document !== 'undefined' && document.hidden;
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.visibilityChanged);
    this.nextTime = context.currentTime + .15;
    this.refresh();
  }
  get activeVoiceCount(): number { return this.orchestra.activeVoiceCount; }
  setEnabled(enabled: boolean): void { if (enabled === this.enabled) return; this.enabled = enabled; this.refresh(); }
  setVolume(volume: number): void { this.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : this.volume; this.applyGain(); }
  setBattleMood(battle: boolean): void { this.battle = battle; }
  setHidden(hidden: boolean): void { if (hidden === this.hidden) return; this.hidden = hidden; this.refresh(); }
  resume(): void { if (!this.timer) this.refresh(); }
  private applyGain(): void { this.output.gain.setTargetAtTime(this.enabled && !this.hidden ? this.volume : 0, this.context.currentTime, .65); }
  private refresh(): void {
    if (this.disposed) return;
    this.applyGain();
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
    if (!this.enabled || this.hidden) { this.orchestra.silence(this.context.currentTime); return; }
    this.nextTime = Math.max(this.nextTime, this.context.currentTime + .1);
    this.schedule();
  }
  private schedule = (): void => {
    this.timer = null;
    if (this.disposed || !this.enabled || this.hidden) return;
    const now = this.context.currentTime;
    // Background throttling or an interrupted device resumes with one future beat,
    // never an audible burst replaying the elapsed wall-clock time.
    if (this.nextTime < now - .1) { this.nextTime = now + .1; this.tick = Math.ceil(this.tick / 8) * 8; }
    if (this.context.state === 'running') {
      let scheduled = 0;
      while (this.nextTime < now + .45 && scheduled++ < 4) {
        for (const note of scoreAtTick(this.tick++, this.battle)) this.orchestra.note(note, this.nextTime);
        this.nextTime += EIGHTH_SECONDS;
      }
    }
    this.timer = setTimeout(this.schedule, 80);
    // Node test runners should not be kept alive by a browser-oriented scheduler.
    (this.timer as unknown as { unref?: () => void }).unref?.();
  };
  dispose(): void {
    this.disposed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.orchestra.dispose(); this.output.disconnect();
  }
}
