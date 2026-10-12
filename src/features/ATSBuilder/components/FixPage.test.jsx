// @vitest-environment jsdom
// The Fix page: one issue at a time, and one thing at a time inside it. First a few lines around the sentence and two choices; the edit box, the AI
// draft and the whole resume appear only when asked for. See docs/architecture/plans/DESIGN-fix-page-flow.md.
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
    onChange: vi.fn(), onBackToList: vi.fn(), onOpenBuilder: vi.fn(), template: TEMPLATE,
    ...over,
  };
  const utils = render(<FixPage {...props} />);
  return { ...utils, props };
}
const improve = () => fireEvent.click(screen.getByRole('button', { name: /Improve this sentence/i }));
const editBox = () => screen.getByRole('textbox', { name: /your text/i });
const btn = (name) => screen.getByRole('button', { name });
const keyOfIssue = (i) => `${i}:${ISSUES[i].title}:${ISSUES[i].before}`;

describe('the first screen of an issue: a few lines and two choices', () => {
  it('opens on the first issue that is not applied, counting only the issues that can be fixed here', () => {
    setup();
    expect(screen.getByText(/Issue 1 of 2/)).toBeTruthy();   // the third issue has no quoted text, so it is not on this page
    expect(screen.getByText('No metrics in bullets')).toBeTruthy();
  });

  it('opens on the issue the user came from', () => {
    setup({ startKey: keyOfIssue(1) });
    expect(screen.getByText(/Issue 2 of 2/)).toBeTruthy();
    expect(screen.getByText('Plain dashboard bullet')).toBeTruthy();
  });

  it('shows the priority', () => {
    setup();
    expect(screen.getByText(/High/)).toBeTruthy();
  });

  it('shows the job, the sentence to fix, and the sentence next to it, and not the whole resume', () => {
    setup();
    expect(screen.getByText('Acme · Analyst · 2021 - 2023')).toBeTruthy();
    expect(screen.getByText('Handled monthly reporting for the sales team')).toBeTruthy();
    expect(screen.getByText('Built a dashboard for 6 managers')).toBeTruthy();
    expect(screen.queryByText('Trained two new hires')).toBeNull();      // two lines away, so not in the excerpt
    expect(screen.queryByText(/Analyst who builds weekly reports/)).toBeNull();
    expect(screen.queryByText(/jordan.lee@example.com/)).toBeNull();
  });

  it('says which line is to be fixed in words, not only by colour', () => {
    const { container } = setup();
    const target = container.querySelector('[data-fix-target]');
    expect(target.textContent).toContain('Handled monthly reporting for the sales team');
    expect(within(target).getByText(/Fix this sentence/i)).toBeTruthy();
  });

  it('the reason is folded away until it is asked for', () => {
    setup();
    expect(screen.queryByText('Add numbers to your bullets.')).toBeNull();
    fireEvent.click(btn(/Why\?/));
    expect(screen.getByText('Add numbers to your bullets.')).toBeTruthy();
  });

  it('offers two choices and nothing else to decide: improve it, or leave it', () => {
    setup();
    expect(btn(/Improve this sentence/i)).toBeTruthy();
    expect(btn(/Leave it for now/i)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('region', { name: /AI draft/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Save & next/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Skip$/i })).toBeNull();     // one way to leave an issue, not two
  });

  it('has one primary action on this screen', () => {
    setup();
    expect(screen.getAllByRole('button', { name: /Improve this sentence/i })).toHaveLength(1);
  });

  it('has no template selector', () => {
    setup();
    for (const t of TEMPLATES) expect(screen.queryByRole('button', { name: t.label })).toBeNull();
  });
});

describe('Improve this sentence: the edit box takes the place of the sentence', () => {
  it('shows the edit box in the excerpt, filled with the user\'s own text and not the AI draft', () => {
    const { container } = setup();
    improve();
    expect(editBox().value).toBe('Handled monthly reporting for the sales team');
    expect(editBox().closest('[data-excerpt]')).toBeTruthy();
    expect(container.querySelector('[data-excerpt]').textContent).toContain('Built a dashboard for 6 managers');
  });

  it('the AI draft is folded away, and a warning on the fold says when it has figures the resume does not', () => {
    setup();
    improve();
    expect(screen.queryByRole('region', { name: /AI draft/i })).toBeNull();
    expect(btn(/Show AI draft/i).textContent).toMatch(/figures not in your resume/i);
  });

  it('no warning on the fold when the draft has no new figure', () => {
    setup({ startKey: keyOfIssue(1) });
    improve();
    expect(btn(/Show AI draft/i).textContent).not.toMatch(/figures not in your resume/i);
  });

  it('with no draft there is no fold and the edit box stays', () => {
    setup({ issues: [{ ...ISSUES[0], after: '' }] });
    improve();
    expect(screen.queryByRole('button', { name: /AI draft/i })).toBeNull();
    expect(editBox()).toBeTruthy();
  });

  it('shows what the user types as they type it, and says it is not saved', () => {
    const { props } = setup();
    improve();
    expect(screen.queryByText(/not saved yet/i)).toBeNull();
    fireEvent.change(editBox(), { target: { value: 'Cut monthly reporting time for the sales team' } });
    expect(screen.getByText(/not saved yet/i)).toBeTruthy();
    expect(props.onChange).not.toHaveBeenCalled();
  });
});

describe('the AI draft, once asked for', () => {
  const openDraft = () => { improve(); fireEvent.click(btn(/Show AI draft/i)); };

  it('is labelled as an AI draft', () => {
    setup();
    openDraft();
    expect(screen.getByRole('region', { name: /AI draft/i })).toBeTruthy();
  });

  it('a figure the resume does not contain is shown as [X] with a note, never as the AI wrote it', () => {
    setup();
    openDraft();
    const draft = screen.getByRole('region', { name: /AI draft/i });
    expect(draft.textContent).toContain('[X]');
    expect(draft.textContent).not.toContain('30%');
    expect(screen.getByText(/These figures are not in your resume: .*The draft shows/i).textContent).toMatch(/30%/);
  });

  it('can be folded again', () => {
    setup();
    openDraft();
    fireEvent.click(btn(/Hide AI draft/i));
    expect(screen.queryByRole('region', { name: /AI draft/i })).toBeNull();
  });

  it('Use suggestion puts the draft in the edit box and saves nothing', () => {
    const { props } = setup();
    openDraft();
    fireEvent.click(btn(/Use suggestion/i));
    expect(editBox().value).toContain('[X]');
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('Use suggestion asks before it replaces text the user typed', () => {
    setup();
    openDraft();
    fireEvent.change(editBox(), { target: { value: 'My own words' } });
    fireEvent.click(btn(/Use suggestion/i));
    expect(screen.getByText(/Replace what you typed/i)).toBeTruthy();
    expect(editBox().value).toBe('My own words');
    fireEvent.click(btn(/^Replace$/i));
    expect(editBox().value).toContain('[X]');
  });

  it('a claim warning is shown and the button carries the confirmation wording', () => {
    const data = makeData(); data.experience[0].bullets[0] = 'Assisted with weekly reports';
    setup({ data, issues: [{ severity: 'high', title: 'Weak verb', description: 'x', before: 'Assisted with weekly reports', after: 'Led weekly reports company-wide', builderStep: 2, module: null }] });
    openDraft();
    expect(btn(/I confirm this is true/i)).toBeTruthy();
  });
});

describe('Save & next', () => {
  it('saves only that field, tells the page that holds the data, and goes to the next issue\'s first screen', () => {
    const { props } = setup();
    improve();
    fireEvent.change(editBox(), { target: { value: 'Cut monthly reporting time for the sales team' } });
    fireEvent.click(btn(/Save & next/i));
    expect(props.onChange).toHaveBeenCalledTimes(1);
    const [data, key, entry] = props.onChange.mock.calls[0];
    const expected = makeData(); expected.experience[0].bullets[0] = 'Cut monthly reporting time for the sales team';
    expect(data).toEqual(expected);
    expect(key).toBe(keyOfIssue(0));
    expect(entry.record.at).toEqual({ kind: 'bullet', exp: 0, bullet: 0 });
    expect(screen.getByText(/Issue 2 of 2/)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();     // the next issue starts on its first screen
    expect(btn(/Improve this sentence/i)).toBeTruthy();
  });

  it('refuses an empty text: nothing is saved and it says why', () => {
    const { props } = setup();
    improve();
    fireEvent.change(editBox(), { target: { value: '   ' } });
    fireEvent.click(btn(/Save & next/i));
    expect(props.onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Write the text first/i)).toBeTruthy();
    expect(screen.getByText(/Issue 1 of 2/)).toBeTruthy();
  });

  it('a [X] left in the text is saved but the issue stays open', () => {
    const { props } = setup();
    improve();
    fireEvent.click(btn(/Show AI draft/i));
    fireEvent.click(btn(/Use suggestion/i));
    fireEvent.click(btn(/Save & next/i));
    expect(props.onChange.mock.calls[0][2].placeholders).toBe(true);
    improve();
    fireEvent.change(editBox(), { target: { value: 'Built a dashboard that the managers used each week' } });
    fireEvent.click(btn(/Save & next/i));
    expect(screen.getByText(/1 applied/i)).toBeTruthy();
    expect(screen.getByText(/1 open/i)).toBeTruthy();
  });
});

describe('leaving an issue, the end, and the way out', () => {
  it('Leave it for now moves on and saves nothing; leaving the last one shows the summary', () => {
    const { props } = setup();
    fireEvent.click(btn(/Leave it for now/i));
    expect(screen.getByText(/Issue 2 of 2/)).toBeTruthy();
    fireEvent.click(btn(/Leave it for now/i));
    expect(props.onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/2 open/i)).toBeTruthy();
  });

  it('the summary counts what is, and never says everything is fixed', () => {
    setup();
    improve();
    fireEvent.change(editBox(), { target: { value: 'Cut monthly reporting time for the sales team' } });
    fireEvent.click(btn(/Save & next/i));
    fireEvent.click(btn(/Leave it for now/i));
    expect(screen.getByText(/1 applied/i)).toBeTruthy();
    expect(screen.getByText(/1 open/i)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/fixed all|all fixed|all issues are fixed|resolved|optimi[sz]ed/i);
  });

  it('the summary says how many issues are not covered here', () => {
    setup();
    fireEvent.click(btn(/Leave it for now/i));
    fireEvent.click(btn(/Leave it for now/i));
    expect(screen.getByText(/1 other issue/i)).toBeTruthy();
  });

  it('Open the Builder and Back to list from the summary', () => {
    const { props } = setup();
    fireEvent.click(btn(/Leave it for now/i));
    fireEvent.click(btn(/Leave it for now/i));
    fireEvent.click(btn(/Open the Builder/i));
    expect(props.onOpenBuilder).toHaveBeenCalled();
    fireEvent.click(btn(/Back to list/i));
    expect(props.onBackToList).toHaveBeenCalled();
  });

  it('Back to list with nothing typed leaves at once', () => {
    const { props } = setup();
    fireEvent.click(btn(/Back to list/i));
    expect(props.onBackToList).toHaveBeenCalled();
  });

  it('Back to list with an unsaved change asks first, and Stay keeps the text', () => {
    const { props } = setup();
    improve();
    fireEvent.change(editBox(), { target: { value: 'Half written' } });
    fireEvent.click(btn(/Back to list/i));
    expect(props.onBackToList).not.toHaveBeenCalled();
    expect(screen.getByText(/Leave without saving/i)).toBeTruthy();
    fireEvent.click(btn(/^Stay$/i));
    expect(editBox().value).toBe('Half written');
    fireEvent.click(btn(/Back to list/i));
    fireEvent.click(btn(/^Leave$/i));
    expect(props.onBackToList).toHaveBeenCalled();
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
    expect(screen.getByText('Plain dashboard bullet')).toBeTruthy();   // opens on the one that is not applied
    fireEvent.click(btn(/Leave it for now/i));
    expect(screen.getByText(/1 applied/i)).toBeTruthy();
  });
});

describe('the whole resume, only when asked for', () => {
  it('is not on the page until View full resume is pressed', () => {
    setup();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/Template:/)).toBeNull();
  });

  it('opens the resume in the chosen template with the sentence marked and scrolled into view, and closes again', () => {
    const { container } = setup();
    fireEvent.click(btn(/View full resume/i));
    const dialog = screen.getByRole('dialog', { name: /your resume/i });
    expect(within(dialog).getByText(/Jordan Lee/)).toBeTruthy();
    expect(within(dialog).getByText(new RegExp(`Template: ${TEMPLATE.label}`))).toBeTruthy();
    const marked = container.querySelectorAll('[data-fix-marked]');
    expect(marked).toHaveLength(1);
    expect(marked[0].getAttribute('data-fix-at')).toBe('b:0:0');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: /Close/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the typed text in the marked place, not yet saved', () => {
    const { container, props } = setup();
    improve();
    fireEvent.change(editBox(), { target: { value: 'Cut monthly reporting time for the sales team' } });
    fireEvent.click(btn(/View full resume/i));
    expect(container.querySelector('[data-fix-at="b:0:0"]').textContent).toContain('Cut monthly reporting time');
    expect(props.onChange).not.toHaveBeenCalled();
  });
});

describe('edge states', () => {
  it('the same text in several places: the user chooses first, and no excerpt is shown until then', () => {
    const issues = [{ severity: 'high', title: 'Plain verb', description: 'Say more.', before: 'Trained two new hires', after: 'Coached two new hires', builderStep: 2, module: null }];
    const { props } = setup({ issues });
    expect(screen.getByText(/2 places/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Improve this sentence/i })).toBeNull();
    fireEvent.click(btn(/Beta/));
    expect(screen.getByText('Beta · Lead · 2023 - now')).toBeTruthy();
    improve();
    expect(editBox().value).toBe('Trained two new hires');
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('a bullet the full resume does not draw says so and can still be edited', () => {
    const issues = [{ severity: 'low', title: 'Odd line', description: 'x', before: 'Filed paperwork', after: '', builderStep: 2, module: null }];
    setup({ issues });
    expect(screen.getByText(/does not show it/i)).toBeTruthy();
    improve();
    expect(editBox().value).toBe('Filed paperwork');
  });

  it('a summary sentence is shown alone', () => {
    const issues = [{ severity: 'medium', title: 'Generic summary', description: 'x', before: 'builds weekly reports', after: 'builds weekly sales reports', builderStep: 5, module: null }];
    const { container } = setup({ issues });
    expect(container.querySelector('[data-excerpt]').textContent).toContain('Analyst who builds weekly reports.');
    expect(screen.queryByText(/Acme/)).toBeNull();
  });
});
