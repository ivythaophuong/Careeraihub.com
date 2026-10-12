// @vitest-environment jsdom
// Acceptance scenarios for the Builder's score and suggestion cards, through the real component (not the pieces alone).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../lib/ai', () => ({ callLLM: vi.fn() }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));
import ATSBuilder from './ATSBuilder';

const GOOD = 'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%\n\nEducation\nBSc Business 2018\n\nSkills\nSQL, Excel\n';
const profile = (issues) => ({
  name: 'Jane Example', email: 'jane@example.com', skills: ['SQL', 'Excel'],
  workExperience: [{ title: 'Manager', company: 'Acme', period: 'Jan 2021 - Mar 2024', bullets: ['Handled monthly reporting', 'Grew revenue by 20%', 'Responsible for vendor calls'] }],
  education: [{ degree: 'BSc Business', institution: 'State University', year: '2018' }],
  issues,
});
const ISSUES = [
  { severity: 'high', title: 'No metric in reporting bullet', description: 'Add a number.', before: 'Handled monthly reporting', after: 'Cut monthly reporting time by 20%', builderStep: 2 },
  { severity: 'medium', title: 'Invented figure', description: 'Be specific.', before: 'Responsible for vendor calls', after: 'Negotiated vendor contracts worth 45%', builderStep: 2 },
  { severity: 'high', title: 'Raises the role', description: 'Stronger verb.', before: 'Responsible for vendor calls', after: 'Led vendor strategy', builderStep: 2 },
  { severity: 'low', title: 'Quote not in resume', description: 'Nothing to apply.', before: 'text that is not there', after: 'x', builderStep: 1 },
];
const props = (issues = ISSUES) => ({ user: { id: 'u1', token: 't' }, memory: { parseProfile: profile(issues) }, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn(), resumeText: GOOD });

// the score and the suggestions are behind the Review button, so the helper opens it
const openBuilder = () => { fireEvent.click(screen.getByText(/Fix These Issues in Builder/)); fireEvent.click(screen.getByRole('button', { name: /^Review/ })); };
// The bullets are on step 2 (Experience).
const openExperience = () => { openBuilder(); fireEvent.click(screen.getByText('Next →')); expect(screen.getByText(/Step 2 of 6/)).toBeTruthy(); };
const card = (title) => screen.getByText(title).closest('[data-issue]');
const btn = (el, re) => Array.from(el.querySelectorAll('button')).find(b => re.test(b.textContent));
const score = () => Number(screen.getByTestId('builder-score').textContent);
const bulletTexts = () => Array.from(document.querySelectorAll('textarea')).map(t => t.value).join('\n');

beforeEach(() => {
  try { localStorage.clear(); } catch {}
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Builder suggestions, through the real component', () => {
  it('shows the code score for the draft, and it rises when a suggestion adds a figure the resume already had', async () => {
    render(<ATSBuilder {...props()} />);
    openBuilder();
    const before = score();
    fireEvent.click(btn(card('No metric in reporting bullet'), /^apply$/i));
    await waitFor(() => expect(score()).toBeGreaterThan(before));
  });

  it('Apply changes only the target bullet; the other bullets are untouched', () => {
    render(<ATSBuilder {...props()} />);
    openExperience();
    fireEvent.click(btn(card('No metric in reporting bullet'), /^apply$/i));
    const text = bulletTexts();
    expect(text).toContain('Cut monthly reporting time by 20%');
    expect(text).toContain('Grew revenue by 20%');
    expect(text).toContain('Responsible for vendor calls');
    expect(text).not.toContain('Handled monthly reporting');
  });

  it('the Apply button is not offered when the quote is not in the resume', () => {
    render(<ATSBuilder {...props()} />);
    openBuilder();
    expect(btn(card('Quote not in resume'), /apply/i)).toBeUndefined();
    expect(btn(card('Quote not in resume'), /go to (contact|experience|education|skills|summary)/i)).toBeTruthy();
  });

  it('an invented figure becomes [X] and is flagged; it is not shown as fact', () => {
    render(<ATSBuilder {...props()} />);
    openExperience();
    fireEvent.click(btn(card('Invented figure'), /^apply/i) || btn(card('Invented figure'), /apply/i));
    expect(bulletTexts()).toContain('worth [X]%');
    expect(card('Invented figure').textContent).toMatch(/replace \[X\]/i);
  });

  it('a suggestion that raises the role asks for confirmation first', () => {
    render(<ATSBuilder {...props()} />);
    openBuilder();
    expect(btn(card('Raises the role'), /^apply$/i)).toBeUndefined();
    expect(btn(card('Raises the role'), /i confirm this is true/i)).toBeTruthy();
  });

  it('moving to another step and back keeps the applied text, the status and the score', async () => {
    render(<ATSBuilder {...props()} />);
    openExperience();
    fireEvent.click(btn(card('No metric in reporting bullet'), /^apply$/i));
    const s = score();
    fireEvent.click(screen.getByText('Next →'));
    fireEvent.click(screen.getByText('← Back'));
    expect(screen.getByText(/Step 2 of 6/)).toBeTruthy();
    expect(card('No metric in reporting bullet').textContent).toMatch(/Applied/);
    expect(bulletTexts()).toContain('Cut monthly reporting time by 20%');
    await waitFor(() => expect(score()).toBe(s));
  });

  it('after a reload the draft, the Applied status and Undo are all still there, and Undo restores the original', () => {
    const first = render(<ATSBuilder {...props()} />);
    openExperience();
    fireEvent.click(btn(card('No metric in reporting bullet'), /^apply$/i));
    first.unmount();

    render(<ATSBuilder {...props()} />);
    openExperience();
    expect(bulletTexts()).toContain('Cut monthly reporting time by 20%');
    expect(card('No metric in reporting bullet').textContent).toMatch(/Applied/);
    fireEvent.click(btn(card('No metric in reporting bullet'), /undo/i));
    expect(bulletTexts()).toContain('Handled monthly reporting');
    expect(bulletTexts()).not.toContain('Cut monthly reporting time by 20%');
  });

  it('editing the applied bullet by hand: the card says so and Undo is not offered over the user\'s edit', () => {
    render(<ATSBuilder {...props()} />);
    openExperience();
    fireEvent.click(btn(card('No metric in reporting bullet'), /^apply$/i));
    const ta = Array.from(document.querySelectorAll('textarea')).find(t => t.value.includes('Cut monthly reporting time by 20%'));
    fireEvent.change(ta, { target: { value: ta.value.replace('Cut monthly reporting time by 20%', 'My own wording') } });
    expect(card('No metric in reporting bullet').textContent).toMatch(/applied, then edited/i);
    expect(btn(card('No metric in reporting bullet'), /undo/i)).toBeUndefined();
    expect(bulletTexts()).toContain('My own wording');
  });

  it('opening the Builder again with "Fix in Builder" does not wipe the user\'s edits or the applied suggestions', () => {
    render(<ATSBuilder {...props()} />);
    openExperience();
    fireEvent.click(btn(card('No metric in reporting bullet'), /^apply$/i));
    // back to the analysis screen, then into the Builder again from the same button
    fireEvent.click(screen.getByText('Upload & Parse'));
    fireEvent.click(screen.getByText(/Fix These Issues in Builder/));
    fireEvent.click(screen.getByText('Next →'));
    expect(bulletTexts()).toContain('Cut monthly reporting time by 20%');
    fireEvent.click(screen.getByRole('button', { name: /^Review/ }));   // a new visit to the Builder starts with Review closed
    expect(card('No metric in reporting bullet').textContent).toMatch(/Applied/);
  });

  describe('export with a blank left', () => {
    const applyInvented = () => { openExperience(); fireEvent.click(btn(card('Invented figure'), /apply/i)); };

    it('asks before the Word file is made when a [X] is still in the resume, and does not export if the user says no', async () => {
      const docx = await import('../../lib/docxExport.js');
      const make = vi.spyOn(docx, 'buildResumeDocx');
      const confirm = vi.fn(() => false); vi.stubGlobal('confirm', confirm);
      render(<ATSBuilder {...props()} />);
      applyInvented();
      fireEvent.click(screen.getAllByText(/Download Word/)[0]);
      await new Promise(r => setTimeout(r, 20));
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm.mock.calls[0][0]).toMatch(/\[X\]/);
      expect(make).not.toHaveBeenCalled();
      make.mockRestore();
    });

    it('does not ask when the resume has no blank', async () => {
      const confirm = vi.fn(() => true); vi.stubGlobal('confirm', confirm);
      render(<ATSBuilder {...props()} />);
      openExperience();
      fireEvent.click(screen.getAllByText(/Download Word/)[0]);
      await new Promise(r => setTimeout(r, 20));
      expect(confirm).not.toHaveBeenCalled();
    });
  });
});
