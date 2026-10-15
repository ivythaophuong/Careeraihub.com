// Warnings for an AI rewrite that changes what a resume CLAIMS, beyond the figures that factGuard.js neutralises:
// a higher role (assisted -> led), a wider scope (company-wide, executive), a tool or name the resume never mentions,
// or an outcome nothing in the resume supports. Plain word lists, no AI. These are warnings for the person to check, never proof:
// a word list cannot know what is true, and it will miss claims phrased in ways it does not list.

const words = (s) => String(s ?? '').toLowerCase().match(/[a-z][a-z'&-]*/g) || [];

const LEAD = /^(led|lead|leads|leading|manag\w*|direct(?:ed|s|ing|or)?|own(?:ed|s|ing|ership)?|head(?:ed|s|ing)?|overs(?:aw|ee|ees|eeing|ight)|spearhead\w*|driv(?:e|es|ing|en)|drove|supervis\w*|architect(?:ed|s|ing)?|founded|established|championed|orchestrated)$/;
const DO = /^(built|build\w*|creat\w*|develop\w*|produc\w*|wrote|writ\w*|analy[sz]\w*|prepar\w*|implement\w*|deliver\w*|design\w*|execut\w*|maintain\w*|perform\w*|respons\w*|ran|run|runs|running|launch\w*|improv\w*|reduc\w*|cut|increas\w*|automat\w*|coordinat\w*|present\w*|process\w*|handl\w*|conduct\w*)$/;
const SUPPORT = /^(assist\w*|help(?:ed|s|ing)?|support(?:ed|s|ing)?|contribut\w*|participat\w*|collaborat\w*|aid(?:ed|s|ing)?|involved|shadow\w*|attend\w*)$/;

const levelOf = (w) => (LEAD.test(w) ? 3 : DO.test(w) ? 2 : SUPPORT.test(w) ? 1 : 0);

// "the lead", "my manager", "the hiring manager", "the director" name ANOTHER person, not what the user did. They look like leading verbs to the lists
// above, so "I assisted the lead" would count as already leading and a later "led" would never be flagged. A role word after one of these words is
// skipped, unless the user says it is their own role ("as a manager", "was the lead"). A bare title ("Team Lead", "Product Manager") is still a claim.
const ROLE_NOUN = /^(lead|leads|manager|managers|director|directors|head|owner|owners|supervisor|supervisors)$/;
const ANOTHER_PERSON = new Set(['the', 'a', 'an', 'my', 'our', 'your', 'their', 'his', 'her', 'its', 'this', 'that', 'hiring', 'line', 'reporting']);
const OWN_ROLE = new Set(['as', 'was', 'were', 'am', 'be', 'been', 'being', 'became', 'become', 'becoming', 'served', 'acting', 'role']);

// [{ word, level }] in order, with a role noun that names another person set to level 0.
function levelsIn(text) {
  const ws = words(text);
  return ws.map((w, i) => {
    const another = ROLE_NOUN.test(w) && i > 0 && ANOTHER_PERSON.has(ws[i - 1]) && !(i > 1 && OWN_ROLE.has(ws[i - 2]));
    return { word: w, level: another ? 0 : levelOf(w) };
  });
}

// 0 = no contribution verb, 1 = supported, 2 = did, 3 = led/owned. The highest level found.
export function contributionLevel(text) {
  return levelsIn(text).reduce((m, x) => Math.max(m, x.level), 0);
}
const firstVerbAt = (text, level) => levelsIn(text).find(x => x.level === level)?.word;

const SCOPE = ['company-wide', 'organization-wide', 'organisation-wide', 'enterprise', 'global', 'globally', 'worldwide', 'nationwide', 'cross-functional',
  'executive', 'executives', 'c-suite', 'board', 'stakeholder', 'stakeholders', 'strategic', 'strategy', 'decision', 'decisions', 'budget', 'budgets', 'p&l'];

const OUTCOME = /^(grew|grown|gain(?:ed|s)?|doubled|tripled|improv\w*|increas\w*|reduc\w*|sav(?:e|ed|es|ing|ings)|grow\w*|boost\w*|generat\w*|accelerat\w*|streamlin\w*|cut|lower\w*|enhanc\w*|optimi[sz]\w*)$/;

// Capitalised words (not at the start of a sentence), acronyms and names with a dot or digit, e.g. Tableau, AWS, Node.js.
function namedTerms(text) {
  const out = [];
  const t = String(text ?? '');
  const re = /[A-Za-z][A-Za-z0-9.+#]*/g;
  let m;
  while ((m = re.exec(t))) {
    const w = m[0];
    const before = t.slice(0, m.index).trimEnd();
    const sentenceStart = before === '' || /[.!?:\n]$/.test(before);
    const named = /^[A-Z][a-z0-9]+/.test(w) || /^[A-Z]{2,}$/.test(w) || /[A-Za-z]\.[a-z]/.test(w);
    if (named && !sentenceStart) out.push(w.replace(/[.]+$/, ''));
  }
  return out;
}


// ── Things a rewrite can add without a figure, a tool name or a result word (measured 2026-10-14 on three models and 12 invented resumes) ──
// A duty ("handled escalated complaints"), a link, a place, a skill. Plain word and pattern rules, no AI; they only warn.
const STOP = new Set('the and for with from that this into over under about across through your you our their his her its are was were been being have has had having will would can could should may might not but all any each both more most other some such than then them they these those who whom whose which what when where why how also very just only own same too per via using used use within without between among while during before after again here there out off above below nor so as at by in of on to up is it be an a if no yes'.split(' '));
// Words a rewrite uses to sound stronger without adding a fact.
const FILLER = new Set('helped assisted supported worked responsible handled managed results driven focused strong proven skilled experienced reliable dedicated detail oriented team player effective efficient key core professional dynamic motivated passionate highly successfully consistently ensuring delivering providing contributing maintaining collaborating collaborated various multiple several daily weekly monthly day-to-day clear accurate timely quality high improved improving enhanced enhancing increased increasing reduced reducing streamlined optimized'.split(' '));
const stem = (w) => w.replace(/(ing|ed|es|s|ly)$/, '');
const noBlanks = (t) => String(t ?? '').replace(/\[[^\]]*\]/g, ' ');
const allWords = (t) => noBlanks(t).toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [];
const MIN_NEW_WORDS = 3;
const MIN_NEW_SHARE = 0.5;

// Every content word of the suggestion that the resume (and the text it replaces) never uses, and how many content words the suggestion has in all.
function freshWords(after, source) {
  const known = new Set(allWords(source).map(stem));
  const mine = [...new Set(allWords(after).filter((w) => !STOP.has(w) && !FILLER.has(w)))];
  return { fresh: mine.filter((w) => !known.has(stem(w))), total: mine.length };
}
// ...when they are at least half of what the suggestion says.
function newContentWords(before, after, source) {
  const { fresh, total } = freshWords(after, source);
  return fresh.length >= MIN_NEW_WORDS && fresh.length / total >= MIN_NEW_SHARE ? fresh : [];
}

// ── Layer 2: evidence. The model quotes the resume for what a suggestion is based on and names what it added that the resume does not say. Code
// trusts neither: a quote must really be in the resume, and words added without being declared are warned about. Without the fields (the old
// format) nothing here fires.
const normQuote = (t) => String(t ?? '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const MIN_QUOTE_CHARS = 6;
const MAX_DECLARED = 5;
const MAX_DECLARED_CHARS = 120;
const MIN_UNDECLARED = 2;
// A declared "addition" that is about a quantity ("number of customers assisted", "bug count", "invoice and payment volume") restates a figure the user is
// already asked to fill as a blank. (A real addition that names a quantity word, such as "sales volume", is dropped here; the result and ownership rules still see it.)
const QUANTITY = /\b(number|count|amount|headcount|percentage|percent|figures?|metrics?|volume|frequency|per (?:day|week|month|year|shift))\b/i;
// The contact line (an address, a phone number, a LinkedIn link): words added there are fields to fill, not claims about work.
const isContactLine = (t) => /@|linkedin\.com|\+?\d[\d\s().-]{7,}\d/i.test(String(t ?? ''));
const textsOf = (v, limit) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim() && x.length <= MAX_DECLARED_CHARS * 2).map((x) => x.trim()).slice(0, limit) : []);

function evidenceWarnings({ evidence, unsupported, before, after, source }) {
  const out = [];
  const hasEvidence = Array.isArray(evidence);
  if (!hasEvidence && !Array.isArray(unsupported)) return out;

  if (hasEvidence) {
    const haystack = normQuote(source);
    const missing = textsOf(evidence, 8).filter((q) => { const n = normQuote(q); return n.length >= MIN_QUOTE_CHARS && !haystack.includes(n); });
    if (missing.length) out.push({ type: 'bad_evidence', words: missing, message: `The AI quoted text that is not in your resume: "${missing[0]}"${missing.length > 1 ? ` and ${missing.length - 1} more` : ''}. Do not rely on that quote.` });
  }

  // A declaration is passed on only when it points at a word the suggestion really added (in "after", not in the resume), and not on the contact line.
  const added = new Set(freshWords(after, source).fresh.map(stem));
  const points = (x) => allWords(x).some((w) => added.has(stem(w)));
  const declared = isContactLine(before) || isContactLine(after) ? [] : textsOf(unsupported, MAX_DECLARED * 3).filter((x) => x.length <= MAX_DECLARED_CHARS && !QUANTITY.test(x) && points(x)).slice(0, MAX_DECLARED);
  if (declared.length) out.push({ type: 'declared_addition', words: declared, message: `The AI says this suggestion adds: ${declared.join('; ')}. Keep it only if it is true.` });

  if (hasEvidence && !isContactLine(before) && !isContactLine(after)) {
    const covered = new Set(allWords(declared.join(' ')).map(stem));
    const undeclared = freshWords(after, source).fresh.filter((w) => !covered.has(stem(w)));
    if (undeclared.length >= MIN_UNDECLARED) out.push({ type: 'undeclared_addition', words: undeclared.slice(0, 6), message: `The suggestion also adds words your resume does not use, and the AI did not mention them: ${undeclared.slice(0, 6).join(', ')}. Keep it only if it is true.` });
  }
  return out;
}

const HEADING_WORDS = /^(skills?|technical skills|core skills|key skills)$/;
const listItems = (t) => noBlanks(t).replace(/\([^)]*\)/g, '').split(/[,;\n]/).map((x) => x.trim().toLowerCase()).filter((x) => x && !HEADING_WORDS.test(x));
// A skills list: short items, no sentence, no verb of doing or leading in it.
// A sentence starts with a verb ("Built", "Managed"); a skills list starts with a skill, and a skill name may contain "management" or "planning".
const STARTS_WITH_VERB = /^(?:built|wrote|ran|led|drove|grew|cut|made|did|[a-z]+ed)$/;
const looksLikeSkillList = (t) => { const items = listItems(t); return items.length >= 2 && items.every((x) => x.split(/\s+/).length <= 4) && !/[.!?]\s*$/.test(String(t).trim()) && !STARTS_WITH_VERB.test(items[0].split(/\s+/)[0]); };
function newSkills(before, after, sourceLower) {
  if (!looksLikeSkillList(before)) return [];
  const known = listItems(before);
  const inSource = (x) => sourceLower.includes(x);
  const sameSkill = (x) => known.some((k) => k === x || k.includes(x) || x.includes(k));
  const items = listItems(after);
  // an item longer than a skill name is advice or a sentence, not a skill
  return items.length >= known.length ? [...new Set(items.filter((x) => x.split(/\s+/).length <= 4 && !inSource(x) && !sameSkill(x)))] : [];
}

export function claimWarnings({ before = '', after = '', resumeText = '', evidence, unsupported } = {}) {
  const out = [];
  const source = `${resumeText}\n${before}`;
  const sourceLower = source.toLowerCase();

  const lb = contributionLevel(before);
  const la = contributionLevel(after);
  if (la === 3 && lb < 3) {
    const was = firstVerbAt(before, lb);
    const now = firstVerbAt(after, la);
    out.push({
      type: 'ownership',
      words: [now],
      message: was
        ? `Your resume says "${was}" here; the suggestion says "${now}". Keep it only if your role really was that.`
        : `The suggestion says "${now}", which claims more responsibility than the text it replaces. Keep it only if it is true.`,
    });
  }

  const scope = SCOPE.filter(w => words(after).includes(w) && !sourceLower.includes(w));
  if (scope.length) out.push({ type: 'scope', words: scope, message: `The suggestion adds scope your resume does not mention: ${scope.join(', ')}. Keep it only if it is true.` });

  const seen = new Set();
  const terms = namedTerms(after).filter(w => {
    const k = w.toLowerCase();
    if (seen.has(k) || sourceLower.includes(k)) return false;
    seen.add(k); return true;
  });
  if (terms.length) out.push({ type: 'new_term', words: terms, message: `The suggestion names ${terms.join(', ')}, which is not in your resume. Keep it only if you used it.` });

  const hasOutcome = (t) => words(t).some(w => OUTCOME.test(w));
  if (hasOutcome(after) && !hasOutcome(source)) {
    out.push({ type: 'result', words: words(after).filter(w => OUTCOME.test(w)), message: 'The suggestion claims a result that nothing in your resume states. Keep it only if you can back it up.' });
  }

  if (String(before).trim()) {
    const fresh = newContentWords(before, after, source);
    if (fresh.length) out.push({ type: 'new_content', words: fresh.slice(0, 6), message: `The suggestion talks about things your resume does not mention: ${fresh.slice(0, 6).join(', ')}. Keep it only if it is true.` });
  }

  for (const m of String(after).matchAll(/linkedin\.com\/in\/([A-Za-z0-9._‐-―-]+)/gi)) {
    if (!sourceLower.includes(m[1].toLowerCase())) { out.push({ type: 'invented_link', words: [m[0]], message: `The suggestion gives a link (${m[0]}) that is not in your resume. Use your own address, or remove it.` }); break; }
  }
  for (const m of String(after).matchAll(/\blocation\s*:\s*([^|\n\[\]]+)/gi)) {
    const value = m[1].trim(); const city = value.split(',')[0].trim().toLowerCase();
    if (city.length > 1 && !sourceLower.includes(city)) { out.push({ type: 'invented_location', words: [value], message: `The suggestion gives a place (${value}) that your resume does not name. Use your own, or remove it.` }); break; }
  }

  out.push(...evidenceWarnings({ evidence, unsupported, before, after, source }));

  const skills = newSkills(before, after, sourceLower);
  if (skills.length) out.push({ type: 'new_skill', words: skills, message: `The suggestion adds skills your resume does not list: ${skills.join(', ')}. Keep only the ones you really have.` });

  return out;
}

// The warning messages for one AI suggestion (an issue with before / after, and, when the model followed the newer format, evidence / unsupported).
// `after` can be another text than issue.after, for example the draft as it would be saved.
export const warningsForIssue = (issue, resumeText, after = issue?.after) =>
  claimWarnings({ before: issue?.before ?? '', after: after ?? '', resumeText, evidence: issue?.evidence, unsupported: issue?.unsupported }).map(w => w.message);
