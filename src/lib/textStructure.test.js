import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { detectLostStructure, detectUnreadableSections } from './textStructure';
import { extractResumeFacts } from '../extraction/resumeFacts';
import { computeDeterministicScore } from '../scoring/computeDeterministicScore';

const cv = fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/synthetic-cv.txt'), 'utf8');
const oneLine = cv.replace(/\s*\n\s*/g, ' ');

describe('detectLostStructure', () => {
  it('flags a CV whose line breaks were lost (a long text on one or two lines)', () => {
    expect(detectLostStructure(oneLine).lost).toBe(true);
    expect(detectLostStructure(`${cv.slice(0, 500).replace(/\n/g, ' ')}\n${cv.slice(500).replace(/\n/g, ' ')}`).lost).toBe(true);
  });

  it('does not flag a normal CV, a short text, or a CV with long paragraphs but many lines', () => {
    expect(detectLostStructure(cv).lost).toBe(false);
    expect(detectLostStructure('Jordan Lee\njordan@example.com').lost).toBe(false);
    expect(detectLostStructure('Jordan Lee jordan@example.com Analyst at Northwind').lost).toBe(false); // short: not enough to judge
    const longSummary = `Summary\n${'Analyst who turns data into decisions. '.repeat(20)}\nExperience\nAnalyst, Northwind\nJan 2020 - Present\n- Built a report used by 6 managers\nEducation\nBSc\nSkills\nSQL`;
    expect(detectLostStructure(longSummary).lost).toBe(false);
  });

  it('says why in plain words, and is safe on empty or non-string input', () => {
    expect(detectLostStructure(oneLine).reason).toMatch(/line breaks/i);
    expect(detectLostStructure('')).toEqual({ lost: false });
    expect(detectLostStructure(null)).toEqual({ lost: false });
  });
});

describe('a text without line breaks is not given a made-up low score', () => {
  it('the facts say the structure was lost, and the score is null with every part "not assessed", not 25', () => {
    const facts = extractResumeFacts(oneLine);
    expect(facts.extraction.status).toBe('failed');
    expect(facts.extraction.notes).toContain('structure_lost');
    const r = computeDeterministicScore(oneLine).score;
    expect(r.score).toBeNull();
    expect(r.missing).toEqual(['completeness', 'measurable_impact', 'chronology_health']);
  });

  it('the same CV with its line breaks is scored normally', () => {
    const r = computeDeterministicScore(cv).score;
    expect(r.score).toBeGreaterThan(50);
    expect(extractResumeFacts(cv).extraction.notes).not.toContain('structure_lost');
  });

  it('a CV that is really bare but has line breaks is still scored (it is read, and it is thin)', () => {
    const bare = 'Jordan Lee\nI am looking for a job in sales and I like working with people.\nPlease contact me.\nThank you for your time and consideration of my application.';
    expect(computeDeterministicScore(bare).score.score).not.toBeNull();
  });
});

const TWO_COLUMN = `Ahmed Khalil                          SKILLS
ahmed.khalil@example.com              Project planning
+20 100 555 0100                      Budgeting
                                       Risk management

EXPERIENCE                            EDUCATION
Project Manager, Delta Build          BSc Civil Engineering
Feb 2018 - Present                    Cairo University, 2014
- Delivered 6 projects on budget      Languages: Arabic, English
- Led a site team of 12 people        Certifications: PMP
`;

describe('detectUnreadableSections', () => {
  it('flags a text with plenty of lines where no experience, education or skill could be read', () => {
    const r = detectUnreadableSections(TWO_COLUMN, { experiences: 0, education: 0, skills: 0 });
    expect(r.unreadable).toBe(true);
    expect(r.reason).toMatch(/experience, education or skills/i);
  });
  it('does not flag when anything was read, or when the text is too short or too thin to judge', () => {
    expect(detectUnreadableSections(TWO_COLUMN, { experiences: 1, education: 0, skills: 0 }).unreadable).toBe(false);
    expect(detectUnreadableSections(TWO_COLUMN, { experiences: 0, education: 1, skills: 0 }).unreadable).toBe(false);
    expect(detectUnreadableSections(TWO_COLUMN, { experiences: 0, education: 0, skills: 3 }).unreadable).toBe(false);
    expect(detectUnreadableSections('Jordan Lee\njordan@example.com\nAnalyst', { experiences: 0, education: 0, skills: 0 }).unreadable).toBe(false);
    expect(detectUnreadableSections('', { experiences: 0, education: 0, skills: 0 }).unreadable).toBe(false);
    expect(detectUnreadableSections(null, null).unreadable).toBe(false);
  });
});

describe('a resume whose sections cannot be read is not scored', () => {
  it('extraction fails with the note layout_unreadable and the score is null, not a low number', () => {
    const r = computeDeterministicScore(TWO_COLUMN);
    expect(r.facts.extraction.status).toBe('failed');
    expect(r.facts.extraction.notes).toContain('layout_unreadable');
    expect(r.score.score).toBeNull();
  });
  it('a normal resume is unaffected', () => {
    const r = computeDeterministicScore(cv);
    expect(r.facts.extraction.status).toBe('ok');
    expect(r.score.score).not.toBeNull();
  });
  it('an entry-level resume with only education and skills is not flagged', () => {
    const t = 'Zoe Williams\nzoe.williams@example.com | +44 7700 900456\n\nEducation\nBSc Biology, University of Bristol, 2025\n\nSkills\nLaboratory techniques, Data analysis, Teamwork\nReport writing, Microscopy, Statistics\nProject work in ecology and genetics\n';
    expect(extractResumeFacts(t).extraction.status).toBe('ok');
  });
});
