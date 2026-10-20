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

// Voice practice is offered after one timed round with most questions answered (owner direction 2026-10-20). It is a suggestion made by code, not a score:
// it never reads an AI number. Kept on this device only, like the timed marker.
export const VOICE_UNLOCK_SHARE = 0.8; // 4 of 5; a shorter round (3 to 5 questions can come back) scales and rounds up
const VOICE_KEY = (userId) => `careerai_mock_voice:${userId || 'guest'}`;

export function loadVoiceUnlocked(userId) {
  try { return !!localStorage.getItem(VOICE_KEY(userId)); } catch { return false; }
}
export function markVoiceUnlocked(userId) {
  try { localStorage.setItem(VOICE_KEY(userId), String(Date.now())); } catch { /* storage blocked: voice just stays locked */ }
}
export function earnedVoice(input) {
  const { challenge, answered, total } = input && typeof input === 'object' ? input : {};
  if (challenge !== 'timed') return false;
  if (!Number.isInteger(answered) || !Number.isInteger(total) || total < 1 || answered < 0) return false;
  return answered >= Math.ceil(total * VOICE_UNLOCK_SHARE);
}

// -> { id: 'timed' | 'again_timed' | 'again_untimed', challenge: 'timed' | 'untimed' }
export function nextStep({ challenge, answered = 0, skipped = 0 }) {
  const total = answered + skipped;
  const mostSkipped = total > 0 && skipped * 2 >= total;
  if (mostSkipped || answered === 0) return { id: 'again_untimed', challenge: 'untimed' };
  if (challenge === 'timed') return { id: 'again_timed', challenge: 'timed' };
  return { id: 'timed', challenge: 'timed' };
}
