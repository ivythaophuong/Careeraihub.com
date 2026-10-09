import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({
  callLLM: vi.fn(),
  extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } },
}));
vi.mock('./coverLetter', async (orig) => ({ ...(await orig()), copyToClipboard: vi.fn().mockResolvedValue(true) }));
import { callLLM } from '../../lib/ai.jsx';
import { copyToClipboard } from './coverLetter';
import CoverLetterGen from './CoverLetterGen';

const LETTER = 'Dear Hiring Manager,\n\n' + 'At Acme I cut checkout latency by forty percent for millions of users. '.repeat(3) + '\n\nSincerely,\nAnn Lee';
const REPLY = { roleTitle: 'Senior PM', company: 'Grab', subject: 'Application — Senior PM', coverLetter: LETTER, sellingPoints: ['Cut latency 40% at Acme'], missingInfo: ['Add team size'] };
const resumeText = { type: 'text', content: 'Product manager at Acme. '.repeat(10), fileName: 'cv' };

const setup = (props = {}) => {
  const p = { resumeText, form: { role: '' }, memory: {}, user: { name: 'Ann' }, updateMemory: vi.fn(), setAuthModal: vi.fn(), setActiveModule: vi.fn(), ...props };
  render(<CoverLetterGen {...p} />);
  return p;
};
const role = (v) => fireEvent.change(screen.getByLabelText('Role'), { target: { value: v } });
const jd = (v) => fireEvent.change(screen.getByLabelText('Job description'), { target: { value: v } });
const generate = () => fireEvent.click(screen.getByText(/Generate Cover Letter/));

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); copyToClipboard.mockResolvedValue(true); });
afterEach(cleanup);

describe('CoverLetterGen', () => {
  it('has no Preview banner and no mock "Candidate" subject', () => {
    setup();
    expect(screen.queryByText(/Preview/)).toBeNull();
  });

  it('asks for a role or JD instead of calling the AI with nothing', () => {
    setup();
    generate();
    expect(screen.getByRole('alert').textContent).toMatch(/Enter the role/);
    expect(callLLM).not.toHaveBeenCalled();
  });

  it('generates from the role alone (JD is optional) and shows the real result', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    setup();
    role('Senior PM'); generate();
    await screen.findByText('Application — Senior PM');
    expect(screen.getByLabelText('Cover letter text').value).toBe(LETTER);
    expect(screen.getByText('• Add team size')).toBeTruthy();
    expect(screen.getByText('Cut latency 40% at Acme')).toBeTruthy();
    const prompt = callLLM.mock.calls[0][0][0].content;
    expect(prompt).toContain('No job description was provided. Write for the role "Senior PM"');
    expect(prompt).toContain('Product manager at Acme.');
    expect(prompt).toContain('Sign off with the name "Ann"');
  });

  it('uses the chosen tone and the JD in the prompt', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    setup();
    fireEvent.click(screen.getByText(/Ultra-Concise/));
    jd('We need a PM to run checkout at Grab.'); generate();
    await screen.findByText('Application — Senior PM');
    const prompt = callLLM.mock.calls[0][0][0].content;
    expect(prompt).toContain('Tone: Ultra-Concise');
    expect(prompt).toContain('We need a PM to run checkout at Grab.');
  });

  it('prefers the name from the structured resume', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    setup({ memory: { resumeData: { personalInfo: { fullName: 'Ann Lee' }, summary: 'PM with ten years in checkout and payments products.', skills: [{ category: 'PM', items: ['roadmaps', 'experiments'] }] } } });
    role('PM'); generate();
    await screen.findByText('Application — Senior PM');
    expect(callLLM.mock.calls[0][0][0].content).toContain('Sign off with the name "Ann Lee"');
  });

  it('saves the generated letter to history, newest first, capped at 20', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    const p = setup();
    role('PM'); generate();
    await screen.findByText('Application — Senior PM');
    const next = p.updateMemory.mock.calls[0][0]({ coverLetters: Array.from({ length: 25 }, (_, i) => ({ roleTitle: `old${i}` })) });
    expect(next.coverLetters).toHaveLength(20);
    expect(next.coverLetters[0]).toMatchObject({ roleTitle: 'Senior PM', company: 'Grab', tone: 'professional', coverLetter: LETTER });
    expect(next.coverLetters[1].roleTitle).toBe('old0');
    expect(Object.keys(next)).toEqual(['coverLetters']);
  });

  it('writes a cover_letters row with the generated letter (hotfix persistence)', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    const p = setup();
    role('PM'); generate();
    await screen.findByText('Application — Senior PM');
    expect(p.updateMemory.mock.calls[0][1]).toEqual({
      table: 'cover_letters',
      data: { company: 'Grab', tone: 'professional', subject: 'Application — Senior PM', content: LETTER },
    });
  });

  it('uses the company the user typed when the AI cannot find one, and tells the model about it', async () => {
    callLLM.mockResolvedValue(JSON.stringify({ ...REPLY, company: 'Not stated' }));
    const p = setup();
    role('PM');
    fireEvent.change(screen.getByLabelText('Target company'), { target: { value: 'Stripe' } });
    generate();
    await screen.findByText('Application — Senior PM');
    expect(callLLM.mock.calls[0][0][0].content).toContain('the target company is "Stripe"');
    expect(p.updateMemory.mock.calls[0][1].data.company).toBe('Stripe');
  });

  it('downloads the edited letter as a text file', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    setup();
    role('PM'); generate();
    await screen.findByText('Application — Senior PM');
    fireEvent.change(screen.getByLabelText('Cover letter text'), { target: { value: 'edited letter body' } });
    fireEvent.click(screen.getByText('Download'));
    expect(click).toHaveBeenCalled();
    const blob = URL.createObjectURL.mock.calls[0][0];
    expect(await blob.text()).toBe('edited letter body');
    click.mockRestore();
  });

  it('lets the user edit the letter and copies the edited text', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    setup();
    role('PM'); generate();
    await screen.findByText('Application — Senior PM');
    fireEvent.change(screen.getByLabelText('Cover letter text'), { target: { value: 'My edited letter' } });
    fireEvent.click(screen.getByText('Copy Text'));
    await screen.findByText('Copied ✓');
    expect(copyToClipboard).toHaveBeenCalledWith('My edited letter');
  });

  it('copies the subject and reports a copy failure', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    setup();
    role('PM'); generate();
    await screen.findByText('Application — Senior PM');
    fireEvent.click(screen.getByText('Copy Subject'));
    await screen.findByText('Copied ✓');
    expect(copyToClipboard).toHaveBeenCalledWith('Application — Senior PM');
    copyToClipboard.mockResolvedValue(false);
    fireEvent.click(screen.getByText('Copy Text'));
    await screen.findByText(/Copy failed/);
  });

  it('blocks generation without a resume and does not call the AI', () => {
    setup({ resumeText: null, memory: {} });
    expect(screen.getByRole('note').textContent).toMatch(/Add your resume first/);
    expect(screen.getByText(/Generate Cover Letter/).closest('button').disabled).toBe(true);
    fireEvent.click(screen.getByText('Go to Resume Scan'));
  });

  it('explains a lost PDF and offers Resume Scan', () => {
    const p = setup({ resumeText: { type: 'pdf', content: null }, memory: {} });
    expect(screen.getByRole('note').textContent).toMatch(/PDF resume is not available/);
    fireEvent.click(screen.getByText('Go to Resume Scan'));
    expect(p.setActiveModule).toHaveBeenCalledWith('scan');
  });

  it('can use the session PDF as the resume', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    setup({ resumeText: { type: 'pdf', content: null }, memory: { scanPdfBase64: 'PDFDATA' } });
    role('PM'); generate();
    await screen.findByText('Application — Senior PM');
    expect(callLLM.mock.calls[0][2]).toBe('PDFDATA');
  });

  it('shows an error and saves nothing when the reply is unusable', async () => {
    callLLM.mockResolvedValue('Sorry, no.');
    const p = setup();
    role('PM'); generate();
    expect((await screen.findByRole('alert')).textContent).toMatch(/unreadable letter/);
    expect(p.updateMemory).not.toHaveBeenCalled();
  });

  it('opens sign-up for guests (401)', async () => {
    callLLM.mockRejectedValue(Object.assign(new Error('Please sign in'), { status: 401 }));
    const p = setup();
    role('PM'); generate();
    await waitFor(() => expect(p.setAuthModal).toHaveBeenCalledWith('register'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Create a free account/);
  });
});
