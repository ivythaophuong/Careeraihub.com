import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import atsBuilderSrc from './ATSBuilder.jsx?raw';
import panelSrc from './components/BuilderScorePanel.jsx?raw';
import BuilderScorePanel from './components/BuilderScorePanel.jsx';

// The cut-offs 80 and 60 were never validated against anything (see the note beside the score in ATSBuilder.jsx), so the colour of the
// ATS Readiness score must not say "good" or "poor": one neutral colour for every number.
const draft = (email, bullets) => ({
  contact: { name: 'Jordan A. Lee', email, phone: '+1 555 0100' },
  summary: 'Operations analyst.',
  experience: [{ id: 1, company: 'Acme Corp', title: 'Analyst', period: '2020 - 2023', bullets }],
  education: [{ id: 1, institution: 'State University', degree: 'BSc', year: '2016' }],
  skills: ['SQL'],
});
const colourOf = (d) => { cleanup(); render(<BuilderScorePanel data={d} debounceMs={0} />); const el = screen.getByTestId('builder-score'); return [Number(el.textContent), el.style.color]; };

describe('the ATS Readiness score colour', () => {
  afterEach(cleanup);
  it('is the same for a high score and a low score', () => {
    const [hi, hiColour] = colourOf(draft('jordan@example.com', ['Cut time by 30% across 4 teams']));
    const [lo, loColour] = colourOf(draft('', ['Did various tasks', 'Helped the team']));
    expect(hi).toBeGreaterThan(lo + 20);
    expect(hiColour).toBe(loColour);
  });
  it('is not one of the red / amber / green status colours', () => {
    const [, c] = colourOf(draft('jordan@example.com', ['Cut time by 30%']));
    expect(c.toLowerCase()).not.toMatch(/00e5a0|ffb84d|ff5a5a|rgb\(0, 229, 160\)|rgb\(255, 184, 77\)|rgb\(255, 90, 90\)/);
  });
  it.each([['ATSBuilder.jsx', atsBuilderSrc], ['BuilderScorePanel.jsx', panelSrc]])('%s has no 80 / 60 cut-off that picks a colour', (_, src) => {
    expect(src.length).toBeGreaterThan(1000);
    expect(src).not.toMatch(/(?:score|Score|\bn)\s*>=\s*(?:80|60)\s*\?/);
  });
});
