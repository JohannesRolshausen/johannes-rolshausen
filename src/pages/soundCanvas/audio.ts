// Synth engine for the Sound Canvas.
// Every voice is built from plain Web Audio nodes, so the same code runs live
// (AudioContext) and offline for the WAV export (OfflineAudioContext).

export type SoundType =
  | 'kick'
  | 'snare'
  | 'clap'
  | 'hihat'
  | 'bass'
  | 'lead'
  | 'chime'
  | 'pad'
  | 'rest';

export type SoundDef = {
  sound: SoundType;
  label: string;
  // MIDI note for melodic voices, null for drums and the rest block
  baseMidi: number | null;
};

export const SOUND_LIBRARY: SoundDef[] = [
  { sound: 'kick', label: 'Kick', baseMidi: null },
  { sound: 'snare', label: 'Snare', baseMidi: null },
  { sound: 'clap', label: 'Clap', baseMidi: null },
  { sound: 'hihat', label: 'HiHat', baseMidi: null },
  { sound: 'bass', label: 'Bass', baseMidi: 40 },
  { sound: 'lead', label: 'Lead', baseMidi: 64 },
  { sound: 'chime', label: 'Chime', baseMidi: 76 },
  { sound: 'pad', label: 'Pad', baseMidi: 52 },
  { sound: 'rest', label: 'Rest', baseMidi: null },
];

export const SOUND_DEFS = new Map(SOUND_LIBRARY.map((def) => [def.sound, def]));

export const SOUND_TYPES = SOUND_LIBRARY.map((def) => def.sound);

// E minor pentatonic offsets: melodic blocks step through these, so every
// pitch change stays in key.
const PENTATONIC = [-12, -9, -7, -5, -2, 0, 3, 5, 7, 10, 12];
const PITCH_LIMIT = 12;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function isMelodic(sound: SoundType) {
  return SOUND_DEFS.get(sound)?.baseMidi != null;
}

export function stepPitch(sound: SoundType, pitch: number, direction: 1 | -1) {
  if (sound === 'rest') return 0;
  if (!isMelodic(sound)) {
    return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch + direction));
  }
  if (direction > 0) {
    return PENTATONIC.find((value) => value > pitch) ?? PENTATONIC[PENTATONIC.length - 1];
  }
  return [...PENTATONIC].reverse().find((value) => value < pitch) ?? PENTATONIC[0];
}

export function clampPitch(sound: SoundType, pitch: number) {
  if (sound === 'rest' || !Number.isFinite(pitch)) return 0;
  return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, Math.round(pitch)));
}

export function pitchLabel(sound: SoundType, pitch: number) {
  const base = SOUND_DEFS.get(sound)?.baseMidi;
  if (base == null) {
    if (pitch === 0) return '±0';
    return pitch > 0 ? `+${pitch}` : `−${Math.abs(pitch)}`;
  }
  const midi = base + pitch;
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

// Step length: one eighth note at the given tempo
export function stepSeconds(bpm: number) {
  return 60 / bpm / 2;
}

const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export type Bus = {
  dry: AudioNode;
  fx: AudioNode;
};

export type MasterChain = Bus & {
  output: GainNode;
  setTempo: (bpm: number) => void;
};

// Master: voices → (dry + echo) → compressor → output gain → limiter → speakers
export function createMaster(ctx: BaseAudioContext, bpm: number): MasterChain {
  const dry = ctx.createGain();
  const fx = ctx.createGain();
  const delay = ctx.createDelay(2);
  const feedback = ctx.createGain();
  const tone = ctx.createBiquadFilter();
  const comp = ctx.createDynamicsCompressor();
  const output = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();

  dry.gain.value = 0.85;
  fx.gain.value = 1;
  feedback.gain.value = 0.32;
  tone.type = 'lowpass';
  tone.frequency.value = 2400;

  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  output.gain.value = 0.9;
  // fast, hard knee: catches the peaks of many voices hitting at once
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;

  fx.connect(delay);
  delay.connect(tone);
  tone.connect(feedback);
  feedback.connect(delay);
  tone.connect(comp);
  dry.connect(comp);
  comp.connect(output);
  output.connect(limiter);
  limiter.connect(ctx.destination);

  const setTempo = (nextBpm: number) => {
    // dotted eighth echo, locked to the tempo
    delay.delayTime.setValueAtTime(stepSeconds(nextBpm) * 1.5, ctx.currentTime);
  };
  setTempo(bpm);

  return { dry, fx, output, setTempo };
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext) {
  let buffer = noiseCache.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    noiseCache.set(ctx, buffer);
  }
  return buffer;
}

function noiseSource(ctx: BaseAudioContext) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  return source;
}

function envelope(param: AudioParam, at: number, peak: number, attack: number, decay: number) {
  param.setValueAtTime(0.0001, at);
  param.exponentialRampToValueAtTime(peak, at + attack);
  param.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}

function sendToFx(ctx: BaseAudioContext, from: AudioNode, bus: Bus, amount: number) {
  const send = ctx.createGain();
  send.gain.value = amount;
  from.connect(send);
  send.connect(bus.fx);
}

export function playVoice(
  ctx: BaseAudioContext,
  bus: Bus,
  sound: SoundType,
  at: number,
  pitch: number,
  stepDur: number,
) {
  if (sound === 'rest') return;

  const ratio = 2 ** (pitch / 12);
  const nyquist = ctx.sampleRate / 2 - 100;
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(bus.dry);

  if (sound === 'kick') {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150 * ratio, at);
    osc.frequency.exponentialRampToValueAtTime(42 * ratio, at + 0.12);
    envelope(out.gain, at, 1, 0.004, 0.42);
    osc.connect(out);
    osc.start(at);
    osc.stop(at + 0.5);
    return;
  }

  if (sound === 'snare') {
    const noise = noiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = Math.min(nyquist, 1500 * ratio);
    const noiseGain = ctx.createGain();
    envelope(noiseGain.gain, at, 0.7, 0.002, 0.18);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(out);

    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(190 * ratio, at);
    body.frequency.exponentialRampToValueAtTime(140 * ratio, at + 0.08);
    const bodyGain = ctx.createGain();
    envelope(bodyGain.gain, at, 0.5, 0.002, 0.09);
    body.connect(bodyGain);
    bodyGain.connect(out);

    out.gain.value = 1;
    noise.start(at, Math.random() * 0.5);
    noise.stop(at + 0.24);
    body.start(at);
    body.stop(at + 0.14);
    return;
  }

  if (sound === 'clap') {
    const noise = noiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = Math.min(nyquist, 1200 * ratio);
    filter.Q.value = 1.1;
    noise.connect(filter);
    filter.connect(out);

    // three quick bursts and a short tail make the clap
    for (const offset of [0, 0.012, 0.024]) {
      out.gain.setValueAtTime(1.5, at + offset);
      out.gain.exponentialRampToValueAtTime(0.1, at + offset + 0.011);
    }
    out.gain.setValueAtTime(1.2, at + 0.036);
    out.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
    noise.start(at, Math.random() * 0.5);
    noise.stop(at + 0.27);
    return;
  }

  if (sound === 'hihat') {
    const noise = noiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = Math.min(nyquist, 7000 * ratio);
    envelope(out.gain, at, 0.48, 0.001, 0.06);
    noise.connect(filter);
    filter.connect(out);
    noise.start(at, Math.random() * 0.5);
    noise.stop(at + 0.09);
    return;
  }

  const def = SOUND_DEFS.get(sound);
  const freq = midiToHz((def?.baseMidi ?? 60) + pitch);

  if (sound === 'bass') {
    const saw = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    saw.type = 'sawtooth';
    sub.type = 'square';
    saw.frequency.value = freq;
    sub.frequency.value = freq / 2;
    subGain.gain.value = 0.45;
    filter.type = 'lowpass';
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(1400, at);
    filter.frequency.exponentialRampToValueAtTime(180, at + 0.25);
    const length = Math.min(0.6, Math.max(0.22, stepDur * 1.6));
    envelope(out.gain, at, 0.5, 0.006, length);
    saw.connect(filter);
    sub.connect(subGain);
    subGain.connect(filter);
    filter.connect(out);
    saw.start(at);
    sub.start(at);
    saw.stop(at + length + 0.05);
    sub.stop(at + length + 0.05);
    return;
  }

  if (sound === 'lead') {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(2800, at);
    filter.frequency.exponentialRampToValueAtTime(900, at + 0.3);
    const length = Math.min(0.8, Math.max(0.25, stepDur * 1.8));
    for (const cents of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = cents;
      osc.connect(filter);
      osc.start(at);
      osc.stop(at + length + 0.05);
    }
    envelope(out.gain, at, 0.22, 0.01, length);
    filter.connect(out);
    sendToFx(ctx, out, bus, 0.35);
    return;
  }

  if (sound === 'chime') {
    // two-operator FM bell
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modDepth = ctx.createGain();
    carrier.type = 'sine';
    modulator.type = 'sine';
    carrier.frequency.value = freq;
    modulator.frequency.value = freq * 3.5;
    modDepth.gain.setValueAtTime(freq * 2, at);
    modDepth.gain.exponentialRampToValueAtTime(freq * 0.05, at + 0.8);
    modulator.connect(modDepth);
    modDepth.connect(carrier.frequency);
    carrier.connect(out);
    envelope(out.gain, at, 0.28, 0.003, 1.4);
    sendToFx(ctx, out, bus, 0.5);
    carrier.start(at);
    modulator.start(at);
    carrier.stop(at + 1.45);
    modulator.stop(at + 1.45);
    return;
  }

  // pad: detuned minor chord
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1100;
  filter.Q.value = 0.7;
  const hold = Math.min(1.6, Math.max(0.3, stepDur * 1.8));
  const end = at + 0.08 + hold + 0.5;
  for (const interval of [0, 3, 7]) {
    for (const cents of [-8, 8]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq * 2 ** (interval / 12);
      osc.detune.value = cents;
      osc.connect(filter);
      osc.start(at);
      osc.stop(end + 0.05);
    }
  }
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(0.1, at + 0.08);
  out.gain.setValueAtTime(0.1, at + 0.08 + hold);
  out.gain.exponentialRampToValueAtTime(0.0001, end);
  filter.connect(out);
  sendToFx(ctx, out, bus, 0.4);
}

// 16-bit PCM WAV encoder
export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const dataSize = frames * channels * bytesPerSample;
  const view = new DataView(new ArrayBuffer(44 + dataSize));

  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < frames; i += 1) {
    for (let c = 0; c < channels; c += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}
