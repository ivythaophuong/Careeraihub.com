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

  return out;
}
