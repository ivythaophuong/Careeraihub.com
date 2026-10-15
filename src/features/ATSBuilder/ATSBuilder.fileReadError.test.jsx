// @vitest-environment jsdom
// When reading an uploaded file fails, the person sees one sentence ("Could not read file"), so the real cause has to reach the console.
// Before this, handleFile swallowed the error and nobody could tell which step (pdf.js, worker, saving) had failed.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

afterEach(cleanup);

vi.mock('../../lib/ai', () => ({ callLLM: vi.fn(), extractJSON: () => ({ error: true }) }));
vi.mock('../../lib/ai.jsx', () => ({ callLLM: vi.fn(), extractJSON: () => ({ error: true }) }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));
vi.mock('../../lib/resumeParser.js', async (importOriginal) => ({
  ...(await importOriginal()),
  extractTextFromPdfFile: vi.fn().mockRejectedValue(new Error('worker failed to load')),
}));

import ATSBuilder from './ATSBuilder';

const base = { user: { id: 'u1', token: 't' }, memory: {}, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn() };

describe('ATS Builder: a file that cannot be read', () => {
  it('shows the usual sentence and writes the real error to the console', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ATSBuilder {...base} />);
    const input = document.querySelector('input[type="file"]');
    const file = new File([new Uint8Array([37, 80, 68, 70])], 'resume.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/Could not read file/)).toBeTruthy());
    const logged = errSpy.mock.calls.find(c => String(c[0]).includes('[ATS Builder] file read failed'));
    expect(logged).toBeTruthy();
    expect(logged[1]).toMatchObject({ message: 'worker failed to load' });
    errSpy.mockRestore();
  });
});
