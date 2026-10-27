import { useEffect, useState } from 'react';
import { MAX_JD_CHARS_KEPT } from './jobTracker';

// Hands one application from the tracker to the module the user opens next (JD Analyzer, Interview Coach,
// Cover Letter, Salary Coach), so they start on that job instead of retyping it.
//
// The tracker writes `memory.activeJob`; the receiving module reads it ONCE when it opens and clears it, so a job
// never lingers and prefills an unrelated visit later. It lives in the memory backup (no new table).
export const HANDOFF_MAX_AGE_MS = 10 * 60 * 1000;

export function buildActiveJob(app, now = Date.now()) {
  return {
    appId: app.id,
    company: app.company || '',
    role: app.role || '',
    jd: (app.jd || '').slice(0, MAX_JD_CHARS_KEPT),
    ts: now,
  };
}

export const isFreshJob = (job, now = Date.now()) =>
  !!job && typeof job === 'object' && Number.isFinite(job.ts) && now - job.ts >= 0 && now - job.ts <= HANDOFF_MAX_AGE_MS;

// Returns the job handed over when the module opened (or null). Safe when `updateMemory` is missing.
export function useActiveJob(memory, updateMemory) {
  const [job] = useState(() => (isFreshJob(memory?.activeJob) ? memory.activeJob : null));
  useEffect(() => {
    if (memory?.activeJob) updateMemory?.({ activeJob: null });
    // once, on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return job;
}

// "Back to my tracker" from another module. Job Search reads the request once when it opens (session only, nothing saved).
const TAB_KEY = 'cah_jobs_tab';
export function requestTrackerTab() {
  try { sessionStorage.setItem(TAB_KEY, 'tracker'); } catch { /* storage blocked: Job Search opens on Search */ }
}
// Read in a state initializer (pure, so a double render cannot lose it) and cleared in an effect.
export function peekRequestedTab() {
  try { return sessionStorage.getItem(TAB_KEY) === 'tracker' ? 'tracker' : null; } catch { return null; }
}
export function clearRequestedTab() {
  try { sessionStorage.removeItem(TAB_KEY); } catch { /* nothing to clear */ }
}

// Small banner text shared by the modules that receive a job.
export const jobLabel = (job) => [job?.company, job?.role].filter(Boolean).join(' · ');
