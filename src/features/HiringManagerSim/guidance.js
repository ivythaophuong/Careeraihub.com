// Guided practice: which step to suggest after a finished round. Design: docs/architecture/plans/DESIGN-mock-interview-progression.md.
// The suggestion uses only what the person did (the challenge they chose, how many questions they answered or skipped). It never reads an AI
// score, never locks anything, and the person can always pick another path.
export const TIMED_SECONDS = 180; // 3 minutes per question: a soft limit, the owner's starting value (P4)

const TIMED_KEY = (userId) => `careerai_mock_timed:${userId || 'guest'}`;

// Kept on this device only: progress is derived, not stored on the server.
export function loadTimedTried(userId) {
  try { return !!localStorage.getItem(TIMED_KEY(userId)); } catch { return false; }
}
export function markTimedTried(userId) {
  try { localStorage.setItem(TIMED_KEY(userId), String(Date.now())); } catch { /* storage blocked: the suggestion just stays the same */ }
}

// -> { id: 'timed' | 'again_timed' | 'again_untimed', challenge: 'timed' | 'untimed' }
export function nextStep({ challenge, answered = 0, skipped = 0 }) {
  const total = answered + skipped;
  const mostSkipped = total > 0 && skipped * 2 >= total;
  if (mostSkipped || answered === 0) return { id: 'again_untimed', challenge: 'untimed' };
  if (challenge === 'timed') return { id: 'again_timed', challenge: 'timed' };
  return { id: 'timed', challenge: 'timed' };
}
