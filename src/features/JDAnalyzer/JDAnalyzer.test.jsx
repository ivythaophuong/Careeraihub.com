import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({
  callLLM: vi.fn(),
  extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } },
}));
import { callLLM } from '../../lib/ai.jsx';
import JDAnalyzer from './JDAnalyzer';

const JD = 'We are hiring a Senior Frontend Engineer to own our React platform. '.repeat(3);
const REPLY = {
  roleTitle: 'Senior Frontend Engineer', company: 'Grab', matchScore: 72,
  keyRequirements: ['React', 'Performance'], candidateStrengths: ['5 years of React'], criticalGaps: ['No Golang'],
  hiddenKeywords: ['latency'], redFlags: ['Vague scope'], applicationAdvice: 'Lead with latency wins.', interviewFocus: ['System design'],
};
const longResume = { type: 'text', content: 'Frontend engineer. '.repeat(10), fileName: 'cv' };

const setup = (props = {}) => {
  const p = { resumeText: longResume, form: { role: 'Frontend' }, memory: {}, updateMemory: vi.fn(), setAuthModal: vi.fn(), setActiveModule: vi.fn(), ...props };
  render(<JDAnalyzer {...p} />);
  return p;
};
const paste = (text = JD) => fireEvent.change(screen.getByLabelText('Job description'), { target: { value: text } });
const analyze = () => fireEvent.click(screen.getByText(/Analyze This Job/));

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(cleanup);

describe('JDAnalyzer', () => {
  it('shows no Preview banner and disables the button until the JD is long enough', () => {
    setup();
    expect(screen.queryByText(/Preview/)).toBeNull();
    expect(screen.getByText(/Analyze This Job/).closest('button').disabled).toBe(true);
    paste('too short');
    expect(screen.getByText(/Analyze This Job/).closest('button').disabled).toBe(true);
    paste();
    expect(screen.getByText(/Analyze This Job/).closest('button').disabled).toBe(false);
  });

  it('sends the JD and the resume to the AI and renders the real result', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    setup();
    paste(); analyze();
    await screen.findByText('Senior Frontend Engineer');
    expect(screen.getByText('Grab')).toBeTruthy();
    expect(screen.getByText('• 5 years of React')).toBeTruthy();
    expect(screen.getByText('• No Golang')).toBeTruthy();
    expect(screen.getByText('LATENCY')).toBeTruthy();
    expect(screen.getByText('• Vague scope')).toBeTruthy();
    expect(screen.getByText('Lead with latency wins.')).toBeTruthy();
    expect(screen.getByText(/Compared against your pasted resume/)).toBeTruthy();
    const prompt = callLLM.mock.calls[0][0][0].content;
    expect(prompt).toContain('Senior Frontend Engineer to own our React platform');
    expect(prompt).toContain('Frontend engineer.');
  });

  it('saves the real result to history, newest first, capped at 20', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    const p = setup();
    paste(); analyze();
    await screen.findByText('Grab');
    const updater = p.updateMemory.mock.calls[0][0];
    const old = Array.from({ length: 25 }, (_, i) => ({ company: `old${i}` }));
    const next = updater({ jdAnalyses: old });
    expect(next.jdAnalyses).toHaveLength(20);
    expect(next.jdAnalyses[0]).toMatchObject({ company: 'Grab', role: 'Senior Frontend Engineer', matchScore: 72 });
    expect(next.jdAnalyses[1].company).toBe('old0'); // the newest old entry is kept, not dropped
    expect(Object.keys(next)).toEqual(['jdAnalyses']);
  });

  it('works without a resume: no score, no invented comparison, offers to scan', async () => {
    callLLM.mockResolvedValue(JSON.stringify({ ...REPLY, matchScore: 99, candidateStrengths: [] }));
    const p = setup({ resumeText: null, memory: {} });
    paste(); analyze();
    await screen.findByText('Senior Frontend Engineer');
    expect(screen.getByText(/No resume to compare against/)).toBeTruthy();
    expect(screen.queryByText(/Compared against/)).toBeNull();
    expect(callLLM.mock.calls[0][0][0].content).toContain('No resume was provided.');
    expect(p.updateMemory.mock.calls[0][0]({}).jdAnalyses[0].matchScore).toBeNull();
    fireEvent.click(screen.getByText('Scan your resume first'));
    expect(p.setActiveModule).toHaveBeenCalledWith('scan');
  });

  it('uses the session PDF when no text resume exists', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    setup({ resumeText: { type: 'pdf', content: null }, memory: { scanPdfBase64: 'PDFDATA' } });
    paste(); analyze();
    await screen.findByText('Grab');
    expect(callLLM.mock.calls[0][2]).toBe('PDFDATA');
    expect(screen.getByText(/Compared against your uploaded PDF resume/)).toBeTruthy();
  });

  it('shows the error and saves nothing when the AI reply is unusable', async () => {
    callLLM.mockResolvedValue('Sorry, I cannot help with that.');
    const p = setup();
    paste(); analyze();
    expect((await screen.findByRole('alert')).textContent).toMatch(/unreadable analysis/);
    expect(p.updateMemory).not.toHaveBeenCalled();
    expect(screen.queryByText('Grab')).toBeNull();
  });

  it('shows a clear message when the reply was cut off', async () => {
    callLLM.mockRejectedValue(Object.assign(new Error('Reply hit the length limit.'), { truncated: true }));
    setup();
    paste(); analyze();
    expect((await screen.findByRole('alert')).textContent).toMatch(/length limit/);
  });

  it('opens the sign-up modal for guests (401) instead of a raw error', async () => {
    callLLM.mockRejectedValue(Object.assign(new Error('Please sign in to use AI features.'), { status: 401 }));
    const p = setup();
    paste(); analyze();
    await waitFor(() => expect(p.setAuthModal).toHaveBeenCalledWith('register'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Create a free account/);
  });

  it('clears the old result while a new analysis runs and re-enables the button afterwards', async () => {
    let resolve;
    callLLM.mockReturnValue(new Promise(r => { resolve = r; }));
    setup();
    paste(); analyze();
    expect(screen.getByText('Analyzing JD...')).toBeTruthy();
    resolve(JSON.stringify(REPLY));
    await screen.findByText('Grab');
    expect(screen.getByText(/Analyze This Job/).closest('button').disabled).toBe(false);
  });
});
