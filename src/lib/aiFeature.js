// Labels an AI call with the feature that made it and, for resume-bearing calls, how much resume text it carries.
// Counts and kinds only: this never touches the content of the resume. The server writes them into the usage log line
// (supabase/functions/_shared/usage.js) so the cost of each feature, and of the resume part of it, can be measured (Stage 1,
// docs/architecture/plans/DESIGN-resume-context.md). It does not change what is sent to the model.
import { callLLM } from './ai.jsx';

export const RESUME_KINDS = ['structured', 'text', 'pdf', 'none'];

// resume: the object pickResumeSource returns ({ kind, text, pdfBase64 }), or { kind, chars } when the call builds its own excerpt.
export function resumeCounts(resume) {
  if (!resume || !RESUME_KINDS.includes(resume.kind)) return {};
  const chars = Number.isFinite(resume.chars) ? resume.chars : typeof resume.text === 'string' ? resume.text.length : 0;
  return { resumeKind: resume.kind, resumeChars: Math.max(0, Math.round(chars)) };
}

// callLLMFor('mock_questions', resume)(messages, maxTokens, pdfBase64) behaves exactly like callLLM(messages, maxTokens, pdfBase64).
export const callLLMFor = (feature, resume = null) => (messages, maxTokens, pdfBase64 = null) =>
  callLLM(messages, maxTokens, pdfBase64, { feature, ...resumeCounts(resume) });
