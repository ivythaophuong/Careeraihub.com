// Summarises confidence across an extracted ResumeFacts object: how much of it is known at all, and how
// much of what IS known is low-confidence. This feeds later scoring (P4: a resume that is mostly
// requiresInterpretation is not a "0", it is "we could not read most of this") and gives a reviewer a
// single place to see what deserves a second look. No AI, purely descriptive — it does not judge or score.
const LOW_CONFIDENCE = 0.6; // below this, worth a second look, but not wrong by itself

const collect = (facts) => {
  const out = [];
  const add = (f, path) => { if (f) out.push([f, path]); };
  if (facts?.contact) {
    for (const k of ['name', 'email', 'phone', 'location']) add(facts.contact[k], `contact.${k}`);
    (facts.contact.links || []).forEach((f, i) => add(f, `contact.links[${i}]`));
  }
  (facts?.experiences || []).forEach((e, i) => {
    for (const k of ['title', 'company', 'start', 'end']) add(e?.[k], `experiences[${i}].${k}`);
    (e?.bullets || []).forEach((b, bi) => add(b, `experiences[${i}].bullets[${bi}]`));
  });
  (facts?.education || []).forEach((e, i) => {
    for (const k of ['degree', 'institution', 'year']) add(e?.[k], `education[${i}].${k}`);
  });
  for (const k of ['skills', 'metrics', 'certifications']) (facts?.[k] || []).forEach((f, i) => add(f, `${k}[${i}]`));
  return out;
};

export function summarizeConfidence(facts) {
  const all = collect(facts);
  const known = all.filter(([f]) => f.value !== null);
  const unknown = all.filter(([f]) => f.value === null);
  const lowConfidence = known.filter(([f]) => f.confidence < LOW_CONFIDENCE).map(([, path]) => path);
  return {
    total: all.length,
    known: known.length,
    unknown: unknown.length,
    unknownPaths: unknown.map(([, path]) => path),
    lowConfidenceCount: lowConfidence.length,
    lowConfidencePaths: lowConfidence,
    averageConfidence: known.length ? known.reduce((s, [f]) => s + f.confidence, 0) / known.length : null,
  };
}
