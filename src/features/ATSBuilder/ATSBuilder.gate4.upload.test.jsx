// @vitest-environment jsdom
// Gate 4: drives the REAL upload path, not the resumeText-prop shortcut Gate 3 used.
//
// Every earlier test (ATSBuilder.gate3.test.jsx) sets resumeText as a prop, which seeds rawText directly
// and skips UploadAndParseTab's own handleFile — the function that actually runs when a user drops a file
// on the real page (mammoth.extractRawText for .docx, extractTextFromPdfFile/pdfjs-dist for .pdf, a plain
// TextDecoder for .txt). No existing test fires a file input change event, so nobody had verified that the
// live handler really sets rawText, which really trips the Gate 2 useEffect, which really computes the
// deterministic score — the literal "upload" step of "upload -> extraction -> validation -> scoring -> UI"
// that Gate 4 exists to check end to end, through the component tree, not through computeDeterministicScore
// called directly.
//
// Revised 2026-10-09 (product decision, same as Gate 3): the score is computed silently and never rendered
// — read via console.log('[ATS Builder] deterministic score (not shown in UI):', score), not the DOM.
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
// canva-style-single-col.pdf on the live page (the panel was still visible at that point, before the
// same-day decision below to stop rendering it). Result matched this file's and Gate 3's own expectation
// for that exact fixture exactly — fileInfo showed "canva-style-single-col.pdf, 33 words", and the panel
// showed completeness 100/100, measurable_impact 100/100 ("2 of 2 experience bullets..."), chronology_health
// 100/100. The AI parse call failed in the same screenshot (CORS: the deployed `ai` function's
// ALLOWED_ORIGINS is the production domain only, not localhost — unrelated to this integration, a
// pre-existing local-dev limitation) and the score was computed unaffected by that failure, which is the
// real-browser confirmation of the same "AI outage" case this file's own last test simulates with a
// rejected mock. That manual check is a one-time confirmation, not a regression test: nothing here will
// catch a future change that breaks the real .pdf upload path, since no automated test drives it.
//
// Separately, 2026-10-09: the panel itself was removed from the UI on request — the screen must look
// exactly as it did before Gate 2 — so every assertion below now reads the console.log, not the DOM.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
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

const LOG_PREFIX = '[ATS Builder] deterministic score (not shown in UI):';
let logSpy;
beforeEach(() => { logSpy = vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { logSpy.mockRestore(); });
const lastLoggedScore = () => {
  const matches = logSpy.mock.calls.filter(c => c[0] === LOG_PREFIX);
  return matches[matches.length - 1]?.[1];
};
const partOf = (id) => lastLoggedScore()?.parts.find(p => p.id === id);

describe('Gate 4 — real .docx upload through the live drop zone (not the resumeText prop)', () => {
  it('standard.docx: fileInfo renders, and a real (not fabricated) score is computed via a real file drop', async () => {
    callLLM.mockResolvedValue('{}');
    render(<ATSBuilder {...base} />);
    dropFile(docxFile('standard.docx'));

    await waitFor(() => expect(screen.getByText(/standard\.docx/)).toBeTruthy());
    await waitFor(() => expect(lastLoggedScore()).toBeTruthy());

    // mammoth's flat paragraph-to-text join loses the structure pdf.js's column-gap heuristic gives
    // standard.pdf (Gate 3): standard.docx's text has a name and an unlabelled job/skills line, but no
    // "Experience"/"Education"/"Skills" heading P2's extraction looks for and no email, so completeness
    // reads as only 1 of 4 signals (worse than standard.pdf's 2 of 4) — the same documented P1/P2 heading
    // boundary Gate 3 already names for standard.pdf, now reached through the real upload path instead of
    // a hand-built prop. This is a known limitation, not a new regression: verified with the real number,
    // not assumed.
    expect(lastLoggedScore().score).toBe(25);
    expect(partOf('completeness').score).toBe(25);
    expect(partOf('completeness').evidence).toContain('experience or education: missing');
    expect(partOf('measurable_impact').score).toBeNull(); // no bullet reached the extractor at all
    expect(screen.queryByText(/Deterministic score/i)).toBeNull(); // never rendered
  });

  it('a .docx with no document.xml: handleFile’s catch path shows a read error, and no score is ever computed', async () => {
    render(<ATSBuilder {...base} />);
    dropFile(docxFile('docx-missing-document-xml.docx'));

    await waitFor(() => expect(screen.getByText(/could not read file/i)).toBeTruthy());
    expect(lastLoggedScore()).toBeUndefined();
  });
});

describe('Gate 4 — real .txt upload through the live drop zone', () => {
  it('a plain-text resume dropped as a .txt file scores exactly as the same text does via the prop path', async () => {
    callLLM.mockResolvedValue('{}');
    render(<ATSBuilder {...base} />);
    dropFile(txtFile('Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew signups 20 percent'));

    await waitFor(() => expect(lastLoggedScore()).toBeTruthy());
    expect(partOf('measurable_impact').score).toBe(100);
    expect(partOf('chronology_health').score).toBe(100);
  });

  it('an empty .txt file shows a read error, matching the empty-document contract (nothing computed, never a 0)', async () => {
    render(<ATSBuilder {...base} />);
    dropFile(txtFile('   '));

    await waitFor(() => expect(screen.getByText(/could not extract text/i)).toBeTruthy());
    expect(lastLoggedScore()).toBeUndefined();
  });
});
