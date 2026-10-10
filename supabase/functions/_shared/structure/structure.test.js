// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { scoreStarStructure, scoreInterviewAnswer, scoreInterviewSession, STATUS, comparable, detectLanguage, metricSignals, ENABLED_LANGUAGES } from './index.js';
import { SCORE_VERSIONS, rulesFingerprint, STAR_WEIGHTS } from './rules.js';
import { makeResult, SCORE_TYPES } from './contract.js';
import { WEIGHTS as STAR_UI_WEIGHTS } from '../starScoring.js';
import { EN_STORIES, VI_STORIES, OTHER_LANGUAGE, EN_ANSWERS, VI_ANSWERS, Q, QVI } from './fixtures.js';

const BOTH = { enabledLanguages: ['en', 'vi'] };
const EN = { enabledLanguages: ['en'] };
const VI = { enabledLanguages: ['vi'] };
const star = (s, o = BOTH) => scoreStarStructure(s, o);
const ans = (a, q = Q, o = BOTH) => scoreInterviewAnswer({ question: q, answer: a }, o);
const checkOf = (r, id, section) => r.evidence.find((c) => c.id === id && (!section || c.section === section));

describe('contract', () => {
  it('a score exists only when status is scored, and the same input gives the same result', () => {
    const a = star(EN_STORIES.strong), b = star(EN_STORIES.strong);
    expect(a.status).toBe(STATUS.SCORED);
    expect(Number.isInteger(a.score)).toBe(true);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    for (const r of [star(EN_STORIES.incomplete), star(OTHER_LANGUAGE.french), star(null)]) expect(r.score).toBeNull();
  });
  it('refuses to build a scored result without a number, and an unknown status', () => {
    expect(() => makeResult({ scoreType: 'x', scoreVersion: '1', status: STATUS.SCORED })).toThrow();
    expect(() => makeResult({ scoreType: 'x', scoreVersion: '1', status: 'weird' })).toThrow();
  });
  it('is not directly comparable across types, versions or non-scored results', () => {
    const a = star(EN_STORIES.strong);
    expect(comparable(a, star(EN_STORIES.strong))).toBe(true);
    expect(comparable(a, { ...a, score_version: '2.0.0' })).toBe(false);
    expect(comparable(a, { ...a, score_type: 'other' })).toBe(false);
    expect(comparable(a, star(EN_STORIES.incomplete))).toBe(false);
  });
  it('no language is enabled until the owner enables it (the gate file is empty)', () => {
    expect(ENABLED_LANGUAGES).toEqual([]);
    const r = scoreStarStructure(EN_STORIES.strong); // default options
    expect(r.status).toBe(STATUS.UNSUPPORTED_LANGUAGE);
    expect(r.score).toBeNull();
  });
  it('a processing failure is never a valid score', () => {
    for (const bad of [null, undefined, 5, 'text']) {
      const r = star(bad);
      expect(r.status).toBe(STATUS.PROCESSING_ERROR);
      expect(r.score).toBeNull();
    }
    expect(scoreInterviewAnswer(null, BOTH).status).toBe(STATUS.PROCESSING_ERROR);
    expect(scoreInterviewSession('not a list').status).toBe(STATUS.PROCESSING_ERROR);
  });
});

describe('rules are versioned: changing a weight, list or threshold must bump the version', () => {
  // If this fails, you changed scoring rules. Increment SCORE_VERSIONS for the affected type and update the fingerprint here on purpose.
  const PINNED = {
    star_structure: ['1.0.0', '2069dab3'],
    interview_answer_structure: ['1.0.0', 'bbf7ff71'],
    interview_session_structure: ['1.0.0', 'bbf7ff71'],
  };
  it.each(Object.entries(PINNED))('%s', (type, [version, fingerprint]) => {
    expect(SCORE_VERSIONS[type]).toBe(version);
    expect(rulesFingerprint(type)).toBe(fingerprint);
  });
  it('STAR weights equal the weights the app already shows (star.js / starScoring.js)', () => {
    expect(STAR_WEIGHTS).toEqual(STAR_UI_WEIGHTS);
  });
  it('results carry the version of the rules that produced them', () => {
    expect(star(EN_STORIES.strong).score_version).toBe(SCORE_VERSIONS.star_structure);
    expect(ans(EN_ANSWERS.strong).score_version).toBe(SCORE_VERSIONS.interview_answer_structure);
  });
});

describe('language detection', () => {
  it.each([
    ['English', 'I was responsible for the migration and we finished it on time with the team.', 'en'],
    ['Vietnamese', 'Tôi chịu trách nhiệm cho việc chuyển hệ thống và chúng tôi đã hoàn thành đúng hạn.', 'vi'],
    ['Vietnamese with English tech words', EN_ANSWERS && VI_ANSWERS.codeSwitch, 'vi'],
    ['French', OTHER_LANGUAGE.french.task, 'other'],
    ['Chinese', OTHER_LANGUAGE.chinese.task, 'other'],
    ['too short', 'ok done', 'unknown'],
  ])('%s', (_n, text, expected) => expect(detectLanguage(text).language).toBe(expected));
  it('full sentences in two languages are mixed, not guessed', () => {
    expect(detectLanguage('I was responsible for the migration and we finished it on time. Tôi chịu trách nhiệm cho việc chuyển hệ thống và chúng tôi đã hoàn thành đúng hạn.').language).toBe('mixed');
  });
  it('NFC and decomposed Vietnamese text give the same result', () => {
    const nfd = VI_STORIES.strong.action.normalize('NFD');
    expect(star({ ...VI_STORIES.strong, action: nfd }).score).toBe(star(VI_STORIES.strong).score);
  });
});

describe('numbers', () => {
  it('counts quantities, not years, and tells strong from bare numbers', () => {
    expect(metricSignals('Cut costs by 40% and $2,000 per month')).toMatchObject({ strong: 2 });
    expect(metricSignals('Joined in 2021')).toEqual({ strong: 0, weak: 0 });
    expect(metricSignals('I bought 7 things')).toEqual({ strong: 0, weak: 1 });
    expect(metricSignals('giảm 40% chi phí, tiết kiệm 15 giờ')).toMatchObject({ strong: 2 });
  });
});

describe('STAR Structure Score — English', () => {
  it('a complete, concrete story scores well above short, padded, vague and quantified-but-irrelevant ones', () => {
    const s = star(EN_STORIES.strong, EN).score;
    for (const k of ['short', 'padded', 'vague', 'quantifiedIrrelevant', 'notStar']) expect(s).toBeGreaterThan(star(EN_STORIES[k], EN).score);
  });
  it('short stories are scored low (not hidden), padded stories are flagged', () => {
    expect(star(EN_STORIES.short, EN).status).toBe(STATUS.SCORED);
    const padded = star(EN_STORIES.padded, EN);
    expect(checkOf(padded, 'length', 'action').note).toMatch(/repeated/);
    expect(padded.sections.action.capped).toBe('repeated words');
    expect(padded.score).toBeLessThanOrEqual(55); // repetition cannot pass for a good story
    expect(star(EN_STORIES.strong, EN).sections.action.capped).toBeUndefined();
  });
  it('vague wording is counted and lowers the vague check', () => {
    const r = star(EN_STORIES.vague, EN);
    expect(checkOf(r, 'vague', 'action').value.vagueWords).toBeGreaterThan(3);
    expect(checkOf(r, 'vague', 'action').score).toBeLessThan(checkOf(star(EN_STORIES.strong, EN), 'vague', 'action').score);
  });
  it('a number in the result is a structural signal only: irrelevant numbers raise that one check, not the whole story', () => {
    const q = star(EN_STORIES.quantifiedIrrelevant, EN);
    expect(checkOf(q, 'concrete', 'result').score).toBe(100);
    expect(q.score).toBeLessThan(star(EN_STORIES.strong, EN).score);
    expect(q.evidence.find((c) => c.id === 'concrete').note).toBe('');
  });
  it('first-person wording is not proof of ownership; team-only wording is shown as such', () => {
    const team = star(EN_STORIES.teamOnly, EN);
    const own = checkOf(team, 'ownership', 'action');
    expect(own.value.singular).toBe(0);
    expect(own.value.team).toBeGreaterThan(0);
    expect(own.note).toBe('team wording only');
    expect(own.score).toBeLessThan(checkOf(star(EN_STORIES.strong, EN), 'ownership', 'action').score);
    expect(team.score).toBeLessThan(star(EN_STORIES.strong, EN).score);
  });
  it('an incomplete story gets no score and no inflated weights: insufficient_data naming the missing section', () => {
    const r = star(EN_STORIES.incomplete, EN);
    expect(r.status).toBe(STATUS.INSUFFICIENT_DATA);
    expect(r.score).toBeNull();
    expect(r.notes[0]).toMatch(/task/);
    expect(r.sections.task.status).toBe(STATUS.INSUFFICIENT_DATA);
  });
  it('every check is listed with its outcome and counts', () => {
    const r = star(EN_STORIES.strong, EN);
    expect(r.evidence.length).toBe(12);
    for (const c of r.evidence) { expect(['pass', 'partial', 'fail']).toContain(c.outcome); expect(c.value).toBeTruthy(); }
  });
  it('a section score uses only that section\'s own text', () => {
    const a = star(EN_STORIES.strong, EN);
    const b = star({ ...EN_STORIES.strong, situation: EN_STORIES.vague.situation }, EN);
    expect(b.sections.action.score).toBe(a.sections.action.score);
    expect(b.sections.result.score).toBe(a.sections.result.score);
    expect(b.sections.situation.score).not.toBe(a.sections.situation.score);
  });
});

describe('repetition cap: stops padding, does not punish natural repetition', () => {
  const natural = {
    // Repeats "customers" and "orders" on purpose, as real writing does; still mostly distinct words.
    situation: 'Last year our customers kept leaving because checkout was slow, and the customers who stayed told the company that orders failed.',
    task: 'I was responsible for fixing the orders flow so customers could finish their orders before the November campaign.',
    action: 'I profiled the orders page, removed two blocking scripts, added caching and then I ran load tests with the team to confirm customers saw the fix.',
    result: 'Load time dropped by 40% and orders from customers rose 12% in the first month, and complaints stopped.',
  };
  it('natural repetition is not capped', () => {
    const r = star(natural, EN);
    for (const k of ['situation', 'task', 'action', 'result']) expect(r.sections[k].capped).toBeUndefined();
    expect(r.score).toBeGreaterThanOrEqual(85);
  });
  it('heavy repetition is capped section by section, and the cap applies only to the repeated sections', () => {
    const r = star({ ...EN_STORIES.strong, action: EN_STORIES.padded.action }, EN);
    expect(r.sections.action.capped).toBe('repeated words');
    expect(r.sections.action.score).toBeLessThanOrEqual(50);
    expect(r.sections.situation.capped).toBeUndefined();
  });
  it('short texts are never judged as repeated (too few words to say)', () => {
    const r = star({ situation: 'Slow slow slow site.', task: 'Fix fix it now.', action: 'I fixed fixed it.', result: 'Fast fast now.' }, EN);
    for (const k of ['situation', 'task', 'action', 'result']) expect(r.sections[k].capped).toBeUndefined();
  });
});

describe('missing data never inflates a score', () => {
  it('three perfect sections and one missing give no score at all (weights are not re-spread over the three)', () => {
    for (const missing of ['situation', 'task', 'action', 'result']) {
      const r = star({ ...EN_STORIES.strong, [missing]: '' }, EN);
      expect(r.status).toBe(STATUS.INSUFFICIENT_DATA);
      expect(r.score).toBeNull();
      expect(r.sections[missing].score).toBeNull();
      for (const k of Object.keys(r.sections)) if (k !== missing) expect(r.sections[k].status).toBe('not_assessed'); // present sections are not scored either
    }
  });
  it('a check that cannot be evaluated is left out and listed, not counted as 0', () => {
    const r = ans('I led the migration at Acme and we cut errors by 30% in two weeks across all teams.', '', EN); // empty question: no relevance comparison
    expect(r.status).toBe(STATUS.SCORED);
    const rel = r.evidence.find((c) => c.id === 'relevance');
    expect(rel.outcome).toBe('not_evaluated');
    expect(rel.score).toBeNull();
  });
});

describe('isolation: nothing depends on this folder yet (rollback is a plain revert)', () => {
  it('no file outside _shared/structure imports it', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const here = path.dirname(new URL(import.meta.url).pathname);
    const root = path.resolve(here, '../../../..');
    const hits = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', '.git', 'dist', 'research'].includes(e.name)) continue;
        const full = path.join(dir, e.name);
        if (full === here) continue;
        if (e.isDirectory()) walk(full);
        else if (/\.(jsx?|tsx?|mjs)$/.test(e.name) && /_shared\/structure|\.\/structure\//.test(fs.readFileSync(full, 'utf8'))) hits.push(path.relative(root, full));
      }
    };
    for (const d of ['src', 'supabase', 'tests', 'scripts']) if (fs.existsSync(path.join(root, d))) walk(path.join(root, d));
    expect(hits).toEqual([]);
  });
});

describe('STAR Structure Score — Vietnamese', () => {
  it('works on Vietnamese text with diacritics and ranks complete over short, vague and quantified-but-irrelevant', () => {
    const s = star(VI_STORIES.strong, VI);
    expect(s.status).toBe(STATUS.SCORED);
    expect(s.language).toBe('vi');
    for (const k of ['short', 'vague', 'quantifiedIrrelevant']) expect(s.score).toBeGreaterThan(star(VI_STORIES[k], VI).score);
  });
  it('knows "chúng tôi" is team wording even though it contains "tôi"', () => {
    const own = checkOf(star(VI_STORIES.teamOnly, VI), 'ownership', 'action');
    expect(own.value.singular).toBe(0);
    expect(own.value.team).toBeGreaterThanOrEqual(2);
    const mine = checkOf(star(VI_STORIES.strong, VI), 'ownership', 'action');
    expect(mine.value.singular).toBeGreaterThan(0);
  });
  it('an incomplete Vietnamese story is insufficient data', () => {
    expect(star(VI_STORIES.incomplete, VI).status).toBe(STATUS.INSUFFICIENT_DATA);
  });
  it('Vietnamese is not scored with English rules: it is unsupported until its own gate is open', () => {
    const r = star(VI_STORIES.strong, EN);
    expect(r.status).toBe(STATUS.UNSUPPORTED_LANGUAGE);
    expect(r.language).toBe('vi');
    expect(r.score).toBeNull();
  });
  it('English is likewise not scored when only Vietnamese is enabled', () => {
    expect(star(EN_STORIES.strong, VI).status).toBe(STATUS.UNSUPPORTED_LANGUAGE);
  });
  it('the same story is scored with the Vietnamese length band, not the English one', () => {
    expect(checkOf(star(VI_STORIES.strong, VI), 'length', 'action').value.idealMax).toBe(Math.round(150 * 1.4));
  });
});

describe('unsupported languages never get a misleading low score', () => {
  it.each(['french', 'chinese'])('%s', (k) => {
    for (const r of [star(OTHER_LANGUAGE[k]), ans(OTHER_LANGUAGE[k].action)]) { expect(r.status).toBe(STATUS.UNSUPPORTED_LANGUAGE); expect(r.score).toBeNull(); }
  });
});

describe('Interview Structure Score — English', () => {
  it('a specific, relevant answer beats parroting the question, filler, and a tiny answer', () => {
    const s = ans(EN_ANSWERS.strong).score;
    expect(s).toBeGreaterThan(ans(EN_ANSWERS.parrot).score);
    expect(s).toBeGreaterThan(ans(EN_ANSWERS.fillerUm).score);
  });
  it('repeating the question\'s words without adding an answer does not earn a high relevance score', () => {
    const r = ans(EN_ANSWERS.parrot);
    expect(checkOf(r, 'relevance').score).toBeLessThanOrEqual(30);
    expect(checkOf(r, 'relevance').note).toMatch(/few words beyond/);
  });
  it('a short but relevant answer is not failed for length alone', () => {
    const r = ans(EN_ANSWERS.shortRelevant);
    expect(r.status).toBe(STATUS.SCORED);
    expect(checkOf(r, 'length').score).toBeGreaterThanOrEqual(70);
    expect(r.score).toBeGreaterThan(ans(EN_ANSWERS.parrot).score);
  });
  it('an answer without STAR cues can still score well when relevant and specific', () => {
    const r = ans(EN_ANSWERS.noStarButRelevant);
    expect(checkOf(r, 'starCues').value.result).toBe(false);
    expect(r.score).toBeGreaterThanOrEqual(55);
  });
  it('filler spellings count the same: "um", "ummm", "uhhh"', () => {
    const a = checkOf(ans(EN_ANSWERS.fillerUm), 'hedging').value.hedgeOrFiller;
    const b = checkOf(ans(EN_ANSWERS.fillerUmmmm), 'hedging').value.hedgeOrFiller;
    expect(b).toBeGreaterThanOrEqual(a - 2);
    expect(checkOf(ans(EN_ANSWERS.fillerUmmmm), 'hedging').score).toBeLessThan(checkOf(ans(EN_ANSWERS.strong), 'hedging').score);
  });
  it('names, tools and numbers raise specificity, and the note says that is detail, not correctness', () => {
    const r = ans(EN_ANSWERS.strong);
    expect(checkOf(r, 'specificity').value.namedThings).toBeGreaterThanOrEqual(1);
    expect(checkOf(r, 'specificity').note).toMatch(/not correctness/);
  });
  it('too short to assess is insufficient data, not zero', () => {
    const r = ans(EN_ANSWERS.tiny);
    expect(r.status).toBe(STATUS.INSUFFICIENT_DATA);
    expect(r.score).toBeNull();
  });
  it('integrity signals are not inputs: extra fields change nothing', () => {
    const base = scoreInterviewAnswer({ question: Q, answer: EN_ANSWERS.strong }, BOTH);
    const withSignals = scoreInterviewAnswer({ question: Q, answer: EN_ANSWERS.strong, pasted_chars: 500, tab_hidden_count: 9, time_ms: 100 }, BOTH);
    expect(withSignals.score).toBe(base.score);
  });
  it('is deterministic', () => {
    expect(JSON.stringify(ans(EN_ANSWERS.strong))).toBe(JSON.stringify(ans(EN_ANSWERS.strong)));
  });
});

describe('Interview Structure Score — Vietnamese', () => {
  it('scores a Vietnamese answer and rewards specifics over parroting and filler', () => {
    const s = ans(VI_ANSWERS.strong, QVI, VI);
    expect(s.status).toBe(STATUS.SCORED);
    expect(s.language).toBe('vi');
    expect(s.score).toBeGreaterThan(ans(VI_ANSWERS.parrot, QVI, VI).score);
    expect(s.score).toBeGreaterThan(ans(VI_ANSWERS.filler, QVI, VI).score);
  });
  it('Vietnamese filler and hedges (ờ, ừm, ừmmm, kiểu như, hình như) are counted', () => {
    expect(checkOf(ans(VI_ANSWERS.filler, QVI, VI), 'hedging').value.hedgeOrFiller).toBeGreaterThanOrEqual(5);
  });
  it('code-switching: English tool names inside a Vietnamese answer still count as Vietnamese and as specific details', () => {
    const r = ans(VI_ANSWERS.codeSwitch, QVI, VI);
    expect(r.language).toBe('vi');
    expect(r.status).toBe(STATUS.SCORED);
    expect(checkOf(r, 'specificity').value.namedThings).toBeGreaterThanOrEqual(2); // AWS, Jira
  });
  it('a Vietnamese answer is not scored with English rules', () => {
    expect(ans(VI_ANSWERS.strong, QVI, EN).status).toBe(STATUS.UNSUPPORTED_LANGUAGE);
  });
});

describe('Interview session score', () => {
  const ok = (a) => ans(a);
  it('is the mean of scored answers, and says what was left out', () => {
    const answers = [ok(EN_ANSWERS.strong), ok(EN_ANSWERS.fillerUm), ok(EN_ANSWERS.tiny), ans(OTHER_LANGUAGE.french.action)];
    const sess = scoreInterviewSession(answers, { skipped: 1 });
    const scored = answers.filter((a) => a.status === STATUS.SCORED);
    expect(sess.status).toBe(STATUS.SCORED);
    expect(sess.score).toBe(Math.round(scored.reduce((s, a) => s + a.score, 0) / scored.length));
    expect(sess.evidence[0].value).toMatchObject({ scored: 2, skipped: 1, insufficient_data: 1, unsupported_language: 1 });
    expect(sess.notes[0]).toMatch(/left out/);
  });
  it('excluded answers never act as zeros', () => {
    const one = scoreInterviewSession([ok(EN_ANSWERS.strong)]);
    const withTiny = scoreInterviewSession([ok(EN_ANSWERS.strong), ok(EN_ANSWERS.tiny)], { skipped: 3 });
    expect(withTiny.score).toBe(one.score);
  });
  it('no scored answer means no session score', () => {
    const r = scoreInterviewSession([ok(EN_ANSWERS.tiny)], { skipped: 4 });
    expect(r.status).toBe(STATUS.INSUFFICIENT_DATA);
    expect(r.score).toBeNull();
  });
  it('answers scored under another version are left out, not mixed in', () => {
    const a = ok(EN_ANSWERS.strong);
    const r = scoreInterviewSession([a, { ...a, score_version: '0.9.0' }]);
    expect(r.evidence[0].value).toMatchObject({ scored: 1, other_version: 1 });
  });
  it('processing failures are listed, never scored', () => {
    const r = scoreInterviewSession([ok(EN_ANSWERS.strong), scoreInterviewAnswer(null, BOTH)]);
    expect(r.evidence[0].value.processing_error).toBe(1);
  });
});

describe('purity', () => {
  it('the scoring modules import nothing with a model, network, database or browser dependency', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = path.dirname(new URL(import.meta.url).pathname);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js') && f !== 'fixtures.js');
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      expect(src, f).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|localStorage|document\.|window\.|process\.env|Deno\.|Math\.random|Date\.now|new Date/);
      for (const m of src.matchAll(/from\s+'([^']+)'/g)) expect(m[1], `${f} imports ${m[1]}`).toMatch(/^\.\//);
    }
  });
});
