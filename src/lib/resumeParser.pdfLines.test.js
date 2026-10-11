// @vitest-environment node
// extractTextFromPdfFile must build lines from pdf.js runs, not make every run its own line.
import { describe, it, expect, vi } from 'vitest';

vi.mock('mammoth', () => ({ default: {} }));
vi.mock('./ai.jsx', () => ({ callLLM: vi.fn(), extractJSON: vi.fn() }));
const run = (str, x, y, width, hasEOL = false) => ({ str, transform: [10, 0, 0, 10, x, y], width, hasEOL });
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({ getTextContent: async () => ({ items: [run('Senior Product Analyst', 30, 700, 110), run(', Northwind Logistics', 140, 700, 100, true), run('•', 30, 684, 5), run('Built a report', 44, 684, 70, true)] }) }),
    }),
  }),
}));
import { extractTextFromPdfFile } from './resumeParser';

describe('extractTextFromPdfFile', () => {
  it('returns one line per printed line', async () => {
    const file = { arrayBuffer: async () => new ArrayBuffer(8) };
    expect(await extractTextFromPdfFile(file)).toBe('Senior Product Analyst, Northwind Logistics\n• Built a report');
  });
});
