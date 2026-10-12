import React, { useState } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
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
function Harness({ onGoToStep }) {
  const [data, setData] = useState(initial);
  latest = { data, setData };
  return <BuilderIssuesPanel issues={issues} data={data} onChange={setData} onGoToStep={onGoToStep} />;
}
const card = (title) => screen.getByText(title).closest('[data-issue]');
const within = (el, name) => Array.from(el.querySelectorAll('button')).find(b => name.test(b.textContent));

describe('BuilderIssuesPanel', () => {
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

  it('says so when the inserted text was edited and cannot be undone', () => {
    render(<Harness onGoToStep={() => {}} />);
    fireEvent.click(within(card('Passive bullet'), /^apply/i));
    fireEvent.click(within(card('Passive bullet'), /undo/i)); // restores
    fireEvent.click(within(card('Passive bullet'), /^apply/i));
    React.act(() => latest.setData(d => ({ ...d, experience: [{ ...d.experience[0], bullets: ['Something else', 'Cut costs by 12%'] }] })));
    fireEvent.click(within(card('Passive bullet'), /undo/i));
    expect(screen.getByText(/edited that text/i)).toBeTruthy();
    expect(latest.data.experience[0].bullets[0]).toBe('Something else');
  });

  it('offers only "Edit this step" when the quote is not in the resume, and jumps to that step', () => {
    const onGoToStep = vi.fn();
    render(<Harness onGoToStep={onGoToStep} />);
    const c = card('No LinkedIn');
    expect(within(c, /^apply/i)).toBeUndefined();
    fireEvent.click(within(c, /edit this step/i));
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
});
