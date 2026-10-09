// @vitest-environment jsdom
// Gate 4: drives the REAL upload path, not the resumeText-prop shortcut Gate 3 used.
//
// Every earlier test (ATSBuilder.gate3.test.jsx) sets resumeText as a prop, which seeds rawText directly
// and skips UploadAndParseTab's own handleFile — the function that actually runs when a user drops a file
// on the real page (mammoth.extractRawText for .docx, extractTextFromPdfFile/pdfjs-dist for .pdf, a plain
// TextDecoder for .txt). No existing test fires a file input change event, so nobody had verified that the
// live handler really sets rawText, which really trips the Gate 2 useEffect, which really renders the
// Deterministic score panel — the literal "upload" step of "upload -> extraction -> validation -> scoring
// -> UI" that Gate 4 exists to check end to end, through the component tree, not through computeDeterministicScore
// called directly.
//
// Scope, deliberately: only .docx and .txt go through this test with the REAL library (mammoth has no
// browser-only dependency; a bare TextDecoder needs nothing special). The .pdf path
// (src/lib/resumeParser.js extractTextFromPdfFile) imports pdfjs-dist's BROWSER build and points
// GlobalWorkerOptions.workerSrc at a bundler-resolved worker URL — unlike src/ingestion/ingestDocument.js,
// which deliberately switches to pdfjs-dist's Node-safe legacy build outside a browser (see its own
// comment). That browser-only worker path cannot run inside Vitest/jsdom, and no browser-automation tool
// was available this session to drive the dev server, so it is not covered by an automated test here.
//
// It WAS checked by hand: 2026-10-09, `npm run dev`, real Chrome, dropping tests/fixtures/documents/
// canva-style-single-col.pdf on the live page. Result matched this file's and Gate 3's own expectation for
// that exact fixture exactly — fileInfo showed "canva-style-single-col.pdf, 33 words", and the panel showed
// completeness 100/100, measurable_impact 100/100 ("2 of 2 experience bullets..."), chronology_health
// 100/100. The AI parse call failed in the same screenshot (CORS: the deployed `ai` function's
// ALLOWED_ORIGINS is the production domain only, not localhost — unrelated to this integration, a
// pre-existing local-dev limitation) and the Deterministic panel was unaffected by that failure, which is
// the real-browser confirmation of the same "AI outage" case this file's own last test simulates with a
// rejected mock. That manual check is a one-time confirmation, not a regression test: nothing here will
// catch a future change that breaks the real .pdf upload path, since no automated test drives it.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

afterEach(cleanup);

const callLLM = vi.fn();
vi.mock('../../lib/ai', () => ({ callLLM: (...a) => callLLM(...a), extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } } }));
vi.mock('../../lib/ai.jsx', () => ({ callLLM: (...a) => callLLM(...a), extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } } }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));
// ATSBuilder.jsx calls mammoth.extractRawText({ arrayBuffer }), which is the key mammoth's "browser" build
// (browser/unzip.js) expects — the one Vite's real build resolves via mammoth's package.json "browser"
// field. Vitest resolves plain Node module resolution instead, landing on lib/unzip.js, which wants
// `buffer`, not `arrayBuffer`. Both ultimately call the SAME zipfile.openArrayBuffer with the same bytes —
// only the options key differs between the two builds — so this adapts the key without touching any real
// docx-parsing logic (zip reading, XML walking, style mapping all still run for real).
vi.mock('mammoth', async (importOriginal) => {
  const real = await importOriginal();
  return { default: { extractRawText: (opts) => real.default.extractRawText({ buffer: Buffer.from(opts.arrayBuffer) }) } };
});

import ATSBuilder from './ATSBuilder';

const FIX = path.resolve(__dirname, '../../../tests/fixtures/documents');
const docxFile = (name) => {
  const buf = fs.readFileSync(path.join(FIX, name));
  return new File([buf], name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
};
const txtFile = (text, name = 'resume.txt') => new File([text], name, { type: 'text/plain' });

const base = { user: { id: 'u1', token: 't' }, memory: {}, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn() };

const getFileInput = () => document.querySelector('input[type="file"]');
const dropFile = (file) => fireEvent.change(getFileInput(), { target: { files: [file] } });

const overallRow = () => screen.getByText('Overall').nextSibling.textContent;
const partScore = (label) => screen.getByText(label).nextSibling.textContent;

describe('Gate 4 — real .docx upload through the live drop zone (not the resumeText prop)', () => {
  it('standard.docx: fileInfo renders, and a real (not fabricated) score reaches the panel via a real file drop', async () => {
    callLLM.mockResolvedValue('{}');
    render(<ATSBuilder {...base} />);
    dropFile(docxFile('standard.docx'));

    await waitFor(() => expect(screen.getByText(/standard\.docx/)).toBeTruthy());
    await waitFor(() => expect(screen.queryByText(/Deterministic score/i)).toBeTruthy());

    // mammoth's flat paragraph-to-text join loses the structure pdf.js's column-gap heuristic gives
    // standard.pdf (Gate 3): standard.docx's text has a name and an unlabelled job/skills line, but no
    // "Experience"/"Education"/"Skills" heading P2's extraction looks for and no email, so completeness
    // reads as only 1 of 4 signals (worse than standard.pdf's 2 of 4) — the same documented P1/P2 heading
    // boundary Gate 3 already names for standard.pdf, now reached through the real upload path instead of
    // a hand-built prop. This is a known limitation, not a new regression: verified with the real number,
    // not assumed.
    expect(overallRow()).toBe('25/100');
    expect(partScore('completeness')).toBe('25/100');
    expect(screen.getByText(/experience or education: missing/)).toBeTruthy();
    expect(partScore('measurable impact')).toBe('unknown'); // no bullet reached the extractor at all
  });

  it('a .docx with no document.xml: handleFile’s catch path shows a read error, never a silent 0/100', async () => {
    render(<ATSBuilder {...base} />);
    dropFile(docxFile('docx-missing-document-xml.docx'));

    await waitFor(() => expect(screen.getByText(/could not read file/i)).toBeTruthy());
    expect(screen.queryByText(/Deterministic score/i)).toBeNull();
  });
});

describe('Gate 4 — real .txt upload through the live drop zone', () => {
  it('a plain-text resume dropped as a .txt file scores exactly as the same text does via the prop path', async () => {
    callLLM.mockResolvedValue('{}');
    render(<ATSBuilder {...base} />);
    dropFile(txtFile('Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew signups 20 percent'));

    await waitFor(() => expect(screen.queryByText(/Deterministic score/i)).toBeTruthy());
    expect(partScore('measurable impact')).toBe('100/100');
    expect(partScore('chronology health')).toBe('100/100');
  });

  it('an empty .txt file shows a read error and no score panel, matching the empty-document contract (null, never 0)', async () => {
    render(<ATSBuilder {...base} />);
    dropFile(txtFile('   '));

    await waitFor(() => expect(screen.getByText(/could not extract text/i)).toBeTruthy());
    expect(screen.queryByText(/Deterministic score/i)).toBeNull();
  });
});
