// Where an issue is fixed in the Builder, decided by code. The step number the AI writes with an issue is often wrong (a "missing summary" issue
// arrived with step 2, Experience), so it is only the last resort. In order: where the quoted sentence is in the resume, then what the title says,
// then what the description says, then the AI's number. Words decide only when they name exactly one section; two sections is a tie and is not guessed.
// Steps: 1 Contact, 2 Experience, 3 Education, 4 Skills, 5 Summary.
import { locateAll } from './applyIssue.js';
import { neutralizeInventedFigures } from '../../lib/factGuard.js';
import { claimWarnings } from '../../lib/claimGuard.js';
import { builderDataToText } from './builderText.js';

const SECTIONS = [
  [5, /\b(summary|objective|profile statement)\b/i],
  [4, /\bskills?\b|\bkeywords?\b/i],
  [3, /\b(education|degree|university|school|gpa|graduat\w*)\b/i],
  [1, /\b(contact|e-?mail|phone|linkedin|address|location)\b/i],
  [2, /\b(experience|bullets?|roles?|job titles?|responsibilit\w*|achievement\w*|metrics?|quantif\w*|dates?|verbs?|work history)\b/i],
];
const named = (text) => SECTIONS.filter(([, re]) => re.test(text || '')).map(([n]) => n);
const validStep = (n) => (Number.isInteger(n) && n >= 1 && n <= 5 ? n : null);

export function stepForIssue(issue, data) {
  if (!issue) return null;
  if (issue.before && String(issue.before).trim()) {
    const kinds = new Set(locateAll(data, issue.before).map(p => p.at.kind));
    if (kinds.size === 1) return kinds.has('summary') ? 5 : 2;
  }
  const inTitle = named(issue.title);
  if (inTitle.length === 1) return inTitle[0];
  if (inTitle.length === 0) { const inText = named(issue.description); if (inText.length === 1) return inText[0]; }
  return validStep(issue.builderStep);
}

// The AI's suggestion as it would be put in the form: a figure the resume does not contain becomes [X], and the claim warnings are kept.
// null when the issue has no suggestion.
export function draftFor(issue, data) {
  const after = String(issue?.after ?? '').trim();
  if (!after) return null;
  const resumeText = builderDataToText(data);
  const g = neutralizeInventedFigures(after, resumeText);
  const warnings = claimWarnings({ before: issue.before || '', after, resumeText }).map(w => w.message);
  return { text: g.text, placeholders: g.changed, replaced: g.replaced, warnings };
}

// Is the issue about the sentences under a job, so that the user can pick the sentence it applies to on the side-by-side page?
// (Dates, the summary, skills and education are not.) Words decide, as in stepForIssue: the title first, then the description.
const BULLET_WORDS = /\b(bullets?|achievements?|accomplishments?|responsibilit\w*|quantif\w*|metrics?|measurable|impact|results?|action verbs?|verbs?)\b/i;
export function isBulletIssue(issue) {
  if (!issue) return false;
  if (BULLET_WORDS.test(issue.title || '')) return true;
  return !SECTION_WORDS_IN_TITLE(issue.title) && BULLET_WORDS.test(issue.description || '');
}
// A title that names some other section settles it: "Missing location for education institutions" is not about bullets whatever the description says.
function SECTION_WORDS_IN_TITLE(title) { return named(title).length > 0; }

// The AI's quote, only when it really is in the resume (the summary or a bullet; an ellipsis is allowed). Otherwise null: a fragment stitched from the
// header and a heading ("JORDAN LEE, CFA ... WORKING EXPERIENCE") is not text of the resume and must not be shown as "In your resume".
export function quoteInResume(issue, data) {
  return issue?.before && String(issue.before).trim() && locateAll(data, issue.before).length > 0 ? issue.before : null;
}

// Is the issue about the skills list, so that the Fix page can offer the Skills card? Words decide, as in stepForIssue: the title first, then the
// description, and only when exactly one section is named and it is Skills. The AI's step number is never used, and a quoted sentence that is in the
// resume makes it a sentence issue.
export function isSkillsIssue(issue, data) {
  if (!issue || !data || !Array.isArray(data.skills)) return false;
  if (quoteInResume(issue, data)) return false;
  const inTitle = named(issue.title);
  if (inTitle.length === 1) return inTitle[0] === 4;
  if (inTitle.length > 1) return false;
  const inText = named(issue.description);
  return inText.length === 1 && inText[0] === 4;
}

// Is the issue about the dates (of the jobs or of the education), so that the Fix page can offer the Dates card? Words decide, as in stepForIssue: the title
// first, then the description, and only when it names no other section than the experience one that dates belong with. The AI's step number is never used,
// and a quoted sentence that is in the resume makes it a sentence issue.
const DATE_WORDS = /\b(dates?|dated|dating|chronolog\w*|timeline|employment gaps?|gaps? in (?:employment|work))\b/i;
const GRADUATION_DATE = /\b(?:graduation|graduating|completion)\s+(?:year|date)s?\b|\byears?\s+of\s+graduation\b/i;
export function isDatesIssue(issue, data) {
  if (!issue || !data || !(Array.isArray(data.experience) || Array.isArray(data.education))) return false;
  if (quoteInResume(issue, data)) return false;
  const inTitle = named(issue.title);
  // A graduation year is a date of an education entry (the word 'date' also names the experience section, so that one is allowed with it). If the title
  // also names the degree or the school it is a tie between two cards, and is not guessed.
  if (GRADUATION_DATE.test(issue.title || '')) return inTitle.includes(3) && inTitle.every(n => n === 2 || n === 3) && !/\b(degree|university|school|gpa)\b/i.test(issue.title) && !JOB_WORDS.test(issue.title);
  if (inTitle.length > 1) return false;
  if (DATE_WORDS.test(issue.title || '')) return (inTitle.length === 0 || inTitle[0] === 2) && !JOB_WORDS.test(issue.title);   // job titles named with it: a tie
  if (inTitle.length === 1) return false;
  const inText = named(issue.description);
  return inText.length === 1 && inText[0] === 2 && DATE_WORDS.test(issue.description || '');
}

// Which card of the Fix page an issue about the contact details, the education or the title and company of a jobs gets: 'contact', 'education', 'experience', or null (the step form). Words decide, as in
// stepForIssue: the title first, then the description, only when exactly one of the two sections is named and no sentence of the resume is quoted. A year
// or a date is not decided here: it belongs to the Dates card. The AI's step number is never used.
const JOB_WORDS = /\b(job titles?|titles?|company names?|names? of (?:the )?compan(?:y|ies)|employers?|compan(?:y|ies))\b/i;
export function fieldsIssueKind(issue, data) {
  if (!issue || !data || typeof data !== 'object' || quoteInResume(issue, data)) return null;
  const inTitle = named(issue.title);
  // The job card: the title or the company of a job. A date, or another section, named with it is a tie between two cards and is not guessed.
  const hasJobs = Array.isArray(data.experience);
  if (JOB_WORDS.test(issue.title || '')) return hasJobs && !DATE_WORDS.test(issue.title) && (inTitle.length === 0 || (inTitle.length === 1 && inTitle[0] === 2)) ? 'experience' : null;
  if (inTitle.length === 0 && JOB_WORDS.test(issue.description || '')) {
    const inText = named(issue.description);
    return hasJobs && !DATE_WORDS.test(issue.description) && (inText.length === 0 || (inText.length === 1 && inText[0] === 2)) ? 'experience' : null;
  }
  let step;
  if (inTitle.length > 1) return null;
  if (inTitle.length === 1) step = inTitle[0];
  else { const inText = named(issue.description); if (inText.length !== 1) return null; step = inText[0]; }
  if (step === 1 && data.contact && typeof data.contact === 'object') return 'contact';
  if (step === 3 && Array.isArray(data.education) && !/\b(years?|dates?)\b/i.test(`${issue.title || ''}`)) return 'education';
  return null;
}
