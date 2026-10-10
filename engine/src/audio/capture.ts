import { CONFIG } from '../config';

type Device = Pick<MediaDeviceInfo, 'kind' | 'label' | 'deviceId'>;

export interface Capture {
  ctx: AudioContext;
  /** Stays the same across a reopen: the analyser listens here, not to the stream. */
  source: GainNode;
  analyser: AnalyserNode;
  track: MediaStreamTrack;
  deviceId: string;
  stream: MediaStreamAudioSourceNode;
}

export function pickBlackHole(devices: Device[]): string {
  const inputs = devices.filter((d) => d.kind === 'audioinput');
  if (inputs.length > 0 && inputs.every((d) => d.label === '')) {
    throw new Error('Device labels are empty: audio permission not granted yet');
  }
  const match = inputs.find((d) => d.label.includes('BlackHole'));
  if (!match) throw new Error(`No BlackHole input. Inputs seen: ${inputs.map((d) => d.label).join(', ')}`);
  return match.deviceId;
}

function openStream(deviceId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: { exact: deviceId },
      // Chrome's voice processing would reshape the music.
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 2,
    },
  });
}

export async function openBlackHole(): Promise<Capture> {
  // Labels are only exposed after a permission grant, so ask once generically first.
  const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
  probe.getTracks().forEach((t) => t.stop());
  const deviceId = pickBlackHole(await navigator.mediaDevices.enumerateDevices());
  const media = await openStream(deviceId);
  const ctx = new AudioContext();
  await ctx.resume();
  const stream = ctx.createMediaStreamSource(media);
  const source = ctx.createGain();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = CONFIG.fftSize;
  analyser.smoothingTimeConstant = 0; // onset detection needs raw frames; thresholds were tuned this way
  stream.connect(source);
  source.connect(analyser); // never to ctx.destination: BlackHole is the default output during a session
  return { ctx, source, analyser, track: media.getAudioTracks()[0], deviceId, stream };
}

/**
 * Swap in a fresh BlackHole stream on the same context. An open stream can go silent with no error —
 * opened at a rate rekordbox then changes, or a PC MASTER OUT toggle (spike-findings §1, §5).
 */
export async function reopenBlackHole(c: Capture): Promise<void> {
  // Stop first: Chrome may share one device stream between tracks, so an overlapping open could inherit the dead one.
  c.track.stop();
  c.stream.disconnect();
  const media = await openStream(c.deviceId);
  c.stream = c.ctx.createMediaStreamSource(media);
  c.stream.connect(c.source);
  c.track = media.getAudioTracks()[0];
}
