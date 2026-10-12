// Specification for docs/architecture/plans/DESIGN-completeness-states.md, written BEFORE the change.
// `it.fails` marks a case the current scorer does not meet yet: each one must be turned into a normal `it` when the design is implemented
// (a case that starts passing makes its `it.fails` fail, which forces that flip). Plain `it` cases already hold today and must keep holding.
// Resumes are synthetic.
import { describe, it, expect } from 'vitest';
import { computeDeterministicScore } from './computeDeterministicScore';
import { validateScoreResult } from '../contracts/scoreResult';
import { extractResumeFacts } from '../extraction/resumeFacts';
import { validateFacts } from '../validation/validateFacts';
import { scoreResume } from './resumeScore';

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
});

// ── Decisions of 2026-10-12 (C1-C5) and the review: scope of an assessment, partial extraction, URL at-signs, a date is not proof ──
const SPLIT_EMAIL = 'jordan@\nexample.com';
const ODD_WORK = 'Career Odyssey\nAnalyst, Acme Corp\nJan 2020 – Mar 2023\n• Cut report time by 30%\n\n';
const ODD_SKILLS = 'Toolbox Matters\nSQL, Excel, Python\n';
const AMBIGUOUS_NAME = 'Senior Product Analyst\nJordan Lee\nAlex Kim\n';
const ALL_UNKNOWN = AMBIGUOUS_NAME + SPLIT_EMAIL + '\n\n' + ODD_WORK + ODD_SKILLS;
const ONE_ASSESSED = AMBIGUOUS_NAME + 'jordan@example.com\n\n' + ODD_WORK + ODD_SKILLS;

describe('C5: no fixed threshold, but the scope of the assessment is always stated', () => {
  it.fails('every signal unknown: completeness is null and so is the overall score (not 0), and all four are listed as not assessed', () => {
    const r = run(ALL_UNKNOWN);
    expect(r.parts.find((p) => p.id === 'completeness').score).toBeNull();
    expect(r.score).toBeNull();
    expect(r.assessment).toMatchObject({ assessed: 0, total: 4 });
    expect(r.assessment.not_assessed.map((n) => n.signal).sort()).toEqual(['email', 'experience_or_education', 'name', 'skills']);
  });
  it.fails('only one signal assessed (email present): the formula gives 100, and the result says 1 of 4, with the other three named', () => {
    const r = run(ONE_ASSESSED);
    expect(signal(ONE_ASSESSED, 'email')).toMatchObject({ state: 'present' });
    expect(r.parts.find((p) => p.id === 'completeness').score).toBe(100);
    expect(r.assessment).toMatchObject({ assessed: 1, total: 4 });
    expect(r.assessment.not_assessed).toHaveLength(3);
  });
  it('one signal is enough to compute a score: there is no 2-of-4 cut-off (true today, must stay true)', () => {
    expect(run(ONE_ASSESSED).score).not.toBeNull();
  });
});

describe('partial extraction is judged signal by signal', () => {
  const partial = () => {
    const facts = extractResumeFacts(HEAD + EXP + EDU + SKILLS);
    facts.extraction = { status: 'partial', notes: ['internal: one section could not be read'] };
    facts.skills = []; // the part that was not read
    return scoreResume(facts, validateFacts(facts));
  };
  it.fails('name and email that have valid evidence stay present; only the unread skills become unknown (extraction_incomplete)', () => {
    const signals = Object.fromEntries(partial().parts.find((p) => p.id === 'completeness').signals.map((s) => [s.id, s]));
    expect(signals.name.state).toBe('present');
    expect(signals.email.state).toBe('present');
    expect(signals.experience_or_education.state).toBe('present');
    expect(signals.skills).toMatchObject({ state: 'unknown', reason: 'extraction_incomplete' });
  });
  it.fails('present and missing never carry an extraction reason', () => {
    for (const sg of partial().parts.find((p) => p.id === 'completeness').signals) {
      if (sg.state !== 'unknown') expect(sg.reason).toBeNull();
    }
  });
});

describe('an @ that is not an email address', () => {
  it.fails('an @ in a URL or an account name does not make the email present, nor unknown: it is missing, and the ignored @ are counted', () => {
    const t = 'Jordan Lee\nhttps://medium.com/@jordan\n@jordan_lee\n+1 555 0100\n\n' + EXP + EDU + SKILLS;
    expect(signal(t, 'email')).toMatchObject({ state: 'missing', reason: null, evidence: { ignored_at_signs: 2 } });
  });
  it.fails('a real email next to a URL with an @ is still read', () => {
    const t = 'Jordan Lee\nhttps://medium.com/@jordan\njordan@example.com\n\n' + EXP + EDU + SKILLS;
    expect(signal(t, 'email')).toMatchObject({ state: 'present' });
  });
});

describe('a date line is a sign to investigate, not proof of experience', () => {
  it.fails('a dated certification with no experience or education entry: unknown (dates_without_section), not present and not missing', () => {
    const t = HEAD + 'Certifications\nGoogle Data Analytics, Jan 2020 – Mar 2023\n\n' + SKILLS;
    expect(signal(t, 'experience_or_education')).toMatchObject({ state: 'unknown', reason: 'dates_without_section' });
  });
});

describe('one source of truth: the assessment is derived from the signals', () => {
  const TEXTS = [HEAD + EXP + EDU + SKILLS, 'Jordan Lee\n+1 555 0100\n\n' + EXP + EDU + SKILLS, HEAD + EXP + EDU + ODD_SKILLS,
    HEAD + ODD_WORK + SKILLS, 'Jordan Lee\n' + SPLIT_EMAIL + '\n\n' + EXP + EDU + SKILLS, ONE_ASSESSED, ALL_UNKNOWN];
  it.fails('for every sample, not_assessed is exactly the unknown signals and assessed + not_assessed = total', () => {
    for (const t of TEXTS) {
      const r = run(t);
      const signals = r.parts.find((p) => p.id === 'completeness').signals;
      const unknown = signals.filter((x) => x.state === 'unknown').map((x) => ({ part: 'completeness', signal: x.id, reason: x.reason }));
      expect(r.assessment.not_assessed).toEqual(unknown);
      expect(r.assessment.assessed + r.assessment.not_assessed.length).toBe(r.assessment.total);
      expect(r.assessment.total).toBe(signals.length);
    }
  });
  it.fails('the validator rejects an assessment that disagrees with the signals, and a reason code outside the closed list', () => {
    const r = JSON.parse(JSON.stringify(run(ONE_ASSESSED)));
    expect(validateScoreResult(r).ok).toBe(true);
    const bad = JSON.parse(JSON.stringify(r)); bad.assessment.not_assessed.pop();
    expect(validateScoreResult(bad).ok).toBe(false);
    const bad2 = JSON.parse(JSON.stringify(r)); bad2.parts.find((p) => p.id === 'completeness').signals.find((x) => x.state === 'unknown').reason = 'made_up_code';
    expect(validateScoreResult(bad2).ok).toBe(false);
  });
});

describe('every reader of the score uses the same contract (written when the UI changes)', () => {
  it.todo('describeScorePart.js: "not found" only for missing, "not read" for unknown; no regex on evidence strings');
  it.todo('codeFindings.js: only a missing signal says "add ..."; an unknown signal says "check ..."; it never tells the user to add something that may already be there');
  it.todo('BuilderScorePanel.jsx: states the scope next to the number ("Based on n of 4 checks"); no raw Completeness evidence strings');
  it.todo('ATSBuilder.jsx upload screen: the "ATS readiness" tile, the score ring and the Score Breakdown chips state the scope; no "Strong Resume" / "Score below 80" wording when assessed < total');
  it.todo('changing the human-readable evidence text does not break any of the above');
  it.todo('ATSBuilder.gate3/gate4 and readerParity expectations are updated on purpose, each change explained');
});
