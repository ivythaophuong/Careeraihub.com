import { describe, it, expect } from 'vitest';
import { sectionReport } from './sectionReport';

describe('sectionReport', () => {
  it('lists the sections that were recognised', () => {
    const r = sectionReport('Jane Doe\njane@example.com\n\nExperience\nPM at Acme\n\nEducation\nBSc 2017\n\nSkills\nSQL');
    expect(r.recognised).toEqual(['Experience', 'Education', 'Skills']);
    expect(r.unrecognisedHeadings).toEqual([]);
    expect(r.hasExperience).toBe(true);
  });
  it('shows capitalised heading-like lines it did not recognise, so a user can see why a part was not assessed', () => {
    const r = sectionReport('JANE DOE\njane@example.com\n\nCAREER ACHIEVEMENTS & ROLES\nPM at Acme\nJan 2021 - Present\n\nEducation\nBSc 2017\nSkills\nSQL');
    expect(r.hasExperience).toBe(false);
    expect(r.unrecognisedHeadings).toContain('CAREER ACHIEVEMENTS & ROLES');
    expect(r.unrecognisedHeadings).not.toContain('JANE DOE'); // the name line is not a heading
  });
  it('does not call ordinary lines headings', () => {
    const r = sectionReport('Jane Doe\nExperience\nLed the roadmap for payments.\nGrew revenue by 20%.\nSkills\nSQL');
    expect(r.unrecognisedHeadings).toEqual([]);
  });
});
