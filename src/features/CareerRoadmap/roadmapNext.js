// What to do next on the Career Roadmap, from the user's real state only. The first step that is not done decides; each line states a count the
// user can check. No time estimate and no promise: the app has no data that could back either.
export const READINESS_TARGET = 75;
export const STAR_TARGET = 5;
export const PRACTICE_TARGET = 65;

// state: { hasResume, sessionsCount, readiness (latest mock interview average, or null), starCount, hasSkillsGap, trustScore, trustVisible }
export function nextActions(s) {
  const interviewDone = Number.isFinite(s.readiness) && s.readiness >= READINESS_TARGET && s.starCount >= STAR_TARGET;
  const practiceDone = s.trustScore >= PRACTICE_TARGET;

  if (!s.hasResume) {
    return { step: 1, allDone: false, items: [{ text: 'Add your resume. Every other step builds on it.', cta: 'Add resume →', module: 'ats' }] };
  }
  if (!interviewDone) {
    const items = [];
    if (!Number.isFinite(s.readiness) || s.readiness < READINESS_TARGET) {
      items.push({
        text: s.sessionsCount === 0 ? `No mock interview yet. The target is a latest mock interview average of ${READINESS_TARGET}%.`
          : !Number.isFinite(s.readiness) ? `No scored mock interview yet. The target is a latest mock interview average of ${READINESS_TARGET}%.`
          : `Your latest mock interview average is ${s.readiness}% (an AI estimate of your first attempts). The target is ${READINESS_TARGET}%.`,
        cta: 'Practise a mock interview →', module: 'simulate',
      });
    }
    if (s.starCount < STAR_TARGET) {
      items.push({ text: `You have ${s.starCount} of ${STAR_TARGET} STAR stories.`, cta: 'Add STAR stories →', module: 'star' });
    }
    return { step: 2, allDone: false, items };
  }
  if (!s.hasSkillsGap) {
    return { step: 3, allDone: false, items: [{ text: 'Run the skills gap analysis to see where your resume and your target role differ.', cta: 'Analyse skills gap →', module: 'skillsgap' }] };
  }
  // A screen that does not load the practice score passes null: say where to look, never a made-up number.
  if (!Number.isFinite(s.trustScore)) {
    return { step: 4, allDone: false, items: [{ text: 'See your Career Roadmap for your next step.', cta: 'Open Career Roadmap →', module: 'roadmap' }] };
  }
  if (!practiceDone) {
    return { step: 4, allDone: false, items: [{ text: `Your practice score is ${s.trustScore}. The target is ${PRACTICE_TARGET}. It comes from your saved interview sessions, STAR stories and resume scans.`, cta: 'Practise →', module: 'simulate' }] };
  }
  if (!s.trustVisible) {
    return { step: 5, allDone: false, items: [{ text: 'Turn on TrustMatch to make your profile visible to recruiters.', cta: 'Open TrustMatch →', module: 'trustmatch' }] };
  }
  return { step: 5, allDone: true, items: [] };
}
