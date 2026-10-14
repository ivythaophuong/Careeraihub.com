// The prompt that asks the model to read a resume into the builder's fields and to list problems. The model does not know today's date, and
// once called an end date of Feb 2026 "an impossible future date" in October 2026 (a CRITICAL issue about a perfectly normal past date), so the
// date is part of the prompt, and dropFalseDateClaims removes such a claim when the dates it names are not after today (code decides dates).

const pad = (n) => String(n).padStart(2, '0');
export const todayIso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function buildParsePrompt(text, today = todayIso()) {
  return `Parse this resume and extract all structured data for a resume builder.
Today's date is ${today}. A date on or before ${today} is not in the future: a job that ended in the past is normal. Never call a date future, impossible or a typo unless it is after ${today}; dates are also checked by code, so do not list date problems you are not sure of.
Resume text:
${String(text).slice(0, 5000)}

Return ONLY raw JSON (no markdown, start with {):
{
  "name": "full name",
  "email": "email address",
  "phone": "phone number",
  "linkedin": "linkedin handle or URL",
  "location": "city / region",
  "targetRole": "most recent or target role title",
  "experience": "X years",
  "topSkills": ["skill1","skill2","skill3"],
  "market": "city / region",
  "summary": "professional summary paragraph if present, else empty string",
  "workExperience": [{"title":"job title","company":"company name","period":"date range","duration":"X years","bullets":["bullet point 1","bullet point 2"]}],
  "education": [{"degree":"degree name","institution":"school","year":"graduation year","gpa":"if present"}],
  "skills": ["skill1","skill2","skill3","skill4","skill5","skill6","skill7","skill8"],
  "awards": ["award 1","award 2"],
  "extras": [{"heading":"Section Name as written in resume","items":["item 1","item 2"]}],
  "issues": [
    {"severity":"critical","title":"4-6 word specific title","description":"2-3 sentences: what is wrong and why it hurts.","before":"exact weak text quoted from resume","after":"improved version with specifics","builderStep":2,"module":null}
  ]
}
For extras: include every section not already captured above (e.g. Certifications, Publications, Projects, Volunteer, Languages, Interests, Patents, etc.). Do NOT put work experience, education, skills, awards, or summary into extras.

issues: List 3-6 specific, actionable problems found in THIS resume. Rules:
- severity: "critical" (the resume is likely rejected because of it), "high" (clearly hurts screening), "medium" (worth fixing)
- title: 4-6 words, hyper-specific (NOT "Improve bullet quality" — instead "No metrics in any bullet")
- description: 2-3 sentences. Name the exact problem and why it hurts ATS or recruiter screening.
- before: quote exact weak text from the resume (keep short, max 12 words)
- after: rewritten version showing the fix for that specific text
- builderStep: 1=Contact, 2=Experience, 3=Education, 4=Skills, 5=Summary — the builder step where this is fixed; null if not fixable in builder
- module: "scan" if this issue requires comparing against a JD (keyword gaps); null otherwise
Only include issues that are genuinely present. Do not fabricate problems.

Do NOT output any overall score or per-dimension scores: the score is computed by code, not by you. Your job here is to extract the data and to explain concrete problems.`;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const MONTH_YEAR = /\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+((?:19|20)\d{2})\b/gi;
const YEAR_ONLY = /(?<![\d/.-])((?:19|20)\d{2})(?![\d/.-])/g;
const CLAIM = /\b(future|impossible)\b/i;

// Every date an issue mentions, as year*12+month (a bare year is its last month: it may still be in the future during that year, and is past only in an earlier one).
function mentionedDates(text) {
  const out = [];
  const t = String(text || '');
  const used = [];
  for (const m of t.matchAll(MONTH_YEAR)) { out.push(Number(m[2]) * 12 + MONTHS[m[1].toLowerCase()]); used.push([m.index, m.index + m[0].length]); }
  for (const m of t.matchAll(YEAR_ONLY)) { if (!used.some(([a, b]) => m.index >= a && m.index < b)) out.push(Number(m[1]) * 12 + 12); }
  return out;
}

// Removes an issue that calls a date "future" or "impossible" when none of the dates it names is after `today`. An issue that names no date,
// or a real future date, or any other issue, is kept untouched.
export function dropFalseDateClaims(issues, today = todayIso()) {
  if (!Array.isArray(issues)) return [];
  const [y, m] = String(today).split('-').map(Number);
  const now = y * 12 + (m || 12);
  return issues.filter((it) => {
    if (!it || typeof it !== 'object') return false;
    const claim = `${it.title || ''} ${it.description || ''}`;
    if (!CLAIM.test(claim) || !/\bdates?\b/i.test(claim)) return true;
    const dates = mentionedDates(`${it.title || ''} ${it.description || ''} ${it.before || ''}`);
    if (!dates.length) return true;
    return dates.some((d) => d > now);
  });
}
