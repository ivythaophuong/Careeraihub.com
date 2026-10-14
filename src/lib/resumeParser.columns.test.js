// @vitest-environment node
// extractTextFromPdfFile reads a two-column page column by column, but only when the normal reading finds nothing to read.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('mammoth', () => ({ default: {} }));
vi.mock('./ai.jsx', () => ({ callLLM: vi.fn(), extractJSON: vi.fn() }));
const item = (str, x, y, width = str.length * 5) => ({ str, transform: [10, 0, 0, 10, x, y], width, hasEOL: false });
const column = (lines, x, top, step) => lines.map((s, i) => item(s, x, top - i * step));
let pageItems = [];
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: pageItems }) }) }) }),
}));
import { extractTextFromPdfFile } from './resumeParser';
import { extractResumeFacts } from '../extraction/resumeFacts';

const file = { arrayBuffer: async () => new ArrayBuffer(8) };
const MAIN = ['Ahmed Khalil', 'EXPERIENCE', 'Project Manager, Delta Build', 'Feb 2018 - Present', '- Delivered 6 projects on budget', '- Led a site team of 12 people', 'Site Engineer, Nile Works', 'Jan 2015 - Jan 2018', '- Supervised 4 sites', 'EDUCATION', 'BSc Civil Engineering, Cairo University, 2014'];
const SIDE = ['CONTACT', 'ahmed.khalil@example.com', '+20 100 555 0100', 'Cairo, Egypt', 'SKILLS', 'Project planning', 'Budgeting', 'Risk management', 'Scheduling', 'Site supervision'];
const byHeight = (xs) => [...xs].sort((a, b) => b.transform[5] - a.transform[5]);

beforeEach(() => { pageItems = []; });

describe('two-column pages in extractTextFromPdfFile', () => {
  it('reads a two-column page whose normal reading mixes the columns, column by column', async () => {
    pageItems = byHeight([...column(MAIN, 40, 740, 16), ...column(SIDE, 360, 741, 16)]); // same line pitch: the columns share baselines
    const text = await extractTextFromPdfFile(file);
    const f = extractResumeFacts(text);
    expect(f.experiences.length).toBe(2);
    expect(f.education.length).toBe(1);
    expect(f.skills.length).toBeGreaterThan(0);
  });

  it('keeps the normal reading when reading by columns finds nothing either', async () => {
    const prose = (n, w) => Array.from({ length: 9 }, (_, i) => `${w} line ${i} of free text without any resume heading`);
    pageItems = byHeight([...column(prose(9, 'left'), 40, 740, 16), ...column(prose(9, 'right'), 360, 741, 16)]);
    const { buildLinesFromPdfItems } = await import('./pdfLines');
    expect(await extractTextFromPdfFile(file)).toBe(buildLinesFromPdfItems(pageItems));
  });

  it('leaves a one-column page exactly as the normal reading gives it', async () => {
    pageItems = column([...MAIN, ...SIDE], 40, 740, 14);
    const text = await extractTextFromPdfFile(file);
    expect(text.split('\n')).toEqual([...MAIN, ...SIDE]);
  });

  it('keeps the normal reading when the page is not clearly two columns', async () => {
    pageItems = column(['Jordan Lee', 'Analyst', 'a@example.com'], 40, 740, 14);
    expect((await extractTextFromPdfFile(file)).split('\n')).toEqual(['Jordan Lee', 'Analyst', 'a@example.com']);
  });
});
