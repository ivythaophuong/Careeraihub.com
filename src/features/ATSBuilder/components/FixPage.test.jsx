// @vitest-environment jsdom
// The Fix page: one issue at a time, the resume as the main element, the place to fix marked, a card with the reason, the AI draft and an edit box,
// and a preview of the typed text before it is saved. See docs/architecture/plans/DESIGN-fix-page-flow.md.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import FixPage from './FixPage.jsx';
import { TEMPLATES } from '../resumeTemplates.jsx';

afterEach(cleanup);
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});

const makeData = () => ({
  contact: { name: 'Jordan Lee', email: 'jordan.lee@example.com', phone: '', linkedin: '', location: 'Singapore' },
  summary: 'Analyst who builds weekly reports.',
  experience: [
    { id: 1, company: 'Acme', title: 'Analyst', period: '2021 - 2023', bullets: ['Handled monthly reporting for the sales team', 'Built a dashboard for 6 managers', 'Trained two new hires'] },
    { id: 2, company: '', title: 'Intern', period: '2020', bullets: ['Filed paperwork'] },
    { id: 3, company: 'Beta', title: 'Lead', period: '2023 - now', bullets: ['Trained two new hires'] },
  ],
  education: [], skills: ['SQL'], awards: [], extras: [],
});
const ISSUES = [
  { severity: 'high', title: 'No metrics in bullets', description: 'Add numbers to your bullets.', before: 'Handled monthly reporting', after: 'Cut monthly reporting time by 30%', builderStep: 2, module: null },
  { severity: 'medium', title: 'Plain dashboard bullet', description: 'Say what the dashboard changed.', before: 'Built a dashboard', after: 'Built a dashboard that the managers used each week', builderStep: 2, module: null },
  { severity: 'medium', title: 'Skills look thin', description: 'Add more skills.', before: '', after: '', builderStep: 4, module: null },
];
const TEMPLATE = { id: TEMPLATES[0].id, label: TEMPLATES[0].label, component: TEMPLATES[0].component };

function setup(over = {}) {
  const props = {
    data: makeData(), issues: ISSUES, startKey: null, records: {},
    onChange: vi.fn(), onBackToList: vi.fn(), onOpenBuilder: vi.fn(), onOpenModule: vi.fn(), template: TEMPLATE,
    ...over,
  };
  const utils = render(<FixPage {...props} />);
  return { ...utils, props };
}
const editBox = () => screen.getByRole('textbox', { name: /your text/i });
const keyOfIssue = (i) => `${i}:${ISSUES[i].title}:${ISSUES[i].before}`;

describe('the page and the issue in it', () => {
  it('opens on the first issue that is not applied and says where it is in the list, counting only the issues that can be fixed here', () => {
    setup();
    expect(screen.getByText(/Issue 1 of 2/)).toBeTruthy();   // the third issue has no quoted text, so it is not on this page
    expect(screen.getByText('No metrics in bullets')).toBeTruthy();
  });

  it('opens on the issue the user came from', () => {
    setup({ startKey: keyOfIssue(1) });
    expect(screen.getByText(/Issue 2 of 2/)).toBeTruthy();
    expect(screen.getByText('Plain dashboard bullet')).toBeTruthy();
  });

  it('gives the reason as the issue says it, and the priority', () => {
    setup();
    expect(screen.getByText('Add numbers to your bullets.')).toBeTruthy();
    expect(screen.getByText(/high/i)).toBeTruthy();
  });

  it('the edit box starts with the user\'s own text of that bullet, not the AI draft', () => {
    setup();
    expect(editBox().value).toBe('Handled monthly reporting for the sales team');
  });

  it('shows the resume with the template name and no template selector', () => {
    setup();
    expect(screen.getByText(/Jordan Lee/)).toBeTruthy();
    expect(screen.getByText(new RegExp(`Template: ${TEMPLATE.label}`))).toBeTruthy();
    for (const t of TEMPLATES.slice(1)) expect(screen.queryByRole('button', { name: t.label })).toBeNull();
  });

  it('marks the place to fix in the resume and scrolls it into view', () => {
    const { container } = setup();
    const marked = container.querySelectorAll('[data-fix-marked]');
    expect(marked).toHaveLength(1);
    expect(marked[0].getAttribute('data-fix-at')).toBe('b:0:0');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByText(/the marked passage/i)).toBeTruthy();   // the card says what the mark is, so it does not depend on colour
  });
});

describe('the AI draft', () => {
  it('is labelled as an AI draft', () => {
    setup();
    expect(screen.getByRole('region', { name: /AI draft/i })).toBeTruthy();
  });

  it('a figure the resume does not contain is shown as [X] with a note, never as the AI wrote it', () => {
    setup();
    const draft = screen.getByRole('region', { name: /AI draft/i });
    expect(draft.textContent).toContain('[X]');
    expect(draft.textContent).not.toContain('30%');
    expect(screen.getByText(/not in your resume/i).textContent).toMatch(/30%/);
  });

  it('a draft with no new figure has no figure note', () => {
    setup({ startKey: keyOfIssue(1) });
    expect(screen.queryByText(/not in your resume/i)).toBeNull();
  });

  it('Use suggestion puts the draft in the edit box and saves nothing', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Use suggestion/i }));
    expect(editBox().value).toContain('[X]');
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('Use suggestion asks before it replaces text the user typed', () => {
    setup();
    fireEvent.change(editBox(), { target: { value: 'My own words' } });
    fireEvent.click(screen.getByRole('button', { name: /Use suggestion/i }));
    expect(screen.getByText(/Replace what you typed/i)).toBeTruthy();
    expect(editBox().value).toBe('My own words');
    fireEvent.click(screen.getByRole('button', { name: /^Replace$/i }));
    expect(editBox().value).toContain('[X]');
  });

  it('with no draft the draft block is not shown and the edit box stays', () => {
    const issues = [{ ...ISSUES[0], after: '' }];
    setup({ issues });
    expect(screen.queryByRole('region', { name: /AI draft/i })).toBeNull();
    expect(editBox()).toBeTruthy();
  });

  it('a claim warning is shown and the button carries the confirmation wording', () => {
    const data = makeData(); data.experience[0].bullets[0] = 'Assisted with weekly reports';
    const issues = [{ severity: 'high', title: 'Weak verb', description: 'Use a stronger verb.', before: 'Assisted with weekly reports', after: 'Led weekly reports company-wide', builderStep: 2, module: null }];
    setup({ data, issues });
    expect(screen.getByRole('button', { name: /I confirm this is true/i })).toBeTruthy();
  });
});

describe('the preview of the typed text', () => {
  it('shows what the user types in the marked place before it is saved, and says it is not saved', () => {
    const { container, props } = setup();
    fireEvent.change(editBox(), { target: { value: 'Cut monthly reporting time for the sales team' } });
    expect(container.querySelector('[data-fix-at="b:0:0"]').textContent).toContain('Cut monthly reporting time');
    expect(screen.getByText(/Preview of your change, not saved/i)).toBeTruthy();
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('says nothing about a preview while the text is unchanged', () => {
    setup();
    expect(screen.queryByText(/Preview of your change/i)).toBeNull();
  });
});

describe('Save & next', () => {
  it('saves only that field, tells the page that holds the data, and moves to the next issue', () => {
    const { props } = setup();
    fireEvent.change(editBox(), { target: { value: 'Cut monthly reporting time for the sales team' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & next/i }));
    expect(props.onChange).toHaveBeenCalledTimes(1);
    const [data, key, entry] = props.onChange.mock.calls[0];
    const expected = makeData(); expected.experience[0].bullets[0] = 'Cut monthly reporting time for the sales team';
    expect(data).toEqual(expected);
    expect(key).toBe(keyOfIssue(0));
    expect(entry.record.at).toEqual({ kind: 'bullet', exp: 0, bullet: 0 });
    expect(screen.getByText(/Issue 2 of 2/)).toBeTruthy();
    expect(editBox().value).toBe('Built a dashboard for 6 managers');
  });

  it('refuses an empty text: nothing is saved and it says why', () => {
    const { props } = setup();
    fireEvent.change(editBox(), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & next/i }));
    expect(props.onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Write the text first/i)).toBeTruthy();
    expect(screen.getByText(/Issue 1 of 2/)).toBeTruthy();
  });

  it('a [X] left in the text is saved but the issue stays open, and the page says so', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Use suggestion/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save & next/i }));
    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange.mock.calls[0][2].placeholders).toBe(true);
    // the second issue is saved without a blank, so the summary shows one applied and one still open
    fireEvent.change(editBox(), { target: { value: 'Built a dashboard that the managers used each week' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & next/i }));
    expect(screen.getByText(/1 applied/i)).toBeTruthy();
    expect(screen.getByText(/1 open/i)).toBeTruthy();
  });
});

describe('Skip, the end and the way out', () => {
  it('Skip moves on and saves nothing; skipping the last issue shows the summary', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Skip/i }));
    expect(screen.getByText(/Issue 2 of 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Skip/i }));
    expect(props.onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/2 open/i)).toBeTruthy();
  });

  it('the summary counts what is, and never says everything is fixed', () => {
    setup();
    fireEvent.change(editBox(), { target: { value: 'Cut monthly reporting time for the sales team' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Skip/i }));
    expect(screen.getByText(/1 applied/i)).toBeTruthy();
    expect(screen.getByText(/1 open/i)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/fixed all|all fixed|all issues are fixed|resolved|optimi[sz]ed/i);
  });

  it('the summary says how many issues are not covered here and where they are', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Skip/i }));
    fireEvent.click(screen.getByRole('button', { name: /Skip/i }));
    expect(screen.getByText(/1 other issue/i)).toBeTruthy();
  });

  it('Open the Builder and Back to list from the summary', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Skip/i }));
    fireEvent.click(screen.getByRole('button', { name: /Skip/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open the Builder/i }));
    expect(props.onOpenBuilder).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Back to list/i }));
    expect(props.onBackToList).toHaveBeenCalled();
  });

  it('Back to list with nothing typed leaves at once', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Back to list/i }));
    expect(props.onBackToList).toHaveBeenCalled();
  });

  it('Back to list with an unsaved change asks first, and Stay keeps the text', () => {
    const { props } = setup();
    fireEvent.change(editBox(), { target: { value: 'Half written' } });
    fireEvent.click(screen.getByRole('button', { name: /Back to list/i }));
    expect(props.onBackToList).not.toHaveBeenCalled();
    expect(screen.getByText(/Leave without saving/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Stay$/i }));
    expect(editBox().value).toBe('Half written');
    fireEvent.click(screen.getByRole('button', { name: /Back to list/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Leave$/i }));
    expect(props.onBackToList).toHaveBeenCalled();
  });

  it('there is one primary action: Save & next', () => {
    setup();
    expect(screen.getAllByRole('button', { name: /Save & next/i })).toHaveLength(1);
  });
});

describe('edge states', () => {
  it('the same text in several places: the user chooses first, nothing is marked or saved until then', () => {
    const issues = [{ severity: 'high', title: 'Plain verb', description: 'Say more.', before: 'Trained two new hires', after: 'Coached two new hires', builderStep: 2, module: null }];
    const { container, props } = setup({ issues });
    expect(screen.getByText(/2 places/i)).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /your text/i })).toBeNull();
    expect(container.querySelectorAll('[data-fix-marked]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /Beta/ }));
    expect(editBox().value).toBe('Trained two new hires');
    expect(container.querySelector('[data-fix-marked]').getAttribute('data-fix-at')).toBe('b:2:0');
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('a bullet that the preview does not draw says so and can still be edited', () => {
    const issues = [{ severity: 'low', title: 'Odd line', description: 'x', before: 'Filed paperwork', after: '', builderStep: 2, module: null }];
    const { container } = setup({ issues });
    expect(screen.getByText(/does not show it/i)).toBeTruthy();
    expect(container.querySelectorAll('[data-fix-marked]')).toHaveLength(0);
    expect(editBox().value).toBe('Filed paperwork');
  });

  it('with no issue that can be fixed here it goes straight to the summary and says so', () => {
    setup({ issues: [ISSUES[2]] });
    expect(screen.getByText(/0 applied/i)).toBeTruthy();
    expect(screen.getByText(/1 other issue/i)).toBeTruthy();
  });

  it('an issue already applied is counted as applied in the summary', () => {
    const data = makeData(); data.experience[0].bullets[0] = 'Cut monthly reporting time for the sales team';
    const record = { at: { kind: 'bullet', exp: 0, bullet: 0 }, inserted: 'Cut monthly reporting time for the sales team', original: 'Handled monthly reporting for the sales team' };
    setup({ data, records: { [keyOfIssue(0)]: { record, placeholders: false, warnings: [] } } });
    // the first issue is applied, so the page opens on the second one
    expect(screen.getByText('Plain dashboard bullet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Skip/i }));
    expect(screen.getByText(/1 applied/i)).toBeTruthy();
  });
});

describe('a narrow screen', () => {
  it('has two tabs, Resume and Fix, so the resume is never under a long form', () => {
    setup();
    // the tabs are hidden by CSS on a wide screen and shown below 768px, so the test looks at hidden elements too
    const tabs = screen.getByRole('tablist', { hidden: true });
    const [resumeTab, fixTab] = within(tabs).getAllByRole('tab', { hidden: true });
    expect(resumeTab.textContent).toMatch(/Resume/);
    expect(fixTab.textContent).toMatch(/Fix/);
    expect(fixTab.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(resumeTab);
    expect(resumeTab.getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('[data-pane="resume"]').getAttribute('data-active')).toBe('true');
    expect(document.querySelector('[data-pane="fix"]').getAttribute('data-active')).toBe('false');
  });
});
