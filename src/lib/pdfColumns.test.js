import { describe, it, expect } from 'vitest';
import { buildColumnLines } from './pdfColumns';

// pdf.js text items: { str, transform: [a, b, c, d, x, y], width, hasEOL }. A page is 612 wide; the left column starts at x=40, the right at x=340.
const item = (str, x, y, width = str.length * 5) => ({ str, transform: [10, 0, 0, 10, x, y], width, hasEOL: false });
const column = (lines, x, top, step) => lines.map((s, i) => item(s, x, top - i * step));

const LEFT = ['EXPERIENCE', 'Project Manager, Delta Build', 'Feb 2018 - Present', '- Delivered 6 projects on budget', '- Led a site team of 12 people', 'Site Engineer, Nile Works', 'Jan 2015 - Jan 2018', '- Supervised 4 sites'];
const RIGHT = ['SKILLS', 'Project planning', 'Budgeting', 'Risk management', 'EDUCATION', 'BSc Civil Engineering', 'Cairo University, 2014', 'Languages: Arabic, English'];

describe('buildColumnLines', () => {
  it('reads the left column, then the right one, when the baselines of the two columns differ', () => {
    const items = [...column(LEFT, 40, 700, 14), ...column(RIGHT, 340, 696, 17)].sort((a, b) => b.transform[5] - a.transform[5]); // pdf.js order: by height
    const text = buildColumnLines(items);
    expect(text.split('\n')).toEqual([...LEFT, ...RIGHT]);
  });

  it('reads a full-width banner first and in place, then the columns', () => {
    const banner = item('Ahmed Khalil  ahmed.khalil@example.com  +20 100 555 0100', 40, 760, 520);
    const items = [banner, ...column(LEFT, 40, 720, 14), ...column(RIGHT, 340, 716, 17)];
    const lines = buildColumnLines(items).split('\n');
    expect(lines[0]).toMatch(/^Ahmed Khalil/);
    expect(lines.slice(1)).toEqual([...LEFT, ...RIGHT]);
  });

  it('does not touch a table whose rows line up across the page', () => {
    const rows = [['Role', 'Employer'], ['Graphic Designer', 'Studio Verde'], ['Junior Designer', 'Pixel House'], ['Brand Lead', 'Aurora Foods'], ['Copywriter', 'Lumen Labs'], ['Intern', 'Harbor Retail'], ['Analyst', 'Kite Analytics']];
    const items = rows.flatMap(([a, b], i) => [item(a, 40, 700 - i * 16), item(b, 340, 700 - i * 16), item('2020', 480, 700 - i * 16, 30)]);
    expect(buildColumnLines(items)).toBeNull();
  });

  it('returns null for a single-column page, a short page and nonsense input', () => {
    expect(buildColumnLines(column(LEFT.concat(RIGHT), 40, 700, 14))).toBeNull();
    expect(buildColumnLines(column(['Jordan Lee', 'Analyst'], 40, 700, 14))).toBeNull();
    expect(buildColumnLines(null)).toBeNull();
    expect(buildColumnLines([{ str: 'x' }, {}, null])).toBeNull();
  });

  it('puts the left column first even when the left column is the narrow sidebar', () => {
    const side = ['CONTACT', 'a@example.com', '+1 555 0100', 'SKILLS', 'SQL', 'Excel', 'Power BI', 'Python'];
    const main = ['Experience', 'Analyst, Acme Ltd', 'Jan 2020 - Present', '- Built reports', '- Cut costs 12%', 'Education', 'BSc Statistics, Example University, 2019', 'Skills in forecasting'];
    const items = [...column(side, 40, 700, 15), ...column(main, 240, 696, 18)];
    expect(buildColumnLines(items).split('\n')).toEqual([...side, ...main]);
  });
});
