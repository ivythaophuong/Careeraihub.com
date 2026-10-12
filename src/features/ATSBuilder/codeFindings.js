// What the code scorer found wrong, as a short list the user can act on. Read from the scorer's own evidence lines
// (src/scoring/resumeScore.js), so it is fixed by code: no AI, and nothing is added that the checks did not find.
// codeFindings.test.js runs the real scorer, so a change in those lines fails a test instead of silently emptying the list.

const COMPLETENESS = {
  'contact.name':             { id: 'name',   title: 'Add your name',               description: 'No name was found at the top of the resume.', builderStep: 1 },
  'contact.email':            { id: 'email',  title: 'Add an email address',        description: 'No email address was found; recruiters and ATS need it to reach you.', builderStep: 1 },
  'experience or education':  { id: 'experience_or_education', title: 'Add experience or education', description: 'Neither work experience nor education was found.', builderStep: 2 },
  'skills':                   { id: 'skills', title: 'Add a skills section',        description: 'No skills were found.', builderStep: 4 },
};

export function codeFindings(score) {
  if (!score?.parts) return [];
  const out = [];
  for (const part of score.parts) {
    for (const line of part.evidence || []) {
      if (part.id === 'completeness') {
        const m = line.match(/^(.+): missing$/);
        if (m && COMPLETENESS[m[1]]) out.push(COMPLETENESS[m[1]]);
      } else if (part.id === 'measurable_impact') {
        const m = line.match(/^(\d+) of (\d+) experience bullets contain a measurable number/);
        if (m && Number(m[1]) < Number(m[2])) {
          const without = Number(m[2]) - Number(m[1]);
          out.push({ id: 'numbers', title: 'Add numbers to your bullets', description: `${without} of ${m[2]} bullets have no number. Add a real figure (a count, a percentage, a size) where you have one.`, builderStep: 2 });
        }
      } else if (part.id === 'chronology_health') {
        const m = line.match(/^(\d+) internal date contradiction/);
        if (m && Number(m[1]) > 0) {
          out.push({ id: 'dates', title: 'Check your dates', description: `${m[1]} date contradiction(s) found, for example an end date before a start date.`, builderStep: 2 });
        }
      }
    }
  }
  return out;
}
