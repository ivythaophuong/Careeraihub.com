// @vitest-environment jsdom
// Fix in Builder puts the user where the work is: the right step, the suggestion next to the box it is for, and that part of the resume lit up.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

vi.mock('../../lib/ai', () => ({ callLLM: vi.fn() }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));
import ATSBuilder from './ATSBuilder';

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

const GOOD = 'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%\n\nEducation\nBSc Business 2018\n\nSkills\nSQL, Excel\n';
const SUMMARY_ISSUE = { severity: 'high', title: 'Missing professional summary', description: 'The resume lacks a short summary at the top.', before: '', after: 'Seasoned analyst with 7+ years delivering insights from 6 managers\' reports', builderStep: 2, module: null };
const profile = (over = {}) => ({
  name: 'Jane Example', email: 'jane@example.com', skills: ['SQL'], education: [], summary: '',
  workExperience: [{ title: 'Analyst', company: 'Acme', period: '2021 - 2023', bullets: ['Handled monthly reporting', 'Built a dashboard for 6 managers'] }],
  issues: [SUMMARY_ISSUE], ...over,
});
const props = (p = profile()) => ({ user: { id: 'u1', token: 't' }, memory: { parseProfile: p }, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn(), resumeText: GOOD });
const openFix = (p) => { render(<ATSBuilder {...props(p)} />); fireEvent.click(screen.getByText(/Fix in Builder/)); };
const note = () => screen.getByRole('note', { name: /fixing/i });
const summaryBox = () => screen.getByRole('textbox', { name: /professional summary/i });

describe('Fix in Builder puts the user in the right step', () => {
  it('a summary issue opens the Summary step, although the AI said step 2', () => {
    openFix();
    expect(screen.getByText(/Step 5 of 6/)).toBeTruthy();
    expect(screen.queryByText(/Step 2 of 6/)).toBeNull();
  });
});

describe('the suggestion sits next to the box it is for', () => {
  it('the card is in the step, above the summary box, and not pinned above the step title', () => {
    openFix();
    const card = note();
    const box = summaryBox();
    expect(card.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const stepTitle = screen.getByText(/Step 5 of 6/);
    expect(stepTitle.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();   // after the step title, in the step
  });

  it('shows the suggestion as it would be put in the box: a figure the resume lacks is [X], and it says which', () => {
    openFix();
    const draft = note().querySelector('[data-quote="after"]');
    expect(draft.textContent).toContain('[X]');
    expect(draft.textContent).not.toContain('7+');
    expect(within(note()).getByText(/not in your resume/i).textContent).toMatch(/7/);
  });

  it('Use suggestion puts the text in the summary box and in the resume preview; nothing else changes', () => {
    openFix();
    fireEvent.click(within(note()).getByRole('button', { name: /use suggestion/i }));
    expect(summaryBox().value).toContain('Seasoned analyst');
    expect(summaryBox().value).toContain('[X]');
    expect(document.querySelector('[data-fix-at="summary"]').textContent).toContain('Seasoned analyst');
  });

  it('with a summary already written it asks before replacing it', () => {
    openFix(profile({ summary: 'Analyst who builds weekly reports.' }));
    fireEvent.click(within(note()).getByRole('button', { name: /use suggestion/i }));
    expect(summaryBox().value).toBe('Analyst who builds weekly reports.');
    expect(screen.getByText(/replace your summary/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Replace$/ }));
    expect(summaryBox().value).toContain('Seasoned analyst');
  });

  it('on another step the card shrinks to one line that leads back', () => {
    openFix();
    fireEvent.click(screen.getByText('← Back'));
    expect(screen.queryByRole('note', { name: /fixing/i })).toBeNull();
    const line = screen.getByText(/Fixing: Missing professional summary/);
    expect(within(line.closest('[data-fixing-pointer]')).getByRole('button', { name: /go to summary/i })).toBeTruthy();
  });

  it('a suggestion for another step offers no Use suggestion button: it is only shown', () => {
    openFix(profile({ issues: [{ ...SUMMARY_ISSUE, title: 'Needs a closer look', description: 'Please review.', before: '', builderStep: 4, after: 'SQL, Excel' }   /* no section named, so the AI step decides: the step form (an issue about skills opens the Skills card) */] }));
    expect(screen.getByText(/Step 4 of 6/)).toBeTruthy();
    expect(within(note()).queryByRole('button', { name: /use suggestion/i })).toBeNull();
  });
});

describe('the resume lights up the part being worked on', () => {
  it('on the Summary step the summary in the preview is marked', () => {
    openFix(profile({ summary: 'Analyst who builds weekly reports.' }));
    const el = document.querySelector('[data-fix-at="summary"]');
    expect(el.hasAttribute('data-fix-marked')).toBe(true);
  });

  it('on another step nothing in the preview is marked', () => {
    openFix(profile({ summary: 'Analyst who builds weekly reports.' }));
    fireEvent.click(screen.getByText('← Back'));
    expect(document.querySelector('[data-fix-marked]')).toBeNull();
  });
});

describe('the reminder card is short and says what it is', () => {
  const JUNK = { ...SUMMARY_ISSUE, before: 'JANE EXAMPLE, CFA ... WORKING EXPERIENCE' };

  it('does not show a quote that is not in the resume as "In your resume"', () => {
    openFix(profile({ issues: [JUNK] }));
    expect(within(note()).queryByText(/^In your resume$/i)).toBeNull();
    expect(note().querySelector('[data-quote="before"]')).toBeNull();
  });

  it('folds the explanation behind "Why this matters" until it is asked for', () => {
    openFix();
    expect(within(note()).queryByText(SUMMARY_ISSUE.description)).toBeNull();
    fireEvent.click(within(note()).getByRole('button', { name: /why this matters/i }));
    expect(within(note()).getByText(SUMMARY_ISSUE.description)).toBeTruthy();
  });

  it('names the suggestion as an AI suggestion in a small badge, and keeps the warning to check every figure', () => {
    openFix();
    const badge = note().querySelector('[data-badge="ai"]');
    expect(badge.textContent).toMatch(/AI suggestion/i);
    expect(note().textContent).toMatch(/check every figure is true/i);
  });

  it('the summary box is the main thing: tall, with its hint above it', () => {
    openFix();
    const box = summaryBox();
    expect(parseInt(box.style.minHeight, 10)).toBeGreaterThanOrEqual(180);
    const hint = screen.getByText(/2-3 sentences/i);
    expect(hint.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the figures that are not in the resume are named under the suggestion, apart from it', () => {
    openFix();
    const draft = note().querySelector('[data-quote="after"]');
    const warn = within(note()).getByText(/not in your resume/i);
    expect(draft.contains(warn)).toBe(false);
  });
});
