import { describe, it, expect } from 'vitest';
import { extractEducation } from './education';

describe('extractEducation', () => {
  it('reads degree, the following institution line and the latest year', () => {
    const [e] = extractEducation('BSc Computer Science\nExample University\n2016 - 2020');
    expect(e.degree.value).toBe('BSc Computer Science');
    expect(e.institution.value).toBe('Example University');
    expect(e.year.normalized_value).toBe('2020');
  });

  it('falls back to the preceding line for the institution when there is no clean following line', () => {
    const [e] = extractEducation('Example University\nMaster of Science, 2019');
    expect(e.institution.value).toBe('Example University');
    expect(e.degree.value).toContain('Master of Science');
  });

  it('splits two entries at the second degree line', () => {
    const es = extractEducation('MSc Economics\nExample University, 2022\n\nBSc Economics\nAnother University, 2019');
    expect(es).toHaveLength(2);
    expect(es[0].degree.value).toBe('MSc Economics');
    expect(es[1].degree.value).toBe('BSc Economics');
    expect(es[0].year.normalized_value).toBe('2022');
    expect(es[1].year.normalized_value).toBe('2019');
  });

  it('recognises engineering, business, arts and law degree abbreviations', () => {
    const lines = [
      'B.Tech Computer Science, Anna University, 2020', 'BTech Mechanical Engineering, Example Institute, 2018',
      'BFA Graphic Design, Istanbul Technical University, 2017', 'MFA Creative Writing, Example College, 2021',
      'BBA Finance, University of Texas, 2017', 'BBA, ESADE, 2018', 'B.E. Electronics, Example University, 2015',
      'BEng Civil Engineering, Example University, 2016', 'BCom Accounting, Example University, 2014', 'LLB, Example University, 2012',
      'M.Tech Data Science, Example Institute, 2022', 'MEng Robotics, Example University, 2023', 'BEd Primary Education, Example College, 2013',
    ];
    for (const l of lines) {
      const es = extractEducation(l);
      expect(es, l).toHaveLength(1);
      expect(es[0].year.normalized_value, l).toMatch(/^(19|20)\d{2}$/);
    }
  });

  it('does not read ordinary words as a degree', () => {
    expect(extractEducation('Dean\'s list, GPA 3.9')).toHaveLength(0);
    expect(extractEducation('Be proactive and learn fast')).toHaveLength(0);
    expect(extractEducation('Member of the debate club, 2019')).toHaveLength(0);
    expect(extractEducation('Mobile development workshop 2020')).toHaveLength(0);
  });

  it('recognises common abbreviations and Vietnamese degree words', () => {
    expect(extractEducation('B.Sc. Computer Science')).toHaveLength(1);
    expect(extractEducation('Cử nhân Kinh tế')).toHaveLength(1);
  });

  it('returns an empty array when nothing looks like a degree, rather than guessing', () => {
    expect(extractEducation('Self-taught, various online courses')).toEqual([]);
    expect(extractEducation('')).toEqual([]);
  });

  it('does not guess an institution when neither neighbour line is institution-shaped', () => {
    const [e] = extractEducation('PhD\n2015 - 2020');
    expect(e.institution).toMatchObject({ value: null, requiresInterpretation: true });
  });
});
