// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

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
