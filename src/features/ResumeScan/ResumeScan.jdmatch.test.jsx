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

  it('an unreadable AI reply shows an error and saves nothing', async () => {
    callLLM.mockResolvedValue('this is not JSON at all');
    const updateMemory = vi.fn();
    render(<ResumeScan resumeText={{ type: 'text', content: 'Jane Doe\nPM at Acme using SQL', fileName: 'cv.docx' }} setResumeText={vi.fn()} form={{}} memory={{}} updateMemory={updateMemory} setActiveModule={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Paste the full job description/), { target: { value: 'We need a Product Manager who knows SQL.' } });
    fireEvent.click(screen.getAllByRole('button').find(b => /scan|analy|match/i.test(b.textContent) && !b.disabled));
    await waitFor(() => expect(screen.getByText(/couldn't read the AI's reply/i)).toBeTruthy());
    expect(updateMemory).not.toHaveBeenCalled();
  });
  const runScan = async (reply, memory = {}) => {
    callLLM.mockResolvedValue(JSON.stringify(reply));
    const utils = render(<ResumeScan resumeText={{ type: 'text', content: 'Jane Doe\nPM at Acme using SQL', fileName: 'cv.docx' }} setResumeText={vi.fn()} form={{}} memory={memory} updateMemory={vi.fn()} setActiveModule={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Paste the full job description/), { target: { value: 'We need a Product Manager who knows SQL.' } });
    fireEvent.click(screen.getAllByRole('button').find(b => /scan|analy|match/i.test(b.textContent) && !b.disabled));
    await waitFor(() => expect(screen.getAllByText(/AI estimate/).length).toBeGreaterThan(0));
    return utils;
  };
  const issue = { severity: 'critical', type: 'Missing Metric', original: 'Led the team', fix: 'Led a team of [X] engineers' };

  it('shows the match score as an AI estimate in one colour, whatever the value', async () => {
    const hi = await runScan({ matchScore: 90, roleTitle: 'PM', bars: [], jdKeywords: [], aiInsight: 'x', issues: [] });
    const hiColor = screen.getByText('90').style.color;
    hi.unmount();
    await runScan({ matchScore: 55, roleTitle: 'PM', bars: [], jdKeywords: [], aiInsight: 'x', issues: [] });
    expect(screen.getByText('55').style.color).toBe(hiColor);
  });

  it('does not compare with the previous estimate ("vs last")', async () => {
    await runScan({ matchScore: 70, roleTitle: 'PM', bars: [], jdKeywords: [], aiInsight: 'x', issues: [] }, { jdAnalyses: [{ matchScore: 50 }] });
    expect(screen.queryByText(/vs last/)).toBeNull();
  });

  it('a low estimate warns but still shows the fix suggestions without a click', async () => {
    await runScan({ matchScore: 30, roleTitle: 'PM', bars: [], jdKeywords: [], aiInsight: 'x', issues: [issue] });
    expect(screen.getByText(/AI estimate suggests low alignment/i)).toBeTruthy();
    expect(screen.getByText(/Fix suggestions/)).toBeTruthy();
    expect(screen.queryByText(/I understand, show fixes anyway/)).toBeNull();
  });
  it('the bars are one neutral colour whatever the value, and say which are AI estimates', async () => {
    const bars = [{ label: 'Skills alignment', score: 90 }, { label: 'Format score', score: 55 }, { label: 'Tone', score: 20 }];
    await runScan({ matchScore: 70, roleTitle: 'PM', bars, jdKeywords: [], aiInsight: 'x', issues: [] });
    const fill = (label) => screen.getByText(label).parentElement.children[1].firstChild.style.background; // label, track(fill), value
    expect(fill('Skills alignment')).toBe(fill('Format score'));
    expect(fill('Format score')).toBe(fill('Tone'));
    expect(screen.getByText(/bars are AI estimates/i)).toBeTruthy();
  });
});
