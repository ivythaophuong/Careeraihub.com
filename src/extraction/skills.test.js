import { describe, it, expect } from 'vitest';
import { extractSkills } from './skills';

describe('extractSkills', () => {
  it('splits a comma-separated line into separate skills', () => {
    const s = extractSkills('SQL, Python, Roadmapping');
    expect(s.map(f => f.value)).toEqual(['SQL', 'Python', 'Roadmapping']);
    expect(s.every(f => !f.requiresInterpretation)).toBe(true);
  });
  it('reads one skill per bullet line', () => {
    const s = extractSkills('• SQL\n• Python\n• Roadmapping');
    expect(s.map(f => f.value)).toEqual(['SQL', 'Python', 'Roadmapping']);
  });
  it('drops a category label but keeps its items', () => {
    const s = extractSkills('Languages: English, Vietnamese\nTools: Figma, Jira');
    expect(s.map(f => f.value)).toEqual(['English', 'Vietnamese', 'Figma', 'Jira']);
  });
  it('deduplicates case-insensitively, keeping the first spelling', () => {
    const s = extractSkills('SQL, Python\nsql, Figma');
    expect(s.map(f => f.value)).toEqual(['SQL', 'Python', 'Figma']);
  });
  it('returns an empty array for an empty section, never throws', () => {
    expect(extractSkills('')).toEqual([]);
    expect(() => extractSkills(undefined)).not.toThrow();
  });
  it('each fact carries evidence (the source line) and a normalized lowercase value', () => {
    const [f] = extractSkills('Python');
    expect(f.evidence).toBe('Python');
    expect(f.normalized_value).toBe('python');
  });
});
