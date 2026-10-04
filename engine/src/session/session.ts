/** The launcher passes ?session=; in dev an id is made once and kept across reloads. */
export function sessionId(): string {
  const fromUrl = new URLSearchParams(location.search).get('session');
  if (fromUrl && /^[\w-]+$/.test(fromUrl)) return fromUrl;
  const kept = sessionStorage.getItem('dj-vj-session');
  if (kept) return kept;
  const id = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
  sessionStorage.setItem('dj-vj-session', id);
  return id;
}
