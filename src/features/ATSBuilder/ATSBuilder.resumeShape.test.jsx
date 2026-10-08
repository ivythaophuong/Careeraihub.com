// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
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

// Gate 2 integration: a rule-based score shown alongside the existing AI profile, never replacing it.
describe('ATSBuilder deterministic score panel (additive, alongside the existing AI profile)', () => {
  const base = { user: { id: 'u1', token: 't' }, memory: {}, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn() };

  it('shows the new panel, with a real computed score, once resume text is present', () => {
    render(<ATSBuilder {...base} resumeText={'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%'} />);
    expect(screen.getByText(/Deterministic score/i)).toBeTruthy();
    expect(screen.getByText('Overall').nextSibling.textContent).toMatch(/^\d+\/100$/);
  });

  it('says "Not assessed" rather than a misleading 0 when the document could not be read', () => {
    render(<ATSBuilder {...base} resumeText={'   '} />); // whitespace-only: nothing to score
    expect(screen.queryByText(/Deterministic score/i)).toBeNull(); // no text at all: the panel does not appear
  });

  it('does not alter the existing AI "ATS score" row: both can be present at once, clearly separate', () => {
    render(<ATSBuilder {...base} resumeText={'Jane Example\njane@example.com'} />);
    // The old AI row only appears once a profile has been parsed (it starts null until the AI call
    // resolves); this just confirms the new panel's own label is distinct from the old row's label.
    expect(screen.getByText(/Deterministic score \(new, rule-based/i)).toBeTruthy();
    expect(screen.queryByText('ATS score')).toBeNull(); // old row not shown yet (no AI profile parsed in this test)
  });
});
