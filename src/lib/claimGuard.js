// Warnings for an AI rewrite that changes what a resume CLAIMS, beyond the figures that factGuard.js neutralises:
// a higher role (assisted -> led), a wider scope (company-wide, executive), a tool or name the resume never mentions,
// or an outcome nothing in the resume supports. Plain word lists, no AI. These are warnings for the person to check, never proof:
// a word list cannot know what is true, and it will miss claims phrased in ways it does not list.

const words = (s) => String(s ?? '').toLowerCase().match(/[a-z][a-z'&-]*/g) || [];

const LEAD = /^(led|lead|leads|leading|manag\w*|direct(?:ed|s|ing|or)?|own(?:ed|s|ing|ership)?|head(?:ed|s|ing)?|overs(?:aw|ee|ees|eeing|ight)|spearhead\w*|driv(?:e|es|ing|en)|drove|supervis\w*|architect(?:ed|s|ing)?|founded|established|championed|orchestrated)$/;
const DO = /^(built|build\w*|creat\w*|develop\w*|produc\w*|wrote|writ\w*|analy[sz]\w*|prepar\w*|implement\w*|deliver\w*|design\w*|execut\w*|maintain\w*|perform\w*|respons\w*|ran|run|runs|running|launch\w*|improv\w*|reduc\w*|cut|increas\w*|automat\w*|coordinat\w*|present\w*|process\w*|handl\w*|conduct\w*)$/;
const SUPPORT = /^(assist\w*|help(?:ed|s|ing)?|support(?:ed|s|ing)?|contribut\w*|participat\w*|collaborat\w*|aid(?:ed|s|ing)?|involved|shadow\w*|attend\w*)$/;

const levelOf = (w) => (LEAD.test(w) ? 3 : DO.test(w) ? 2 : SUPPORT.test(w) ? 1 : 0);

// 0 = no contribution verb, 1 = supported, 2 = did, 3 = led/owned. The highest level found.
export function contributionLevel(text) {
  return words(text).reduce((m, w) => Math.max(m, levelOf(w)), 0);
}
const firstVerbAt = (text, level) => words(text).find(w => levelOf(w) === level);

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

// Words of the suggestion that the resume (and the text it replaces) never uses, when they are at least half of what the suggestion says.
function newContentWords(before, after, source) {
  const known = new Set(allWords(source).map(stem));
  const mine = [...new Set(allWords(after).filter((w) => !STOP.has(w) && !FILLER.has(w)))];
  const fresh = mine.filter((w) => !known.has(stem(w)));
  return fresh.length >= MIN_NEW_WORDS && fresh.length / mine.length >= MIN_NEW_SHARE ? fresh : [];
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

export function claimWarnings({ before = '', after = '', resumeText = '' } = {}) {
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

  const skills = newSkills(before, after, sourceLower);
  if (skills.length) out.push({ type: 'new_skill', words: skills, message: `The suggestion adds skills your resume does not list: ${skills.join(', ')}. Keep only the ones you really have.` });

  return out;
}
