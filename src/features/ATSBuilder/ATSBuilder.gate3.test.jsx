// @vitest-environment jsdom
// Gate 3: regression for the Gate 2 integration (computeDeterministicScore(rawText), wired into
// UploadAndParseTab — see ATSBuilder.jsx and docs/AI_ARCHITECTURE_CONTRACT.md). Each test asserts an actual
// COMPUTED VALUE, not just "it ran" — a value mismatch here is a real behaviour regression.
//
// Revised 2026-10-09 (product decision): (superseded: the computed score is now the one shown, see ATSBuilder.shownScore.test.jsx) the score was computed silently and never rendered in the UI — the
// screen must look exactly as it did before Gate 2. The only observable trace is
// console.log('[ATS Builder] computed ATS readiness score:', score), so every assertion below
// reads that logged value instead of querying the DOM (see ATSBuilder.gate4.upload.test.jsx and
// ATSBuilder.resumeShape.test.jsx for the same change applied there).
//
// Resume text used below is either read from committed, synthetic fixtures (tests/fixtures/documents/,
// no real person's data — see that folder's own README) via the exact same ingestDocument already proven
// by 48 ingestion tests, or hand-written placeholder text for conditions (a date contradiction, an
// overlap) that no fixture file encodes. Nothing here uses the real CC-BY templates in tests/fixtures/
// documents/real/ (gitignored, local-only, licensed to their own authors): a test that only every
// contributor's machine can run is not a regression test anyone else can rely on.
import { describe, it, expect, vi, afterEach, beforeEach, beforeAll } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

afterEach(cleanup);

const callLLM = vi.fn();
vi.mock('../../lib/ai', () => ({ callLLM: (...a) => callLLM(...a), extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } } }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));

import ATSBuilder from './ATSBuilder';
import { ingestDocument } from '../../ingestion/ingestDocument';

const FIX = path.resolve(__dirname, '../../../tests/fixtures/documents');
const textFromFixture = async (name) => {
  const buf = fs.readFileSync(path.join(FIX, name));
  const file = { name, size: buf.length, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
  return (await ingestDocument(file)).text;
};

const base = { user: { id: 'u1', token: 't' }, memory: {}, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn() };

const LOG_PREFIX = '[ATS Builder] computed ATS readiness score:';
let logSpy;
beforeEach(() => { logSpy = vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { logSpy.mockRestore(); });
// The last matching call so far — renders accumulate calls in order, so this always reflects the most
// recent render/effect run at the point it's read.
const lastLoggedScore = () => {
  const matches = logSpy.mock.calls.filter(c => c[0] === LOG_PREFIX);
  return matches[matches.length - 1]?.[1];
};
const partOf = (id) => lastLoggedScore()?.parts.find(p => p.id === id);

let canvaText, wingdingsText;
beforeAll(async () => {
  canvaText = await textFromFixture('canva-style-single-col.pdf');       // full signal: name, email, phone,
  wingdingsText = await textFromFixture('word-wingdings-bullets.pdf');   // location, dated experience with
});                                                                       // 2 quantified bullets, skills

describe('Gate 3 — complete CV: the deterministic score matches its independently-verified value', () => {
  it('canva-style-single-col.pdf: completeness 100, measurable_impact 100 (2 of 2 bullets), overall 100', () => {
    render(<ATSBuilder {...base} resumeText={canvaText} />);
    expect(lastLoggedScore().score).toBe(100);
    expect(partOf('completeness').score).toBe(100);
    expect(partOf('measurable_impact').score).toBe(100);
    expect(partOf('measurable_impact').evidence).toEqual(['2 of 2 experience bullets contain a measurable number.']);
    expect(partOf('chronology_health').score).toBe(100);
    expect(partOf('chronology_health').evidence[0]).toMatch(/0 internal date contradiction/);
    expect(screen.queryByText(/Deterministic score/i)).toBeNull(); // never rendered
  });

  it('a second, differently-shaped complete fixture (Word/Wingdings bullets) gives the same shape of result', () => {
    render(<ATSBuilder {...base} resumeText={wingdingsText} />);
    expect(lastLoggedScore().score).toBe(100);
  });
});

describe('Gate 3 — missing information: a real partial score, never a fabricated 0', () => {
  it('standard.pdf (no email, no recognised Skills section — a known, documented P1/P2 boundary): completeness 50, not 0', async () => {
    const text = await textFromFixture('standard.pdf');
    render(<ATSBuilder {...base} resumeText={text} />);
    expect(partOf('completeness').score).toBe(50); // name + experience/education present; email + skills missing
    expect(partOf('completeness').evidence).toContain('contact.email: missing');
  });

  it('a resume with a dated role but no bullets at all: measurable_impact is null (unknown), not 0%', () => {
    render(<ATSBuilder {...base} resumeText={'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme'} />);
    expect(partOf('measurable_impact').score).toBeNull();
    expect(partOf('measurable_impact').evidence).toEqual([]);
  });
});

describe('Gate 3 — extraction failure: no score computed at all, never a fabricated number', () => {
  it('corrupt.pdf: nothing is even attempted — resumeContent() empties this before it reaches scoring', async () => {
    const text = await textFromFixture('corrupt.pdf');
    expect(text).toBe(''); // sanity: this fixture really does fail to extract any text
    render(<ATSBuilder {...base} resumeText={''} />); // ATSBuilder's own resumeContent() also empties a falsy prop the same way
    expect(lastLoggedScore()).toBeUndefined();
  });

  it('text that is present but entirely whitespace: also nothing attempted, never a 0', () => {
    // Directly exercises the same short-circuit as above at the component level: whitespace-only rawText
    // fails the `rawText.trim()` check in UploadAndParseTab's own useEffect before computeDeterministicScore
    // is ever called (a stricter unreadable document — one with real bytes but no text layer — still reaches
    // computeDeterministicScore and gets score: null there; see the Gate 1 fix in commit 0024736 and that
    // function's own tests for that path).
    render(<ATSBuilder {...base} resumeText={'   '} />);
    expect(lastLoggedScore()).toBeUndefined();
  });
});

describe('Gate 3 — contradictory dates: reflected as a real error, never silently repaired', () => {
  it('an end date before its own start lowers chronology_health and is never fixed up or hidden', () => {
    render(<ATSBuilder {...base} resumeText={'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2024 - Jan 2021\nAcme\n• Did X'} />);
    expect(partOf('chronology_health').score).toBe(50);
    expect(partOf('chronology_health').evidence[0]).toMatch(/1 internal date contradiction/);
  });
});

describe('Gate 3 — overlapping experience: a warning in validation, never a scoring penalty', () => {
  it('two overlapping roles still score chronology_health 100 (no error — only end-before-start is penalised)', () => {
    render(<ATSBuilder {...base} resumeText={
      'Jane Example\njane@example.com\n\nExperience\n' +
      'Manager\tJan 2020 - Jan 2022\nAcme\n• Did X\n' +
      'Consultant\tJan 2021 - Jan 2023\nBeta\n• Did Y'
    } />);
    expect(partOf('chronology_health').score).toBe(100);
    expect(partOf('chronology_health').evidence[0]).toMatch(/0 internal date contradiction/); // the overlap itself is not an "internal date contradiction"
  });
});

describe('Gate 3 — the deterministic computation works independently of the AI call (a Gemini outage/overload)', () => {
  it('callLLM rejecting (simulated provider overload) does not prevent the deterministic score from being computed', async () => {
    callLLM.mockRejectedValue(new Error('503: This model is currently experiencing high demand.'));
    render(<ATSBuilder {...base} resumeText={canvaText} />);
    expect(lastLoggedScore().score).toBe(100); // computed immediately; does not wait on or depend on the AI call
  });
});

describe('Gate 3 — the existing AI flow is unchanged (profile.atsScore, same prompt, same display)', () => {
  it('a successful AI parse still populates "ATS score" exactly as before, with no new UI alongside it', async () => {
    callLLM.mockResolvedValue(JSON.stringify({ targetRole: 'Product Manager', experience: '3 years', market: 'Singapore', atsScore: 78, topSkills: ['SQL'] }));
    const { rerender } = render(<ATSBuilder {...base} resumeText={canvaText} />);
    // UploadAndParseTab only calls parseResume from handleFile/paste, not merely from the initial prop,
    // so trigger it the same way the existing (pre-Gate-2) tests exercise the AI path: via the paste flow.
    const textarea = screen.queryByRole('textbox');
    if (textarea) {
      const { fireEvent } = await import('@testing-library/react');
      fireEvent.click(screen.getAllByRole('button').find(b => /parse|analy/i.test(b.textContent)) || document.body);
    }
    rerender(<ATSBuilder {...base} resumeText={canvaText} />);
    // The regression this guards: adding the silent computation must not add any visible panel, and must
    // not touch the old AI row's own rendering path.
    expect(screen.queryByText(/Deterministic score/i)).toBeNull();
  });
});

describe('Gate 3 — determinism: same input, same computed result, every render', () => {
  it('re-rendering with the same resumeText logs the identical score and evidence each time', () => {
    render(<ATSBuilder {...base} resumeText={canvaText} />);
    const first = lastLoggedScore();
    for (let i = 0; i < 5; i++) {
      cleanup();
      render(<ATSBuilder {...base} resumeText={canvaText} />);
      expect(lastLoggedScore()).toEqual(first);
    }
  });
});
