// What reaches the account backup for a finished mock session (E1a): scores and labels, none of the text.
import { describe, it, expect } from 'vitest';
import { toBackup } from './useMemory';
import { buildSessionRecord, summarize } from '../features/HiringManagerSim/interview';

describe('toBackup with a new mock session', () => {
  it('holds no question, answer or tip text from the session', () => {
    const results = [{ question: 'How did you handle the Zebra outage at Acme?', focus: 'Incident', answer: 'I paged Dana Ortiz and rolled back the Zebra release.', score: 65, verdict: 'Acceptable', tip: 'Name the Zebra rollback criteria.' }];
    const rec = buildSessionRecord({ personaId: 'startup', role: 'PM', results, summary: summarize(results) });
    const payload = JSON.stringify(toBackup({ mockSessions: [rec], profile: {} }));
    for (const w of ['Zebra', 'Acme', 'Dana Ortiz', 'rollback']) expect(payload).not.toContain(w);
    expect(JSON.parse(payload).mockSessions[0]).toMatchObject({ avgScore: 65, questionsCount: 1 });
  });
});
