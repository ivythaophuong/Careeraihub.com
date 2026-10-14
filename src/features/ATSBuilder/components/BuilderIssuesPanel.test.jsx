import React, { useState } from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import BuilderIssuesPanel from './BuilderIssuesPanel.jsx';

const initial = () => ({
  contact: { name: 'Jordan', email: 'j@example.com' },
  summary: 'Hard working analyst who likes data.',
  experience: [{ id: 1, company: 'Acme', title: 'Analyst', period: '2020 - 2023', bullets: ['Responsible for weekly reports', 'Cut costs by 12%'] }],
  education: [], skills: [],
});
const issues = [
  { severity: 'high', title: 'Weak summary', description: 'Too vague.', before: 'Hard working analyst', after: 'Analyst who improved accuracy by 45%', builderStep: 5 },
  { severity: 'medium', title: 'Passive bullet', description: 'Starts with Responsible.', before: 'Responsible for weekly reports', after: 'Produced weekly reports', builderStep: 2 },
  { severity: 'critical', title: 'No LinkedIn', description: 'Add a profile link.', before: 'quote that is not in the resume', after: 'x', builderStep: 1 },
  { severity: 'medium', title: 'Missing section', description: 'No certifications.', builderStep: null },
];

// The panel works on the data its parent holds, like the Builder does.
let latest;
function Harness({ onGoToStep, storageKey, start, list = issues }) {
  const [data, setData] = useState(start || initial);
  latest = { data, setData };
  return <BuilderIssuesPanel issues={list} data={data} onChange={setData} onGoToStep={onGoToStep} storageKey={storageKey} />;
}
const card = (title) => screen.getByText(title).closest('[data-issue]');
const within = (el, name) => Array.from(el.querySelectorAll('button')).find(b => name.test(b.textContent));

describe('BuilderIssuesPanel', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });
  afterEach(cleanup);

  it('lists every issue with its before and after', () => {
    render(<Harness onGoToStep={() => {}} />);
    expect(screen.getByText('Weak summary')).toBeTruthy();
    expect(screen.getByText('Hard working analyst')).toBeTruthy();
    expect(screen.getByText('Produced weekly reports')).toBeTruthy();
  });

  it('Apply puts the suggestion in the resume and turns an invented figure into [X], with a note to fill it in', () => {
    render(<Harness onGoToStep={() => {}} />);
    fireEvent.click(within(card('Weak summary'), /^apply/i));
    expect(latest.data.summary).toBe('Analyst who improved accuracy by [X]% who likes data.');
    expect(screen.getByText(/replace \[X\] with your real figure/i)).toBeTruthy();
    expect(within(card('Weak summary'), /undo/i)).toBeTruthy();
  });

  it('Undo gives the original text back', () => {
    render(<Harness onGoToStep={() => {}} />);
    fireEvent.click(within(card('Passive bullet'), /^apply/i));
    expect(latest.data.experience[0].bullets[0]).toBe('Produced weekly reports');
    fireEvent.click(within(card('Passive bullet'), /undo/i));
    expect(latest.data).toEqual(initial());
  });

  it('when the user edits the inserted text, the card says so and offers no Undo that could damage the edit', () => {
    render(<Harness onGoToStep={() => {}} />);
    fireEvent.click(within(card('Passive bullet'), /^apply/i));
    React.act(() => latest.setData(d => ({ ...d, experience: [{ ...d.experience[0], bullets: ['Something else', 'Cut costs by 12%'] }] })));
    expect(within(card('Passive bullet'), /undo/i)).toBeUndefined();
    expect(card('Passive bullet').textContent).toMatch(/applied, then edited/i);
    expect(latest.data.experience[0].bullets[0]).toBe('Something else');
  });

  it('offers only a "Go to <step>" button when the quote is not in the resume, and jumps to that step', () => {
    const onGoToStep = vi.fn();
    render(<Harness onGoToStep={onGoToStep} />);
    const c = card('No LinkedIn');
    expect(within(c, /^apply/i)).toBeUndefined();
    fireEvent.click(within(c, /go to (contact|experience|education|skills|summary)/i));
    expect(onGoToStep).toHaveBeenCalledWith(1);
  });

  it('shows no action button for an issue with no quote and no step', () => {
    render(<Harness onGoToStep={() => {}} />);
    expect(card('Missing section').querySelectorAll('button').length).toBe(0);
  });

  it('says plainly that the suggestions are AI drafts to check', () => {
    render(<Harness onGoToStep={() => {}} />);
    expect(screen.getByText(/ai drafts/i)).toBeTruthy();
  });

  it('renders nothing when there are no issues', () => {
    const { container } = render(<BuilderIssuesPanel issues={[]} data={initial()} onChange={() => {}} onGoToStep={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('marks an issue "Changed by you" when its quote is no longer in the resume and it was not applied here; never "Resolved"', () => {
    render(<Harness onGoToStep={() => {}} start={() => ({ ...initial(), summary: 'Analyst who likes data.' })} />);
    expect(card('Weak summary').textContent).toMatch(/changed by you/i);
    expect(screen.queryByText(/resolved/i)).toBeNull();
  });

  it('shows Open for an issue whose quote is still there', () => {
    render(<Harness onGoToStep={() => {}} />);
    expect(Array.from(card('Weak summary').querySelectorAll('div')).some(d => d.textContent === 'Open')).toBe(true);
  });

  it('when the quote is in several places the user chooses where, and nothing changes until then', () => {
    const dup = () => ({ ...initial(), experience: [
      { id: 1, company: 'Acme', title: 'A', period: '2020 - 2023', bullets: ['Responsible for weekly reports'] },
      { id: 2, company: 'Beta', title: 'B', period: '2017 - 2020', bullets: ['Responsible for weekly reports'] },
    ] });
    render(<Harness onGoToStep={() => {}} start={dup} />);
    const c = card('Passive bullet');
    expect(within(c, /^apply$/i)).toBeUndefined();
    expect(c.textContent).toMatch(/2 places/i);
    expect(latest.data).toEqual(dup());
    fireEvent.click(within(c, /beta/i));
    expect(latest.data.experience[1].bullets[0]).toBe('Produced weekly reports');
    expect(latest.data.experience[0].bullets[0]).toBe('Responsible for weekly reports');
  });

  it('keeps Applied and Undo after the page is reloaded (records are saved with the draft)', () => {
    const first = render(<Harness onGoToStep={() => {}} storageKey="t:applied" />);
    fireEvent.click(within(card('Passive bullet'), /^apply/i));
    const dataAfter = latest.data;
    first.unmount();
    render(<Harness onGoToStep={() => {}} storageKey="t:applied" start={() => dataAfter} />);
    expect(card('Passive bullet').textContent).toMatch(/applied/i);
    fireEvent.click(within(card('Passive bullet'), /undo/i));
    expect(latest.data).toEqual(initial());
  });

  it('works when browser storage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<Harness onGoToStep={() => {}} storageKey="t:blocked" />);
    expect(screen.getByText('Weak summary')).toBeTruthy();
    spy.mockRestore();
  });

  describe('claims beyond figures', () => {
    const risky = [{ severity: 'high', title: 'Weak bullet', description: 'Vague.', before: 'Assisted with campaign reporting', after: 'Led marketing analytics, driving strategic campaign decisions', builderStep: 2 }];
    const start = () => ({ ...initial(), experience: [{ id: 1, company: 'Acme', title: 'A', period: '2020 - 2023', bullets: ['Assisted with campaign reporting'] }] });

    it('warns before Apply when the suggestion raises the role or adds scope, and asks for confirmation on the button', () => {
      render(<Harness onGoToStep={() => {}} list={risky} start={start} />);
      const c = card('Weak bullet');
      expect(c.textContent).toMatch(/assisted/i);
      expect(c.textContent).toMatch(/keep it only if/i);
      expect(within(c, /^apply$/i)).toBeUndefined();
      expect(within(c, /i confirm this is true/i)).toBeTruthy();
    });

    it('keeps showing the warnings after Apply, until Undo', () => {
      render(<Harness onGoToStep={() => {}} list={risky} start={start} />);
      fireEvent.click(within(card('Weak bullet'), /i confirm this is true/i));
      expect(latest.data.experience[0].bullets[0]).toContain('Led marketing analytics');
      expect(card('Weak bullet').textContent).toMatch(/keep it only if/i);
      fireEvent.click(within(card('Weak bullet'), /undo/i));
      expect(latest.data.experience[0].bullets[0]).toBe('Assisted with campaign reporting');
    });

    it('a plain rewrite has no warning and the normal Apply button', () => {
      render(<Harness onGoToStep={() => {}} />);
      expect(card('Passive bullet').textContent).not.toMatch(/keep it only if/i);
      expect(within(card('Passive bullet'), /^apply$/i)).toBeTruthy();
    });
  });

  describe('a change made on the Fix page to the skills list', () => {
    const skillsIssue = { severity: 'medium', title: 'Skills list is short', description: 'Add the tools you use.', before: '', after: 'Python', builderStep: 4 };
    const key = (i) => `${i}:${skillsIssue.title}:${skillsIssue.before}`;
    const rec = { record: { kind: 'skills', added: ['Power BI'], removed: [] }, placeholders: false, warnings: [] };
    const withSkills = (skills) => () => ({ ...initial(), skills });
    const stored = () => { localStorage.setItem('records', JSON.stringify({ [key(0)]: rec })); };

    it('shows Applied while the list is as the change left it, and Undo takes it back', () => {
      stored();
      render(<Harness onGoToStep={() => {}} storageKey="records" list={[skillsIssue]} start={withSkills(['SQL', 'Power BI'])} />);
      expect(card('Skills list is short').textContent).toMatch(/Applied/);
      expect(card('Skills list is short').textContent).not.toMatch(/edited by you/);
      fireEvent.click(within(card('Skills list is short'), /^Undo$/));
      expect(latest.data.skills).toEqual(['SQL']);
    });

    it('says the list was edited afterwards, and offers no Undo', () => {
      stored();
      render(<Harness onGoToStep={() => {}} storageKey="records" list={[skillsIssue]} start={withSkills(['SQL'])} />);
      expect(card('Skills list is short').textContent).toMatch(/Applied, then edited by you/);
      expect(within(card('Skills list is short'), /^Undo$/)).toBeUndefined();
    });
  });

  describe('a change made on the Fix page to the dates', () => {
    const datesIssue = { severity: 'medium', title: 'Inconsistent date formatting', description: 'Written in different ways.', before: '', after: '', builderStep: 2 };
    const key = (i) => `${i}:${datesIssue.title}:${datesIssue.before}`;
    const rec = { record: { kind: 'dates', changes: [{ ref: { kind: 'job', id: 1 }, before: '2020 - 2023', after: 'Jan 2020 - Mar 2023' }] }, placeholders: false, warnings: [] };
    const withPeriod = (period) => () => { const d = initial(); d.experience[0].period = period; return d; };
    const stored = () => { localStorage.setItem('records', JSON.stringify({ [key(0)]: rec })); };

    it('shows Applied while the date is as the change left it, and Undo takes it back', () => {
      stored();
      render(<Harness onGoToStep={() => {}} storageKey="records" list={[datesIssue]} start={withPeriod('Jan 2020 - Mar 2023')} />);
      expect(card('Inconsistent date formatting').textContent).toMatch(/Applied/);
      expect(card('Inconsistent date formatting').textContent).not.toMatch(/edited by you/);
      fireEvent.click(within(card('Inconsistent date formatting'), /^Undo$/));
      expect(latest.data.experience[0].period).toBe('2020 - 2023');
    });

    it('says the date was edited afterwards, and offers no Undo', () => {
      stored();
      render(<Harness onGoToStep={() => {}} storageKey="records" list={[datesIssue]} start={withPeriod('2019')} />);
      expect(card('Inconsistent date formatting').textContent).toMatch(/Applied, then edited by you/);
      expect(within(card('Inconsistent date formatting'), /^Undo$/)).toBeUndefined();
    });
  });

  describe('a change made on the Fix page to the contact details', () => {
    const contactIssue = { severity: 'medium', title: 'Phone number missing', description: 'Add one.', before: '', after: '', builderStep: 1 };
    const key = (i) => `${i}:${contactIssue.title}:${contactIssue.before}`;
    const rec = { record: { kind: 'fields', changes: [{ ref: { kind: 'contact', field: 'phone' }, before: '', after: '+65 9000 0000' }] }, placeholders: false, warnings: [] };
    const withPhone = (phone) => () => ({ ...initial(), contact: { name: 'Jordan', email: 'j@example.com', phone } });
    const stored = () => { localStorage.setItem('records', JSON.stringify({ [key(0)]: rec })); };

    it('shows Applied while the value is as the change left it, and Undo takes it back', () => {
      stored();
      render(<Harness onGoToStep={() => {}} storageKey="records" list={[contactIssue]} start={withPhone('+65 9000 0000')} />);
      expect(card('Phone number missing').textContent).toMatch(/Applied/);
      expect(card('Phone number missing').textContent).not.toMatch(/edited by you/);
      fireEvent.click(within(card('Phone number missing'), /^Undo$/));
      expect(latest.data.contact.phone).toBe('');
    });

    it('says it was edited afterwards, and offers no Undo', () => {
      stored();
      render(<Harness onGoToStep={() => {}} storageKey="records" list={[contactIssue]} start={withPhone('12345678')} />);
      expect(card('Phone number missing').textContent).toMatch(/Applied, then edited by you/);
      expect(within(card('Phone number missing'), /^Undo$/)).toBeUndefined();
    });
  });
});

describe('BuilderIssuesPanel: blanks the model wrote itself', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });
  afterEach(cleanup);
  const one = (after) => [{ severity: 'medium', title: 'Passive bullet', description: 'Starts with Responsible.', before: 'Responsible for weekly reports', after, builderStep: 2 }];

  it('[X]% written by the model still gets a note to fill it in', () => {
    render(<Harness onGoToStep={() => {}} list={one('Produced weekly reports, cutting errors by [X]%')} />);
    fireEvent.click(within(card('Passive bullet'), /^apply/i));
    expect(latest.data.experience[0].bullets[0]).toBe('Produced weekly reports, cutting errors by [X]%');
    expect(screen.getByText(/has a blank for you to fill: \[X\]/i)).toBeTruthy();
  });

  it('[number] is applied as written, with a note that names it (not the "[X]" note)', () => {
    render(<Harness onGoToStep={() => {}} list={one('Produced [number] weekly reports')} />);
    fireEvent.click(within(card('Passive bullet'), /^apply/i));
    expect(latest.data.experience[0].bullets[0]).toBe('Produced [number] weekly reports');
    expect(screen.getByText(/has a blank for you to fill: \[number\]/i)).toBeTruthy();
    expect(screen.queryByText(/replace \[X\] with your real figure/i)).toBeNull();
  });

  it('a clean rewrite has no note', () => {
    render(<Harness onGoToStep={() => {}} list={one('Produced weekly reports')} />);
    fireEvent.click(within(card('Passive bullet'), /^apply/i));
    expect(screen.queryByText(/for you to fill/i)).toBeNull();
    expect(screen.queryByText(/replace \[X\]/i)).toBeNull();
  });
});
