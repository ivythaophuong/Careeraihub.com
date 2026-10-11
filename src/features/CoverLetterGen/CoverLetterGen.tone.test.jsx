// Changing the tone of a letter that already exists must not run the whole generation again (resume + job description + a 2 500-token
// answer). It rewrites only the letter, keeps each tone that was opened, never loses the user's edits, and refuses a rewrite that adds a figure.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({
  callLLM: vi.fn(),
  extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } },
}));
import { callLLM } from '../../lib/ai.jsx';
import CoverLetterGen from './CoverLetterGen';

const LETTER = 'Dear Hiring Manager,\n\n' + 'At Acme I cut checkout latency by forty percent and led a team of 4. '.repeat(3) + '\n\nSincerely,\nAnn Lee';
const REPLY = { roleTitle: 'Senior PM', company: 'Grab', subject: 'Application: Senior PM', coverLetter: LETTER, sellingPoints: ['Cut latency at Acme'], missingInfo: [] };
const CONFIDENT = LETTER.replace('At Acme I cut', 'At Acme I decisively cut');
const resumeText = { type: 'text', content: 'Product manager at Acme. UNIQUE-RESUME-MARKER. '.repeat(8), fileName: 'cv' };

const setup = (props = {}) => {
  const p = { resumeText, form: { role: '' }, memory: {}, user: { name: 'Ann' }, updateMemory: vi.fn(), setAuthModal: vi.fn(), setActiveModule: vi.fn(), ...props };
  render(<CoverLetterGen {...p} />);
  return p;
};
const generate = async () => {
  fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'Senior PM' } });
  fireEvent.change(screen.getByLabelText('Job description'), { target: { value: 'UNIQUE-JD-MARKER needs a PM.' } });
  fireEvent.click(screen.getByText(/Generate Cover Letter/));
  await screen.findByLabelText('Cover letter text');
};
const letterBox = () => screen.getByLabelText('Cover letter text');
const tone = (name) => fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(cleanup);

describe('changing the tone of an existing letter', () => {
  it('rewrites only the letter: one small request with no resume and no job description', async () => {
    callLLM.mockResolvedValueOnce(JSON.stringify(REPLY));
    setup(); await generate();
    callLLM.mockResolvedValueOnce(JSON.stringify({ coverLetter: CONFIDENT }));
    tone('Confident');
    await waitFor(() => expect(letterBox().value).toBe(CONFIDENT));
    expect(callLLM).toHaveBeenCalledTimes(2);
    const prompt = callLLM.mock.calls[1][0][0].content;
    expect(prompt).toContain('At Acme I cut checkout latency');
    expect(prompt).not.toMatch(/UNIQUE-RESUME-MARKER|UNIQUE-JD-MARKER/);
    expect(callLLM.mock.calls[1][1]).toBeLessThan(callLLM.mock.calls[0][1]); // a smaller answer limit than the full generation
  });

  it('switching back to a tone already opened costs nothing and shows that version', async () => {
    callLLM.mockResolvedValueOnce(JSON.stringify(REPLY));
    setup(); await generate();
    callLLM.mockResolvedValueOnce(JSON.stringify({ coverLetter: CONFIDENT }));
    tone('Confident');
    await waitFor(() => expect(letterBox().value).toBe(CONFIDENT));
    tone('Professional');
    expect(letterBox().value).toBe(LETTER);
    tone('Confident');
    expect(letterBox().value).toBe(CONFIDENT);
    expect(callLLM).toHaveBeenCalledTimes(2);
  });

  it('keeps the user\'s edits when they switch tone and come back', async () => {
    callLLM.mockResolvedValueOnce(JSON.stringify(REPLY));
    setup(); await generate();
    fireEvent.change(letterBox(), { target: { value: `${LETTER}\nP.S. My edit.` } });
    callLLM.mockResolvedValueOnce(JSON.stringify({ coverLetter: CONFIDENT }));
    tone('Confident');
    await waitFor(() => expect(letterBox().value).toBe(CONFIDENT));
    tone('Professional');
    expect(letterBox().value).toContain('P.S. My edit.');
  });

  it('refuses a rewrite that adds a figure that is not in the letter, and keeps the current letter', async () => {
    callLLM.mockResolvedValueOnce(JSON.stringify(REPLY));
    setup(); await generate();
    callLLM.mockResolvedValueOnce(JSON.stringify({ coverLetter: CONFIDENT.replace('a team of 4', 'a team of 40 and grew revenue by 300%') }));
    tone('Confident');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not in your letter/i));
    expect(letterBox().value).toBe(LETTER);
  });

  it('a failed rewrite leaves the letter as it was and says so', async () => {
    callLLM.mockResolvedValueOnce(JSON.stringify(REPLY));
    setup(); await generate();
    callLLM.mockRejectedValueOnce(new Error('The AI provider is busy.'));
    tone('Storytelling');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/busy/i));
    expect(letterBox().value).toBe(LETTER);
  });

  it('before a letter exists, choosing a tone only selects it (no request)', () => {
    setup();
    tone('Confident');
    expect(callLLM).not.toHaveBeenCalled();
  });
});

describe('what to do next', () => {
  it('shows no next steps before a letter exists', () => {
    setup();
    expect(screen.queryByText(/What next/i)).toBeNull();
  });

  it('after a letter, offers the next steps and each one opens the right tool', async () => {
    callLLM.mockResolvedValueOnce(JSON.stringify(REPLY));
    const p = setup(); await generate();
    expect(screen.getByText(/What next/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Practise the interview/i }));
    expect(p.setActiveModule).toHaveBeenCalledWith('simulate');
    fireEvent.click(screen.getByRole('button', { name: /Check your resume against this job/i }));
    expect(p.setActiveModule).toHaveBeenCalledWith('scan');
    fireEvent.click(screen.getByRole('button', { name: /Improve your resume/i }));
    expect(p.setActiveModule).toHaveBeenCalledWith('ats');
  });
});
