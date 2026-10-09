// P3: the validation layer on top of P2's extraction. Runs the P0 schema contract, then three semantic
// checks over the same ResumeFacts object — chronology (end-before-start, overlaps), evidence consistency
// (a value really sits inside its own evidence), and a confidence summary. No AI; nothing here extracts or
// changes a fact, it only reports on what P2 produced. See docs/AI_ARCHITECTURE_CONTRACT.md.
import { validateResumeFacts } from '../contracts/resumeFacts';
import { checkChronology } from './chronology';
import { checkEvidenceConsistency } from './evidence';
import { summarizeConfidence } from './confidence';

// Schema violations are always 'error' (the data does not match its own contract); semantic findings carry
// their own severity ('error' for an internal contradiction like end-before-start, 'warning' for something
// that can be legitimate, like two overlapping jobs). `ok` is true only when there are no errors at all;
// warnings never affect it, since they are not claims that anything is wrong.
export function validateFacts(facts) {
  const schema = validateResumeFacts(facts);
  const schemaFindings = schema.errors.map(e => ({ kind: `schema_${e.code}`, severity: 'error', message: `${e.path}: ${e.message}`, refs: [e.path] }));
  const semanticFindings = [...checkChronology(facts), ...checkEvidenceConsistency(facts)];
  const findings = [...schemaFindings, ...semanticFindings];
  return {
    ok: findings.every(f => f.severity !== 'error'),
    findings,
    errors: findings.filter(f => f.severity === 'error'),
    warnings: findings.filter(f => f.severity === 'warning'),
    confidence: summarizeConfidence(facts),
  };
}
