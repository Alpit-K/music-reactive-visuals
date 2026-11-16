import { CONFIG } from '../config';
import { BeatTracker, type Heard } from '../analysis/tempo';
import workletUrl from './onsets.worklet.ts?worker&url';

/** What the second hearing reports at a frame: the tracker's state, the beat carried on to now, kicks since the last read. */
export interface EarsReading {
  bpm: number | null;
  beat: number;
  confidence: number;
  kickPresence: number;
  kicks: number;
}

/**
 * The second hearing on the page (design §5): the worklet's hops through the beat tracker, as they arrive — not tied
 * to drawn frames. It listens only: nothing on the wall follows it until a live set has shown it beats the kick
 * detector. `onSecond` gets each second's hops, rounded, for the log — the only way to tune it on a streamed set.
 */
export class Ears {
  private tracker: BeatTracker | null = null;
  private heard: Heard | null = null;
  private heardAt = 0;
  private kicks = 0;
  private second: { t: number; hops: number[] } | null = null;

  constructor(private ctx: AudioContext, private onSecond?: (row: { t: number; hops: number[] }) => void) {}

  async listen(source: AudioNode): Promise<void> {
    await this.ctx.audioWorklet.addModule(workletUrl);
    const node = new AudioWorkletNode(this.ctx, 'onsets', { numberOfInputs: 1, numberOfOutputs: 0 });
    this.tracker = new BeatTracker(this.ctx.sampleRate / CONFIG.ears.hop);
    node.port.onmessage = (e: MessageEvent<{ t: number; flux: number[]; level: number[] }>) => {
      const { t, flux, level } = e.data;
      this.heard = this.tracker!.hop(t, flux, level);
      this.heardAt = t;
      if (this.heard.kick) this.kicks++;
      if (!this.onSecond) return;
      if (this.second && Math.floor(t) !== Math.floor(this.second.t)) {
        this.onSecond(this.second);
        this.second = null;
      }
      this.second ??= { t: +t.toFixed(4), hops: [] };
      // Rises to a tenth of a dB, levels to a dB: enough to replay the tracker, a quarter the size of full floats.
      for (const x of flux) this.second.hops.push(Math.round(x * 10) / 10);
      for (const x of level) this.second.hops.push(Math.round(x));
    };
    source.connect(node);
  }

  read(): EarsReading | null {
    if (!this.heard) return null;
    const h = this.heard;
    const kicks = this.kicks;
    this.kicks = 0;
    const since = Math.max(0, this.ctx.currentTime - this.heardAt);
    return { bpm: h.bpm, beat: h.beat + (h.bpm === null ? 0 : (since * h.bpm) / 60), confidence: h.confidence, kickPresence: h.kickPresence, kicks };
  }
}
