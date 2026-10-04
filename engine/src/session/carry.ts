/**
 * What survives a page reload within a session (a lost GPU context), kept in sessionStorage:
 * design §7's "never back up within a session" for the render scale and scenes disabled for the session.
 */
export interface Carry {
  scale: number;
  disabled: string[];
}

const KEY = 'dj-vj-carry';

export function loadCarry(store: Pick<Storage, 'getItem'>): Carry {
  return { scale: 1, disabled: [], ...JSON.parse(store.getItem(KEY) ?? '{}') };
}

export function saveCarry(store: Pick<Storage, 'setItem'>, c: Carry): void {
  store.setItem(KEY, JSON.stringify(c));
}
