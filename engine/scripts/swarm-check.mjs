// Headless check of every scene on the curation page (2026-11-12): frame times, how much of the screen each lights,
// and whether its corners stay lit. Needs the Vite dev server (`cd engine && npm run dev`) and a kick track:
//   ffmpeg -f lavfi -i "aevalsrc='0.8*sin(2*PI*50*mod(t,0.46875))*exp(-mod(t,0.46875)/0.08)':s=44100:d=600" kick.wav
//   node scripts/swarm-check.mjs --audio kick.wav [--only <text>] [--secs 3] [--samples 6] [--shots <dir>] [--query '&pair=a,b']
// One line per scene: id, frame p95 and max (ms), fewest of the 8 × 6 tiles lit in any shot, fewest corners lit.
// Headless Chrome draws on the real GPU (ANGLE Metal), so frame times are representative (docs/spike-findings.md §6).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const audio = resolve(arg('audio', ''));
const only = arg('only', '');
const secs = Number(arg('secs', '3'));
const query = arg('query', '');
const uncapped = process.argv.includes('--uncapped'); // no vsync or frame cap: frame times then show GPU load, not 60 fps held
const shots = arg('shots', ''); // a folder: a full-size screenshot per scene, plus each coverage shot, for eyeballing
const samples = Number(arg('samples', '6')); // coverage shots per scene, spread over --secs
const port = 9333;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'swarm-check-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1920,1080',
  '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', ...(uncapped ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []), 'about:blank'], { stdio: 'ignore' });
// Chrome may still be writing its profile as it dies: retry, and never fail the check over a temp folder.
process.on('exit', () => { chrome.kill('SIGKILL'); try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {} });

let page;
for (let i = 0; i < 50 && !page; i++) {
  await sleep(200);
  try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {}
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const waiting = new Map();
const errors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
});
const send = (method, params = {}) => new Promise((r) => { const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.result.value;

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://localhost:5173/curate.html?selected=1${only ? `&only=${encodeURIComponent(only)}` : ''}${query}` });
await sleep(3000);
const doc = await send('DOM.getDocument');
const input = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#file' });
await send('DOM.setFileInputFiles', { nodeId: input.result.nodeId, files: [audio] });
await sleep(8000); // the beat clock locks on

const lit = async (name) => {
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 0.25 } });
  if (shots && name) writeFileSync(join(shots, name), Buffer.from(shot.result.data, 'base64'));
  const ff = spawn('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);
  ff.stdin.end(Buffer.from(shot.result.data, 'base64'));
  const chunks = [];
  for await (const c of ff.stdout) chunks.push(c);
  const px = Buffer.concat(chunks);
  const W = 480, H = 270, tiles = new Array(48).fill(false);
  let sx = 0, sw = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 3;
    const l = (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255;
    if (l > 0.02) tiles[Math.floor((y / H) * 6) * 8 + Math.floor((x / W) * 8)] = true;
    sx += l * x; sw += l;
  }
  // centre: where the light sits across the screen, 0 left .. 1 right — it moves as a form grooves.
  return { count: tiles.filter(Boolean).length, corners: [0, 7, 40, 47].filter((i) => tiles[i]).length, centre: sw ? sx / sw / W : 0.5 };
};

const total = Number((await evaluate(`document.getElementById('hud').textContent`) ?? '').match(/\/(\d+)/)?.[1] ?? 1);
await evaluate(`document.getElementById('hud').style.visibility = 'hidden'`);
for (let n = 0; n < (query.includes('pair=') ? 1 : total); n++) {
  let name = '';
  for (let w = 0; w < 50 && !name.startsWith(`${n + 1}/`) && !query.includes('pair='); w++) {
    name = (await evaluate(`document.getElementById('hud').textContent`)).split('\n')[0];
    await sleep(50);
  }
  if (query.includes('pair=')) name = query;
  await sleep(1500); // past the 0.5 s change between scenes
  const times = evaluate(`new Promise((r) => { const d = []; let last = performance.now(); const end = last + ${secs * 1000};
    const f = (now) => { d.push(now - last); last = now; now < end ? requestAnimationFrame(f) : r(d); }; requestAnimationFrame(f); })`);
  if (shots) writeFileSync(join(shots, `${n + 1}.jpg`), Buffer.from((await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 })).result.data, 'base64'));
  let count = 48, corners = 4, lo = 1, hi = 0;
  for (let k = 0; k < samples; k++) {
    const l = await lit(`${n + 1}-${k}.png`);
    count = Math.min(count, l.count); corners = Math.min(corners, l.corners); lo = Math.min(lo, l.centre); hi = Math.max(hi, l.centre);
    await sleep((secs * 1000) / (samples + 1));
  }
  const d = (await times).slice(1).sort((a, b) => a - b);
  // Scene errors (a shader that fails to compile) are listed under the HUD's key line, not logged to the console.
  const hud = (await evaluate(`document.getElementById('hud').textContent`)).split('\n');
  errors.push(...hud.slice(hud.findIndex((l) => l.startsWith('c copy changes')) + 1).filter(Boolean));
  const p95 = d[Math.floor(d.length * 0.95)], p99 = d[Math.floor(d.length * 0.99)], max = d[d.length - 1];
  console.log(`${name.padEnd(70)} p95 ${p95.toFixed(1).padStart(5)}  p99 ${p99.toFixed(1).padStart(5)}  max ${max.toFixed(1).padStart(6)}  tiles ${String(count).padStart(2)}/48  corners ${corners}/4  sway ${(hi - lo).toFixed(2)}${errors.length ? `  ERR ${errors.splice(0).join(' | ')}` : ''}`);
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))`);
}
ws.close();
process.exit(0);
