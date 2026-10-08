import { digestResume } from '../../lib/resumeDigest.js';
// Pure utility functions extracted for testability

export const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export const CATEGORIES = {
  keywords:         'Keywords',
  impact_metrics:   'Impact & Metrics',
  formatting:       'Formatting',
  missing_sections: 'Missing Sections',
  summary_headline: 'Summary/Headline',
};

export function genId() {
  return `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function computeLineDiff(oldText, newText) {
  const oldLineSet = new Set(oldText.split('\n').filter(l => l.trim().length > 4));
  const newLines = newText.split('\n').filter(l => l.trim().length > 4);
  const result = [];
  for (const l of oldText.split('\n').filter(l => l.trim().length > 4)) {
    if (!newLines.includes(l)) result.push({ type: 'removed', text: l.trim() });
  }
  for (const l of newLines) {
    if (!oldLineSet.has(l)) result.push({ type: 'added', text: l.trim() });
  }
  return result.slice(0, 50);
}

export function sortGapsBySeverity(gaps) {
  return [...gaps].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4)
  );
}

export function buildRebuildPrompt(resumeText, doneCards) {
  const edits = doneCards.map((c, i) => {
    let s = `${i + 1}. Section: ${c.section}\n   Gap: ${c.title}\n   Fix: ${c.aiSuggestion}`;
    if (c.userNotes?.trim()) s += `\n   User intent: ${c.userNotes}`;
    return s;
  }).join('\n\n');
  const css = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Calibri','Segoe UI',Arial,sans-serif;font-size:11pt;line-height:1.55;color:#1a1a2e;max-width:800px;margin:0 auto;padding:40px 48px;background:#fff}h1{font-size:22pt;font-weight:700;letter-spacing:-.5px;margin-bottom:5px}.contact{font-size:9.5pt;color:#444;margin-bottom:22px;line-height:1.7}h2{font-size:10pt;font-weight:700;text-transform:uppercase;letter-spacing:1.8px;color:#1a1a2e;border-bottom:1.5px solid #1a1a2e;padding-bottom:3px;margin:20px 0 10px}.entry{margin-bottom:14px}.entry-header{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px}.role{font-weight:700;font-size:10.5pt}.period{font-size:9pt;color:#555;white-space:nowrap}.org{font-size:10pt;color:#444;font-style:italic;margin:2px 0 5px}ul{padding-left:18px;margin-top:4px}li{margin-bottom:3px;font-size:10.5pt}.skills{font-size:10.5pt;line-height:1.7}@media print{body{padding:24px 36px}h2{break-after:avoid}.entry{break-inside:avoid}}`;
  return `You are an expert resume writer and ATS specialist. Rewrite the resume below applying ONLY the listed edits. Do not change anything not mentioned. Preserve all sections and all original content not covered by an edit.

ORIGINAL RESUME:
${resumeText}

EDITS TO APPLY:
${edits}

OUTPUT REQUIREMENTS:
- Return ONLY a complete HTML document. No markdown, no code fences, no explanation before or after.
- Your response must start immediately with: <!DOCTYPE html>
- Use this exact CSS (copy verbatim) in a <style> tag inside <head>: ${css}
- Do NOT add any <script> tags, external stylesheets, @import rules, Google Fonts links, or external image src attributes.
- Do NOT use inline style="" attributes — rely on the provided CSS classes only.
- HTML structure to use in <body>:
  - <h1> for candidate name
  - <p class="contact"> for contact info (email · phone · location · LinkedIn)
  - <h2> for each section heading (EXPERIENCE, EDUCATION, SKILLS, etc.)
  - For each job: <div class="entry"><div class="entry-header"><span class="role">Title</span><span class="period">Dates</span></div><p class="org">Company</p><ul><li>bullet</li></ul></div>
  - <p class="skills"> for skills section content
- Do NOT include any placeholder text, TODO comments, or meta-instructions in the HTML output.
- The document must render a complete, readable resume with all sections filled in.`;
}

export function stripHtmlToText(html) {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// Pure card-movement reducer — no React state, used for testing
export function moveCardPure(state, card, from, to) {
  const { gapCards, editCards, doneCards } = state;
  const remove = (arr) => arr.filter(c => c.id !== card.id);
  const newGaps = from === 'gaps' ? remove(gapCards) : gapCards;
  const newEdit = from === 'edit' ? remove(editCards) : editCards;
  const newDone = from === 'done' ? remove(doneCards) : doneCards;
  return {
    gapCards:  to === 'gaps' ? [...newGaps, card] : newGaps,
    editCards: to === 'edit' ? [...newEdit, card] : newEdit,
    doneCards: to === 'done' ? [...newDone, card] : newDone,
  };
}

// Before/after comparison prompt. Each resume goes through whole when it fits, otherwise as a section-aware digest
// (never just its first 2000 characters, which hid everything after the first role).
export function buildAnalysisPrompt(originalText, newText) {
  return `Compare these two resumes. Long resumes are condensed to their key sections. Return ONLY raw JSON (start with {):
{"atsScore":0,"parameters":{"keywords":0,"impactMetrics":0,"formatting":0,"missingSections":0,"summaryHeadline":0},"addedKeywords":[],"changesSummary":[]}
ORIGINAL: ${digestResume(originalText).text}
IMPROVED: ${digestResume(newText).text}`;
}

// A score is a finite number from 0 to 100. Anything else (missing, a string, NaN) is "unknown" (null),
// never 0: a made-up 0 would be saved to the database and counted by the trust score.
export const validScore = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v) : null);

// What one finished ATS scan writes to memory and to the `resume_scans` row.
// `metrics_found` is not set: this scan does not count metrics (it used to save the number of score
// parameters, which is always 5 and means nothing). null = not counted.
export function buildScanRecord(parsed, now = new Date().toISOString()) {
  const score = validScore(parsed?.atsScore);
  const gaps = Array.isArray(parsed?.gaps) ? parsed.gaps : [];
  const summary = parsed?.summary || '';
  const questions = parsed?.interrogationQuestions || [];
  return {
    score,
    radarResult: { credibilityScore: score, issues: gaps, summary, metricsFound: null },
    historyEntry: (result) => ({ score, date: now, result }),
    row: { credibility_score: score, metrics_found: null, summary, issues: gaps, questions },
  };
}
