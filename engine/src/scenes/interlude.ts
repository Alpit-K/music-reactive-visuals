import { ENABLED_PRESETS } from './psychedelic/presets';

// The ambient interlude pool (design §6): picked by the user on the curation page against an ambient mix,
// 2026-10-03 — slow visuals that fill the screen. Scene ids as the registry and the Butterchurn wrapper give them.
export const INTERLUDE_SCENES: string[] = [
  'organic-curves',
  'organic-flow',
  'bc:Aderrasi + Geiss - Airhandler (Kali Mix) - Canvas Mix',
  'bc:Flexi + stahlregen - jelly showoff parade',
  'bc:Flexi - alien fish pond',
  'bc:Flexi - area 51',
  'bc:Flexi - truly soft piece of software - this is generic texturing (Jelly) ', // trailing space is in the name
  'bc:Geiss - Cauldron - painterly 2 (saturation remix)',
  'bc:Rovastar - Oozing Resistance',
  'bc:_Mig_085',
  'bc:cope + martin - mother-of-pearl',
  'bc:martin - castle in the air', // not curated for rotation; flash limiter held it 0% on ambient audio
  'bc:martin - chain breaker',
  'bc:martin - stormy sea (2010 update)',
];

const isPreset = (id: string) => id.startsWith('bc:');

/** 'also' when the scene shows in its family's rotation too, 'only' when it shows in interludes alone. */
export function interludeRole(id: string): 'also' | 'only' | undefined {
  if (!INTERLUDE_SCENES.includes(id)) return undefined;
  return isPreset(id) && !ENABLED_PRESETS.includes(id.slice(3)) ? 'only' : 'also';
}

/** Presets the wall loads: the curated rotation plus interlude-only ones. */
export const WALL_PRESETS: string[] = [
  ...ENABLED_PRESETS,
  ...INTERLUDE_SCENES.filter((id) => interludeRole(id) === 'only').map((id) => id.slice(3)),
];
