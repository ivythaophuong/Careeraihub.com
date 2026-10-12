// Download and save, shared by the Builder and the template screen: the same guard for a [X] left in the text, the same file names, the same saved version.
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../lib/printElement.js', () => ({ printElement: vi.fn(async () => true) }));
vi.mock('../../lib/docxExport.js', () => ({ buildResumeDocx: vi.fn(async () => 'BLOB'), downloadBlob: vi.fn() }));
import { printElement } from '../../lib/printElement.js';
import { buildResumeDocx, downloadBlob } from '../../lib/docxExport.js';
import { exportName, exportPdf, exportDocx, makeVersion } from './exportActions.js';

afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
const data = (over = {}) => ({ contact: { name: 'Jane Lee', email: 'j@example.com' }, summary: 'Analyst.', experience: [{ id: 1, company: 'Acme', title: 'A', period: '2020', bullets: ['Built a thing'] }], education: [], skills: ['SQL'], awards: [], extras: [], ...over });
const withBlank = () => data({ summary: 'Analyst with [X] years.' });

describe('exportName', () => {
  it('is the name with underscores, or resume when there is none', () => {
    expect(exportName(data())).toBe('Jane_Lee');
    expect(exportName(data({ contact: { name: '  ' } }))).toBe('resume');
    expect(exportName({})).toBe('resume');
  });
});

describe('exportPdf', () => {
  const el = { innerHTML: '<p>x</p>' };
  it('prints the element with a title made of the name and the template', async () => {
    expect(await exportPdf({ el, data: data(), templateLabel: 'Modern Professional' })).toBe(true);
    expect(printElement).toHaveBeenCalledWith(el, { title: 'Jane_Lee_Modern Professional' });
  });
  it('does nothing without an element', async () => {
    expect(await exportPdf({ el: null, data: data(), templateLabel: 'X' })).toBe(false);
    expect(printElement).not.toHaveBeenCalled();
  });
  it('asks first when a [X] blank is still in the resume, and stops if the user says no', async () => {
    const confirm = vi.fn(() => false); vi.stubGlobal('confirm', confirm);
    expect(await exportPdf({ el, data: withBlank(), templateLabel: 'X' })).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(printElement).not.toHaveBeenCalled();
  });
  it('goes on when the user says yes', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    expect(await exportPdf({ el, data: withBlank(), templateLabel: 'X' })).toBe(true);
    expect(printElement).toHaveBeenCalled();
  });
  it('does not ask when there is no blank', async () => {
    const confirm = vi.fn(); vi.stubGlobal('confirm', confirm);
    await exportPdf({ el, data: data(), templateLabel: 'X' });
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe('exportDocx', () => {
  it('builds the Word file from the data and saves it under the name', async () => {
    expect(await exportDocx(data())).toBe(true);
    expect(buildResumeDocx).toHaveBeenCalledWith(data());
    expect(downloadBlob).toHaveBeenCalledWith('BLOB', 'Jane_Lee.docx');
  });
  it('asks first about a [X] blank, and does not build the file on no', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    expect(await exportDocx(withBlank())).toBe(false);
    expect(buildResumeDocx).not.toHaveBeenCalled();
  });
});

describe('makeVersion', () => {
  it('is a copy of the data with the template and a label: the given one trimmed, else Version N', () => {
    const d = data();
    const v = makeVersion({ data: d, templateId: 'bold', templateLabel: 'Bold', label: '  For Acme  ', count: 2 });
    expect(v).toMatchObject({ template: 'bold', templateLabel: 'Bold', label: 'For Acme', data: d });
    expect(v.data).not.toBe(d);
    d.summary = 'changed afterwards';
    expect(v.data.summary).toBe('Analyst.');
    expect(Number.isNaN(Date.parse(v.date))).toBe(false);
    expect(makeVersion({ data: d, templateId: 'x', templateLabel: 'X', label: '   ', count: 2 }).label).toBe('Version 3');
    expect(makeVersion({ data: d, templateId: 'x', templateLabel: 'X', count: 0 }).label).toBe('Version 1');
  });
});
