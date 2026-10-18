// Owner preview of the rule-based interview Structure Score (step D2 of docs/architecture/plans/PLAN-voice-and-deterministic-first-2026-10-18.md).
// OFF by default and off in production: it shows only for the user ids listed in VITE_STRUCTURE_PANEL_USERS at build or dev time.
// It runs the rules on the answer on this device, next to the AI feedback, and does nothing else: it changes no score, saves nothing, sends nothing.
// The product's own language gate (ENABLED_LANGUAGES) stays closed; this preview switches both languages on for itself only, because showing the owner
// what the rules say is how a language is judged. The result is labelled beta and is not calibrated (docs/architecture/plans/D1-...).
import { scoreInterviewAnswer } from '../../../supabase/functions/_shared/structure/interviewStructure.js';

export const structurePanelEnabledFor = (userId) => {
  if (!userId) return false;
  const list = String(import.meta.env?.VITE_STRUCTURE_PANEL_USERS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes(String(userId));
};

// Never throws: the scorer already turns a failure into a processing_error result.
export const previewStructure = (input) => {
  try { return scoreInterviewAnswer(input, { enabledLanguages: ['en', 'vi'] }); }
  catch (e) { return { status: 'processing_error', score: null, evidence: [], notes: [`The rules could not run: ${e?.message || e}`] }; }
};
