// Download and save, shared by the Builder and the template screen so both behave the same: the same guard when a [X] blank is still in the resume, the same
// file names, the same saved version.
import { printElement } from '../../lib/printElement.js';
import { buildResumeDocx, downloadBlob } from '../../lib/docxExport.js';
import { confirmExport } from '../../lib/exportGuard.js';
import { builderDataToText } from './builderText.js';

export const exportName = (data) => (String(data?.contact?.name ?? '').trim() || 'resume').replace(/\s+/g, '_');

// Opens the print dialog ("Save as PDF") for the drawn resume. false when there is nothing to print or the user declined the blank warning.
export async function exportPdf({ el, data, templateLabel }) {
  if (!el) return false;
  if (!confirmExport(builderDataToText(data))) return false;
  await printElement(el, { title: `${exportName(data)}_${templateLabel}` });
  return true;
}

// Word file: plain single column, real headings and bullets, the same text as the templates.
export async function exportDocx(data) {
  if (!confirmExport(builderDataToText(data))) return false;
  downloadBlob(await buildResumeDocx(data), `${exportName(data)}.docx`);
  return true;
}

// A saved version of the resume: a copy of the data (so later edits do not change it), the template, and a label (the user's, else Version N).
export function makeVersion({ data, templateId, templateLabel, label, count = 0 }) {
  return {
    date: new Date().toISOString(),
    template: templateId,
    templateLabel: templateLabel || templateId,
    label: String(label ?? '').trim() || `Version ${count + 1}`,
    data: JSON.parse(JSON.stringify(data)),
  };
}
