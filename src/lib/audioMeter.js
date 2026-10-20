// Live sound level for the voice recorder. The microphone stream is read in the browser to draw the waveform and to notice a recording with no sound
// before it is sent anywhere. Nothing here stores, uploads or keeps audio; the numbers are levels, not sound.
export const SILENT_PEAK = 0.02; // PROPOSED starting value (RMS, 0 to 1): quieter than this for the whole recording is treated as "no sound". Not yet tuned on real microphones.

// Time-domain bytes are centred on 128. RMS of the samples, 0 (silence) to 1 (full scale).
export function levelOf(bytes) {
  if (!bytes || !bytes.length) return 0;
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) { const v = (bytes[i] - 128) / 128; sum += v * v; }
  return Math.min(1, Math.sqrt(sum / bytes.length));
}

// `count` bars, each the level of its slice of the samples.
export function barsOf(bytes, count) {
  const out = new Array(count).fill(0);
  if (!bytes || !bytes.length) return out;
  const size = bytes.length / count;
  for (let i = 0; i < count; i++) {
    const slice = bytes.slice(Math.floor(i * size), Math.max(Math.floor(i * size) + 1, Math.floor((i + 1) * size)));
    out[i] = levelOf(slice);
  }
  return out;
}

// The waveform history: the loudest level of each group of `perColumn` frames, at most `count` columns. Odd values count as silence.
export function columnsOf(levels, perColumn, count) {
  if (!Array.isArray(levels) || !(perColumn > 0) || !(count > 0)) return [];
  const n = Math.min(count, Math.ceil(levels.length / perColumn));
  const out = [];
  for (let c = 0; c < n; c++) {
    let m = 0;
    for (let i = c * perColumn; i < Math.min(levels.length, (c + 1) * perColumn); i++) {
      const v = levels[i];
      if (typeof v === 'number' && Number.isFinite(v) && v > m) m = Math.min(1, v);
    }
    out.push(m);
  }
  return out;
}

// True only for a known peak below the threshold: a missing or broken measurement never blocks a recording.
export const isSilent = (peak) => typeof peak === 'number' && Number.isFinite(peak) && peak < SILENT_PEAK;

// Returns { analyser, sample(), peak(), close() } or null when Web Audio is unavailable or fails.
export function createAudioMeter(stream, Ctx = globalThis.AudioContext || globalThis.webkitAudioContext) {
  if (!Ctx || !stream) return null;
  try {
    const ctx = new Ctx();
    ctx.resume?.();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let peak = 0;
    return {
      analyser,
      sample() { analyser.getByteTimeDomainData(buf); const l = levelOf(buf); if (l > peak) peak = l; return l; },
      peak: () => peak,
      close() { try { source.disconnect(); } catch { /* already gone */ } try { Promise.resolve(ctx.close?.()).catch(() => {}); } catch { /* ignore */ } },
    };
  } catch { return null; }
}
