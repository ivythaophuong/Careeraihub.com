import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({
  callLLM: vi.fn(),
  extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } },
}));
vi.mock('../CoverLetterGen/coverLetter', () => ({ copyToClipboard: vi.fn().mockResolvedValue(true) }));
import { callLLM } from '../../lib/ai.jsx';
import { copyToClipboard } from '../CoverLetterGen/coverLetter';
import SalaryCoach from './SalaryCoach';

const SITUATION = 'I got an offer for 95000 base plus a 10% bonus. I have 6 years of experience and one competing interview.';
const REPLY = {
  assessment: 'You have room to negotiate because you have a competing process.',
  leverage: ['6 years of experience'],
  scripts: [
    { label: 'Opening response', when: 'When they call with the offer', text: 'Thank you so much for the offer. I am excited about the role and would like a day to review the details.' },
    { label: 'Counter on base', when: 'Next call', text: 'Based on my 6 years of experience, I was hoping for 115000 as a base. Could we get closer to [your target base]?' },
  ],
  nonSalaryLevers: ['Signing bonus'], questionsToAsk: ['How often are salaries reviewed?'],
  researchChecklist: ['Check a salary survey for your role, level and city'], pitfalls: ['Accepting on the spot'], ifTheySayNo: 'Decide if the whole package still works.',
};

const setup = (props = {}) => {
  const p = { resumeText: null, form: { role: '' }, memory: {}, setAuthModal: vi.fn(), ...props };
  render(<SalaryCoach {...p} />);
  return p;
};
const type = (name, value) => fireEvent.change(screen.getByLabelText(name), { target: { value } });
const go = () => fireEvent.click(screen.getByText(/Get Negotiation Strategy/));

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); copyToClipboard.mockResolvedValue(true); });
afterEach(cleanup);

describe('SalaryCoach', () => {
  it('shows no Preview banner and no market figures before the user acts', () => {
    setup();
    expect(screen.queryByText(/Preview/)).toBeNull();
    expect(screen.queryByText(/Market Min|Median|Market Max/i)).toBeNull();
  });

  it('asks for a situation before calling the AI', () => {
    setup();
    type('Situation', 'short');
    go();
    expect(screen.getByRole('alert').textContent).toMatch(/Describe your situation/);
    expect(callLLM).not.toHaveBeenCalled();
  });

  it('rejects an invalid amount without calling the AI', () => {
    setup();
    type('Situation', SITUATION); type('Offered base', 'lots');
    go();
    expect(screen.getByRole('alert').textContent).toMatch(/plain numbers/);
    expect(callLLM).not.toHaveBeenCalled();
  });

  it('shows live math from the user\'s own figures (no AI) and warns when the target is below the offer', () => {
    setup();
    expect(screen.queryByTestId('live-math')).toBeNull();
    type('Offered base', '95000'); type('Target base', '115000');
    expect(screen.getByTestId('live-math').textContent).toMatch(/\+21\.1%/);
    expect(screen.getByTestId('live-math').textContent).toMatch(/5–10% above your target/);
    type('Target base', '80000');
    expect(screen.getByTestId('live-math').textContent).toMatch(/target is below the offer/i);
    expect(callLLM).not.toHaveBeenCalled();
  });

  it('sends the situation, stage and figures, and renders the real strategy', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    setup();
    fireEvent.click(screen.getByText(/Mid-Negotiation/));
    type('Situation', SITUATION); type('Offered base', '95k'); type('Target base', '115000');
    go();
    await screen.findByText('Opening response');
    const prompt = callLLM.mock.calls[0][0][0].content;
    expect(prompt).toContain('Stage: Mid-Negotiation');
    expect(prompt).toContain(SITUATION);
    expect(prompt).toContain('Offered base (as entered): SGD 95000');
    expect(prompt).toContain('You do NOT have market salary data');
    expect(screen.getByText(/room to negotiate/)).toBeTruthy();
    expect(screen.getByText('• Signing bonus')).toBeTruthy();
    expect(screen.getByText('• Check a salary survey for your role, level and city')).toBeTruthy();
    expect(screen.getByText(/Decide if the whole package/)).toBeTruthy();
    expect(screen.queryByText(/Check these numbers/)).toBeNull(); // 95000, 115000, 10%, 6 all came from the user
  });

  it('works with no figures at all (situation only)', async () => {
    callLLM.mockResolvedValue(JSON.stringify({ ...REPLY, scripts: [REPLY.scripts[0]] }));
    setup();
    type('Situation', SITUATION); go();
    await screen.findByText('Opening response');
    expect(callLLM.mock.calls[0][0][0].content).toContain('No figures were entered.');
  });

  it('warns when the AI states market numbers the user never gave', async () => {
    callLLM.mockResolvedValue(JSON.stringify({ ...REPLY, assessment: 'The market median is $135,000, so your offer is 12% below it.' }));
    setup();
    type('Situation', SITUATION); go();
    const warn = await screen.findByText(/Check these numbers before you use anything below/);
    expect(warn.parentElement.textContent).toContain('$135,000');
    expect(warn.parentElement.textContent).toContain('12%');
    expect(warn.parentElement.textContent).toMatch(/not verified market data/);
  });

  it('lists [bracketed] placeholders the user must fill in', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    setup();
    type('Situation', SITUATION); go();
    await screen.findByText('Counter on base');
    expect(screen.getByText('To fill in: [your target base]')).toBeTruthy();
  });

  it('copies a script', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    setup();
    type('Situation', SITUATION); go();
    await screen.findByText('Opening response');
    fireEvent.click(screen.getAllByText('Copy')[0]);
    await screen.findByText('Copied ✓');
    expect(copyToClipboard).toHaveBeenCalledWith(REPLY.scripts[0].text);
  });

  it('uses the resume when there is one', async () => {
    callLLM.mockResolvedValue(JSON.stringify(REPLY));
    setup({ resumeText: { type: 'text', content: 'Senior engineer. '.repeat(10) } });
    type('Situation', SITUATION); go();
    await screen.findByText('Opening response');
    expect(callLLM.mock.calls[0][0][0].content).toContain('Senior engineer.');
  });

  it('shows an error when the reply is unusable', async () => {
    callLLM.mockResolvedValue('nope');
    setup();
    type('Situation', SITUATION); go();
    expect((await screen.findByRole('alert')).textContent).toMatch(/unreadable strategy/);
  });

  it('opens sign-up for guests (401)', async () => {
    callLLM.mockRejectedValue(Object.assign(new Error('Please sign in'), { status: 401 }));
    const p = setup();
    type('Situation', SITUATION); go();
    await waitFor(() => expect(p.setAuthModal).toHaveBeenCalledWith('register'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Create a free account/);
  });
});
