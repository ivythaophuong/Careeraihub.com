// @vitest-environment jsdom
// The Fix page marks the passage to fix in the drawn resume. Each template puts `data-fix-at` on the summary and on every bullet it
// draws, with the position of that text in the Builder data (not the position among what the template shows).
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TEMPLATES } from './resumeTemplates.jsx';

afterEach(cleanup);

const data = {
  contact: { name: 'Jordan Lee', email: 'jordan.lee@example.com', phone: '', linkedin: '', location: 'Singapore' },
  summary: 'Analyst who builds reports.',
  experience: [
    { id: 1, company: 'Acme', title: 'Analyst', period: '2021 - 2023', bullets: ['First bullet', '', 'Third bullet'] },
    { id: 2, company: '', title: 'Intern', period: '2020', bullets: ['Bullet of a job with no company'] },
    { id: 3, company: 'Beta', title: 'Lead', period: '2023 - now', bullets: ['Built weekly report', '   ', 'Built weekly report'] },
  ],
  education: [{ id: 1, institution: 'State University', degree: 'BSc', year: '2019' }],
  skills: ['SQL', 'Excel'], awards: ['Employee of the year'], extras: [],
};

const stripMarkers = (html) => html.replace(/ data-fix-at="[^"]*"/g, '');

describe.each(TEMPLATES.map(t => [t.id, t.component]))('%s', (_id, Template) => {
  const draw = (d = data) => render(<Template {...d} />).container;

  it('draws exactly what it drew before: the markers are the only difference', () => {
    expect(stripMarkers(draw().innerHTML)).toMatchSnapshot();
  });

  it('marks the summary', () => {
    const el = draw().querySelector('[data-fix-at="summary"]');
    expect(el?.textContent).toBe('Analyst who builds reports.');
  });

  it('marks each bullet with its position in the data, counting the jobs and bullets the template does not draw', () => {
    const c = draw();
    const text = (at) => c.querySelector(`[data-fix-at="${at}"]`)?.textContent ?? null;
    expect(text('b:0:0')).toMatch(/First bullet/);
    expect(text('b:0:2')).toMatch(/Third bullet/);      // the empty bullet at position 1 is not drawn but is counted
    expect(text('b:2:0')).toMatch(/Built weekly report/);
    expect(text('b:2:2')).toMatch(/Built weekly report/); // the same text twice: two different marks
  });

  it('marks nothing for what it does not draw: an empty bullet, a job with no company name', () => {
    const c = draw();
    expect(c.querySelector('[data-fix-at="b:0:1"]')).toBeNull();
    expect(c.querySelector('[data-fix-at="b:1:0"]')).toBeNull();
    expect(c.querySelector('[data-fix-at="b:2:1"]')).toBeNull();
    expect(c.textContent).not.toMatch(/job with no company/);
  });

  it('has one mark per drawn passage and no duplicates', () => {
    const marks = Array.from(draw().querySelectorAll('[data-fix-at]')).map(e => e.getAttribute('data-fix-at'));
    expect(marks.sort()).toEqual(['b:0:0', 'b:0:2', 'b:2:0', 'b:2:2', 'summary']);
  });

  it('marks no summary when there is none', () => {
    expect(draw({ ...data, summary: '' }).querySelector('[data-fix-at="summary"]')).toBeNull();
  });

  it('a mark carries no style: the page looks the same until the Fix page marks it', () => {
    for (const e of draw().querySelectorAll('[data-fix-at]')) expect(e.getAttribute('data-fix-at')).toMatch(/^(summary|b:\d+:\d+)$/);
  });
});
