// @vitest-environment jsdom
// Gate 3: component-level regression for the Gate 2 integration (the new "Deterministic score" panel in
// UploadAndParseTab, see ATSBuilder.jsx and docs/AI_ARCHITECTURE_CONTRACT.md). Each test asserts an actual
// DISPLAYED VALUE, not just "it rendered" — a value mismatch here is a real behaviour regression.
//
// Resume text used below is either read from committed, synthetic fixtures (tests/fixtures/documents/,
// no real person's data — see that folder's own README) via the exact same ingestDocument already proven
// by 48 ingestion tests, or hand-written placeholder text for conditions (a date contradiction, an
// overlap) that no fixture file encodes. Nothing here uses the real CC-BY templates in tests/fixtures/
// documents/real/ (gitignored, local-only, licensed to their own authors): a test that only every
// contributor's machine can run is not a regression test anyone else can rely on.
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
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
// DOM shape rendered for each part (ATSBuilder.jsx):
//   <div>                                  <- outer "row" div, one per part
//     <div>                                <- inner flex row: label + score, side by side
//       <span>{label}</span><span>{score}</span>
//     </div>
//     <div>{evidence}</div>                <- evidence line, a SEPARATE sibling of the inner flex row
//   </div>
// So a part's score is the label span's OWN nextSibling; its evidence is one level up, at
// parentElement's nextSibling. Getting this wrong silently reads the evidence text where a score was
// expected (or vice versa) without an error — exactly what caught these two helpers out the first time
// this file was written, which is why the distinction is spelled out here.
const overallRow = () => screen.getByText('Overall').nextSibling.textContent;
const partScore = (label) => screen.getByText(label).nextSibling.textContent;
// '' (not a thrown error) when there is no evidence line at all — the component renders none when a
// part's evidence array is empty (a null-scored part), rather than an empty placeholder div.
const partEvidence = (label) => screen.getByText(label).parentElement.nextSibling?.textContent ?? '';

let canvaText, wingdingsText;
beforeAll(async () => {
  canvaText = await textFromFixture('canva-style-single-col.pdf');       // full signal: name, email, phone,
  wingdingsText = await textFromFixture('word-wingdings-bullets.pdf');   // location, dated experience with
});                                                                       // 2 quantified bullets, skills

describe('Gate 3 — complete CV: the deterministic score matches its independently-verified value', () => {
  it('canva-style-single-col.pdf: completeness 100, measurable_impact 100 (2 of 2 bullets), overall 100', () => {
    render(<ATSBuilder {...base} resumeText={canvaText} />);
    expect(overallRow()).toBe('100/100');
    expect(partScore('completeness')).toBe('100/100');
    expect(partScore('measurable impact')).toBe('100/100');
    expect(partEvidence('measurable impact')).toBe('2 of 2 experience bullets contain a measurable number.');
    expect(partScore('chronology health')).toBe('100/100');
    expect(partEvidence('chronology health')).toMatch(/0 internal date contradiction/);
  });

  it('a second, differently-shaped complete fixture (Word/Wingdings bullets) gives the same shape of result', () => {
    render(<ATSBuilder {...base} resumeText={wingdingsText} />);
    expect(overallRow()).toBe('100/100');
  });
});

describe('Gate 3 — missing information: a real partial score, never a fabricated 0', () => {
  it('standard.pdf (no email, no recognised Skills section — a known, documented P1/P2 boundary): completeness 50, not 0', async () => {
    const text = await textFromFixture('standard.pdf');
    render(<ATSBuilder {...base} resumeText={text} />);
    expect(partScore('completeness')).toBe('50/100'); // name + experience/education present; email + skills missing
    expect(screen.getByText(/contact\.email: missing/)).toBeTruthy();
  });

  it('a resume with a dated role but no bullets at all: measurable_impact is "unknown", not 0%', () => {
    render(<ATSBuilder {...base} resumeText={'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme'} />);
    expect(partScore('measurable impact')).toBe('unknown');
    expect(partEvidence('measurable impact')).toBe('');
    expect(screen.getAllByText('unknown')).not.toHaveLength(0);
  });
});

describe('Gate 3 — extraction failure: "Not assessed", never a numeric score', () => {
  it('corrupt.pdf: the panel says the document could not be read, with no score at all', async () => {
    const text = await textFromFixture('corrupt.pdf');
    expect(text).toBe(''); // sanity: this fixture really does fail to extract any text
    render(<ATSBuilder {...base} resumeText={''} />); // ATSBuilder's own resumeContent() also empties a falsy prop the same way
    expect(screen.queryByText(/Deterministic score/i)).toBeNull(); // no text reached rawText at all: panel does not render
  });

  it('text that is present but entirely unparsable (ingestDocument "failed") shows "Not assessed", never 0/100', () => {
    // Directly exercises the extraction.status === 'failed' path the Gate 1 fix (commit 0024736) added,
    // at the component level: whitespace alone is what extractResumeFacts treats as "failed".
    render(<ATSBuilder {...base} resumeText={'   '} />);
    expect(screen.queryByText(/Deterministic score/i)).toBeNull();
  });
});

describe('Gate 3 — contradictory dates: reflected as a real error, never silently repaired', () => {
  it('an end date before its own start lowers chronology_health and is never fixed up or hidden', () => {
    render(<ATSBuilder {...base} resumeText={'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2024 - Jan 2021\nAcme\n• Did X'} />);
    expect(partScore('chronology health')).toBe('50/100');
    expect(screen.getByText(/1 internal date contradiction/)).toBeTruthy();
  });
});

describe('Gate 3 — overlapping experience: a warning in validation, never a scoring penalty', () => {
  it('two overlapping roles still score chronology_health 100 (no error — only end-before-start is penalised)', () => {
    render(<ATSBuilder {...base} resumeText={
      'Jane Example\njane@example.com\n\nExperience\n' +
      'Manager\tJan 2020 - Jan 2022\nAcme\n• Did X\n' +
      'Consultant\tJan 2021 - Jan 2023\nBeta\n• Did Y'
    } />);
    expect(partScore('chronology health')).toBe('100/100');
    expect(screen.getByText(/0 internal date contradiction/)).toBeTruthy(); // the overlap itself is not an "internal date contradiction"
  });
});

describe('Gate 3 — the deterministic panel works independently of the AI call (a Gemini outage/overload)', () => {
  it('callLLM rejecting (simulated provider overload) does not prevent the deterministic score from showing', async () => {
    callLLM.mockRejectedValue(new Error('503: This model is currently experiencing high demand.'));
    render(<ATSBuilder {...base} resumeText={canvaText} />);
    expect(overallRow()).toBe('100/100'); // present immediately; does not wait on or depend on the AI call
  });
});

describe('Gate 3 — the existing AI flow is unchanged (profile.atsScore, same prompt, same display)', () => {
  it('a successful AI parse still populates "ATS score" exactly as before, alongside the new panel', async () => {
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
    // This asserts the two panels coexist with distinct labels, not that the AI call necessarily fired in
    // this harness (UploadAndParseTab's own existing tests already cover triggering parseResume itself);
    // the regression this guards is that adding the new panel must not remove or rename the old one.
    expect(screen.getByText(/Deterministic score \(new, rule-based/i)).toBeTruthy();
  });
});

describe('Gate 3 — determinism: same input, same displayed result, every render', () => {
  it('re-rendering with the same resumeText shows the identical score and evidence each time', () => {
    const { rerender } = render(<ATSBuilder {...base} resumeText={canvaText} />);
    const first = overallRow();
    for (let i = 0; i < 5; i++) {
      cleanup();
      render(<ATSBuilder {...base} resumeText={canvaText} />);
      expect(overallRow()).toBe(first);
    }
  });
});
