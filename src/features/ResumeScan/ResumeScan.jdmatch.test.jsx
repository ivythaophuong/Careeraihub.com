// @vitest-environment jsdom
// Regression for the cleanup that removed the dead "Deep Scan" block ({false && ...}) from ResumeScan.jsx:
// the live path (JD match) must still render, run its scan, and write to jd_analyses (never resume_scans).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

afterEach(cleanup);

const callLLM = vi.fn();
vi.mock('../../lib/ai.jsx', () => ({ callLLM: (...a) => callLLM(...a), extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } } }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));

import ResumeScan from './ResumeScan';

describe('ResumeScan (live JD-match path only)', () => {
  it('renders the ATS Scanner header and the JD box, with no legacy Deep Scan controls', () => {
    render(<ResumeScan resumeText={{ type: 'text', content: 'Jane Doe\nPM at Acme', fileName: 'cv.docx' }} setResumeText={vi.fn()} form={{}} memory={{}} updateMemory={vi.fn()} setActiveModule={vi.fn()} />);
    expect(screen.getByText('ATS Scanner')).toBeTruthy();
    expect(screen.getByPlaceholderText(/Paste the full job description/)).toBeTruthy();
    expect(screen.queryByText(/Roast/)).toBeNull();
  });

  it('a JD scan saves a jd_analyses row and never a resume_scans row', async () => {
    callLLM.mockResolvedValue(JSON.stringify({ matchScore: 72, roleTitle: 'Product Manager', company: 'Acme', bars: [], jdKeywords: ['SQL'], aiInsight: 'x', issues: [] }));
    const updateMemory = vi.fn();
    render(<ResumeScan resumeText={{ type: 'text', content: 'Jane Doe\nPM at Acme using SQL', fileName: 'cv.docx' }} setResumeText={vi.fn()} form={{}} memory={{}} updateMemory={updateMemory} setActiveModule={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Paste the full job description/), { target: { value: 'We need a Product Manager who knows SQL.' } });
    fireEvent.click(screen.getAllByRole('button').find(b => /scan|analy|match/i.test(b.textContent) && !b.disabled));
    await waitFor(() => expect(updateMemory).toHaveBeenCalled());
    const tables = updateMemory.mock.calls.map(c => c[1]?.table);
    expect(tables).toContain('jd_analyses');
    expect(tables).not.toContain('resume_scans');
    expect(updateMemory.mock.calls.find(c => c[1]?.table === 'jd_analyses')[1].data.match_score).toBe(72);
  });
});
