// Web Audio API synthesizer for Windows 10 UI feedback sounds

class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;
  public volume = 0.7;
  public muted = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainVal = 0.12,
    delay = 0,
    freqEnd?: number
  ) {
    if (!this.enabled || this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (freqEnd) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
      }

      const scaledGain = gainVal * this.volume;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(scaledGain, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      // Ignore audio errors prior to user interaction
    }
  }

  playStartup() {
    // Warm Fluent major-9th startup chord
    this.playTone(261.63, 0.7, 'sine', 0.1, 0);
    this.playTone(329.63, 0.75, 'sine', 0.09, 0.08);
    this.playTone(392.0, 0.8, 'sine', 0.09, 0.16);
    this.playTone(493.88, 0.9, 'sine', 0.08, 0.24);
    this.playTone(587.33, 1.1, 'triangle', 0.06, 0.34);
  }

  playClick() {
    this.playTone(720, 0.045, 'sine', 0.05, 0, 520);
  }

  playNotification() {
    // Classic crisp Windows 10 two-note chime
    this.playTone(587.33, 0.18, 'sine', 0.1, 0);
    this.playTone(880.0, 0.32, 'sine', 0.1, 0.11);
  }

  playError() {
    // Windows 10 Foreground/Critical Stop low double thud
    this.playTone(190, 0.14, 'triangle', 0.16, 0, 140);
    this.playTone(150, 0.2, 'triangle', 0.14, 0.1, 110);
  }

  playSuccess() {
    this.playTone(523.25, 0.12, 'sine', 0.08, 0);
    this.playTone(659.25, 0.14, 'sine', 0.08, 0.08);
    this.playTone(783.99, 0.22, 'sine', 0.09, 0.16);
  }

  playAlarm() {
    for (let i = 0; i < 3; i++) {
      this.playTone(880, 0.12, 'sine', 0.14, i * 0.22);
      this.playTone(1046.5, 0.12, 'sine', 0.14, i * 0.22 + 0.1);
    }
  }
}

export const soundEngine = new SoundEngine();

// Generate a playable ambient WAV data URL for the built-in Music folder
export function createSampleWavDataUrl(): string {
  const sampleRate = 22050;
  const duration = 6; // 6 seconds gentle ambient chord progression
  const numSamples = sampleRate * duration;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const chords = [
    [261.63, 329.63, 392.0, 493.88], // Cmaj7
    [220.0, 261.63, 329.63, 392.0],  // Am7
    [174.61, 220.0, 261.63, 349.23], // Fmaj7
    [196.0, 246.94, 293.66, 392.0],  // G6
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const chordIdx = Math.min(3, Math.floor((t / duration) * 4));
    const chord = chords[chordIdx];
    const localT = (t % (duration / 4)) / (duration / 4);
    const env = Math.sin(Math.PI * localT) * 0.8 + 0.2;
    const masterEnv = Math.min(1, t * 3) * Math.min(1, (duration - t) * 2);
    let sample = 0;
    for (let c = 0; c < chord.length; c++) {
      sample += Math.sin(2 * Math.PI * chord[c] * t) * 0.16;
    }
    const val = Math.max(-1, Math.min(1, sample * env * masterEnv));
    view.setInt16(44 + i * 2, val * 32767, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}
