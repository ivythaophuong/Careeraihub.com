import { describe, it, expect } from 'vitest';
import { pickResumeSource } from './resumeSource.js';

const CV = 'Product manager at Acme Corp, 2021 to 2025. Led a checkout migration across three teams. Skills: SQL, roadmapping.';

describe('pickResumeSource', () => {
  it('reads a resume that was uploaded (the object shape written by Resume Scan)', () => {
    expect(pickResumeSource({ resumeText: { type: 'text', content: CV, fileName: 'cv.docx' } })).toMatchObject({ kind: 'text', text: CV });
  });
  it('reads a resume that was pasted (a plain string: the paste box in the app and in the ATS Builder)', () => {
    expect(pickResumeSource({ resumeText: CV })).toMatchObject({ kind: 'text', text: CV });
  });
  it('trims the pasted text', () => {
    expect(pickResumeSource({ resumeText: `  \n${CV}\n  ` }).text).toBe(CV);
  });
  it('treats a very short or empty paste, or no resume, as none', () => {
    for (const v of ['', '   ', 'too short', null, undefined, {}, { content: null }]) expect(pickResumeSource({ resumeText: v }).kind).toBe('none');
  });
  it('the structured resume from the ATS Builder wins over pasted text', () => {
    const memory = { resumeData: { personalInfo: { fullName: 'Ann Lee' }, summary: 'A product manager with eight years of experience in checkout and payments.', experience: [] } };
    expect(pickResumeSource({ memory, resumeText: CV }).kind).toBe('structured');
  });
  it('falls back to the PDF kept for this session when there is no text', () => {
    expect(pickResumeSource({ memory: { scanPdfBase64: 'AAAA' }, resumeText: { content: null } })).toMatchObject({ kind: 'pdf', pdfBase64: 'AAAA' });
  });
  it('clips a very long resume', () => {
    expect(pickResumeSource({ resumeText: 'x'.repeat(30000) }).text.length).toBeLessThanOrEqual(12000);
  });
});
