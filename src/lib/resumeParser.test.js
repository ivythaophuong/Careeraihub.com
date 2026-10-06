// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./ai.jsx', () => ({
  callLLM: vi.fn(async () => '{"personalInfo":{"fullName":"A"}}'),
  extractJSON: (s) => JSON.parse(s),
}));
vi.mock('mammoth', () => ({ default: { extractRawText: vi.fn(async () => ({ value: 'resume words' })) } }));
import { callLLM } from './ai.jsx';
import { extractResume } from './resumeParser.js';

const file = (name) => ({ name, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });

beforeEach(() => vi.clearAllMocks());

describe('extractResume routing', () => {
  it('accepts upper-case and mixed-case extensions', async () => {
    await expect(extractResume(file('CV.PDF'))).resolves.toMatchObject({ personalInfo: { fullName: 'A' } });
    await expect(extractResume(file('cv.Docx'))).resolves.toMatchObject({ personalInfo: { fullName: 'A' } });
  });

  it('sends a PDF to the model as base64', async () => {
    await extractResume(file('cv.pdf'));
    const [, , pdf] = callLLM.mock.calls[0];
    expect(typeof pdf).toBe('string');
    expect(pdf.length).toBeGreaterThan(0);
  });

  it('gives a long DOCX the full 8192-token budget so the structured resume is not cut off', async () => {
    await extractResume(file('cv.docx'));
    expect(callLLM.mock.calls[0][1]).toBe(8192);
  });

  it('rejects other file types', async () => {
    await expect(extractResume(file('cv.txt'))).rejects.toThrow(/pdf or \.docx/i);
  });
});
