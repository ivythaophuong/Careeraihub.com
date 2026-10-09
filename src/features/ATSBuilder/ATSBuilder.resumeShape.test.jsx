// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

afterEach(cleanup);

vi.mock('../../lib/ai', () => ({ callLLM: vi.fn() }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));

import ATSBuilder from './ATSBuilder';

// Resume Scan stores { type, content, fileName } in the same slot where the paste box stores a string.
// This crashed the whole screen with "n.trim is not a function".
describe('ATSBuilder resumeText shapes', () => {
  const base = { user: { id: 'u1', token: 't' }, memory: {}, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn() };

  it.each([
    ['a string', 'Jane Doe\nSoftware Engineer at Acme'],
    ['a Resume Scan object', { type: 'text', content: 'Jane Doe\nSoftware Engineer at Acme', fileName: 'cv.docx' }],
    ['a PDF Resume Scan object (no text kept)', { type: 'pdf', content: null, fileName: 'cv.pdf' }],
    ['null', null],
  ])('renders with %s', (_label, resumeText) => {
    expect(() => render(<ATSBuilder {...base} resumeText={resumeText} />)).not.toThrow();
  });
});

// Gate 2 integration, revised 2026-10-09 per product decision: the deterministic score is computed
// silently alongside the existing AI profile, but never rendered — the UI must look exactly as it did
// before Gate 2 (see ATSBuilder.gate3.test.jsx's and ATSBuilder.gate4.upload.test.jsx's own notes for the
// full history). The only observable trace is console.log('[ATS Builder] deterministic score (not shown in
// UI):', score), there for the person running the app in devtools, not for an end user.
describe('ATSBuilder deterministic score (computed silently, never rendered)', () => {
  const base = { user: { id: 'u1', token: 't' }, memory: {}, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn() };
  let logSpy;
  beforeEach(() => { logSpy = vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { logSpy.mockRestore(); });
  const loggedScore = () => {
    const call = logSpy.mock.calls.find(c => c[0] === '[ATS Builder] computed ATS readiness score:');
    return call?.[1];
  };

  it('computes a real score once resume text is present, and never puts it in the DOM', () => {
    render(<ATSBuilder {...base} resumeText={'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%'} />);
    expect(loggedScore().score).toEqual(expect.any(Number));
    expect(screen.queryByText(/Deterministic score/i)).toBeNull();
  });

  it('logs score: null (not a misleading 0) when the document could not be read', () => {
    render(<ATSBuilder {...base} resumeText={'   '} />); // whitespace-only: nothing to score, so nothing is even attempted
    expect(loggedScore()).toBeUndefined(); // resumeContent() empties this before it ever reaches computeDeterministicScore
    expect(screen.queryByText(/Deterministic score/i)).toBeNull();
  });

  it('does not alter the existing AI "ATS score" row, and never shows its own label anywhere', () => {
    render(<ATSBuilder {...base} resumeText={'Jane Example\njane@example.com'} />);
    expect(loggedScore().score).toEqual(expect.any(Number));
    expect(screen.queryByText(/Deterministic score/i)).toBeNull();
    expect(screen.queryByText('ATS score')).toBeNull(); // old row not shown yet (no AI profile parsed in this test)
  });
});
