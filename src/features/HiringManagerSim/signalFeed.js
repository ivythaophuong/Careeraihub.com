// The "Signal feed" of the Delivery rail: the events the rhythm measurement already found, as a short list with the time each started (counted from the first sound).
// Nothing here is guessed: every row comes from a measured stretch. Newest first. While recording only what has happened so far is listed.
export const mmss = (sec) => { const t = Math.max(0, Math.floor(sec)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

export function signalFeed(rhythm, { live = false } = {}) {
  if (!rhythm || rhythm.state !== 'ok' || !Array.isArray(rhythm.segments)) return [];
  const rows = [{ t: 0, rank: 0, at: mmss(0), what: 'Speaking started', note: '' }];
  let longest = null;
  for (const g of rhythm.segments) {
    const start = typeof g.startSec === 'number' ? g.startSec : 0;
    if (g.type === 'pause' && g.long) rows.push({ t: start, rank: 1, at: mmss(start), what: 'Pause', note: `${g.sec.toFixed(1)} s` });
    if (g.type === 'speech' && (!longest || g.sec > longest.sec)) longest = { sec: g.sec, start };
  }
  if (!live) {
    if (longest) rows.push({ t: longest.start, rank: 2, at: mmss(longest.start), what: 'Longest speaking run', note: `${longest.sec.toFixed(1)} s` });
    rows.push({ t: rhythm.totalSec, rank: 3, at: mmss(rhythm.totalSec), what: 'Speaking ended', note: `${rhythm.totalSec.toFixed(1)} s` });
  }
  return rows.sort((a, b) => b.t - a.t || b.rank - a.rank).map(({ at, what, note }) => ({ at, what, note }));
}
