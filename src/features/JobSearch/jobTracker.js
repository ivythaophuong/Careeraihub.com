// Application tracker rules: pure functions, no React, no network. Applications live in `memory.applications`
// (the user_memory backup), so every field here is optional and old rows keep working.
//
// Stored `status` values never change (Saved, Applied, Follow-up, Interviewing, Offer, Rejected). "No reply" is
// DERIVED from the dates, so nothing has to run in the background: an Applied job with no change for NO_REPLY_DAYS
// days is shown in the No reply column.

export const NO_REPLY_DAYS = 7;
export const STATUS_LIST = ['Saved', 'Applied', 'Follow-up', 'Interviewing', 'Offer', 'Rejected'];
export const STATUS_LABEL = {
  Saved: 'Saved', Applied: 'Applied', 'Follow-up': 'Followed up',
  Interviewing: 'Interviewing', Offer: 'Offer', Rejected: 'Rejected / closed',
};
export const MAX_JD_CHARS_KEPT = 6000; // same order of size as the JD Analyzer accepts; keeps the memory backup small

export const STAGES = [
  { id: 'saved', label: 'Saved' },
  { id: 'applied', label: 'Applied' },
  { id: 'noreply', label: `No reply · ${NO_REPLY_DAYS}+ days` },
  { id: 'interviewing', label: 'Interviewing' },
  { id: 'offer', label: 'Offer' },
  { id: 'closed', label: 'Closed' },
];

// ── Dates (all calendar days, local time) ────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
export const todayYmd = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

// Accepts 'YYYY-MM-DD' or an ISO timestamp (rows loaded from the database carry created_at); anything else is null.
export const toDay = (v) => {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  return m ? m[1] : null;
};
const dayNumber = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
export const daysBetween = (fromYmd, toYmd) => (fromYmd && toYmd ? dayNumber(toYmd) - dayNumber(fromYmd) : null);
export const daysSince = (v, now = new Date()) => daysBetween(toDay(v), todayYmd(now));
export const daysUntil = (v, now = new Date()) => daysBetween(todayYmd(now), toDay(v));

export const appliedOn = (app) => toDay(app?.appliedOn) || toDay(app?.date);

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const agoText = (days) => (days == null ? '' : days <= 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`);

// ── Stages ───────────────────────────────────────────────────────────────────
export function stageOf(app, now = new Date()) {
  switch (app?.status) {
    case 'Saved': return 'saved';
    case 'Follow-up': return 'noreply';
    case 'Interviewing': return 'interviewing';
    case 'Offer': return 'offer';
    case 'Rejected': return 'closed';
    default: { // Applied, or a value this version does not know: treated as Applied
      const age = daysSince(appliedOn(app), now);
      return age != null && age >= NO_REPLY_DAYS ? 'noreply' : 'applied';
    }
  }
}

export function groupByStage(apps, now = new Date()) {
  const groups = Object.fromEntries(STAGES.map(s => [s.id, []]));
  (apps || []).forEach(a => groups[stageOf(a, now)].push(a));
  return groups;
}

// Counts only what the user entered. `heardBack` = any application that left Applied/No reply for a real answer.
export function pipelineStats(apps) {
  const list = apps || [];
  const applied = list.filter(a => a.status && a.status !== 'Saved');
  const heardBack = applied.filter(a => ['Interviewing', 'Offer', 'Rejected'].includes(a.status) || a.reachedInterview);
  const interviews = applied.filter(a => a.status === 'Interviewing' || a.status === 'Offer' || a.reachedInterview);
  return {
    saved: list.length - applied.length,
    applied: applied.length,
    heardBack: heardBack.length,
    interviews: interviews.length,
    offers: applied.filter(a => a.status === 'Offer').length,
  };
}

// ── Changing a status ────────────────────────────────────────────────────────
// Returns a new application. Dates are written once, so moving back and forth does not erase history.
export function applyStatus(app, status, now = new Date()) {
  if (!app || app.status === status) return app;
  const today = todayYmd(now);
  const next = { ...app, status, statusChangedOn: today };
  const wasApplied = app.status && app.status !== 'Saved';
  if (status !== 'Saved' && !wasApplied) { next.appliedOn = today; next.date = today; }
  if (status === 'Applied' && !next.appliedOn) next.appliedOn = appliedOn(app) || today;
  if (status === 'Follow-up') next.followedUpOn = today;
  if (status === 'Interviewing' || status === 'Offer') next.reachedInterview = true;
  if (status === 'Rejected') next.closedOn = today;
  return next;
}

// ── What to do next, per application ─────────────────────────────────────────
// action.kind: 'module' (open that app module for this job), 'draft' (show a follow-up/thank-you text),
// 'status' (move the application to `status`).
export function nextStep(app, now = new Date()) {
  const stage = stageOf(app, now);
  const applied = daysSince(appliedOn(app), now);
  switch (stage) {
    case 'saved':
      return {
        urgency: 'low',
        title: 'Check your fit before you apply',
        why: app.jd ? 'Compare your resume with this job description.' : 'Paste the job description on this card to compare it with your resume.',
        actions: [
          { id: 'fit', label: 'Check my fit', kind: 'module', module: 'jd', needs: 'jd' },
          { id: 'applied', label: 'Mark as applied', kind: 'status', status: 'Applied' },
        ],
      };
    case 'applied':
      return {
        urgency: 'low',
        title: 'Practise while you wait',
        why: `Applied ${agoText(applied)}. With no news after ${plural(NO_REPLY_DAYS, 'day')} it moves to No reply.`,
        actions: [
          { id: 'practise', label: 'Practise for this job', kind: 'module', module: 'simulate' },
          { id: 'cover', label: 'Write a cover letter', kind: 'module', module: 'cover' },
        ],
      };
    case 'noreply':
      return {
        urgency: 'medium',
        title: app.status === 'Follow-up' ? 'You followed up. Give it a few more days' : 'Send a short follow-up',
        why: app.status === 'Follow-up'
          ? `Followed up ${agoText(daysSince(app.followedUpOn, now))}. Keep applying elsewhere in the meantime.`
          : `Applied ${agoText(applied)} with no answer yet.`,
        actions: [
          { id: 'followup', label: app.status === 'Follow-up' ? 'See the follow-up draft' : 'Draft a follow-up', kind: 'draft', draft: 'followUp' },
          ...(app.status === 'Follow-up' ? [] : [{ id: 'followed', label: 'I sent it', kind: 'status', status: 'Follow-up' }]),
        ],
      };
    case 'interviewing': {
      const left = daysUntil(app.interviewDate, now);
      const when = left == null ? null : left < 0 ? `Interview was ${agoText(-left)}` : left === 0 ? 'Interview is today' : `Interview in ${plural(left, 'day')}`;
      return {
        urgency: left != null && left >= 0 && left <= 3 ? 'high' : 'medium',
        title: when || 'Prepare for your interview',
        why: when ? 'Practise with questions built for this job.' : 'Add the interview date to get a countdown.',
        actions: [
          { id: 'practise', label: 'Practise for this job', kind: 'module', module: 'simulate' },
          { id: 'star', label: 'Pick your STAR stories', kind: 'module', module: 'star' },
          { id: 'thanks', label: 'Draft a thank-you note', kind: 'draft', draft: 'thankYou' },
        ],
      };
    }
    case 'offer':
      return {
        urgency: 'high',
        title: 'Prepare to negotiate',
        why: 'Get word-for-word scripts using your own numbers.',
        actions: [{ id: 'salary', label: 'Open Salary Coach', kind: 'module', module: 'salary' }],
      };
    default:
      return {
        urgency: 'low',
        title: 'Learn from this one',
        why: 'Write down what you would change, then practise it.',
        actions: [{ id: 'practise', label: 'Practise again', kind: 'module', module: 'simulate' }],
      };
  }
}

// Applications that need the user soonest, for the "Do this next" strip and the Dashboard.
const URGENCY_RANK = { high: 0, medium: 1, low: 2 };
export function attentionList(apps, now = new Date(), limit = 3) {
  return (apps || [])
    .filter(a => ['interviewing', 'offer', 'noreply'].includes(stageOf(a, now)))
    .map(app => ({ app, step: nextStep(app, now) }))
    .sort((a, b) => URGENCY_RANK[a.step.urgency] - URGENCY_RANK[b.step.urgency])
    .slice(0, limit);
}

// ── Drafts (plain templates: no AI call, no cost; the user edits before sending) ─────────────────
export function followUpDraft(app, name = '') {
  const when = appliedOn(app);
  return [
    `Subject: Following up on my ${app.role} application`,
    '',
    'Hello,',
    '',
    `I applied for the ${app.role} role at ${app.company}${when ? ` on ${when}` : ''} and wanted to check on the status of my application.`,
    'I am still very interested and happy to share anything that would help with your decision.',
    '',
    'Thank you for your time.',
    '',
    name || '[Your name]',
  ].join('\n');
}

export function thankYouDraft(app, name = '') {
  return [
    `Subject: Thank you, ${app.role} interview`,
    '',
    'Hello [Interviewer name],',
    '',
    `Thank you for taking the time to talk with me about the ${app.role} role at ${app.company}.`,
    '[Add one specific thing you discussed and why it excites you.]',
    'I would be glad to answer any follow-up questions.',
    '',
    'Kind regards,',
    name || '[Your name]',
  ].join('\n');
}

// ── Creating an application ──────────────────────────────────────────────────
const URL_RE = /^https?:\/\/\S+$/i;
// One smart paste box: a lone link becomes the link; anything longer is the job description.
export function classifyPaste(raw) {
  const text = (raw || '').trim();
  if (!text) return { link: '', jd: '' };
  if (URL_RE.test(text)) return { link: text, jd: '' };
  return { link: '', jd: text };
}

export function makeApplication({ company, role, status = 'Saved', link = '', jd = '', notes = '' }, now = new Date()) {
  const today = todayYmd(now);
  const app = {
    id: now.getTime(), company: company.trim(), role: role.trim(), status: 'Saved',
    link: link.trim(), jd: jd.trim().slice(0, MAX_JD_CHARS_KEPT), notes, date: today, savedOn: today,
  };
  return status === 'Saved' ? app : applyStatus(app, status, now);
}

// ── Job boards (links only: the board shows the live results, so there is no feed to pay for) ─────────
export const FRESHNESS = [
  { days: 1, label: '24 hours' },
  { days: 3, label: '3 days' },
  { days: 7, label: '7 days' },
];

const slug = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// `dated: true` means the link itself filters by the chosen freshness; the others are sorted newest first or unfiltered.
export const JOB_SOURCES = [
  { id: 'mycareersfuture', name: 'MyCareersFuture', color: '#E5382C', regions: ['singapore'], note: 'Newest first' },
  { id: 'jobstreet', name: 'JobStreet', color: '#1F6FEB', regions: ['singapore', 'southeast asia'], dated: true },
  { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2', dated: true },
  { id: 'indeed', name: 'Indeed', color: '#2557A7', dated: true },
  { id: 'glassdoor', name: 'Glassdoor', color: '#0CAA41', dated: true },
  { id: 'wellfound', name: 'Wellfound', color: '#E8484B', note: 'No date filter' },
];

export function buildJobURL(platform, title, loc, keywords = '', days = 7) {
  const q = encodeURIComponent(`${title} ${keywords}`.trim());
  const l = encodeURIComponent(loc);
  switch (platform) {
    case 'linkedin': return `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${l}&f_TPR=r${days * 86400}`;
    case 'indeed': return `https://www.indeed.com/jobs?q=${q}&l=${l}&sort=date&fromage=${days}`;
    case 'glassdoor': return `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${q}&locT=C&locId=${l}&fromAge=${days}`;
    case 'mycareersfuture': return `https://www.mycareersfuture.gov.sg/search?search=${q}&sortBy=new_posting_date&page=0`;
    case 'jobstreet': return `https://sg.jobstreet.com/${slug(`${title} ${keywords}`) || 'jobs'}-jobs/in-${slug(loc) || 'singapore'}?sortmode=ListedDate&daterange=${days}`;
    case 'wellfound': return `https://wellfound.com/role/l/${q.replace(/%20/g, '-')}`;
    case 'ycombinator': return `https://www.ycombinator.com/jobs?query=${q}&location=${l}`;
    case 'remoteok': return `https://remoteok.com/remote-${q.replace(/%20/g, '-')}-jobs`;
    default: return `https://google.com/search?q=${q}+jobs+in+${l}`;
  }
}

// Boards that suit the user's market come first; the rest stay available.
// `where` is the location text the user typed. A region-specific board outside its region is not offered.
export function sourcesFor(where = '') {
  const w = where.trim().toLowerCase();
  const inRegion = (s) => !!s.regions && s.regions.some(r => w.includes(r));
  return [...JOB_SOURCES.filter(inRegion), ...JOB_SOURCES.filter(s => !s.regions)];
}
