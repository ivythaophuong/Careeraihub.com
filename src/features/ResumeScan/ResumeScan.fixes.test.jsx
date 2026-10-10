// @vitest-environment jsdom
// Regressions found while testing the ATS Scanner by hand (2026-10-10): blank PDF, JD without a length limit, next steps after fixing.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

afterEach(cleanup);
vi.mock('../../lib/ai.jsx', () => ({ callLLM: vi.fn(), extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } } }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));
import ResumeScan from './ResumeScan';
import { JD_MAX_CHARS } from '../../lib/templateParse';

const base = { resumeText: { type: 'text', content: 'Jane Doe\nPM at Acme using SQL', fileName: 'cv.docx' }, setResumeText: vi.fn(), form: {}, memory: {}, updateMemory: vi.fn(), setActiveModule: vi.fn() };

describe('PDF export target (blank PDF)', () => {
  it('the captured element has no position or offset of its own: html2pdf copies it, and a copy at left:-9999px is an empty page', () => {
    render(<ResumeScan {...base} />);
    const target = screen.getByTestId('pdf-export-target');
    expect(target.style.position).toBe('');
    expect(target.style.left).toBe('');
    expect(target.parentElement.style.left).toBe('-9999px'); // hiding is done by the wrapper
  });
});

describe('job description length', () => {
  const type = (len) => fireEvent.change(screen.getByLabelText('Job description'), { target: { value: 'x'.repeat(len) } });
  it('a job description over the limit shows a clear message and cannot be scanned', () => {
    render(<ResumeScan {...base} />);
    type(JD_MAX_CHARS + 1);
    expect(screen.getByRole('alert').textContent).toMatch(/too long/);
    expect(screen.getByRole('alert').textContent).toMatch(/15,000/);
    expect(screen.getByRole('button', { name: /scan match/i }).disabled).toBe(true);
  });
  it('a job description at the limit can be scanned', () => {
    render(<ResumeScan {...base} />);
    type(JD_MAX_CHARS);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: /scan match/i }).disabled).toBe(false);
  });
});

describe('choosing which resume to scan', () => {
  const versions = [
    { label: 'Analyst CV', text: 'Analyst CV text\nSQL', data: {}, date: '2026-01-01' },
    { label: 'PM CV – tailored for Grab', text: 'PM CV text\nRoadmaps', data: {}, date: '2026-02-01' },
  ];
  it('lists the loaded resume and the saved versions by name, and loads the one picked', () => {
    const setResumeText = vi.fn();
    render(<ResumeScan {...base} setResumeText={setResumeText} memory={{ resumeVersions: versions }} />);
    const select = screen.getByLabelText('Resume to scan');
    expect([...select.options].map(o => o.value)).toEqual(['cv.docx', 'PM CV – tailored for Grab', 'Analyst CV']);
    expect(select.value).toBe('cv.docx');
    fireEvent.change(select, { target: { value: 'Analyst CV' } });
    expect(setResumeText).toHaveBeenCalledWith({ type: 'text', content: 'Analyst CV text\nSQL', fileName: 'Analyst CV' });
  });
  it('shows no chooser when there are no saved versions', () => {
    render(<ResumeScan {...base} memory={{}} />);
    expect(screen.queryByLabelText('Resume to scan')).toBeNull();
  });
});
