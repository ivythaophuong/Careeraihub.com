// Composes P2 -> P3 -> P4 into one call from plain resume text: computeDeterministicScore(text) ->
// { facts, validation, score }. Nothing here is new logic: it only wires together extractResumeFacts,
// validateFacts and scoreResume in the one order the architecture contract specifies, so a caller (the
// ATS Builder integration, Gate 2) gets one function instead of three imports to keep in sync, and so the
// facts/validation that produced a given score are always available right next to it for tracing.
//
// Deliberately takes plain TEXT, not a File: ATS Builder already extracts text from the uploaded file with
// its own existing code (mammoth / extractTextFromPdfFile), and this integration does not touch that path
// (see the architecture contract's order of work — swapping file-reading for P1's ingestDocument is a
// separate, later step, not bundled into this one).
import { extractResumeFacts } from '../extraction/resumeFacts';
import { validateFacts } from '../validation/validateFacts';
import { scoreResume } from './resumeScore';

export function computeDeterministicScore(text) {
  const facts = extractResumeFacts(text);
  const validation = validateFacts(facts);
  const score = scoreResume(facts, validation);
  return { facts, validation, score };
}
