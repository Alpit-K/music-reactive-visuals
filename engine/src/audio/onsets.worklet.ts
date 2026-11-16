import { OnsetFrontEnd } from '../analysis/onsets';

// The onset front end on the audio thread (2026-11-16): it sees every sample, where the page sees the last 46 ms
// once per drawn frame. Posts each hop's band rises and levels with the context time of its newest sample; the beat
// tracker runs on the page (audio/ears.ts), so a slow tempo estimate can never hold up the audio thread.
declare const sampleRate: number;
declare const currentTime: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

class Onsets extends AudioWorkletProcessor {
  private front = new OnsetFrontEnd(sampleRate);
  private mono = new Float32Array(128);

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const n = input[0].length;
    if (this.mono.length !== n) this.mono = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (const ch of input) s += ch[i];
      this.mono[i] = s / input.length;
    }
    // A hop ends on a block's last sample (the hop is a whole number of blocks), so its time is the block's end.
    this.front.push(this.mono, () => this.port.postMessage({ t: currentTime + n / sampleRate, flux: Array.from(this.front.flux), level: Array.from(this.front.level) }));
    return true;
  }
}
registerProcessor('onsets', Onsets);
