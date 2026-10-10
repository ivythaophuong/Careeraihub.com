import { describe, it, expect } from 'vitest';
import { computeDeterministicScore } from './computeDeterministicScore';
import { splitSections } from '../lib/resumeDigest';

// A standard Vietnamese CV used to score 50 (no Education, Skills or Experience found) only because its headings were not recognised.
const VI = `Nguyễn Phương Thảo\nChuyên viên phân tích kinh doanh\nthao.nguyen@example.com | 0912 345 678 | Hà Nội\n\nKINH NGHIỆM LÀM VIỆC\nChuyên viên phân tích, Công ty ABC\nTháng 1/2021 – nay\n- Xây dựng báo cáo giúp giảm 30% thời gian xử lý\n- Phối hợp với 5 phòng ban\n\nHỌC VẤN\nCử nhân Kinh tế, Đại học Kinh tế Quốc dân\n2016 - 2020\n\nKỸ NĂNG\nSQL, Excel, Power BI`;
const EN_HISTORY = 'Jane Doe\njane@example.com\n\nWork History\nSenior Product Manager, Acme\nJan 2021 - Present\n• Led roadmap, growing revenue by 20%\n\nEducation\nBSc Business, 2017\nSkills\nSQL';

describe('section headings are recognised in English variants and in Vietnamese', () => {
  it('a complete Vietnamese CV is read in full: experience, education, skills, dates and a number', () => {
    const r = computeDeterministicScore(VI);
    expect(r.facts.experiences).toHaveLength(1);
    expect(r.facts.education).toHaveLength(1);
    expect(r.facts.skills.length).toBeGreaterThanOrEqual(3);
    expect(r.score.parts.map(p => p.score)).toEqual([100, 100, 100]);
    expect(r.score.score).toBe(100);
  });
  it('"Work History" counts as work experience', () => {
    const r = computeDeterministicScore(EN_HISTORY);
    expect(r.facts.experiences).toHaveLength(1);
    expect(r.score.parts.find(p => p.id === 'measurable_impact').score).toBe(100);
  });
  it('decomposed (NFD) Vietnamese headings are read the same as composed ones', () => {
    const names = splitSections(VI.normalize('NFD')).map(s => s.name);
    expect(names).toEqual(['header', 'work experience', 'education', 'skills']);
  });
  it('the same CV is still not scored on a heading that is only mentioned inside a sentence', () => {
    const r = computeDeterministicScore('Jane Doe\njane@example.com\nI have a lot of experience and good skills in education technology.');
    expect(r.facts.experiences).toHaveLength(0);
    expect(r.score.parts.find(p => p.id === 'measurable_impact').score).toBeNull();
  });
});
