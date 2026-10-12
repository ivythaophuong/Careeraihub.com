// Turns the Builder's structured data back into resume text, so the same code scorer that reads an uploaded
// resume (src/scoring/) can score what the user is editing. Pure and synchronous: no AI, no network.
import { computeDeterministicScore } from '../../scoring/computeDeterministicScore';

const t = (s) => String(s ?? '').trim();
const list = (a) => (a || []).map(t).filter(Boolean);

export function builderDataToText(d) {
  const c = d?.contact || {};
  const out = [];
  if (t(c.name)) out.push(t(c.name));
  const contact = [c.phone, c.email, c.linkedin, c.location].map(t).filter(Boolean).join(' | ');
  if (contact) out.push(contact);

  const section = (heading, lines) => { if (lines.length) out.push('', heading, ...lines); };

  if (t(d?.summary)) section('Summary', [t(d.summary)]);

  const exp = [];
  for (const j of (d?.experience || [])) {
    if (!t(j.company)) continue;
    exp.push([t(j.title), t(j.company), t(j.period)].filter(Boolean).join(' | '));
    for (const b of list(j.bullets)) exp.push(`- ${b}`);
  }
  section('Work Experience', exp);

  const edu = [];
  for (const e of (d?.education || [])) {
    if (!t(e.institution)) continue;
    edu.push([t(e.degree), t(e.institution), t(e.year)].filter(Boolean).join(' | '));
  }
  section('Education', edu);

  const skills = list(d?.skills);
  section('Skills', skills.length ? [skills.join(', ')] : []);

  section('Awards', list(d?.awards).map(a => `- ${a}`));
  for (const s of (d?.extras || [])) {
    if (t(s.heading) && list(s.items).length) section(t(s.heading), list(s.items).map(i => `- ${i}`));
  }
  return out.join('\n');
}

// The code score of the draft, or null when there is nothing to score (never a made-up 0).
export function scoreBuilderData(d) {
  const text = builderDataToText(d);
  if (!text.trim()) return null;
  return computeDeterministicScore(text).score;
}
