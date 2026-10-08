import { describe, it, expect } from 'vitest';
import { scoreResume, SCORE_TYPE, SCORE_VERSION, WEIGHTS } from './resumeScore';
import { validateScoreResult } from '../contracts/scoreResult';
import { extractResumeFacts } from '../extraction/resumeFacts';
import { validateFacts } from '../validation/validateFacts';

const run = (text) => {
  const facts = extractResumeFacts(text);
  return scoreResume(facts, validateFacts(facts));
};

describe('scoreResume: weights and shape', () => {
  it('declares the three weights explicitly and they sum to 1', () => {
    expect(WEIGHTS).toEqual({ completeness: 0.4, measurable_impact: 0.3, chronology_health: 0.3 });
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(1);
  });

  it('every result matches the P0 ScoreResult contract', () => {
    for (const text of ['', 'Jane Example', 'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%']) {
      const r = run(text);
      expect(validateScoreResult(r)).toMatchObject({ ok: true });
      expect(r.score_type).toBe(SCORE_TYPE);
      expect(r.version).toBe(SCORE_VERSION);
    }
  });
});

describe('scoreResume: an unreadable document (extraction.status "failed") scores null, never 0', () => {
  it('empty input never reaches scoring at all: every part null, headline score null', () => {
    const r = run('');
    expect(extractResumeFacts('').extraction.status).toBe('failed'); // sanity: this really is the failed path
    expect(r.score).toBeNull();
    expect(r.missing).toEqual(['completeness', 'measurable_impact', 'chronology_health']);
    for (const p of r.parts) {
      expect(p.score).toBeNull();
      expect(p.evidence[0]).toMatch(/could not be read/);
    }
  });
});

describe('scoreResume: completeness, always present once a document WAS actually read', () => {
  it('0 of 4 signals on content that was read but matches none of them is a real, computed 0 — never null', () => {
    // Non-empty, so extraction.status is 'ok' (not 'failed'); no name-shaped line, no email, no
    // "Experience"/"Education" heading, no skills list — a real, read document with nothing recognised.
    const facts = extractResumeFacts('12345');
    expect(facts.extraction.status).toBe('ok');
    const r = scoreResume(facts, validateFacts(facts));
    const c = r.parts.find(p => p.id === 'completeness');
    expect(c.score).toBe(0);
    expect(c.required).toBe(true);
    expect(c.evidence.length).toBe(4);
    expect(r.score).not.toBeNull(); // read successfully, just bare — unlike the failed-extraction case above
  });
  it('scores higher as more signals are present', () => {
    const r = run('Jane Example\njane@example.com\n\nSkills\nSQL');
    expect(r.parts.find(p => p.id === 'completeness').score).toBe(75); // name, email, skills; no experience/education
  });
});

describe('scoreResume: measurable_impact', () => {
  it('is null (not 0), listed in missing, when there are no bullets at all', () => {
    const r = run('Jane Example\njane@example.com');
    const m = r.parts.find(p => p.id === 'measurable_impact');
    expect(m.score).toBeNull();
    expect(m.evidence).toEqual([]);
    expect(r.missing).toContain('measurable_impact');
  });
  it('a real 0% (bullets exist, none quantified) is kept as 0, with evidence of what was counted', () => {
    const r = run('Jane Example\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Helped the team\n• Worked on projects');
    const m = r.parts.find(p => p.id === 'measurable_impact');
    expect(m.score).toBe(0);
    expect(m.evidence[0]).toMatch(/0 of 2/);
    expect(r.missing).not.toContain('measurable_impact');
  });
  it('counts the share of bullets with a metric, not the raw metric count (a bullet with 2 numbers counts once)', () => {
    const r = run('Jane Example\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue 20% to $1.2M\n• Helped the team\n• Mentored 3 engineers\n• Wrote documentation');
    const m = r.parts.find(p => p.id === 'measurable_impact');
    expect(m.score).toBe(50); // 2 of 4 bullets have a number, regardless of the first having two
  });
});

describe('scoreResume: chronology_health', () => {
  it('is null when nothing is checkable (no entry has both a start and an end)', () => {
    const r = run('Jane Example\n\nExperience\nManager\nAcme\n• Did X'); // no date at all -> no entries extracted
    const c = r.parts.find(p => p.id === 'chronology_health');
    expect(c.score).toBeNull();
    expect(r.missing).toContain('chronology_health');
  });
  it('a real internal contradiction (end before start) is penalised', () => {
    const r = run('Jane Example\n\nExperience\nManager\tJan 2024 - Jan 2021\nAcme\n• Did X');
    expect(r.parts.find(p => p.id === 'chronology_health').score).toBe(50);
  });
  it('a clean entry scores 100', () => {
    const r = run('Jane Example\n\nExperience\nManager\tJan 2021 - Jan 2024\nAcme\n• Did X');
    expect(r.parts.find(p => p.id === 'chronology_health').score).toBe(100);
  });
  it('an overlap between two entries is NOT penalised here (P3 treats it as a legitimate warning)', () => {
    const r = run(
      'Jane Example\n\nExperience\n' +
      'Manager\tJan 2020 - Jan 2022\nAcme\n• Did X\n' +
      'Consultant\tJan 2021 - Jan 2023\nBeta\n• Did Y'
    );
    expect(r.parts.find(p => p.id === 'chronology_health').score).toBe(100);
  });
});

describe('scoreResume: reduced coverage, not a guess, when parts are missing', () => {
  it('the final score is a weighted average over only the parts that were computed', () => {
    // A single date (not a range) is enough for extractExperiences to create the entry and its bullet
    // (so measurable_impact is computable), but there is no END date to pair it with (so
    // chronology_health, which needs both ends, stays null): only completeness (0.4) and
    // measurable_impact (0.3) are computed.
    const r = run('Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021\nAcme\n• Grew revenue by 20%');
    const completeness = r.parts.find(p => p.id === 'completeness').score;
    const impact = r.parts.find(p => p.id === 'measurable_impact').score;
    const expected = Math.round((completeness * 0.4 + impact * 0.3) / 0.7);
    expect(r.score).toBe(expected);
    expect(r.missing).toEqual(['chronology_health']);
  });
});

describe('scoreResume: determinism', () => {
  it('the exact same ResumeFacts + validation gives a byte-identical ScoreResult every time, 50 runs', () => {
    const facts = extractResumeFacts('Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%\n• Helped the team');
    const validation = validateFacts(facts);
    const first = JSON.stringify(scoreResume(facts, validation));
    for (let i = 0; i < 50; i++) expect(JSON.stringify(scoreResume(facts, validation))).toBe(first);
  });

  it('does not mutate its inputs', () => {
    const facts = extractResumeFacts('Jane Example\njane@example.com');
    const validation = validateFacts(facts);
    const factsBefore = JSON.stringify(facts);
    const validationBefore = JSON.stringify(validation);
    scoreResume(facts, validation);
    expect(JSON.stringify(facts)).toBe(factsBefore);
    expect(JSON.stringify(validation)).toBe(validationBefore);
  });

  it('tolerates missing or malformed input without throwing', () => {
    expect(() => scoreResume(null, null)).not.toThrow();
    expect(() => scoreResume({}, {})).not.toThrow();
    expect(validateScoreResult(scoreResume(null, null))).toMatchObject({ ok: true });
  });
});
