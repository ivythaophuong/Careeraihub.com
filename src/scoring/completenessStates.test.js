// Specification for docs/architecture/plans/DESIGN-completeness-states.md, written BEFORE the change.
// `it.fails` marks a case the current scorer does not meet yet: each one must be turned into a normal `it` when the design is implemented
// (a case that starts passing makes its `it.fails` fail, which forces that flip). Plain `it` cases already hold today and must keep holding.
// Resumes are synthetic.
import { describe, it, expect } from 'vitest';
import { computeDeterministicScore } from './computeDeterministicScore';
import { validateScoreResult } from '../contracts/scoreResult';

const HEAD = 'Jordan Lee\njordan@example.com | +1 555 0100\n\n';
const EXP = 'Experience\nAnalyst, Acme Corp\nJan 2020 – Mar 2023\n• Cut report time by 30%\n\n';
const EDU = 'Education\nBSc Economics, State University, 2016\n\n';
const SKILLS = 'Skills\nSQL, Excel, Python\n';

const run = (text) => computeDeterministicScore(text).score;
const completeness = (text) => run(text).parts.find((p) => p.id === 'completeness');
const signal = (text, id) => completeness(text).signals?.find((s) => s.id === id);

describe('a complete resume', () => {
  it.fails('has four present signals, nothing left unassessed, and scores 100', () => {
    const r = run(HEAD + EXP + EDU + SKILLS);
    expect(completeness(HEAD + EXP + EDU + SKILLS).signals.map((s) => s.state)).toEqual(['present', 'present', 'present', 'present']);
    expect(r.assessment).toMatchObject({ assessed: 4, total: 4, not_assessed: [] });
    expect(r.score).toBe(100);
  });
});

describe('missing: there are grounds to say it is not in the text that was read', () => {
  it.fails('no @ anywhere: email is missing, and the score drops', () => {
    const t = 'Jordan Lee\n+1 555 0100\n\n' + EXP + EDU + SKILLS;
    expect(signal(t, 'email')).toMatchObject({ state: 'missing', reason: null });
    expect(run(t).score).toBeLessThan(100);
  });
  it.fails('no skills heading and nothing shaped like a skills list: skills is missing', () => {
    expect(signal(HEAD + EXP + EDU, 'skills')).toMatchObject({ state: 'missing' });
  });
  it.fails('no work, no education, no dates anywhere: experience or education is missing', () => {
    expect(signal(HEAD + SKILLS, 'experience_or_education')).toMatchObject({ state: 'missing' });
  });
  it.fails('a student with education only does have experience or education', () => {
    expect(signal(HEAD + EDU + 'Skills\nExcel\n', 'experience_or_education')).toMatchObject({ state: 'present' });
  });
});

describe('unknown: the reader could not tell, so it is not called missing and is left out of the average', () => {
  it.fails('skills under an unrecognised heading: unknown, scored on 3 of 4, and the 3-of-4 is stated', () => {
    const t = HEAD + EXP + EDU + 'Toolbox Matters\nSQL, Excel, Python\n';
    expect(signal(t, 'skills')).toMatchObject({ state: 'unknown', reason: 'skills_shaped_list_under_unrecognised_heading' });
    const r = run(t);
    expect(r.parts.find((p) => p.id === 'completeness').score).toBe(100);
    expect(r.assessment).toMatchObject({ assessed: 3, total: 4 });
    expect(r.assessment.not_assessed).toEqual([{ part: 'completeness', signal: 'skills', reason: 'skills_shaped_list_under_unrecognised_heading' }]);
  });
  it.fails('work with dates under an unrecognised heading: unknown (dates_without_section)', () => {
    const t = HEAD + 'Career Odyssey\nAnalyst, Acme Corp\nJan 2020 – Mar 2023\n• Cut report time by 30%\n\n' + SKILLS;
    expect(signal(t, 'experience_or_education')).toMatchObject({ state: 'unknown', reason: 'dates_without_section' });
  });
  it.fails('an Experience heading with only prose and no entries: unknown (section_found_no_entries)', () => {
    const t = HEAD + 'Experience\nWorked at Acme on various reports for many years\n\n' + SKILLS;
    expect(signal(t, 'experience_or_education')).toMatchObject({ state: 'unknown', reason: 'section_found_no_entries' });
  });
  it.fails('an email split over two lines: unknown (email_like_text_not_parsed), not missing', () => {
    const t = 'Jordan Lee\njordan@\nexample.com\n\n' + EXP + EDU + SKILLS;
    expect(signal(t, 'email')).toMatchObject({ state: 'unknown', reason: 'email_like_text_not_parsed' });
  });
  it.fails('two equal name candidates: the name is unknown, never missing', () => {
    const t = 'Senior Product Analyst\nJordan Lee\nAlex Kim\njordan@example.com\n\n' + EXP + EDU + SKILLS;
    expect(signal(t, 'name')).toMatchObject({ state: 'unknown', reason: 'ambiguous_name_candidates' });
  });
  it.fails('the name is never reported missing, whatever the header looks like', () => {
    for (const header of ['+1 555 0100\n', 'Ho Chi Minh City, Vietnam (note)\n', '']) {
      const s = signal(header + '\n' + EXP + EDU + SKILLS, 'name');
      expect(s).toBeDefined();
      expect(['present', 'unknown']).toContain(s.state);
    }
  });
});

describe('what already holds today and must keep holding', () => {
  it('a text whose line breaks were lost is not scored at all (extraction failed), not scored low', () => {
    // 400+ characters on one line: the structure is judged lost (shorter texts are never judged).
    const flat = (HEAD + EXP.repeat(6) + EDU + SKILLS).replace(/\n+/g, ' ');
    expect(flat.length).toBeGreaterThan(400);
    expect(run(flat).score).toBeNull();
  });
  it('a part that cannot be assessed is null and listed, never 0', () => {
    const r = run(HEAD + EDU + SKILLS);
    const impact = r.parts.find((p) => p.id === 'measurable_impact');
    expect(impact.score).toBeNull();
    expect(r.missing).toContain('measurable_impact');
  });
});

describe('contract and version', () => {
  it.fails('accepts well-formed signals, rejects an unknown signal with no reason, and a missing signal that carries one', () => {
    const r = JSON.parse(JSON.stringify(run(HEAD + EXP + EDU + SKILLS)));
    const part = r.parts.find((p) => p.id === 'completeness');
    part.signals = [{ id: 'skills', state: 'present', reason: null, evidence: { source: 'skills' } }];
    expect(validateScoreResult(r).ok).toBe(true);
    part.signals = [{ id: 'skills', state: 'unknown', reason: null, evidence: {} }];
    expect(validateScoreResult(r).ok).toBe(false);
    part.signals = [{ id: 'skills', state: 'missing', reason: 'x', evidence: {} }];
    expect(validateScoreResult(r).ok).toBe(false);
  });
  it.fails('results carry version 2.0.0', () => {
    expect(run(HEAD + EXP + EDU + SKILLS).version).toBe('2.0.0');
  });
  it.todo('the checklist and the Builder read signals, not evidence strings (describeScorePart.js, codeFindings.js)');
  it.todo('every signal unknown: the part is null and so is the overall score, not 0');
});
