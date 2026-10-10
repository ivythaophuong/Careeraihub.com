import { describe, it, expect } from 'vitest';
import { missingSections, TEMPLATE_PARSE, JD_MAX_CHARS } from './templateParse';

const RESUME = 'Jane Doe\njane@example.com\n\nExperience\nManager at Acme\n- Grew revenue 20%\n\nEducation\nBSc Business, 2018\n\nSkills\nSQL, Excel\n';
const FULL = { workExperience: [{ title: 'Manager', company: 'Acme', bullets: ['Grew revenue 20%'] }], education: [{ degree: 'BSc', institution: 'X', year: '2018' }], skills: ['SQL', 'Excel'] };

describe('missingSections (a template must not silently drop Education or Skills)', () => {
  it('finds nothing when the profile has every section the text has', () => {
    expect(missingSections(RESUME, FULL)).toEqual([]);
  });
  it('flags Education and Skills that the profile lost (the 4000-character bug)', () => {
    expect(missingSections(RESUME, { ...FULL, education: [], skills: [] })).toEqual(['education', 'skills']);
    expect(missingSections(RESUME, { ...FULL, education: [{ degree: '', institution: '', year: '' }], skills: [''] })).toEqual(['education', 'skills']);
  });
  it('does not flag a section the text does not have', () => {
    expect(missingSections('Jane Doe\nExperience\nManager at Acme', { workExperience: FULL.workExperience, education: [], skills: [] })).toEqual([]);
  });
  it('knows Vietnamese headings', () => {
    expect(missingSections('Họ tên\nHọc vấn\nĐại học A\nKỹ năng\nExcel', { education: [], skills: [] })).toEqual(['education', 'skills']);
  });
  it('is quiet when there is no profile yet', () => {
    expect(missingSections(RESUME, null)).toEqual([]);
  });
});

describe('limits', () => {
  it('the template parser reads at least a 4,779-character resume whole, with room to write it back', () => {
    expect(TEMPLATE_PARSE.maxChars).toBeGreaterThan(4779);
    expect(TEMPLATE_PARSE.maxTokens).toBeGreaterThanOrEqual(4000);
  });
  it('a job description limit exists', () => {
    expect(JD_MAX_CHARS).toBe(15000);
  });
});
