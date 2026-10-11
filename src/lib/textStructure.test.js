import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { detectLostStructure } from './textStructure';
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
