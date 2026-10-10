import type { Features } from './scenes/types';

/** Tuning overlay text (design §5): off by default, toggled with d; not a performance control. */
export function overlayText(f: Features, scene: string | null, scale: number, damped: boolean): string {
  const bar = (x: number) => '█'.repeat(Math.round(x * 20)).padEnd(20, '·');
  return [
    `sub   ${bar(f.sub)}   bass ${bar(f.bass)}`,
    `mids  ${bar(f.mids)}   highs ${bar(f.highs)}`,
    `kick  ${f.kick ? '●' : '○'}  bpm ${f.bpm?.toFixed(1) ?? '—'}  bar ${f.bar}  phase ${f.beatPhase.toFixed(2)}`,
    `sub-dominance ${f.subDominanceDb?.toFixed(2) ?? '—'} dB  tempo ${f.tempoBpm?.toFixed(1) ?? '—'}  character ${f.character}${f.breakdown ? '  BREAKDOWN' : ''}${f.surge ? '  SURGE' : ''}${f.idle ? '  IDLE' : ''}${f.interlude ? '  INTERLUDE' : ''}`,
    `rms ${f.rmsDb.toFixed(1)} dBFS  busyness ${f.busyness?.toFixed(2) ?? '—'}  scene ${scene ?? '—'}  scale ${scale}${damped ? '  FLASH-DAMPED' : ''}`,
  ].join('\n');
}
