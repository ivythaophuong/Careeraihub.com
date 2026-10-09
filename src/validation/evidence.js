// Evidence-consistency check: does a fact's own `value` actually appear in its own `evidence`? A fact
// that extraction code wrote should always pass this; its real job is to catch a FUTURE bug in an
// extractor that attaches a value to the wrong evidence line, before it reaches anyone. No AI.
//
// Kept intentionally loose (case-insensitive, extra whitespace collapsed) and OFF for extraction_method
// 'ai': the evidence contract for an AI-filled field only requires evidence to be present
// (src/contracts/resumeFacts.js mergeAiFact), not that it echoes the value verbatim.
const normalize = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

function checkOne(fact, path) {
  if (!fact || fact.value === null || fact.extraction_method === 'ai') return null;
  const value = typeof fact.value === 'string' ? fact.value : String(fact.value);
  if (!normalize(fact.evidence).includes(normalize(value))) {
    return { kind: 'evidence_mismatch', severity: 'error', message: `${path}: value does not appear in its own evidence.`, refs: [path] };
  }
  return null;
}

const scalarFacts = (facts) => {
  const out = [];
  if (facts?.contact) {
    for (const k of ['name', 'email', 'phone', 'location']) if (facts.contact[k]) out.push([facts.contact[k], `contact.${k}`]);
    (facts.contact.links || []).forEach((f, i) => out.push([f, `contact.links[${i}]`]));
  }
  (facts?.experiences || []).forEach((e, i) => {
    for (const k of ['title', 'company', 'start', 'end']) if (e?.[k]) out.push([e[k], `experiences[${i}].${k}`]);
    (e?.bullets || []).forEach((b, bi) => out.push([b, `experiences[${i}].bullets[${bi}]`]));
  });
  (facts?.education || []).forEach((e, i) => {
    for (const k of ['degree', 'institution', 'year']) if (e?.[k]) out.push([e[k], `education[${i}].${k}`]);
  });
  for (const k of ['skills', 'metrics', 'certifications']) (facts?.[k] || []).forEach((f, i) => out.push([f, `${k}[${i}]`]));
  return out;
};

export function checkEvidenceConsistency(facts) {
  return scalarFacts(facts).map(([fact, path]) => checkOne(fact, path)).filter(Boolean);
}
