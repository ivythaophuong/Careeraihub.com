import React, { useState, useRef, useEffect } from 'react';
import { isBulletIssue, isSkillsIssue, isDatesIssue, fieldsIssueKind, draftFor } from '../issueStep.js';
import { listContactFields, listEducationFields, fieldFindings, setField, mergeFieldRecords } from '../fieldsFix.js';
import { listDateEntries, dateFindings, setDate, mergeDateRecords } from '../datesFix.js';
import { addSkill, removeSkill, mergeSkillRecords, skillList, skillsFindings } from '../skillsFix.js';
import { closestBullets, fixTargets, suggestionFor, saveFix, issueStatus, nextUnresolved, firstUnresolved, summaryCounts, issueKey, fieldText, withFieldText, undoRecord } from '../fixPage.js';

// The Fix page: your resume on the left, with the sentences that can be improved highlighted; your new resume on the right, which follows what you type;
// and one editor below them. One issue at a time, and one thing at a time inside the editor: first two choices (improve it, or leave it), then the edit box,
// with the AI draft folded away until asked for. Choosing a template is another screen (the Templates tab).
// Nothing here calls AI; the engine is applyIssue.js through fixPage.js. The page keeps its own working copy while it is open and tells the page that
// holds the data after every save (onChange). Design: docs/architecture/plans/DESIGN-fix-page-flow.md.

const SEV = { critical: '#FF5A5A', high: '#FFB84D', medium: 'var(--lp-text3)', low: 'var(--lp-text3)' };
const label = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const A4 = 794;
// Two views, chosen by the user and remembered: Focus (one resume, larger, with the editor beside it) and Compare (your resume and the new one side by side).
// Until the user chooses, a wide screen opens in Compare and a laptop-sized one in Focus, because two A4 pages side by side make the text small.
const VIEW_KEY = 'careeraihub:fixpage:view';
const initialView = () => {
  try { const v = localStorage.getItem(VIEW_KEY); if (v === 'focus' || v === 'compare') return v; } catch { /* storage unavailable: use the width */ }
  return typeof window !== 'undefined' && window.innerWidth >= 1700 ? 'compare' : 'focus';
};
// True on a phone-sized screen (the same width as the stylesheet's phone rules). An old browser without matchMedia counts as a wide screen.
const PHONE_QUERY = '(max-width: 768px)';
function usePhone() {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const m = window.matchMedia(PHONE_QUERY);
    const on = () => setPhone(m.matches);
    on();
    if (m.addEventListener) m.addEventListener('change', on); else if (m.addListener) m.addListener(on);
    return () => { if (m.removeEventListener) m.removeEventListener('change', on); else if (m.removeListener) m.removeListener(on); };
  }, []);
  return phone;
}
const markKeyOf = (at) => (at.kind === 'summary' ? 'summary' : at.kind === 'skills' ? 'skills' : `b:${at.exp}:${at.bullet}`);

const css = `
.atb-fixpage [data-fix-marked] { outline: 2px solid var(--atb-mark, #22D3EE); outline-offset: 3px; background: var(--atb-mark-bg, rgba(34, 211, 238, .16)); }   /* the Builder's mark colour: not the pink of the main button */
.atb-fixpage [data-fix-open] { outline: 2px dashed #FF6B6B; outline-offset: 3px; background: rgba(255, 107, 107, .12); cursor: pointer; }
.atb-fixpage [data-fix-done] { outline: 2px solid #00E5A0; outline-offset: 3px; }
.atb-fixpage [data-fix-pickable] { cursor: pointer; }
.atb-fixpage [data-fix-pickable]:hover { outline: 2px dashed #FF6B6B; outline-offset: 3px; }
.atb-fixpage .atb-fix-tabs { display: none; }
@media (max-width: 768px) {
  .atb-fixpage .atb-fix-tabs { display: flex; }
  .atb-fixpage { height: auto !important; }
  .atb-fixpage .atb-fix-panes { grid-template-columns: 1fr !important; }
  .atb-fixpage .atb-fix-pane[data-active="false"] { display: none !important; }   /* !important: a pane sets its own display (flex), which would beat this rule and show every pane at once */
}`;

const btn = (primary) => ({
  padding: primary ? '10px 22px' : '7px 14px', fontSize: primary ? 13 : 12, fontWeight: 800, borderRadius: 8, cursor: 'pointer',
  border: primary ? 'none' : '1px solid var(--lp-bdr)', background: primary ? 'var(--lp-teal)' : 'transparent', color: primary ? '#000' : 'var(--lp-text2)',
});
const link = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--lp-text2)', fontSize: 12, fontWeight: 700, textDecoration: 'underline' };

// One resume, drawn in the template, scaled to its width. `marks` = [{ key, state: 'marked' | 'open' | 'done', label }], put on the elements the template
// tags with data-fix-at. When `onPick` is given, a marked sentence can be clicked or opened from the keyboard.
function ResumePane({ name, panel, hint, data, Template, templateId, marks, activeKey, onPick, active, pickable = false }) {
  const boxRef = useRef(null);
  const previewRef = useRef(null);
  const lastScrolled = useRef(null);
  const [scale, setScale] = useState(1);

  // The page is scaled to the width of its box. A pane that is not on screen (display: none) has no width, so it is measured again when it is shown,
  // as well as whenever the box changes size; never from a width of 0 or less.
  const fit = (width) => { const w = width - 32; setScale(w > 0 && w < A4 ? w / A4 : 1); };
  useEffect(() => {
    if (!boxRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => fit(e.contentRect.width));
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (active && boxRef.current) { const w = boxRef.current.clientWidth - 32; if (w > 0) fit(w); } }, [active]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;
    root.querySelectorAll('[data-fix-at]').forEach(el => {
      ['data-fix-marked', 'data-fix-open', 'data-fix-done', 'data-fix-pickable', 'role', 'tabindex', 'aria-label'].forEach(a => el.removeAttribute(a));
    });
    if (pickable && onPick) {          // every sentence under a job can be chosen (the issue's own sentence was not found)
      root.querySelectorAll('[data-fix-at^="b:"]').forEach(el => { el.setAttribute('data-fix-pickable', 'true'); el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('aria-label', 'Choose this sentence'); });
    }
    for (const m of marks) {
      const el = root.querySelector(`[data-fix-at="${m.key}"]`);
      if (!el) continue;
      el.setAttribute(`data-fix-${m.state}`, 'true');
      if (onPick && m.state !== 'done') { el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('aria-label', m.label); }
    }
    if (activeKey && lastScrolled.current !== activeKey) {
      lastScrolled.current = activeKey;
      const el = root.querySelector(`[data-fix-at="${activeKey}"]`);
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
    }
    if (!activeKey) lastScrolled.current = null;
  });

  const pick = (e) => {
    const el = e.target.closest?.('[data-fix-at]');
    if (el && onPick) onPick(el.getAttribute('data-fix-at'));
  };
  const key = (e) => { if (e.key === 'Enter' || e.key === ' ') { const el = e.target.closest?.('[data-fix-at]'); if (el && onPick) { e.preventDefault(); onPick(el.getAttribute('data-fix-at')); } } };

  return (
    <section aria-label={name} className="atb-fix-pane" data-pane={panel} data-active={active ? 'true' : 'false'} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, height: '100%' }}>
      <div style={{ fontSize: 12, color: 'var(--lp-text3)', lineHeight: 1.5, padding: '0 4px 8px' }}>{hint}</div>
      <div ref={boxRef} style={{ background: '#e0e0e0', padding: 16, overflow: 'auto', flex: 1, minHeight: 0, borderRadius: 10 }}>
        <div style={{ width: scale < 1 ? Math.round(A4 * scale) : A4, overflow: 'hidden', margin: '0 auto' }}>
          <div ref={previewRef} data-template={templateId} onClick={pick} onKeyDown={key}
            style={{ width: A4, transform: `scale(${scale})`, transformOrigin: 'top left', boxShadow: '0 4px 24px rgba(0,0,0,.2)' }}>
            {Template && <Template {...data} />}
          </div>
        </div>
      </div>
    </section>
  );
}

// The resume as it was before the improvements that are recorded: each recorded change is undone on a copy, so the left resume can show the
// sentence as it was even when the user comes back in a later visit. A change that was edited afterwards cannot be undone and is left as it is.
function revertApplied(data, records) {
  let cur = data;
  for (const e of Object.values(records || {})) {
    if (!e?.record) continue;
    const back = undoRecord(cur, e.record);
    if (back) cur = back;
  }
  return cur;
}

export default function FixPage({ data, issues = [], startKey = null, records = {}, onChange, onBackToList, onOpenBuilder, onChooseTemplate, template }) {
  const [work, setWork] = useState(data);
  const [recs, setRecs] = useState(records || {});

  // The issues this page can place: found in the summary or a bullet (or already applied). Fixed when the page opens, so an issue does not
  // leave the list because its text has just been replaced.
  const [original] = useState(() => revertApplied(data, records));
  // A bullet issue whose sentence cannot be found (the AI reworded it, or the user changed it) is on the page too, as a "pick" issue: the user clicks the
  // sentence it applies to. Other issues whose sentence is not found (dates, skills, a missing summary) stay with the step form.
  const hasBullets = (original.experience || []).some(j => (j.bullets || []).some(b => String(b || '').trim()));
  const [list] = useState(() => issues
    .map((issue, i) => {
      const located = ['one', 'many'].includes(fixTargets(original, issue).kind);
      const rec = !!records?.[issueKey(issue, i)];
      // An issue about the skills list (decided by words, see isSkillsIssue) gets the Skills card; a recorded skills change keeps it too.
      const skills = !located && (records?.[issueKey(issue, i)]?.record?.kind === 'skills' || isSkillsIssue(issue, original));
      // The same for the dates of the jobs and of the education (isDatesIssue).
      const dates = !located && !skills && (records?.[issueKey(issue, i)]?.record?.kind === 'dates' || isDatesIssue(issue, original));
      // And for the contact details or the education (fieldsIssueKind): 'contact', 'education' or null. A recorded change keeps its card.
      const recFields = records?.[issueKey(issue, i)]?.record;
      const fields = located || skills || dates ? null : (recFields?.kind === 'fields' ? (recFields.changes.some(c => c.ref.kind === 'edu') ? 'education' : 'contact') : fieldsIssueKind(issue, original));
      return { issue, i, key: issueKey(issue, i), skills, dates, fields, pick: !located && !skills && !dates && !fields && !rec && hasBullets && isBulletIssue(issue) };
    })
    .filter(it => records?.[it.key] || it.pick || it.skills || it.dates || it.fields || ['one', 'many'].includes(fixTargets(original, it.issue).kind)));

  // Where each issue's sentence is in the resume as it was when the page opened: this is what the left resume highlights.
  const [seed] = useState(() => {
    const out = [];
    list.forEach((it, itemPos) => {
      if (it.skills) { out.push({ key: 'skills', itemPos, at: { kind: 'skills' } }); return; }
      if (it.dates || it.fields) return;                     // the dates, the contact details and the education have no mark on the resume yet
      let ats = it.pick ? closestBullets(original, it.issue).map(c => c.at) : fixTargets(original, it.issue).places.map(p => p.at);   // for a pick issue: the nearest sentences
      if (!ats.length && records?.[it.key]?.record) ats = [records[it.key].record.at];   // improved and then edited: the place is known from the record
      ats.forEach(at => out.push({ key: markKeyOf(at), itemPos, at }));
    });
    return out;
  });

  // A pick issue nobody has acted on is open (it was never "changed by the user"); once it has a record it is read from the text like any other.
  const statusesFor = (d, r) => list.map(it => ((it.pick || it.skills || it.dates || it.fields) && !r[it.key]?.record ? 'open' : issueStatus(d, it.issue, r[it.key]?.record ?? null)));

  const startPos = () => {
    const statuses = statusesFor(data, records || {});
    const asked = startKey ? list.findIndex(it => it.key === startKey) : -1;
    if (asked >= 0) return asked;                       // an issue already improved opens too: it can be seen again, undone or improved again
    return firstUnresolved(statuses);
  };

  // The place an issue points to when it is in exactly one place; for several places the user chooses.
  const placeFor = (d, pos, r = recs) => {
    if (pos === null) return null;
    if (list[pos].skills || list[pos].dates || list[pos].fields) return null;                                    // the skills card has no one sentence to point at
    if (r?.[list[pos].key]?.record) return r[list[pos].key].record.at;   // improved: the place is in the record
    const t = fixTargets(d, list[pos].issue);
    return t.kind === 'one' ? t.places[0].at : null;
  };

  const [pos, setPos] = useState(startPos);
  const [chosenAt, setChosenAt] = useState(() => placeFor(data, startPos(), records || {}));
  const [text, setText] = useState(() => { const a = placeFor(data, startPos(), records || {}); return a ? fieldText(data, a) : ''; });
  const [improving, setImproving] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [msg, setMsg] = useState('');
  const [askReplace, setAskReplace] = useState(false);
  const [askLeave, setAskLeave] = useState(false);
  const [pendingPick, setPendingPick] = useState(null);
  const [stage, setStage] = useState(null);           // Skills: the list with the changes made on this page and not saved yet, and their record
  const [skillInput, setSkillInput] = useState('');
  const [drafts, setDrafts] = useState({});            // Dates: what the user has typed in each date box, by entry, and not saved yet
  const taRef = useRef(null);
  const [chosenView, setViewState] = useState(initialView);
  const [chosenPane, setPane] = useState(() => (initialView() === 'focus' ? 'editor' : 'original'));
  // On a phone only Focus is offered: two resumes side by side are too small to read there. The choice made on a wider screen is kept, not overwritten.
  const phone = usePhone();
  const view = phone ? 'focus' : chosenView;
  const pane = phone && (chosenPane === 'original' || chosenPane === 'new') ? 'editor' : chosenPane;
  const setView = (v) => { setViewState(v); setPane(v === 'focus' ? 'editor' : 'original'); try { localStorage.setItem(VIEW_KEY, v); } catch { /* the choice lives for this visit only */ } };

  const go = (nextPos, d, chosen, r = recs) => {
    const a = chosen || placeFor(d, nextPos, r);
    setPos(nextPos); setChosenAt(a); setText(a ? fieldText(d, a) : '');
    setImproving(false); setShowWhy(false); setShowDraft(false);
    setMsg(''); setAskReplace(false); setAskLeave(false); setPendingPick(null); setStage(null); setSkillInput(''); setDrafts({});
  };

  // Compare: the box is as tall as its text, from 90 px up to 320 px, then it scrolls. (In Focus it fills the column.)
  useEffect(() => {
    const el = taRef.current;
    if (!el || view !== 'compare') return;
    el.style.height = 'auto';
    if (el.scrollHeight) el.style.height = `${Math.min(Math.max(el.scrollHeight, 90), 320)}px`;
  });

  const current = pos === null ? null : list[pos];
  const statuses = statusesFor(work, recs);
  const improved = current ? ['applied', 'applied_edited'].includes(statuses[pos]) : false;   // this issue was improved earlier (this visit or before)
  const isPick = !!current && current.pick && !recs[current.key]?.record;
  const isSkills = !!current && !!current.skills;
  const isDates = !!current && !!current.dates;
  const isFields = !!current && !!current.fields;
  const targets = current && !improved ? (isPick ? { kind: 'pick', places: [] } : isSkills ? { kind: 'skills', places: [] } : isDates ? { kind: 'dates', places: [] } : isFields ? { kind: 'fields', places: [] } : fixTargets(work, current.issue)) : { kind: 'one', places: [] };
  const example = isPick ? draftFor(current.issue, work) : null;   // what the AI wrote about the sentence it looked at: shown, never applied
  const at = chosenAt;
  const place = at && targets ? targets.places.find(p => JSON.stringify(p.at) === JSON.stringify(at)) : null;
  const saved = at ? fieldText(work, at) : '';
  const staged = stage?.data ?? work;
  const skillsDirty = isSkills && !!stage && (stage.record.added.length > 0 || stage.record.removed.length > 0);
  // Dates: the entries, what is typed in them, and the resume with those dates (each applied by setDate, the function the tests cover)
  const dateKey = (e) => `${e.ref.kind}:${e.ref.id}`;
  const dateEntries = isDates ? listDateEntries(work) : [];
  const dateStage = (() => {
    if (!isDates) return null;
    let cur = work; let rec = null; const cleared = [];
    for (const e of dateEntries) {
      const k = dateKey(e);
      if (!(k in drafts) || e.ambiguous) continue;
      if (!String(drafts[k]).trim()) { if (String(e.text).trim()) cleared.push(e); continue; }
      const r = setDate(cur, e.ref, drafts[k]);
      if (r.data) { cur = r.data; rec = mergeDateRecords(rec, r.record); }
    }
    return { data: cur, record: rec, cleared };
  })();
  const datesDirty = isDates && !!dateStage && ((dateStage.record?.changes.length || 0) > 0 || dateStage.cleared.length > 0);
  // Contact details and education (school and degree): the same, by setField
  const fieldKey = (f) => (f.ref.kind === 'contact' ? `contact:${f.ref.field}` : `edu:${f.ref.id}:${f.ref.field}`);
  const fieldItems = isFields ? (current.fields === 'contact' ? listContactFields(work) : listEducationFields(work)) : [];
  const fieldStage = (() => {
    if (!isFields) return null;
    let cur = work; let rec = null; const cleared = [];
    for (const f of fieldItems) {
      const k = fieldKey(f);
      if (!(k in drafts) || f.ambiguous) continue;
      if (!String(drafts[k]).trim()) { if (String(f.text).trim()) cleared.push(f); continue; }
      const r = setField(cur, f.ref, drafts[k]);
      if (r.data) { cur = r.data; rec = mergeFieldRecords(rec, r.record); }
    }
    return { data: cur, record: rec, cleared };
  })();
  const fieldsDirty = isFields && !!fieldStage && ((fieldStage.record?.changes.length || 0) > 0 || fieldStage.cleared.length > 0);
  const dirty = skillsDirty || datesDirty || fieldsDirty || (!!at && text !== saved);
  const suggestion = at && current ? suggestionFor(work, current.issue, at) : null;
  const draft = suggestion && !suggestion.error ? suggestion : null;

  const activeKey = isSkills ? 'skills' : at ? markKeyOf(at) : null;
  const shown = isSkills ? staged : isDates ? dateStage.data : isFields ? fieldStage.data : at && dirty ? withFieldText(work, at, text) : work;     // the new resume: what is saved, plus what is being typed

  // Marks on the left resume (as it was): the sentence being fixed, the other sentences that can be improved, and the ones already improved.
  const seen = new Set();
  const leftMarks = seed.filter(m => (seen.has(m.key) ? false : (seen.add(m.key), true))).map(m => {
    const title = list[m.itemPos].issue.title;
    if (m.key === activeKey) return { key: m.key, state: 'marked', label: `Fixing: ${title}` };
    const done = ['applied', 'applied_edited'].includes(statuses[m.itemPos]);
    return { key: m.key, state: done ? 'done' : 'open', label: `${done ? 'Improved' : 'Fix'}: ${title}` };
  });
  // a sentence the user chose for a pick issue is not one of the nearest, so it has no mark yet
  if (activeKey && !leftMarks.some(m => m.key === activeKey) && current) leftMarks.push({ key: activeKey, state: 'marked', label: `Fixing: ${current.issue.title}` });
  const rightMarks = activeKey ? [{ key: activeKey, state: 'marked', label: '' }] : [];

  const openItem = (itemPos, chosen) => go(itemPos, work, chosen);
  const parseKey = (key) => {
    if (key === 'summary') return { kind: 'summary' };
    const m = /^b:(\d+):(\d+)$/.exec(key);
    return m ? { kind: 'bullet', exp: Number(m[1]), bullet: Number(m[2]) } : null;
  };
  const pick = (key) => {
    const m = seed.find(x => x.key === key);
    const other = m && m.itemPos !== pos && !['applied', 'applied_edited'].includes(statuses[m.itemPos]);
    if (other) {                                          // another issue's highlighted sentence: open that issue
      const many = !list[m.itemPos].pick && fixTargets(work, list[m.itemPos].issue).kind === 'many';
      if (dirty) { setPendingPick({ itemPos: m.itemPos, at: many ? m.at : undefined }); return; }
      openItem(m.itemPos, many ? m.at : undefined);
      return;
    }
    if (isPick) {                                         // this issue's sentence was not found: the clicked bullet is the one to improve
      const a = parseKey(key);
      if (!a || a.kind !== 'bullet' || key === activeKey) return;
      if (dirty) { setPendingPick({ itemPos: pos, at: a }); return; }
      openItem(pos, a);
      return;
    }
    if (m && m.itemPos === pos) {                         // the same issue found in several places: choose one
      const many = fixTargets(work, current.issue).kind === 'many';
      if (!many || key === activeKey) return;
      if (dirty) { setPendingPick({ itemPos: pos, at: m.at }); return; }
      openItem(pos, m.at);
    }
  };

  const Template = template?.component;

  const save = () => {
    const r = saveFix(work, at, text);
    if (r.error === 'empty') { setMsg('Write the text first, or leave this one for now.'); return; }
    if (r.error) { setMsg('That place is not in your resume any more.'); return; }
    const prev = recs[current.key]?.record;
    const record = prev && undoRecord(work, prev) !== null ? { ...r.record, original: prev.original } : r.record;   // Undo goes back to the very first original
    const entry = { record, placeholders: r.blanks > 0, warnings: [] };
    const nextRecs = { ...recs, [current.key]: entry };
    setWork(r.data); setRecs(nextRecs);
    onChange?.(r.data, current.key, entry);
    go(nextUnresolved(statusesFor(r.data, nextRecs), pos), r.data);
  };
  const undo = () => {
    const back = undoRecord(work, recs[current.key].record);
    if (!back) { setMsg(isSkills ? 'The skills were changed afterwards, so this cannot be undone automatically.' : isDates ? 'The dates were changed afterwards, so this cannot be undone automatically.' : isFields ? 'These details were changed afterwards, so this cannot be undone automatically.' : 'That sentence was changed afterwards, so it cannot be undone automatically.'); return; }
    const nextRecs = { ...recs }; delete nextRecs[current.key];
    setWork(back); setRecs(nextRecs);
    onChange?.(back, current.key, null);          // null: the record is removed
    go(pos, back, undefined, nextRecs);
  };
  const leave = () => go(nextUnresolved(statuses, pos), work);
  const back = () => { if (dirty) setAskLeave(true); else onBackToList?.(); };
  const useDraft = () => { if (dirty && text !== draft.text) setAskReplace(true); else setText(draft.text); };
  // Skills: each change is made on the staged list by the same pure functions the tests cover; nothing is saved until Save & next.
  const changeSkills = (r) => {
    if (r.error) { setMsg(r.error === 'duplicate' ? 'That skill is already in your list.' : r.error === 'empty' ? 'Type a skill first.' : 'That skill is not in your list any more.'); return false; }
    setStage({ data: r.data, record: mergeSkillRecords(stage?.record, r.record) }); setMsg('');
    return true;
  };
  const onAddSkill = () => { if (changeSkills(addSkill(staged, skillInput))) setSkillInput(''); };
  const onRemoveSkill = (name) => changeSkills(removeSkill(staged, name));
  const saveSkills = () => {
    if (!skillsDirty) { setMsg('Add or remove a skill first, or leave it for now.'); return; }
    const prev = recs[current.key]?.record;
    const record = mergeSkillRecords(prev && undoRecord(work, prev) !== null ? prev : null, stage.record);
    const entry = { record, placeholders: false, warnings: [] };
    const nextRecs = { ...recs, [current.key]: entry };
    setWork(stage.data); setRecs(nextRecs);
    onChange?.(stage.data, current.key, entry);
    go(nextUnresolved(statusesFor(stage.data, nextRecs), pos), stage.data);
  };
  const saveDates = () => {
    if (dateStage.cleared.length) { setMsg('A date cannot be left empty here. Type it, or put back what was there.'); return; }
    if (!dateStage.record || !dateStage.record.changes.length) { setMsg('Change a date first, or leave it for now.'); return; }
    const prev = recs[current.key]?.record;
    const record = mergeDateRecords(prev && undoRecord(work, prev) !== null ? prev : null, dateStage.record);
    const entry = { record, placeholders: false, warnings: [] };
    const nextRecs = { ...recs, [current.key]: entry };
    setWork(dateStage.data); setRecs(nextRecs);
    onChange?.(dateStage.data, current.key, entry);
    go(nextUnresolved(statusesFor(dateStage.data, nextRecs), pos), dateStage.data);
  };
  const saveFields = () => {
    if (fieldStage.cleared.length) { setMsg('A value cannot be left empty here. Type it, or put back what was there.'); return; }
    if (!fieldStage.record || !fieldStage.record.changes.length) { setMsg('Change something first, or leave it for now.'); return; }
    const prev = recs[current.key]?.record;
    const record = mergeFieldRecords(prev && undoRecord(work, prev) !== null ? prev : null, fieldStage.record);
    const entry = { record, placeholders: false, warnings: [] };
    const nextRecs = { ...recs, [current.key]: entry };
    setWork(fieldStage.data); setRecs(nextRecs);
    onChange?.(fieldStage.data, current.key, entry);
    go(nextUnresolved(statusesFor(fieldStage.data, nextRecs), pos), fieldStage.data);
  };
  const choose = (p) => { setChosenAt(p.at); setText(fieldText(work, p.at)); setMsg(''); };

  const total = list.length;
  const counts = summaryCounts(statuses);
  const others = issues.length - total;

  const prompt = (question, stay, go_, goLabel) => (
    <div role="alert" style={{ padding: '10px 12px', border: '1px solid var(--lp-bdr)', borderRadius: 8, fontSize: 12.5, color: 'var(--lp-text2)' }}>
      {question}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" style={btn(false)} onClick={stay}>Stay</button>
        <button type="button" style={btn(false)} onClick={go_}>{goLabel}</button>
      </div>
    </div>
  );

  if (pos === null) {
    return (
      <div className="atb-fixpage" style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px', minHeight: 360 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--lp-text)', marginBottom: 10 }}>Review finished</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--lp-text2)', fontSize: 14, lineHeight: 1.9 }}>
          <li>{counts.applied} applied</li>
          <li>{counts.open} open</li>
          <li>{counts.changedByYou} changed by you</li>
        </ul>
        <div style={{ fontSize: 12.5, color: 'var(--lp-text3)', lineHeight: 1.6, marginTop: 10 }}>
          These counts come from the text of your resume as it is now. An applied issue can be undone from the Suggestions panel in the Builder.
          {others > 0 && <> {others} other issue{others > 1 ? 's' : ''} {others > 1 ? 'are' : 'is'} not covered here (no text that can be found in your resume); {others > 1 ? 'they are' : 'it is'} in the Suggestions panel of the Builder.</>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button type="button" style={btn(true)} onClick={() => onOpenBuilder?.()}>Open the Builder</button>
          <button type="button" style={btn(false)} onClick={() => onBackToList?.()}>Back to list</button>
        </div>
        {onChooseTemplate && (
          <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--lp-bdr)' }}>
            <div style={{ fontSize: 13, color: 'var(--lp-text2)', marginBottom: 8 }}>Happy with the text? See your resume in other layouts.</div>
            <button type="button" style={btn(false)} onClick={() => onChooseTemplate()}>Choose a template that suits you</button>
          </div>
        )}
      </div>
    );
  }

  const editorStyle = { background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)', borderRadius: 12, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10, boxSizing: 'border-box', overflowY: 'auto',
    ...(view === 'compare' ? { flex: 'none', maxHeight: '42vh' } : { height: '100%' }) };
  const editor = (
      <div role="region" aria-label="Editor" style={editorStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--lp-text)' }}>{current.issue.title}</div>
          <button type="button" style={link} aria-expanded={showWhy} onClick={() => setShowWhy(v => !v)}>Why?</button>
        </div>
        {showWhy && current.issue.description && <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--lp-text2)' }}>{current.issue.description}</div>}

        {askLeave && prompt('Leave without saving your change?', () => setAskLeave(false), () => onBackToList?.(), 'Leave')}
        {pendingPick && prompt('Open another sentence without saving your change?', () => setPendingPick(null), () => openItem(pendingPick.itemPos, pendingPick.at), 'Switch')}

        {improved && !improving && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--lp-text2)' }}>
              {statuses[pos] === 'applied'
                ? <><strong style={{ color: '#00E5A0' }}>Already improved.</strong> Your resume (left) shows the {isSkills ? 'skills' : isDates ? 'dates' : isFields ? 'details' : 'sentence'} as {isSkills || isDates || isFields ? 'they were' : 'it was'}; your new resume (right) shows {isSkills || isDates || isFields ? 'them' : 'it'} now.</>
                : <>You changed this after applying it. Your resume (left) shows the {isSkills ? 'skills' : isDates ? 'dates' : isFields ? 'details' : 'sentence'} as {isSkills || isDates || isFields ? 'they were' : 'it was'}; your new resume (right) shows {isSkills || isDates || isFields ? 'them' : 'it'} now. It cannot be undone automatically.</>}
            </div>
            {msg && <div role="status" style={{ fontSize: 12.5, color: '#FFB84D' }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" style={btn(true)} onClick={() => setImproving(true)}>{isSkills || isDates || isFields ? 'Change again' : 'Improve again'}</button>
              {statuses[pos] === 'applied' && <button type="button" style={btn(false)} onClick={undo}>Undo this change</button>}
              <button type="button" style={btn(false)} onClick={leave}>Leave it for now</button>
            </div>
          </div>
        )}

        {isPick && !at && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--lp-text2)' }}>
              We could not find the exact sentence the AI meant (it may have been reworded, or you changed it). Click the sentence you want to improve in your resume; the ones nearest to it are highlighted.
            </div>
            {example && (<>
              <section aria-label="AI example" style={{ padding: '10px 12px', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 8 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--lp-text3)', marginBottom: 6 }}>AI example, for the sentence it looked at</div>
                {current.issue.before && <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--lp-text3)', marginBottom: 4 }}>Before: {current.issue.before}</div>}
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--lp-text2)' }}>Example: {example.text}</div>
              </section>
              {example.placeholders && example.replaced?.length > 0 && <div style={{ fontSize: 12.5, color: '#FFB84D', lineHeight: 1.5 }}>These figures are not in your resume: {example.replaced.join(', ')}. The example shows [X] in their place.</div>}
            </>)}
            <div><button type="button" style={btn(false)} onClick={leave}>Leave it for now</button></div>
          </div>
        )}

        {!improved && !isPick && targets.kind === 'none' && (<>
          <div style={{ fontSize: 13, color: '#FFB84D', lineHeight: 1.6 }}>Could not find that text in your resume any more. You can leave it, or edit the field in the Builder.</div>
          <div><button type="button" style={btn(false)} onClick={leave}>Leave it for now</button></div>
        </>)}

        {!improved && !isPick && targets.kind === 'many' && !at && (
          <div style={{ fontSize: 13, color: 'var(--lp-text2)', lineHeight: 1.6 }}>
            That text is in {targets.places.length} places, highlighted in your resume. Click one, or choose here:
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {targets.places.map(p => <button key={JSON.stringify(p.at)} type="button" style={btn(false)} onClick={() => choose(p)}>{p.label}</button>)}
            </div>
            <div style={{ marginTop: 12 }}><button type="button" style={btn(false)} onClick={leave}>Leave it for now</button></div>
          </div>
        )}

        {isSkills && (!improved || improving) && (() => {
          const f = skillsFindings(staged);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--lp-text3)' }}>Your skills</div>
              {f.empty && <div style={{ fontSize: 12.5, color: '#FFB84D' }}>Your skills list is empty.</div>}
              {f.duplicates.length > 0 && <div style={{ fontSize: 12.5, color: '#FFB84D' }}>Repeated in your list: {f.duplicates.join(', ')}. Remove the extra one if you like.</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {skillList(staged).map((sk, k) => (
                  <span key={`${k}:${sk}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 6, padding: '4px 6px 4px 10px', fontSize: 13, color: 'var(--lp-text)' }}>
                    {sk}
                    <button type="button" aria-label={`Remove ${sk}`} onClick={() => onRemoveSkill(sk)} style={{ background: 'transparent', border: 'none', color: 'var(--lp-text2)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 4px' }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input aria-label="Add a skill" value={skillInput} onChange={e => { setSkillInput(e.target.value); setMsg(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddSkill(); } }}
                  style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', color: 'var(--lp-text)', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--lp-ff)' }} />
                <button type="button" style={btn(false)} onClick={onAddSkill}>Add skill</button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--lp-text3)', lineHeight: 1.5 }}>Add only skills you really have.{skillsDirty ? ' Not saved yet.' : ''}</div>
              {msg && <div role="status" style={{ fontSize: 12.5, color: '#FFB84D' }}>{msg}</div>}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" style={btn(true)} onClick={saveSkills}>Save &amp; next</button>
                <button type="button" style={btn(false)} onClick={leave}>Leave it for now</button>
              </div>
            </div>
          );
        })()}

        {isDates && (!improved || improving) && (() => {
          const FINDING = { missing: (l) => `No date given for ${l}. Type the real one, or leave it.`, unreadable: (l) => `We could not read a date in ${l}. Check how it is written.`, end_before_start: (l) => `The end date is before the start date in ${l}.` };
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--lp-text3)' }}>Your dates</div>
              {dateEntries.length === 0 && <div style={{ fontSize: 12.5, color: '#FFB84D' }}>There is no job or education entry with dates in your resume.</div>}
              {dateEntries.map(e => {
                const k = dateKey(e); const value = k in drafts ? drafts[k] : e.text;
                const what = e.ref.kind === 'job' ? 'Dates' : 'Year';
                return (
                  <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--lp-text2)' }}>{e.label}</span>
                    <input aria-label={`${what} for ${e.label}`} value={value} disabled={e.ambiguous}
                      onChange={ev => { const v = ev.target.value; setDrafts(d => ({ ...d, [k]: v })); setMsg(''); }}
                      style={{ boxSizing: 'border-box', width: '100%', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', color: 'var(--lp-text)', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--lp-ff)' }} />
                    {e.ambiguous
                      ? <span style={{ fontSize: 12, color: '#FFB84D' }}>Two entries share an id, so this one is edited in the Builder.</span>
                      : dateFindings({ ref: e.ref, text: value }).map(f => <span key={f} style={{ fontSize: 12, color: '#FFB84D' }}>{FINDING[f](e.label)}</span>)}
                  </label>
                );
              })}
              <div style={{ fontSize: 12, color: 'var(--lp-text3)', lineHeight: 1.5 }}>Nothing is suggested for dates: type only dates that are true.{datesDirty ? ' Not saved yet.' : ''}</div>
              {msg && <div role="status" style={{ fontSize: 12.5, color: '#FFB84D' }}>{msg}</div>}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" style={btn(true)} onClick={saveDates}>Save &amp; next</button>
                <button type="button" style={btn(false)} onClick={leave}>Leave it for now</button>
              </div>
            </div>
          );
        })()}

        {isFields && (!improved || improving) && (() => {
          const FINDING = { missing: (l) => `${l} is empty. Type the real one, or leave it.`, not_email: () => 'This does not look like an email address.', phone_digits: () => 'A phone number usually has 7 to 15 digits.', not_linkedin: () => 'This is not a LinkedIn address.' };
          const contact = current.fields === 'contact';
          let lastGroup = null;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--lp-text3)' }}>{contact ? 'Your contact details' : 'Your education'}</div>
              {fieldItems.length === 0 && <div style={{ fontSize: 12.5, color: '#FFB84D' }}>There is no education entry in your resume. Add one in the Builder.</div>}
              {fieldItems.map(f => {
                const k = fieldKey(f); const value = k in drafts ? drafts[k] : f.text;
                const name = contact ? f.label : `${f.label} (${f.group})`;
                const header = !contact && f.group !== lastGroup ? f.group : null; lastGroup = f.group;
                return (
                  <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {header && <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--lp-text)', marginTop: 4 }}>{header}</span>}
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--lp-text2)' }}>{f.label}</span>
                    <input aria-label={name} value={value} disabled={f.ambiguous}
                      onChange={ev => { const v = ev.target.value; setDrafts(d => ({ ...d, [k]: v })); setMsg(''); }}
                      style={{ boxSizing: 'border-box', width: '100%', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', color: 'var(--lp-text)', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--lp-ff)' }} />
                    {f.ambiguous
                      ? <span style={{ fontSize: 12, color: '#FFB84D' }}>Two entries share an id, so this one is edited in the Builder.</span>
                      : fieldFindings({ ref: f.ref, text: value }).map(x => <span key={x} style={{ fontSize: 12, color: '#FFB84D' }}>{FINDING[x](f.label)}</span>)}
                  </label>
                );
              })}
              <div style={{ fontSize: 12, color: 'var(--lp-text3)', lineHeight: 1.5 }}>
                Nothing is suggested here: type only what is true.{fieldsDirty ? ' Not saved yet.' : ''} Something else to change?{' '}
                <button type="button" style={link} onClick={() => { if (fieldsDirty) setMsg('Save your change first, or leave it for now.'); else onOpenBuilder?.(); }}>Open the Builder</button>
              </div>
              {msg && <div role="status" style={{ fontSize: 12.5, color: '#FFB84D' }}>{msg}</div>}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" style={btn(true)} onClick={saveFields}>Save &amp; next</button>
                <button type="button" style={btn(false)} onClick={leave}>Leave it for now</button>
              </div>
            </div>
          );
        })()}

        {at && (!improved || improving) && (<>
          {place && !place.drawn && <div style={{ fontSize: 12.5, color: '#FFB84D', lineHeight: 1.6 }}>This text is in a job with no company name, so the resume does not show it. You can still edit it here.</div>}

          {improving && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, ...(view === 'focus' ? { flex: 1, minHeight: 240 } : {}) }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--lp-text3)' }}>Your text</span>
              {/* The box is the main thing: in Focus it fills the column; in Compare it is as tall as its text (up to a limit) and can be pulled taller. */}
              <textarea ref={taRef} data-autosize={view === 'compare' ? 'true' : undefined} aria-label="Your text" value={text} onChange={e => { setText(e.target.value); setMsg(''); }}
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', color: 'var(--lp-text)', borderRadius: 8, padding: '10px 14px', fontSize: 14.5, lineHeight: 1.6, fontFamily: 'var(--lp-ff)', resize: 'vertical',
                  ...(view === 'focus' ? { flex: 1, minHeight: 200 } : { minHeight: 90 }) }} />
            </label>
          )}
          {improving && dirty && <div style={{ fontSize: 12, color: 'var(--lp-text3)' }}>Not saved yet. Your original: {saved}</div>}
          {msg && <div role="status" style={{ fontSize: 12.5, color: '#FFB84D' }}>{msg}</div>}

          {improving && isPick && example && (<>
            <button type="button" style={{ ...link, alignSelf: 'flex-start' }} aria-expanded={showDraft} onClick={() => setShowDraft(v => !v)}>{showDraft ? 'Hide AI example' : 'Show AI example'}</button>
            {showDraft && (<>
              <section aria-label="AI example" style={{ padding: '10px 12px', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 8 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--lp-text3)', marginBottom: 6 }}>AI example, for a different sentence</div>
                {current.issue.before && <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--lp-text3)', marginBottom: 4 }}>Before: {current.issue.before}</div>}
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--lp-text2)' }}>Example: {example.text}</div>
              </section>
              {example.placeholders && example.replaced?.length > 0 && <div style={{ fontSize: 12.5, color: '#FFB84D', lineHeight: 1.5 }}>These figures are not in your resume: {example.replaced.join(', ')}. The example shows [X] in their place.</div>}
            </>)}
          </>)}
          {improving && draft && (<>
            <button type="button" style={{ ...link, alignSelf: 'flex-start' }} aria-expanded={showDraft} onClick={() => setShowDraft(v => !v)}>
              {showDraft ? 'Hide AI draft' : 'Show AI draft'}{!showDraft && draft.placeholders ? ' ⚠ includes figures not in your resume' : ''}
            </button>
            {showDraft && (<>
              <section aria-label="AI draft" style={{ padding: '10px 12px', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 8 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--lp-text3)', marginBottom: 4 }}>AI draft</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--lp-text2)' }}>{draft.text}</div>
                {draft.warnings.map((w, k) => <div key={k} style={{ marginTop: 6, fontSize: 12, color: '#FFB84D', lineHeight: 1.5 }}>{w}</div>)}
              </section>
              {draft.placeholders && draft.replaced?.length > 0 && (
                <div style={{ fontSize: 12.5, color: '#FFB84D', lineHeight: 1.5 }}>
                  These figures are not in your resume: {draft.replaced.join(', ')}. The draft shows [X] in their place. Put your real figure, or remove it.
                </div>
              )}
              {askReplace
                ? prompt('Replace what you typed with the AI draft?', () => setAskReplace(false), () => { setText(draft.text); setAskReplace(false); }, 'Replace')
                : (
                  <button type="button" style={{ ...btn(false), alignSelf: 'flex-start' }} onClick={useDraft}>
                    {draft.warnings.length ? 'Use suggestion — I confirm this is true' : 'Use suggestion'}
                  </button>
                )}
            </>)}
          </>)}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {improving
              ? <button type="button" style={btn(true)} onClick={save}>Save &amp; next</button>
              : <button type="button" style={btn(true)} onClick={() => setImproving(true)}>Improve this sentence</button>}
            <button type="button" style={btn(false)} onClick={leave}>Leave it for now</button>
          </div>
        </>)}
      </div>
  );

  const toggle = (
    <div role="group" aria-label="View" style={{ display: 'inline-flex', border: '1px solid var(--lp-bdr)', borderRadius: 8, overflow: 'hidden' }}>
      {[['focus', 'Focus', 'One resume, larger text, with the editor beside it'], ['compare', 'Compare', 'Your resume and the new one, side by side']].map(([v, name, tip]) => (
        <button key={v} type="button" title={tip} aria-pressed={view === v} onClick={() => setView(v)}
          style={{ padding: '5px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', border: 'none', background: view === v ? 'var(--lp-teal)' : 'transparent', color: view === v ? '#000' : 'var(--lp-text2)' }}>{name}</button>
      ))}
    </div>
  );

  return (
    <div className="atb-fixpage" style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 20px 8px', display: 'flex', flexDirection: 'column', gap: 12, height: 'calc(100vh - 215px)', minHeight: 520 }}>   {/* the top of the app (title, tabs) takes about 180 to 200 px; the editor must stay on screen */}
      <style>{css}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: SEV[current.issue.severity] || 'var(--lp-text3)' }}>
          Issue {pos + 1} of {total} · {label(current.issue.severity) || 'Issue'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {!phone && toggle}
          <button type="button" style={link} onClick={back}>Back to list</button>
        </div>
      </div>

      <div role="tablist" aria-label="Resumes" className="atb-fix-tabs" style={{ gap: 6 }}>
        {view === 'compare' ? (<>
          <button type="button" role="tab" aria-selected={pane === 'original'} style={btn(pane === 'original')} onClick={() => setPane('original')}>Your resume</button>
          <button type="button" role="tab" aria-selected={pane === 'new'} style={btn(pane === 'new')} onClick={() => setPane('new')}>New resume</button>
        </>) : (<>
          <button type="button" role="tab" aria-selected={pane === 'editor'} style={btn(pane === 'editor')} onClick={() => setPane('editor')}>Edit</button>
          <button type="button" role="tab" aria-selected={pane === 'focus'} style={btn(pane === 'focus')} onClick={() => setPane('focus')}>Resume</button>
        </>)}
      </div>

      {view === 'compare' ? (<>
        <div className="atb-fix-panes" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
          <ResumePane name="Your resume" panel="original" active={pane === 'original'} hint="Highlighted sentences can be improved. Click one to work on it."
            data={original} Template={Template} templateId={template?.id} marks={leftMarks} activeKey={activeKey} onPick={pick} pickable={isPick && !improving} />
          <ResumePane name="Your new resume" panel="new" active={pane === 'new'} hint="Your changes appear here as you type."
            data={shown} Template={Template} templateId={template?.id} marks={rightMarks} activeKey={activeKey} />
        </div>
        {editor}
      </>) : (
        <div className="atb-fix-panes" style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 2fr) 3fr', gap: 16, flex: 1, minHeight: 0 }}>
          <div className="atb-fix-pane" data-pane="editor" data-active={pane === 'editor' ? 'true' : 'false'} style={{ minHeight: 0, minWidth: 0 }}>{editor}</div>
          <ResumePane name="Your resume" panel="focus" active={pane === 'focus'} hint="Highlighted sentences can be improved. Click one to work on it. What you type appears here."
            data={shown} Template={Template} templateId={template?.id} marks={leftMarks} activeKey={activeKey} onPick={pick} pickable={isPick && !improving} />
        </div>
      )}
    </div>
  );
}
