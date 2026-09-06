# Lanterns Beyond the Rim

An original instrumental score composed and synthesized for Rebel Watch. No existing film melody, recording, sample library, MIDI file, or downloaded music is used.

The arrangement is 32 bars at 68 BPM (approximately 113 seconds), written around D minor with occasional Dorian color, suspended chords, and gently changing extended harmonies. It opens with low strings and unhurried harp notes. A warm horn carries short, spacious phrases; a woodwind takes the middle passage. The final phrase settles back into the opening harmony. Battle adds a quiet lower-string pulse while preserving the same tempo and harmonic progression.

Five original timbres use harmonic wavetables. The strings combine three slightly detuned voices with gradual bow-like envelopes and subtle vibrato; the horn and woodwind use separate harmonic balances and breath-like phrasing. A generated stereo impulse supplies a soft room tail and early reflections. No additional AudioContext is created: music, ambience, and effects all pass through Soundscape's existing master bus. Music has a separate enabled preference and volume (45% by default), with gentle gain transitions.

A 450 ms look-ahead timer schedules on the audio clock, with a hard voice ceiling of 48. Hidden tabs stop scheduling and fade voices out. Returning to a throttled or suspended context skips missed ticks instead of producing a burst of old notes. Every oscillator has an explicit stop time and disconnects after completion. Complete-cycle automated probes verify bounded polyphony, timing recovery, and independent music/master mute routing. Additional generated ship-engine and energy-blade effects also have finite source lifetimes.

The implementation uses the browser's [PeriodicWave](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createPeriodicWave) and [ConvolverNode](https://developer.mozilla.org/en-US/docs/Web/API/ConvolverNode) interfaces. The score itself and all synthesis parameters are original project work.

## Integration

`Soundscape.start()` initializes music through the existing user gesture. Repeating it resumes the same context and does not create another player.

- `setMusicEnabled(boolean)` and `toggleMusic(): boolean`
- `setMusicVolume(number)` clamps finite values to 0–1
- `setBattleMood(boolean)` controls the restrained accompaniment layer
- `musicEnabled`, `musicVolume`, and read-only `musicVoices` expose HUD/QA state
- `play('ship-land' | 'ship-takeoff' | 'saber' | 'deflect')` supplies original effects

`outputs/score-preview.wav` is a 48-second native OfflineAudioContext render of the same instruments and arrangement at the default music/master levels. The companion JSON records peak and RMS levels. The preview is evidence of the rendered signal, not a claim of live listening or a recording from the running game.
