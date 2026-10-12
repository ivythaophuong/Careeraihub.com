// @vitest-environment jsdom
// The Fix page: your resume on the left with the sentences that can be improved, your new resume on the right, updated as you type, and one editor
// below them. Choosing a template is not part of this screen. See docs/architecture/plans/DESIGN-fix-page-flow.md.
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
    onChange: vi.fn(), onBackToList: vi.fn(), onOpenBuilder: vi.fn(), onChooseTemplate: vi.fn(), template: TEMPLATE,
    ...over,
  };
  const utils = render(<FixPage {...props} />);
  return { ...utils, props };
}
const left = () => screen.getByRole('region', { name: /^Your resume$/i });
const right = () => screen.getByRole('region', { name: /^Your new resume$/i });
const at = (pane, key) => pane.querySelector(`[data-fix-at="${key}"]`);
const improve = () => fireEvent.click(screen.getByRole('button', { name: /Improve this sentence/i }));
const editBox = () => screen.getByRole('textbox', { name: /your text/i });
const btn = (name) => screen.getByRole('button', { name });
const keyOfIssue = (i) => `${i}:${ISSUES[i].title}:${ISSUES[i].before}`;

describe('two resumes and one editor', () => {
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

  it('shows the whole resume twice: yours on the left, the new one on the right, both in the chosen template', () => {
    setup();
    for (const pane of [left(), right()]) {
      expect(within(pane).getByText(/Jordan Lee/)).toBeTruthy();
      expect(within(pane).getByText(/Analyst who builds weekly reports/)).toBeTruthy();
      expect(pane.querySelector(`[data-template="${TEMPLATE.id}"]`)).toBeTruthy();
    }
  });

  it('has no template selector and does not name the template: choosing one is another screen', () => {
    setup();
    for (const t of TEMPLATES) expect(screen.queryByRole('button', { name: t.label })).toBeNull();
    expect(screen.queryByText(/Template:/)).toBeNull();
  });

  it('on the left, marks the sentence being fixed and the other sentences that can be improved, and nothing else', () => {
    setup();
    expect(at(left(), 'b:0:0').hasAttribute('data-fix-marked')).toBe(true);
    expect(at(left(), 'b:0:1').hasAttribute('data-fix-open')).toBe(true);
    expect(at(left(), 'b:0:2').hasAttribute('data-fix-open')).toBe(false);
    expect(at(left(), 'b:0:2').hasAttribute('data-fix-marked')).toBe(false);
    expect(at(left(), 'summary').hasAttribute('data-fix-open')).toBe(false);
  });

  it('on the right, marks the same place so the change can be followed, and scrolls both into view', () => {
    setup();
    expect(at(right(), 'b:0:0').hasAttribute('data-fix-marked')).toBe(true);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('says in words what the highlights mean, not only by colour', () => {
    setup();
    expect(within(left()).getByText(/highlighted sentences can be improved/i)).toBeTruthy();
    expect(within(right()).getByText(/your changes appear here/i)).toBeTruthy();
  });

  it('the editor starts with the reason folded away and two choices', () => {
    setup();
    expect(screen.queryByText('Add numbers to your bullets.')).toBeNull();
    fireEvent.click(btn(/Why\?/));
    expect(screen.getByText('Add numbers to your bullets.')).toBeTruthy();
    expect(btn(/Improve this sentence/i)).toBeTruthy();
    expect(btn(/Leave it for now/i)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Save & next/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Skip$/i })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Improve this sentence/i })).toHaveLength(1);
  });

  it('shows the priority', () => {
    setup();
    expect(screen.getByText(/· High$/)).toBeTruthy();
  });
});

describe('typing: the new resume follows, your resume does not', () => {
  it('the edit box starts with the user\'s own text, not the AI draft', () => {
    setup();
    improve();
    expect(editBox().value).toBe('Handled monthly reporting for the sales team');
  });

  it('shows what is typed in the new resume at once, leaves your resume as it was, and says it is not saved', () => {
    const { props } = setup();
    improve();
    expect(screen.queryByText(/not saved yet/i)).toBeNull();
    fireEvent.change(editBox(), { target: { value: 'Cut monthly reporting time for the sales team' } });
    expect(at(right(), 'b:0:0').textContent).toContain('Cut monthly reporting time');
    expect(at(left(), 'b:0:0').textContent).toContain('Handled monthly reporting for the sales team');
    expect(screen.getByText(/not saved yet/i)).toBeTruthy();
    expect(props.onChange).not.toHaveBeenCalled();
  });
});

describe('choosing another sentence on the left', () => {
  it('clicking another highlighted sentence opens its issue', () => {
    setup();
    fireEvent.click(at(left(), 'b:0:1'));
    expect(screen.getByText(/Issue 2 of 2/)).toBeTruthy();
    expect(screen.getByText('Plain dashboard bullet')).toBeTruthy();
  });

  it('with an unsaved change it asks first, and Stay keeps the text', () => {
    setup();
    improve();
    fireEvent.change(editBox(), { target: { value: 'Half written' } });
    fireEvent.click(at(left(), 'b:0:1'));
    expect(screen.getByText(/Open another sentence without saving/i)).toBeTruthy();
    expect(screen.getByText(/Issue 1 of 2/)).toBeTruthy();
    fireEvent.click(btn(/^Stay$/i));
    expect(editBox().value).toBe('Half written');
    fireEvent.click(at(left(), 'b:0:1'));
    fireEvent.click(btn(/^Switch$/i));
    expect(screen.getByText(/Issue 2 of 2/)).toBeTruthy();
  });

  it('a sentence with no issue does nothing when clicked', () => {
    setup();
    fireEvent.click(at(left(), 'b:0:2'));
    expect(screen.getByText(/Issue 1 of 2/)).toBeTruthy();
  });

  it('the highlighted sentences can be reached and opened from the keyboard', () => {
    setup();
    const other = at(left(), 'b:0:1');
    expect(other.getAttribute('role')).toBe('button');
    expect(other.getAttribute('tabindex')).toBe('0');
    expect(other.getAttribute('aria-label')).toMatch(/Plain dashboard bullet/);
    fireEvent.keyDown(other, { key: 'Enter' });
    expect(screen.getByText(/Issue 2 of 2/)).toBeTruthy();
  });
});

describe('the AI draft', () => {
  const openDraft = () => { improve(); fireEvent.click(btn(/Show AI draft/i)); };

  it('is folded away, and the fold warns when the draft has figures the resume does not', () => {
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

  it('is labelled, shows a figure the resume does not contain as [X] with a note, and can be folded again', () => {
    setup();
    openDraft();
    const draft = screen.getByRole('region', { name: /AI draft/i });
    expect(draft.textContent).toContain('[X]');
    expect(draft.textContent).not.toContain('30%');
    expect(screen.getByText(/These figures are not in your resume: .*The draft shows/i).textContent).toMatch(/30%/);
    fireEvent.click(btn(/Hide AI draft/i));
    expect(screen.queryByRole('region', { name: /AI draft/i })).toBeNull();
  });

  it('Use suggestion puts the draft in the edit box, and shows it in the new resume, and saves nothing', () => {
    const { props } = setup();
    openDraft();
    fireEvent.click(btn(/Use suggestion/i));
    expect(editBox().value).toContain('[X]');
    expect(at(right(), 'b:0:0').textContent).toContain('[X]');
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
  it('saves only that field, tells the page that holds the data, marks the sentence as done on the left, and opens the next issue', () => {
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
    expect(screen.queryByRole('textbox')).toBeNull();      // the next issue starts on its first screen
    expect(at(left(), 'b:0:0').hasAttribute('data-fix-done')).toBe(true);
    expect(at(left(), 'b:0:0').textContent).toContain('Handled monthly reporting for the sales team');   // your resume is the one you started with
    expect(at(right(), 'b:0:0').textContent).toContain('Cut monthly reporting time for the sales team');
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
    expect(at(left(), 'b:0:0').hasAttribute('data-fix-done')).toBe(false);   // not done: a blank is left
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

  it('the summary offers the Builder, the list, and choosing a template as a separate step', () => {
    const { props } = setup();
    fireEvent.click(btn(/Leave it for now/i));
    fireEvent.click(btn(/Leave it for now/i));
    fireEvent.click(btn(/Open the Builder/i));
    expect(props.onOpenBuilder).toHaveBeenCalled();
    fireEvent.click(btn(/Back to list/i));
    expect(props.onBackToList).toHaveBeenCalled();
    fireEvent.click(btn(/Choose a template/i));
    expect(props.onChooseTemplate).toHaveBeenCalled();
  });

  it('the summary does not show the resumes any more', () => {
    setup();
    fireEvent.click(btn(/Leave it for now/i));
    fireEvent.click(btn(/Leave it for now/i));
    expect(screen.queryByRole('region', { name: /Your resume/i })).toBeNull();
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

describe('edge states', () => {
  it('the same text in several places: every place is highlighted, the user chooses one, and nothing is saved', () => {
    const issues = [{ severity: 'high', title: 'Plain verb', description: 'Say more.', before: 'Trained two new hires', after: 'Coached two new hires', builderStep: 2, module: null }];
    const { props } = setup({ issues });
    expect(screen.getByText(/2 places/i)).toBeTruthy();
    expect(at(left(), 'b:0:2').hasAttribute('data-fix-open')).toBe(true);
    expect(at(left(), 'b:2:0').hasAttribute('data-fix-open')).toBe(true);
    expect(screen.queryByRole('button', { name: /Improve this sentence/i })).toBeNull();
    fireEvent.click(at(left(), 'b:2:0'));                                  // choosing on the resume works as well as the buttons
    expect(at(left(), 'b:2:0').hasAttribute('data-fix-marked')).toBe(true);
    improve();
    expect(editBox().value).toBe('Trained two new hires');
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('the places can also be chosen from the editor', () => {
    const issues = [{ severity: 'high', title: 'Plain verb', description: 'Say more.', before: 'Trained two new hires', after: 'Coached two new hires', builderStep: 2, module: null }];
    setup({ issues });
    fireEvent.click(btn(/Beta/));
    expect(at(left(), 'b:2:0').hasAttribute('data-fix-marked')).toBe(true);
  });

  it('a bullet that no template draws says so and can still be edited', () => {
    const issues = [{ severity: 'low', title: 'Odd line', description: 'x', before: 'Filed paperwork', after: '', builderStep: 2, module: null }];
    setup({ issues });
    expect(screen.getByText(/does not show it/i)).toBeTruthy();
    improve();
    expect(editBox().value).toBe('Filed paperwork');
  });

  it('a sentence in the summary is marked in the summary', () => {
    const issues = [{ severity: 'medium', title: 'Generic summary', description: 'x', before: 'builds weekly reports', after: 'builds weekly sales reports', builderStep: 5, module: null }];
    setup({ issues });
    expect(at(left(), 'summary').hasAttribute('data-fix-marked')).toBe(true);
    improve();
    fireEvent.change(editBox(), { target: { value: 'Analyst who builds weekly sales reports.' } });
    expect(at(right(), 'summary').textContent).toContain('weekly sales reports');
  });
});

describe('a narrow screen', () => {
  it('has two tabs, Your resume and New resume, so the two resumes are never stacked under a long editor', () => {
    setup();
    const tabs = screen.getByRole('tablist', { hidden: true });   // hidden by CSS on a wide screen, shown below 768px
    const [a, b] = within(tabs).getAllByRole('tab', { hidden: true });
    expect(a.textContent).toMatch(/Your resume/);
    expect(b.textContent).toMatch(/New resume/);
    expect(a.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(b);
    expect(b.getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('[data-pane="new"]').getAttribute('data-active')).toBe('true');
    expect(document.querySelector('[data-pane="original"]').getAttribute('data-active')).toBe('false');
  });
});

describe('an issue that was already improved can be opened again', () => {
  const ORIGINAL = 'Handled monthly reporting for the sales team';
  const IMPROVED = 'Cut monthly reporting time for the sales team';
  const improvedSetup = (over = {}) => {
    const data = makeData(); data.experience[0].bullets[0] = IMPROVED;
    const record = { at: { kind: 'bullet', exp: 0, bullet: 0 }, inserted: IMPROVED, original: ORIGINAL };
    return setup({ data, startKey: keyOfIssue(0), records: { [keyOfIssue(0)]: { record, placeholders: false, warnings: [] } }, ...over });
  };

  it('opens on that issue, not on the next one', () => {
    improvedSetup();
    expect(screen.getByText('No metrics in bullets')).toBeTruthy();
    expect(screen.getByText(/Issue 1 of 2/)).toBeTruthy();
  });

  it('shows the sentence as it was on the left and as it is now on the right, so the change is seen', () => {
    improvedSetup();
    expect(at(left(), 'b:0:0').textContent).toContain(ORIGINAL);
    expect(at(right(), 'b:0:0').textContent).toContain(IMPROVED);
    expect(at(left(), 'b:0:0').hasAttribute('data-fix-marked')).toBe(true);
  });

  it('says it is already improved and offers Undo, Improve again and Leave it for now; not Improve this sentence', () => {
    improvedSetup();
    expect(screen.getByText(/already improved/i)).toBeTruthy();
    expect(btn(/Undo this change/i)).toBeTruthy();
    expect(btn(/Improve again/i)).toBeTruthy();
    expect(btn(/Leave it for now/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Improve this sentence/i })).toBeNull();
  });

  it('Undo puts the original sentence back, tells the page that holds the data, and offers to improve it again', () => {
    const { props } = improvedSetup();
    fireEvent.click(btn(/Undo this change/i));
    const [data, key, entry] = props.onChange.mock.calls[0];
    expect(data).toEqual(makeData());
    expect(key).toBe(keyOfIssue(0));
    expect(entry).toBeNull();                                           // null: the record is removed
    expect(at(right(), 'b:0:0').textContent).toContain(ORIGINAL);
    expect(btn(/Improve this sentence/i)).toBeTruthy();
    expect(screen.queryByText(/already improved/i)).toBeNull();
  });

  it('Improve again starts from the improved text, and saving it keeps the very first original, so Undo still goes back to it', () => {
    const { props } = improvedSetup();
    fireEvent.click(btn(/Improve again/i));
    expect(editBox().value).toBe(IMPROVED);
    fireEvent.change(editBox(), { target: { value: 'Cut monthly reporting time by half for the sales team' } });
    fireEvent.click(btn(/Save & next/i));
    const entry = props.onChange.mock.calls[0][2];
    expect(entry.record.original).toBe(ORIGINAL);
    expect(entry.record.inserted).toBe('Cut monthly reporting time by half for the sales team');
  });

  it('a sentence changed after it was applied says so and cannot be undone automatically', () => {
    const data = makeData(); data.experience[0].bullets[0] = 'My own wording afterwards';
    const record = { at: { kind: 'bullet', exp: 0, bullet: 0 }, inserted: IMPROVED, original: ORIGINAL };
    setup({ data, startKey: keyOfIssue(0), records: { [keyOfIssue(0)]: { record, placeholders: false, warnings: [] } } });
    expect(screen.getByText(/you changed this after applying it/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Undo this change/i })).toBeNull();
    expect(btn(/Improve again/i)).toBeTruthy();
  });

  it('with no start issue it still opens on the first one that is not improved', () => {
    const data = makeData(); data.experience[0].bullets[0] = IMPROVED;
    const record = { at: { kind: 'bullet', exp: 0, bullet: 0 }, inserted: IMPROVED, original: ORIGINAL };
    setup({ data, records: { [keyOfIssue(0)]: { record, placeholders: false, warnings: [] } } });
    expect(screen.getByText('Plain dashboard bullet')).toBeTruthy();
  });
});

describe('a bullet issue whose sentence cannot be found: the user picks the sentence', () => {
  const PICK = { severity: 'high', title: 'No quantifiable impact for many bullets', description: 'Several bullet points describe tasks without results.', before: 'Handled the monthly reporting for the whole sales team and finance', after: 'Cut monthly reporting time by 30% for the sales team', builderStep: 2, module: null };
  const DATES = { severity: 'medium', title: 'Inconsistent date formatting', description: 'Dates are written in different ways.', before: 'June 2017 – November 2021', after: 'Jun 2017 – Nov 2021', builderStep: 2, module: null };
  const pickSetup = (over = {}) => setup({ issues: [PICK], ...over });

  it('is on the page, and says the exact sentence was not found and asks the user to click one', () => {
    pickSetup();
    expect(screen.getByText(/Issue 1 of 1/)).toBeTruthy();
    expect(screen.getByText(/could not find the exact sentence/i)).toBeTruthy();
    expect(screen.getByText(/click the sentence you want to improve/i)).toBeTruthy();
  });

  it('highlights the bullets nearest to what the AI quoted, and lets every drawn bullet be chosen', () => {
    pickSetup();
    expect(at(left(), 'b:0:0').hasAttribute('data-fix-open')).toBe(true);
    expect(at(left(), 'b:0:1').hasAttribute('data-fix-open')).toBe(false);
    for (const k of ['b:0:0', 'b:0:1', 'b:0:2', 'b:2:0']) expect(at(left(), k).hasAttribute('data-fix-pickable'), k).toBe(true);
    expect(at(left(), 'b:0:1').getAttribute('role')).toBe('button');
  });

  it('shows what the AI looked at as an example, with a figure the resume lacks as [X], and offers no Use suggestion', () => {
    pickSetup();
    const ex = screen.getByRole('region', { name: /AI example/i });
    expect(ex.textContent).toContain('Handled the monthly reporting for the whole sales team and finance');
    expect(ex.textContent).toContain('[X]');
    expect(ex.textContent).not.toContain('30%');
    expect(screen.queryByRole('button', { name: /use suggestion/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Improve this sentence/i })).toBeNull();
  });

  it('choosing a sentence marks it and offers Improve this sentence, with that sentence in the edit box', () => {
    pickSetup();
    fireEvent.click(at(left(), 'b:0:1'));
    expect(at(left(), 'b:0:1').hasAttribute('data-fix-marked')).toBe(true);
    improve();
    expect(editBox().value).toBe('Built a dashboard for 6 managers');
    expect(screen.queryByRole('button', { name: /use suggestion/i })).toBeNull();
  });

  it('the example is folded under Show AI example once a sentence is chosen', () => {
    pickSetup();
    fireEvent.click(at(left(), 'b:0:1'));
    improve();
    expect(screen.queryByRole('region', { name: /AI example/i })).toBeNull();
    fireEvent.click(btn(/Show AI example/i));
    expect(screen.getByRole('region', { name: /AI example/i })).toBeTruthy();
  });

  it('saves only the chosen bullet, counts it as applied, and Undo goes back to that bullet\'s own text', () => {
    const { props } = pickSetup();
    fireEvent.click(at(left(), 'b:0:1'));
    improve();
    fireEvent.change(editBox(), { target: { value: 'Built a dashboard used by 6 managers every week' } });
    fireEvent.click(btn(/Save & next/i));
    const [data, , entry] = props.onChange.mock.calls[0];
    const expected = makeData(); expected.experience[0].bullets[1] = 'Built a dashboard used by 6 managers every week';
    expect(data).toEqual(expected);
    expect(entry.record.original).toBe('Built a dashboard for 6 managers');
    expect(screen.getByText(/1 applied/i)).toBeTruthy();
  });

  it('leaving it for now counts as open, not as changed by the user', () => {
    pickSetup();
    fireEvent.click(btn(/Leave it for now/i));
    expect(screen.getByText(/1 open/i)).toBeTruthy();
    expect(screen.getByText(/0 changed by you/i)).toBeTruthy();
  });

  it('choosing another sentence before typing switches at once; after typing it asks first', () => {
    pickSetup();
    fireEvent.click(at(left(), 'b:0:1'));
    fireEvent.click(at(left(), 'b:0:2'));
    expect(at(left(), 'b:0:2').hasAttribute('data-fix-marked')).toBe(true);
    improve();
    fireEvent.change(editBox(), { target: { value: 'Half written' } });
    fireEvent.click(at(left(), 'b:2:0'));
    expect(screen.getByText(/Open another sentence without saving/i)).toBeTruthy();
    fireEvent.click(btn(/^Switch$/i));
    expect(at(left(), 'b:2:0').hasAttribute('data-fix-marked')).toBe(true);
  });

  it('when nothing is close, nothing is highlighted but every bullet can still be chosen', () => {
    setup({ issues: [{ ...PICK, before: 'zzz qqq www completely different words here' }] });
    expect(left().querySelector('[data-fix-open]')).toBeNull();
    expect(at(left(), 'b:0:0').hasAttribute('data-fix-pickable')).toBe(true);
  });

  it('an issue that is not about bullets (dates) is not on this page and is counted as another issue', () => {
    setup({ issues: [DATES] });
    expect(screen.getByText(/1 other issue/i)).toBeTruthy();
  });

  it('an issue with no quote at all but about bullets is on the page too', () => {
    setup({ issues: [{ ...PICK, before: '', after: '' }] });
    expect(screen.getByText(/Issue 1 of 1/)).toBeTruthy();
    expect(left().querySelector('[data-fix-open]')).toBeNull();
  });
});
