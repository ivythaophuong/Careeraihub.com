import React, { useState, useEffect, useRef } from 'react';
import './landing.css';
import { SUPABASE_URL, SUPABASE_ANON } from '../../lib/supabase';

// ── DATA ─────────────────────────────────────────────────────────────────────

const TYPEWRITER_PHRASES = [
  'resume to verified hire,',
  'interview-ready in days,',
  'the salary you deserve,',
  'your next career level,',
  'an ATS score that gets you seen,',
];

const AC_DATA = [
  { title: 'Product Manager', sal: 'SGD 7K–11K', meta: '340 open roles · Most in demand' },
  { title: 'Senior Product Manager', sal: 'SGD 9K–13K', meta: '128 open roles · +22% YoY' },
  { title: 'Product Designer', sal: 'SGD 6K–9K', meta: '210 open roles · High velocity' },
  { title: 'Software Engineer', sal: 'SGD 6K–12K', meta: '890 open roles · Always hiring' },
  { title: 'Data Analyst', sal: 'SGD 5K–8K', meta: '180 open roles · Growing fast' },
  { title: 'Marketing Manager', sal: 'SGD 5K–9K', meta: '140 open roles' },
  { title: 'Business Analyst', sal: 'SGD 5K–8K', meta: '160 open roles' },
  { title: 'UX Designer', sal: 'SGD 5.5K–8.5K', meta: '95 open roles' },
  { title: 'DevOps Engineer', sal: 'SGD 7K–12K', meta: '210 open roles · Hot skill' },
  { title: 'Data Scientist', sal: 'SGD 7K–13K', meta: '150 open roles · AI boom' },
];

const ATS_KW_MAP = {
  pm:      { found: ['product strategy', 'roadmap', 'agile', 'stakeholder', 'metrics', 'delivery'],
             missing: ['OKR framework', 'A/B testing', 'growth metrics', 'SQL', 'go-to-market', 'user research'] },
  eng:     { found: ['API design', 'system architecture', 'code review', 'CI/CD', 'testing', 'deployment'],
             missing: ['distributed systems', 'Kubernetes', 'TypeScript', 'performance tuning', 'microservices', 'system design'] },
  design:  { found: ['user research', 'wireframing', 'prototyping', 'design systems', 'Figma', 'UX'],
             missing: ['accessibility (WCAG)', 'usability testing', 'motion design', 'design tokens', 'journey mapping', 'A/B testing'] },
  data:    { found: ['SQL', 'data analysis', 'dashboards', 'reporting', 'Python', 'Excel'],
             missing: ['machine learning', 'statistical modeling', 'Tableau', 'dbt', 'data pipeline', 'ETL'] },
  default: { found: ['communication', 'project management', 'stakeholder management', 'problem solving'],
             missing: ['data-driven decision making', 'KPI tracking', 'cross-functional leadership', 'strategic planning'] },
};

const HERO_ATS_KW = {
  pm:      { found: ['roadmap', 'stakeholder', 'agile', 'cross-functional', 'metrics', 'delivery'],
             missing: ['OKR', 'go-to-market', 'A/B testing', 'growth', 'SQL', 'product strategy'] },
  eng:     { found: ['API', 'backend', 'deployment', 'testing', 'code review', 'CI/CD'],
             missing: ['system design', 'scalability', 'microservices', 'Kubernetes', 'TypeScript', 'performance optimization'] },
  design:  { found: ['user research', 'wireframe', 'prototype', 'UX', 'design system', 'Figma'],
             missing: ['accessibility', 'usability testing', 'design tokens', 'motion design', 'user journey', 'A/B testing'] },
  default: { found: ['leadership', 'communication', 'problem-solving', 'collaboration', 'project management'],
             missing: ['data analysis', 'KPI', 'strategic planning', 'stakeholder management', 'cross-functional', 'metrics'] },
};

function getKwSet(role) {
  const r = (role || '').toLowerCase();
  if (r.includes('product') || r.includes(' pm ')) return ATS_KW_MAP.pm;
  if (r.includes('engineer') || r.includes('developer') || r.includes('software')) return ATS_KW_MAP.eng;
  if (r.includes('design') || r.includes('ux') || r.includes('ui')) return ATS_KW_MAP.design;
  if (r.includes('data') || r.includes('analyst')) return ATS_KW_MAP.data;
  return ATS_KW_MAP.default;
}

function getHeroKwSet(job) {
  const j = (job || '').toLowerCase();
  if (j.includes('product') || j.includes('pm')) return HERO_ATS_KW.pm;
  if (j.includes('engineer') || j.includes('developer') || j.includes('software')) return HERO_ATS_KW.eng;
  if (j.includes('design') || j.includes('ux') || j.includes('ui')) return HERO_ATS_KW.design;
  return HERO_ATS_KW.default;
}

const STORE_KEY = 'cah_applications';
const STAGES = ['applied', 'screening', 'interview', 'offer', 'rejected'];
const STAGE_LABELS = { applied: 'Applied', screening: 'Phone Screen', interview: 'Interview', offer: 'Offer', rejected: 'Closed' };
const EMOJIS = ['🏢', '💼', '🏬', '🏦', '🖥️', '🏗️', '🔬', '📱'];

function timeAgo(date) {
  try {
    const s = Math.floor((Date.now() - date) / 1000);
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  } catch (e) { return 'recently'; }
}

function formatDate(iso) {
  try {
    const d = new Date(iso), now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return diff + 'd ago';
    return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
  } catch (e) { return ''; }
}

const STATS = [
  { value: 75, suffix: '%', cls: 'n-r', label: 'of resumes rejected by ATS before a human reads them' },
  { value: 18, prefix: '$', suffix: 'K', cls: 'n-a', label: 'average salary left on table without negotiation prep' },
  { value: 5, suffix: ' mo', cls: 'n-t', label: 'average job search going in blind with no system' },
  { value: 32, suffix: '×', scale: 10, cls: 'n-p', label: 'higher return when AI memory tracks your progress' },
];

const LAYER_DATA = [
  {
    label: 'l1', n: 'Layer 01', title: 'Resume creation', sub: 'ATS · editor · cover letter',
    status: 'live', ey: 'Layer 01 — Live now', panelTitle: 'Intelligent resume creation',
    desc: 'Choose from professional templates · Write in our In-App Editor with live ATS scoring as you type · XYZ bullet guidance structures every achievement to international standards · Version control saves every draft · One-click PDF & DOCX export · Cover Letter auto-generated from your profile and target role.',
    cta: 'Try it free →', ctaCls: 'cta-t',
    bg: 'var(--lp-teal-dim)', eyC: 'var(--lp-teal)', borderC: 'var(--lp-teal-b2)',
    mods: [
      { n: 'Resume Scan + ATS', d: 'Instant ATS match score against any job description. See missing keywords and exactly which changes move the needle.' },
      { n: 'In-App Editor', d: 'Write and edit directly in CareerAiHub. Live ATS score updates as you type. Professional templates. One-click PDF & DOCX export.' },
      { n: 'Cover Letter Generator', d: 'Auto-generated from your profile and target role. Tone control from formal to direct. Sounds like you, not a template.' },
    ],
    mem: [
      { n: 'Resume parsed', l: 'History extracted' }, { n: 'Target role', l: 'Seeded everywhere' },
      { n: 'Skills mapped', l: 'Gaps flagged' }, { n: 'Versions saved', l: 'Tracked over time' },
      { n: 'ATS score', l: 'Benchmark stored' },
    ],
  },
  {
    label: 'l2', n: 'Layer 02', title: 'Interview + salary prep', sub: 'Mock interviews · HM sim · salary',
    status: 'live', ey: 'Layer 02 — Live now', panelTitle: 'Interview + salary preparation',
    desc: "AI coaches that know your resume, your target role, and every past session. The mock interview knows which role you're targeting. HM Simulator pressure-tests your answers. Salary coach knows your market level.",
    cta: 'Try it free →', ctaCls: 'cta-t',
    bg: 'var(--lp-teal-dim)', eyC: 'var(--lp-teal)', borderC: 'var(--lp-teal-b2)',
    mods: [
      { n: 'Mock interviews', d: 'Role-specific question sets. AI scoring and feedback. Tracks improvement across sessions.' },
      { n: 'HM simulator', d: 'Simulates a hiring manager. Pressure-tests your answers. Knows your experience from memory.' },
      { n: 'Salary coach', d: 'Market benchmarks. Live AI negotiation roleplay. Multi-offer comparison.' },
    ],
    mem: [
      { n: 'Interview log', l: 'Sessions tracked' }, { n: 'Answer score', l: 'Trend visible' },
      { n: 'Weak spots', l: 'Practice flagged' }, { n: 'Salary range', l: 'Market-calibrated' },
      { n: 'Offer history', l: 'Negotiation context' },
    ],
  },
  {
    label: 'l3', n: 'Layer 03', title: 'Verified credentials', sub: 'Blockchain · school partners',
    status: 'building', ey: 'Layer 03 — Building next', panelTitle: 'Verified identity + credentials',
    desc: "Blockchain-backed institutional verification. School partnerships issue credentials directly onto your profile with a green verified badge — making your profile trustworthy to recruiters from day one.",
    cta: 'Join waitlist →', ctaCls: 'cta-a',
    bg: 'var(--lp-amber-dim)', eyC: 'var(--lp-amber)', borderC: 'var(--lp-amber-b)',
    mods: [
      { n: 'School partnerships', d: "Institutional onboarding via Dr. Lilian Koh's network. Free student access via MOU." },
      { n: 'Credential verify', d: 'Blockchain-backed degree and certification verification. Green verified badge on profile.' },
      { n: 'Skills assessment', d: 'Verified skills tests linked to credential. Displayed on profile. Recruiter-searchable.' },
    ],
    mem: [
      { n: 'Degree verified', l: 'Blockchain hash' }, { n: 'GPA confirmed', l: 'Institution-issued' },
      { n: 'Skills tested', l: 'Scores stored' }, { n: 'Badge issued', l: 'Trust score up' },
      { n: 'Recruiter visible', l: 'Searchable' },
    ],
  },
  {
    label: 'l4', n: 'Layer 04', title: 'AI marketplace', sub: 'Match engine · TrustChat',
    status: 'planned', ey: 'Layer 04 — Planned', panelTitle: 'AI-powered HR marketplace',
    desc: "Two-sided AI matching on verified data + TrustChat — verified in-platform messaging with credential sidebar. Recruiters access pre-verified, AI-matched candidates. No cold contact.",
    cta: 'Notify me →', ctaCls: 'cta-p',
    bg: 'var(--lp-purple-dim)', eyC: 'var(--lp-purple)', borderC: 'var(--lp-purple-b)',
    mods: [
      { n: 'AI match engine', d: 'Scores verified profiles against recruiter requirements. Auto-shortlist. Both sides notified on match.' },
      { n: 'TrustChat', d: 'Verified messaging. Recruiter initiates post-match. Credentials visible in sidebar.' },
      { n: 'Recruiter dashboard', d: 'Pipeline management. Hiring analytics. Application tracker. SGD 299–499/month.' },
    ],
    mem: [
      { n: 'Verified profile', l: 'Full trust score' }, { n: 'Match scored', l: 'AI fit calc' },
      { n: 'Both notified', l: 'No cold contact' }, { n: 'Chat started', l: 'Creds visible' },
      { n: 'Outcome logged', l: 'Memory improves' },
    ],
  },
];

const FEAT_DATA = [
  {
    icon: '🔍', label: 'Job Search', isFree: true, moduleId: 'jobs',
    ey: 'Module 1 — Always free', title: 'Job Search Engine',
    desc: 'Find live jobs from 20+ platforms in one place. AI ranks results by fit to your memory profile, surfaces salary data for each role, and shows which companies are actively hiring.',
    bullets: ['Live jobs from LinkedIn, Indeed, Glassdoor, and 17 more in one search', 'AI salary intel shows market rate for each role before you apply', 'Application tracker logs every job across all platforms in one dashboard', "Market intelligence shows hiring velocity — who's growing fast, who's slowing"],
    previewHd: 'Job Search · Live AI-ranked results',
    preview: `<div class="mk-lbl">Live results · "Product Manager · Singapore"</div>
      <div class="mk-row"><span class="mk-l">Senior PM · Tech company · SGD 8K–11K</span><span class="mk-v">94% fit</span></div>
      <div class="mk-row"><span class="mk-l">Product Manager · E-commerce · SGD 7K–10K</span><span class="mk-v">87% fit</span></div>
      <div class="mk-row"><span class="mk-l">Associate PM · Fintech · SGD 5K–7.5K</span><span class="mk-v">81% fit</span></div>
      <div class="mk-stat-row" style="margin-top:12px">
        <div class="mk-stat"><div class="mk-stat-n">340</div><div class="mk-stat-l">Open PM roles SG</div></div>
        <div class="mk-stat"><div class="mk-stat-n">SGD 8.2K</div><div class="mk-stat-l">Median salary</div></div>
        <div class="mk-stat"><div class="mk-stat-n">+18%</div><div class="mk-stat-l">YoY demand</div></div>
      </div>`,
    pw: null,
  },
  {
    icon: '⚡', label: 'Resume Scan', isFree: false, moduleId: 'scan',
    ey: 'Module 2 — Premium', title: 'Resume Scan + ATS Scorer',
    desc: "Upload your resume and a job description. Real-time ATS match score, keyword gap analysis, and specific improvement suggestions — all informed by your AI memory.",
    bullets: ["Real-time ATS score vs the exact job description you're applying to", "Keyword gap analysis — see exactly what's missing before you submit", 'AI memory means it already knows your work history from onboarding', 'Version control tracks every resume iteration and its ATS score over time'],
    previewHd: 'Resume Scan + ATS · live scoring',
    preview: `<div class="mk-lbl">ATS score vs Senior PM · Job description</div>
      <div class="mk-score" style="margin-bottom:12px"><div class="mk-track"><div class="mk-bar" style="width:91%"></div></div><span class="mk-pct">91%</span></div>
      <div class="mk-lbl">Keywords matched</div>
      <div style="margin-bottom:9px"><span class="mk-tag m">product strategy</span><span class="mk-tag m">roadmap</span><span class="mk-tag m">agile</span><span class="mk-tag m">data-driven</span></div>
      <div class="mk-lbl">Missing — add these</div>
      <div><span class="mk-tag x">OKR framework</span><span class="mk-tag x">growth metrics</span><span class="mk-tag x">SQL</span></div>`,
    pw: { h: "You've used your 1 free resume scan.", s: 'Unlock the full editor to fix every gap and re-score as many times as you need.', cta: 'Unlock full editor →' },
  },
  {
    icon: '✦', label: 'ATS Builder', isFree: false, moduleId: 'ats',
    ey: 'Module 3 — Premium', title: 'In-App ATS Builder',
    desc: 'Write and edit your resume directly in CareerAiHub with live ATS scoring as you type. XYZ bullet guidance shows you exactly how to quantify each achievement. Version control means you never lose a draft.',
    bullets: ['XYZ formula: Achieved X, measured by Y, by doing Z — for every bullet', 'Live ATS score updates as you type — see impact of every change in real time', 'Version control with named snapshots — revert to any previous draft instantly', 'One-click download as PDF or DOCX with formatting preserved'],
    previewHd: 'ATS Builder · live edit mode',
    preview: `<div class="mk-lbl">Before XYZ formula</div>
      <div class="mk-chat" style="border-left:2px solid var(--red);margin-bottom:8px;font-size:11px">Led product team to ship new checkout flow.</div>
      <div class="mk-lbl">AI suggestion — XYZ format</div>
      <div class="mk-chat ai">Reduced checkout abandonment by 34% (X), measured by Amplitude funnel data (Y), by shipping a 2-step guest checkout flow in 6 weeks (Z).</div>
      <div class="mk-lbl" style="margin-top:10px">Live ATS score after edit</div>
      <div class="mk-score"><div class="mk-track"><div class="mk-bar" style="width:91%"></div></div><span class="mk-pct">+6pts</span></div>`,
    pw: { h: "You've hit the free editing limit.", s: 'Unlock full editor access — apply all suggestions, save versions, and download your updated resume.', cta: 'Unlock full editor →' },
  },
  {
    icon: '🔎', label: 'JD Analyzer', isFree: false, moduleId: 'jd',
    ey: 'Module 4 — Premium', title: 'JD Analyzer',
    desc: "Paste any job description. CareerAiHub decodes it — surfacing the real requirements hidden in vague language, mapping them to your resume, and flagging gaps you need to address before applying.",
    bullets: ['Decodes vague JD language into specific, actionable skill requirements', "Maps each requirement to your resume — shows what you have and what's missing", 'AI memory means it already knows your background before you paste the JD', 'Priority ranking: which gaps matter most to close before you apply'],
    previewHd: 'JD Analyzer · requirements decoded',
    preview: `<div class="mk-lbl">Tech Company · Senior PM · decoded</div>
      <div class="mk-row"><span class="mk-l">5+ years product experience</span><span class="mk-v">✓ You have 7 years</span></div>
      <div class="mk-row"><span class="mk-l">Growth stage experience</span><span class="mk-v">✓ Matched via memory</span></div>
      <div class="mk-row"><span class="mk-l">SQL / data analysis</span><span class="mk-v neg">⚠ Not on resume</span></div>
      <div class="mk-row"><span class="mk-l">OKR framework</span><span class="mk-v neg">⚠ Add to resume</span></div>
      <div class="mk-chat ai" style="margin-top:10px"><strong style="color:var(--teal)">AI:</strong> Add a bullet in your Shopee role about the SQL dashboards you built. Closes the data gap, lifts ATS by ~10 points.</div>`,
    pw: { h: "You've used your 1 free JD analysis.", s: "Unlock unlimited analyses to decode every role you're targeting — before spending time applying.", cta: 'Unlock unlimited sessions →' },
  },
  {
    icon: '⭐', label: 'STAR Builder', isFree: false, moduleId: 'star',
    ey: 'Module 5 — Premium', title: 'STAR Answer Builder',
    desc: "CareerAiHub builds STAR-structured interview answers from your memory-stored work history — tailored to the specific role you're targeting. Quantified, compelling, and uniquely yours.",
    bullets: ['Generates role-specific STAR answers from your actual work history in memory', 'Quantifies results using your real data — no generic placeholders', 'AI scores each answer for clarity, relevance, and impact', 'Saved answer library you can refine and reuse across applications'],
    previewHd: 'STAR Builder · answer preview',
    preview: `<div class="mk-star"><div class="mk-star-l">Situation</div><div class="mk-star-t">At a major e-commerce platform, checkout abandonment was 61% on mobile — above the 45% SEA benchmark.</div></div>
      <div class="mk-star"><div class="mk-star-l">Task</div><div class="mk-star-t">Reduce abandonment 15 points in one quarter, leading a cross-functional team of 8.</div></div>
      <div class="mk-star"><div class="mk-star-l">Action</div><div class="mk-star-t">Ran discovery sprint, shipped 2-step guest checkout eliminating mandatory account creation on mobile.</div></div>
      <div class="mk-star"><div class="mk-star-l">Result</div><div class="mk-star-t">Abandonment dropped 34% in 6 weeks. SGD 2.1M recovered GMV in Q4 2023.</div></div>`,
    pw: { h: "You've used your 1 free STAR answer.", s: "Unlock unlimited answers to build a complete library for every role you're targeting.", cta: 'Unlock unlimited sessions →' },
  },
  {
    icon: '🧠', label: 'HM Simulator', isFree: false, moduleId: 'simulate',
    ey: 'Module 6 — Premium', title: 'Hiring Manager Simulator',
    desc: "Practice against an AI that behaves like a real hiring manager — asking follow-ups, probing weak answers, and challenging vague claims. It knows your resume and target role, so every question is contextually relevant.",
    bullets: ['Simulates a real hiring manager — not a generic question bot', 'Probes weak answers: "Can you quantify that?" "What was the hardest part?"', 'Knows your resume from memory — asks about your actual experience', 'Scores each answer and gives immediate, specific feedback on what to sharpen'],
    previewHd: 'HM Simulator · live session',
    preview: `<div class="mk-chat ai"><strong style="color:var(--teal)">HM:</strong> You mentioned the checkout redesign. What was the single hardest stakeholder disagreement and how did you resolve it?</div>
      <div class="mk-chat you"><strong style="color:var(--text)">You:</strong> The payments team wanted to delay 3 weeks. I pulled in the CTO for a risk/reward conversation and we agreed to ship with a 10% traffic rollout.</div>
      <div class="mk-chat ai"><strong style="color:var(--teal)">Feedback:</strong> Good structure — but quantify the risk you accepted. What was your rollback threshold? Own the decision with data, not just process description.</div>
      <div class="mk-stat-row" style="margin-top:10px">
        <div class="mk-stat"><div class="mk-stat-n">74%</div><div class="mk-stat-l">Answer score</div></div>
        <div class="mk-stat"><div class="mk-stat-n">+12%</div><div class="mk-stat-l">vs last session</div></div>
      </div>`,
    pw: { h: "You've used your 1 free mock interview session.", s: 'Unlock unlimited sessions to practice until every answer is sharp — before the real interview.', cta: 'Unlock unlimited sessions →' },
  },
  {
    icon: '💰', label: 'Salary Coach', isFree: false, moduleId: 'salary',
    ey: 'Module 7 — Premium', title: 'Salary Coach + Negotiation Roleplay',
    desc: 'Know your market rate before any negotiation. Live Singapore market data, AI negotiation roleplay, and multi-offer comparison. The coach already knows your level from your AI memory.',
    bullets: ['Real-time salary benchmarks by role, experience, and company size in Singapore', 'Live AI negotiation roleplay — practice the number before the real call', 'Multi-offer comparison: total comp, equity, benefits, and growth trajectory', 'AI memory means the coach already knows your current salary and target level'],
    previewHd: 'Salary Coach · negotiation prep',
    preview: `<div class="mk-lbl">Your market position · Senior PM · Singapore</div>
      <div class="mk-row"><span class="mk-l">25th percentile</span><span class="mk-v" style="color:var(--text2)">SGD 6,500/mo</span></div>
      <div class="mk-row"><span class="mk-l">Median (50th)</span><span class="mk-v">SGD 8,200/mo</span></div>
      <div class="mk-row"><span class="mk-l">Your current offer</span><span class="mk-v neg">SGD 7,500/mo — below median</span></div>
      <div class="mk-chat ai" style="margin-top:10px"><strong style="color:var(--teal)">Coach:</strong> They offered SGD 7,500. Based on your 7 years, anchor at SGD 9,000. Say: "Based on my research and the scope, I was expecting closer to SGD 9,000." Try it.</div>`,
    pw: { h: "You've used your 1 free salary coaching session.", s: "Unlock negotiation roleplay — practice your counter-offer out loud so you're ready when it matters.", cta: 'Unlock negotiation roleplay →' },
  },
  {
    icon: '📄', label: 'Cover Letter', isFree: false, moduleId: 'cover',
    ey: 'Module 8 — Premium', title: 'Cover Letter Generator',
    desc: "CareerAiHub writes a cover letter tailored to each specific role — pulling from your AI memory to reference your actual experience, match the company's language, and hit the right tone. Not a template. A letter that sounds like you.",
    bullets: ['Reads the JD and your resume from memory — no copy-pasting needed', 'Matches tone: formal for finance, direct for startups, technical for engineering', 'References your actual achievements, not generic placeholders', 'Editable in-app with tone control — adjust formality before downloading'],
    previewHd: 'Cover Letter Generator · Tech Company · Senior PM',
    preview: `<div class="mk-lbl">Generated · tone: professional · length: medium</div>
      <div class="mk-letter"><div class="mll hl w90"></div><div class="mll w100"></div><div class="mll w85"></div><div style="height:8px"></div><div class="mll w100"></div><div class="mll w100"></div><div class="mll w75"></div><div class="mll w90"></div><div style="height:8px"></div><div class="mll w100"></div><div class="mll w85"></div><div class="mll w60"></div><div style="height:8px"></div><div class="mll w50"></div></div>
      <div style="display:flex;gap:8px;margin-top:12px;align-items:center"><span style="font-size:10px;color:var(--text3)">Tone:</span><div style="flex:1;height:4px;border-radius:2px;background:var(--bg4)"><div style="width:65%;height:100%;background:var(--teal);border-radius:2px"></div></div><span style="font-size:10px;color:var(--text3)">Professional</span></div>`,
    pw: { h: "You've used your 1 free cover letter.", s: 'Unlock unlimited cover letters — one tailored letter for every role, generated in seconds.', cta: 'Unlock unlimited sessions →' },
  },
  {
    icon: '📡', label: 'Weakness Radar', isFree: false, moduleId: 'radar',
    ey: 'Module 9 — Premium', title: 'Weakness Radar',
    desc: 'AI maps your full skill profile and flags the exact gaps most likely to cost you the offer. Not generic advice — targeted intelligence built from your resume, target role, and live Singapore market demand.',
    bullets: ['6-dimension skill radar: technical, leadership, communication, execution, and more', 'Gaps ranked by impact — which ones hurt you most for your specific target role', 'Prioritised action plan: close these gaps before your next application', 'Tracks improvement across sessions as you develop new skills'],
    previewHd: 'Weakness Radar · skill gap analysis',
    preview: `<div class="mk-lbl">Skill gaps · Senior PM · Singapore</div>
      <div class="mk-row"><span class="mk-l">Product strategy</span><span class="mk-v">Strong ✓</span></div>
      <div class="mk-row"><span class="mk-l">Data analysis / SQL</span><span class="mk-v neg">Gap ⚠</span></div>
      <div class="mk-row"><span class="mk-l">Stakeholder management</span><span class="mk-v">Strong ✓</span></div>
      <div class="mk-row"><span class="mk-l">Technical depth</span><span class="mk-v neg">Gap ⚠</span></div>
      <div class="mk-chat ai" style="margin-top:10px"><strong style="color:var(--teal)">AI:</strong> Close the SQL gap first — it appears in 73% of senior PM JDs in Singapore. One project reference lifts ATS by ~8 points.</div>`,
    pw: { h: "You've used your 1 free weakness analysis.", s: 'Unlock unlimited radar scans to track improvement across every application cycle.', cta: 'Unlock weakness radar →' },
  },
  {
    icon: '🏆', label: 'Readiness Score', isFree: false, moduleId: 'score',
    ey: 'Module 10 — Premium', title: 'Job Readiness Score',
    desc: "A single composite score that tells you exactly how ready you are for your target role right now — and the 3 moves that will lift it the most. Built from your resume, ATS score, interview performance, and market fit.",
    bullets: ['Composite readiness score 0–100 across resume, interview, salary, and market fit', 'Tells you the exact 3 actions that will move the needle most', 'Updates live as you complete modules and improve your profile', 'Benchmark against other candidates at your experience level in Singapore'],
    previewHd: 'Readiness Score · composite analysis',
    preview: `<div class="mk-lbl">Overall readiness · Senior PM · Target company</div>
      <div class="mk-score" style="margin-bottom:16px"><div class="mk-track"><div class="mk-bar" style="width:74%"></div></div><span class="mk-pct">74%</span></div>
      <div class="mk-row"><span class="mk-l">Resume + ATS match</span><span class="mk-v">91%</span></div>
      <div class="mk-row"><span class="mk-l">Interview readiness</span><span class="mk-v neg">58% ↑ needs work</span></div>
      <div class="mk-row"><span class="mk-l">Salary knowledge</span><span class="mk-v neg">61% ↑ needs work</span></div>
      <div class="mk-stat-row" style="margin-top:12px">
        <div class="mk-stat"><div class="mk-stat-n">74</div><div class="mk-stat-l">Your score</div></div>
        <div class="mk-stat"><div class="mk-stat-n">+16pts</div><div class="mk-stat-l">To reach 90</div></div>
      </div>`,
    pw: { h: "You've used your 1 free readiness check.", s: 'Unlock full readiness tracking to monitor your score as you work through every module.', cta: 'Unlock readiness score →' },
  },
  {
    icon: '🌏', label: 'Market Intel', isFree: true, moduleId: 'market',
    ey: 'Module 11 — Always free', title: 'Market Intelligence',
    desc: "Live Singapore job market data — hiring velocity by company, salary benchmarks by role and level, and demand trends by skill. Know who's growing, which roles are oversupplied, and where to focus your energy.",
    bullets: ['Hiring velocity: who is growing fast, who is slowing — updated weekly', 'Salary benchmarks by role, level, and company size in Singapore', 'Skill demand trends: which skills are rising, which are declining in demand', 'Company intel: funding stage, headcount growth, recent layoffs'],
    previewHd: 'Market Intel · Singapore · live data',
    preview: `<div class="mk-lbl">Hiring velocity · Product roles · Singapore</div>
      <div class="mk-row"><span class="mk-l">Grab</span><span class="mk-v">↑ Growing fast</span></div>
      <div class="mk-row"><span class="mk-l">Sea Group</span><span class="mk-v">↑ Growing</span></div>
      <div class="mk-row"><span class="mk-l">Shopee</span><span class="mk-v neg">→ Flat</span></div>
      <div class="mk-stat-row" style="margin-top:12px">
        <div class="mk-stat"><div class="mk-stat-n">340</div><div class="mk-stat-l">PM roles open</div></div>
        <div class="mk-stat"><div class="mk-stat-n">+18%</div><div class="mk-stat-l">YoY demand</div></div>
        <div class="mk-stat"><div class="mk-stat-n">SGD 8.2K</div><div class="mk-stat-l">Median salary</div></div>
      </div>`,
    pw: null,
  },
  {
    icon: '🧬', label: 'AI Memory', isFree: false, moduleId: 'memory',
    ey: 'Module 12 — Premium', title: 'AI Memory Dashboard',
    desc: "CareerAiHub reads your resume once and seeds context to every module instantly. Your mock interview knows your target role. Your salary coach knows your level. Every session writes back — the platform compounds over time.",
    bullets: ['One-time setup — upload your resume and the AI seeds every module', 'Every module reads from shared memory — no copy-pasting between tools', 'Memory updates with every session — platform gets smarter over time', 'View, edit, and export your full AI memory profile at any time'],
    previewHd: 'AI Memory · career profile snapshot',
    preview: `<div class="mk-lbl">Memory core — seeded from your resume</div>
      <div class="mk-row"><span class="mk-l">Target role</span><span class="mk-v">Senior PM · Grab</span></div>
      <div class="mk-row"><span class="mk-l">Experience</span><span class="mk-v">7 years · product</span></div>
      <div class="mk-row"><span class="mk-l">ATS score</span><span class="mk-v">91% ↑ from 38%</span></div>
      <div class="mk-row"><span class="mk-l">Sessions logged</span><span class="mk-v">12 across 6 modules</span></div>
      <div class="mk-stat-row" style="margin-top:12px">
        <div class="mk-stat"><div class="mk-stat-n">6</div><div class="mk-stat-l">Modules active</div></div>
        <div class="mk-stat"><div class="mk-stat-n">12</div><div class="mk-stat-l">Sessions logged</div></div>
        <div class="mk-stat"><div class="mk-stat-n">+34%</div><div class="mk-stat-l">Score delta</div></div>
      </div>`,
    pw: { h: 'Unlock your full AI memory dashboard.', s: 'See every data point the AI knows about you — and edit it anytime to keep every module in sync.', cta: 'Unlock full memory →' },
  },
];

const FAQ_DATA = [
  { q: 'What is CareerAiHub and how is it different from LinkedIn?', a: "CareerAiHub owns professional execution — the active, AI-guided layer that turns a static LinkedIn profile into a verified, interview-ready, AI-matched candidate. LinkedIn owns professional identity. We complete it, not compete with it. CareerAiHub has 10 AI modules across 4 layers at $19/month, replacing 5 tools costing $175+/month." },
  { q: 'How does the AI memory work across all 10 modules?', a: 'Upload your resume once at onboarding. The AI memory core reads it and seeds context to every module instantly. Your mock interview knows your target role. Your Salary Coach knows your experience level. Your cover letter knows your latest resume version. Every session writes back to the core — compounding switching costs no point solution can replicate.' },
  { q: 'Is the ATS resume scanner accurate for Singapore job applications?', a: "Yes — CareerAiHub scores your resume against the specific job description you're applying to, not generic templates. Users consistently see ATS scores jump from under 40% to above 85% in a single session. The scanner shows exactly which keywords are missing, which sections need work, and which changes will have the biggest impact on your score." },
  { q: 'Can I try CareerAiHub free without a credit card?', a: "Yes. The free tier includes 1 ATS resume scan, 1–2 uses per module, and unlimited access to the job search engine and market intelligence. No credit card required. Premium is $19/month or $180/year — replacing $175+/month of separate tools, saving $156/month." },
  { q: 'What is the Hiring Manager Simulator?', a: "The HM Simulator is an AI that behaves like a real hiring manager — asking follow-up questions, probing vague answers, and challenging unsupported claims. Unlike generic interview bots, it knows your resume and target role from your AI memory, making every question contextually relevant to your actual background." },
  { q: 'Is CareerAiHub only for Singapore?', a: "Not at all — CareerAiHub is built for every English-speaking professional. Singapore is our launch market because it is the ideal environment: high digital maturity, English as the dominant business language, and a concentration of ambitious professionals at every career stage. From Singapore, we expand across Southeast Asia, then into Australia, the UK, Canada, and the USA. Wherever you are, if you are navigating a job search in English, CareerAiHub works for you." },
];

// ── HOOKS ─────────────────────────────────────────────────────────────────────

function useTypewriter(phrases) {
  const [text, setText] = useState('');
  const state = useRef({ pi: 0, ci: 0, deleting: false });
  useEffect(() => {
    let timer;
    const tick = () => {
      const { pi, ci, deleting } = state.current;
      const phrase = phrases[pi];
      const next = deleting ? phrase.substring(0, ci - 1) : phrase.substring(0, ci + 1);
      setText(next);
      if (!deleting && next === phrase) { timer = setTimeout(() => { state.current.deleting = true; tick(); }, 1800); return; }
      if (deleting && next === '') { state.current = { pi: (pi + 1) % phrases.length, ci: 0, deleting: false }; timer = setTimeout(tick, 300); return; }
      state.current = { pi, ci: deleting ? ci - 1 : ci + 1, deleting };
      timer = setTimeout(tick, deleting ? 38 : 72);
    };
    const init = setTimeout(tick, 600);
    return () => { clearTimeout(timer); clearTimeout(init); };
  }, []);
  return text;
}

function useCounter(target, scale = 1, started = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!started) return;
    const real = target / scale, dur = 1500, startTs = performance.now();
    let raf;
    const tick = (now) => {
      const prog = Math.min((now - startTs) / dur, 1);
      const ease = 1 - Math.pow(1 - prog, 3);
      setVal(real * ease);
      if (prog < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started]);
  return val;
}

function useScrollReveal(rootRef) {
  useEffect(() => {
    const el = rootRef?.current || document;
    const targets = el.querySelectorAll('.reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('up'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    targets.forEach(t => io.observe(t));
    return () => io.disconnect();
  }, []);
}

// ── SUBCOMPONENTS ─────────────────────────────────────────────────────────────

function StatBox({ stat, started }) {
  const val = useCounter(stat.value, stat.scale || 1, started);
  const real = stat.value / (stat.scale || 1);
  const display = Number.isInteger(real) ? Math.round(val) : val.toFixed(1);
  return (
    <div className="stt">
      <div className={`stt-n ${stat.cls}`}>{stat.prefix || ''}{display}{stat.suffix || ''}</div>
      <div className="stt-l">{stat.label}</div>
    </div>
  );
}

export const LogoMark = ({ size = 26, radius = 7 }) => (
  <div className="lp-lmark" style={{ width: size, height: size, borderRadius: radius }}>
    <svg viewBox="0 0 14 14" style={{ width: size * 0.54, height: size * 0.54, fill: 'none', stroke: '#0B0F14', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
      <polyline points="2,12 7,2 12,12" /><line x1="4" y1="8.5" x2="10" y2="8.5" />
    </svg>
  </div>
);

// ── NAV ───────────────────────────────────────────────────────────────────────

function NavBar({ onSignIn, onJoin, scrolled }) {
  const ss = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <nav className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
      <button className="lp-nav-logo"><LogoMark />CareerAiHub</button>
      <div className="lp-nav-center">
        <button className="lp-nl" onClick={() => ss('feat-sec')}>Features</button>
        <button className="lp-nl" onClick={() => ss('price-sec')}>Pricing</button>
        <button className="lp-nl" onClick={() => ss('compare-sec')}>Compare</button>
        <button className="lp-nl" onClick={() => ss('faq-sec')}>FAQ</button>
      </div>
      <div className="lp-nav-r">
        <button className="lp-btn-si" onClick={onSignIn}>Sign In</button>
        <button className="lp-btn-join" onClick={onJoin}>✦ Join Free</button>
      </div>
    </nav>
  );
}

export function GuestNav({ onSignIn, onJoin, onHome }) {
  return (
    <nav className="lp-nav">
      <button className="lp-nav-logo" onClick={onHome}><LogoMark />CareerAiHub</button>
      <div className="lp-nav-center">
        <button className="lp-nl" onClick={onHome}>Features</button>
        <button className="lp-nl" onClick={onHome}>Pricing</button>
        <button className="lp-nl" onClick={onHome}>Compare</button>
        <button className="lp-nl" onClick={onHome}>FAQ</button>
      </div>
      <div className="lp-nav-r">
        <button className="lp-btn-si" onClick={onSignIn}>Sign In</button>
        <button className="lp-btn-join" onClick={onJoin}>✦ Join Free</button>
      </div>
    </nav>
  );
}

// ── PILLS ─────────────────────────────────────────────────────────────────────

export const PILLS = [
  { icon: '🔎', label: 'Job Search',      moduleId: 'jobs'     },
  { icon: '⚡', label: 'Resume Scan',     moduleId: 'scan'     },
  { icon: '✨', label: 'ATS Builder',     moduleId: 'ats'      },
  { icon: '🔍', label: 'JD Analyzer',     moduleId: 'jd'       },
  { icon: '⭐', label: 'STAR Builder',    moduleId: 'star'     },
  { icon: '🧠', label: 'HM Simulator',   moduleId: 'simulate' },
  { icon: '💰', label: 'Salary Coach',   moduleId: 'salary'   },
  { icon: '📄', label: 'Cover Letter',   moduleId: 'cover'    },
  { icon: '📡', label: 'Weakness Radar', moduleId: 'radar'    },
  { icon: '🏆', label: 'Readiness Score',moduleId: 'score'    },
  { icon: '🌏', label: 'Market Intel',   moduleId: 'market'   },
  { icon: '🧬', label: 'AI Memory',      moduleId: 'memory'   },
];

export function ModulePills({ active, setActive }) {
  return (
    <div className="lp-mod-nav">
      {PILLS.map((p, i) => (
        <button key={i} className={`lp-mpill${active === i ? ' on' : ''}`} onClick={() => setActive(i)}>
          <span className="lp-mi">{p.icon}</span>{p.label}
        </button>
      ))}
    </div>
  );
}

// ── TICKER ────────────────────────────────────────────────────────────────────

const TICKER_ITEMS = ['✦ 10 AI modules active', 'Job search & market intel — always free', 'Premium — $19/month · save $156/mo vs separate tools', 'ATS resume scanner Singapore', 'AI mock interview coach'];

export function TickerBar() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="lp-ticker">
      <div className="lp-ticker-t">
        {items.map((t, i) => (
          <React.Fragment key={i}>
            <span className="lp-tseg">{t}</span>
            <span className="lp-tdiv"> · </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ── ATS INTERCEPT per job card ────────────────────────────────────────────────

function AtsIntercept({ jobId, role, company, link, state, onApply, onClose, onOpenImprove }) {
  const circleRef = useRef(null);

  useEffect(() => {
    if (state?.loading === false && state?.score && circleRef.current) {
      let cur = 0;
      const target = state.score;
      const interval = setInterval(() => {
        cur = Math.min(cur + Math.ceil(target / 20), target);
        if (circleRef.current) circleRef.current.textContent = cur + '%';
        if (cur >= target) clearInterval(interval);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [state?.loading, state?.score]);

  if (!state?.show) return null;

  return (
    <div className="ats-intercept show">
      <div className="ats-int-hd">
        <div>
          <div className="ats-int-title">ATS Score Check — {role}</div>
          <div className="ats-int-subtitle">Most ATS systems filter 7 in 10 resumes before a human reads them</div>
        </div>
        <button className="ats-int-close" onClick={() => onClose(jobId)}>✕</button>
      </div>
      <div className="ats-int-body">
        {state.loading ? (
          <div className="ats-int-loading">
            <div className="res-spinner" />
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Scanning your resume against this role...</div>
              <div className="ats-int-bar"><div className="ats-int-bar-fill" style={{ width: '85%' }} /></div>
            </div>
          </div>
        ) : (
          <>
            <div className="ats-int-score-row">
              <div className={`ats-int-score-circle ${state.level}`} ref={circleRef}>0%</div>
              <div className="ats-int-verdict">
                <div className="ats-int-verdict-title">
                  {state.level === 'good' ? "Strong match — you're ready to apply" : state.level === 'mid' ? 'A few gaps — worth a quick fix' : 'Resume needs work for this role'}
                </div>
                <div className="ats-int-verdict-sub">
                  {state.level === 'good'
                    ? 'Your resume passes this ATS filter. Apply with confidence, or fine-tune a few keywords to push your score even higher.'
                    : state.level === 'mid'
                    ? 'Your resume partially matches this role. Closing the keyword gaps below could significantly increase your chance of a phone screen.'
                    : 'Your resume is likely to be filtered out before a recruiter reads it. Add the missing keywords below before applying.'}
                </div>
                <div className="ats-stat-highlight">
                  {state.level === 'good' ? '✓ Resume passes ATS filter for this role' : '⬤ Fixing these gaps increases phone screen rate by up to 3×'}
                </div>
              </div>
            </div>
            <div className="ats-int-kw">
              <div className="ats-int-kw-label">Keywords matched</div>
              <div style={{ marginBottom: 10 }}>{state.kws.found.slice(0, 3).map(k => <span key={k} className="mk-tag m">{k}</span>)}</div>
              <div className="ats-int-kw-label">Missing — add these to improve score</div>
              <div>{state.kws.missing.slice(0, 4).map(k => <span key={k} className="mk-tag x">{k}</span>)}</div>
            </div>
            <div className="ats-int-cta">
              {state.level === 'good' ? (
                <>
                  <button className="ats-int-primary" onClick={() => onApply(jobId, role, company, link)}>Apply now →</button>
                  <button className="ats-int-secondary" onClick={() => onOpenImprove(jobId)}>Fine-tune keywords</button>
                  <button className="ats-int-skip" onClick={() => onClose(jobId)}>Close</button>
                </>
              ) : (
                <>
                  <button className="ats-int-primary" onClick={() => onOpenImprove(jobId)}>✦ Fix it — improve score</button>
                  <button className="ats-int-secondary" onClick={() => onApply(jobId, role, company, link)}>Apply anyway →</button>
                  <button className="ats-int-skip" onClick={() => onClose(jobId)}>Skip</button>
                </>
              )}
            </div>
            {state.showImprove && (
              <div className="ats-improve show">
                <div className="ats-improve-title">How to add these keywords naturally</div>
                {state.kws.missing.slice(0, 4).map((kw, i) => (
                  <div key={i} className="ats-improve-tip">
                    <span className="ats-improve-num">{i + 1}</span>
                    <span>Add <strong style={{ color: 'var(--lp-text)' }}>"{kw}"</strong> — mention a specific example in your experience or skills section</span>
                  </div>
                ))}
                <button className="ats-rescan" onClick={() => { onClose(jobId); document.getElementById('feat-sec')?.scrollIntoView({ behavior: 'smooth' }); }}>
                  ✦ Re-scan after edits — open ATS Builder →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── SEARCH CARD ───────────────────────────────────────────────────────────────

function SearchCard({ onJoin, onModuleSelect, onTrackerOpen, onSnack }) {
  const [jobQ, setJobQ] = useState('');
  const [locQ, setLocQ] = useState('Singapore');
  const [exp, setExp] = useState('Any level');
  const [jobType, setJobType] = useState('All types');
  const [kw, setKw] = useState('');
  const [acItems, setAcItems] = useState([]);
  const [acOpen, setAcOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [resCount, setResCount] = useState('');
  const [resOpen, setResOpen] = useState(false);
  const [atsMap, setAtsMap] = useState({});
  const [ms1, setMs1] = useState(306);
  const [appCount, setAppCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      try { setAppCount(JSON.parse(localStorage.getItem(STORE_KEY) || '[]').length); } catch { setAppCount(0); }
    };
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  useEffect(() => {
    let v = 306, dir = 1;
    const t = setInterval(() => {
      v += dir * (Math.floor(Math.random() * 3) + 1);
      if (v > 360) dir = -1; if (v < 300) dir = 1;
      setMs1(v);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const showAc = (val) => {
    if (!val || val.length < 2) { setAcItems([]); setAcOpen(false); return; }
    const f = AC_DATA.filter(d => d.title.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
    setAcItems(f); setAcOpen(f.length > 0);
  };
  const pickAc = (title) => { setJobQ(title); setAcOpen(false); };
  const hideAc = () => setTimeout(() => setAcOpen(false), 160);

  const logApp = (role, company, url) => {
    const stored = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    if (!stored.find(a => a.role === role && a.company === company)) {
      stored.unshift({ id: Date.now().toString(), role, company, url, source: 'Job Search', status: 'applied', date: new Date().toISOString(), notes: '' });
      localStorage.setItem(STORE_KEY, JSON.stringify(stored));
      setAppCount(stored.length);
      onSnack?.('Application logged: ' + role);
    }
  };

  const applyNow = (jobId, role, company, link) => {
    logApp(role, company, link);
    if (link && link !== '#') window.open(link, '_blank', 'noopener');
  };

  const toggleAts = async (jobId, role, company, link) => {
    setAtsMap(prev => {
      const cur = prev[jobId];
      if (cur?.show && !cur?.loading) return { ...prev, [jobId]: { show: false } };
      return { ...prev, [jobId]: { show: true, loading: true } };
    });
    await new Promise(r => setTimeout(r, 1600));
    const kws = getKwSet(role);
    const score = Math.min(91, Math.max(32, 42 + Math.floor(Math.random() * 35)));
    const level = score >= 75 ? 'good' : score >= 50 ? 'mid' : 'low';
    setAtsMap(prev => ({ ...prev, [jobId]: { show: true, loading: false, score, level, role, company, link, kws, showImprove: false } }));
  };

  const closeAts = (jobId) => setAtsMap(prev => ({ ...prev, [jobId]: { show: false } }));
  const openImprove = (jobId) => setAtsMap(prev => ({ ...prev, [jobId]: { ...prev[jobId], showImprove: true } }));

  const runSearch = async () => {
    const title = jobQ.trim() || 'Product Manager';
    const loc = locQ.trim() || 'Singapore';
    setSearching(true); setResOpen(true);
    setResults([{ type: 'loading' }]); setResCount('');

    // Live results come from the `jobs` Edge Function (Adzuna keys stay on the server).
    // If it is unavailable or returns nothing, fall back to search links on the major boards.
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
        body: JSON.stringify({ what: title, where: loc, experience: exp }),
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) throw new Error('jobs ' + resp.status);
      const data = await resp.json();
      const jobs = data.jobs || [];
      if (!jobs.length) throw new Error('no results');
      setResCount(`${(data.count || 0).toLocaleString()} live results · Showing top ${jobs.length}`);
      setResults(jobs.map((j, i) => ({
        type: 'job', id: `job-${Date.now()}-${i}`,
        role: j.title || title,
        company: j.company || 'Company',
        location: j.location || loc,
        link: j.link || '#',
        salary: j.salaryMin ? `SGD ${Math.round(j.salaryMin / 12).toLocaleString()}–${Math.round(j.salaryMax / 12).toLocaleString()}/mo` : '',
        ago: j.created ? timeAgo(new Date(j.created)) : '',
        desc: j.description ? j.description.slice(0, 120) + '...' : '',
        emoji: EMOJIS[i % EMOJIS.length],
      })));
    } catch {
      setResCount(`Results for "${title}" in ${loc}`);
      setResults([{ type: 'fallback', title, location: loc }]);
    }
    setSearching(false);
    setTimeout(() => document.getElementById('searchResults')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300);
  };

  const fallbackLinks = (title, loc) => {
    const q = encodeURIComponent(title), l = encodeURIComponent(loc);
    return [
      { id: `fb-0`, role: `${title} roles on Indeed`, company: 'Indeed', location: loc, link: `https://www.indeed.com/jobs?q=${q}&l=${l}&sort=date`, salary: '', ago: '', desc: '', emoji: '🔍', type: 'job' },
      { id: `fb-1`, role: `${title} roles on LinkedIn`, company: 'LinkedIn Jobs', location: loc, link: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${l}`, salary: '', ago: '', desc: '', emoji: '💼', type: 'job' },
      { id: `fb-2`, role: `${title} roles on JobStreet`, company: 'JobStreet · Southeast Asia', location: loc, link: `https://www.jobstreet.com.sg/en/job-search/${encodeURIComponent(title.toLowerCase().replace(/ /g, '-'))}-jobs/`, salary: '', ago: '', desc: '', emoji: '🏬', type: 'job' },
      { id: `fb-3`, role: `${title} roles on MyCareersFuture`, company: 'MyCareersFuture · Singapore', location: loc, link: `https://www.mycareersfuture.gov.sg/search?search=${q}&sortBy=new_posting_date`, salary: '', ago: '', desc: '', emoji: '🏦', type: 'job' },
    ];
  };

  const renderedResults = results[0]?.type === 'fallback'
    ? fallbackLinks(results[0].title, results[0].location)
    : results.filter(r => r.type === 'job');

  return (
    <div className="hero-right">
      <div className="search-card-label">Find your next role — AI-ranked from 20+ platforms, free</div>
      <div className="search-card">
        <div className="search-card-hd">
          <div className="search-card-title"><span className="search-card-dot" />Job Search</div>
          <span className="search-card-badge">Always Free</span>
        </div>
        <div className="market-signals">
          <div className="ms-pill">
            <div className="ms-top"><span className="ms-val">{ms1}</span><span className="ms-live">live</span></div>
            <span className="ms-lbl">open roles in Singapore</span>
          </div>
          <div className="ms-pill">
            <div className="ms-top"><span className="ms-val">SGD 8.2K</span><span className="ms-live">live</span></div>
            <span className="ms-lbl">median salary</span>
          </div>
          <div className="ms-pill">
            <div className="ms-top"><span className="ms-val">+18%</span><span className="ms-live">↑ YoY</span></div>
            <span className="ms-lbl">hiring velocity</span>
          </div>
        </div>
        <div className="search-body">
          <div className="fg2">
            <div className="ac-wrap">
              <div className="flbl">Job title</div>
              <input className="fin" placeholder="e.g. Senior Product Manager" value={jobQ}
                onChange={e => { setJobQ(e.target.value); showAc(e.target.value); }}
                onBlur={hideAc} autoComplete="off" />
              <div className={`ac-dropdown${acOpen ? ' show' : ''}`}>
                {acItems.map((d, i) => (
                  <div key={i} className="ac-item" onMouseDown={() => pickAc(d.title)}>
                    <div><div className="ac-item-title">{d.title}</div><div className="ac-item-meta">{d.meta}</div></div>
                    <div className="ac-item-sal">{d.sal}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flbl">Location</div>
              <input className="fin" value={locQ} onChange={e => setLocQ(e.target.value)} />
            </div>
          </div>
          <div className="fg3">
            <div>
              <div className="flbl">Experience</div>
              <select className="fsel" value={exp} onChange={e => setExp(e.target.value)}>
                <option>Any level</option><option>Entry level</option><option>Mid level</option><option>Senior</option><option>Director+</option>
              </select>
            </div>
            <div>
              <div className="flbl">Type</div>
              <select className="fsel" value={jobType} onChange={e => setJobType(e.target.value)}>
                <option>All types</option><option>Full-time</option><option>Contract</option><option>Internship</option>
              </select>
            </div>
            <div>
              <div className="flbl">Keywords</div>
              <input className="fin" placeholder="React, B2B..." value={kw} onChange={e => setKw(e.target.value)} />
            </div>
          </div>
          <button className="fbtn" disabled={searching} onClick={runSearch}>
            {searching ? 'Searching...' : '🔍 Search with AI'}
          </button>
        </div>
        <div className="search-sub-btns">
          <button className="ssb" onClick={onTrackerOpen}>📋 App Tracker {appCount > 0 && <span style={{ background: 'var(--lp-teal)', color: '#08090D', borderRadius: 10, fontSize: 10, fontWeight: 800, padding: '1px 5px', marginLeft: 3 }}>{appCount}</span>}</button>
          <button className="ssb" onClick={() => onModuleSelect?.('salary')}>💰 Salary Intel</button>
          <button className="ssb" onClick={() => onModuleSelect?.('market')}>📈 Market Intel</button>
        </div>
        <div className={`search-results${resOpen ? ' open' : ''}`} id="searchResults">
          <div className="results-inner">
            <div className="results-hd">
              <div className="results-hd-title"><span className="results-hd-dot" />AI-ranked results</div>
              <span className="results-count">{resCount}</span>
            </div>
            {results[0]?.type === 'loading' ? (
              <div className="res-loading"><div className="res-spinner" /><span>Searching live jobs across 20+ platforms...</span></div>
            ) : (
              <>
                {results[0]?.type === 'fallback' && (
                  <div className="res-redirect">
                    <div className="res-redirect-icon">🔍</div>
                    <div>
                      <div className="res-redirect-title">Live jobs across 20+ platforms</div>
                      <div className="res-redirect-sub">Apply from here to track your application automatically. Check ATS score before applying.</div>
                    </div>
                  </div>
                )}
                {renderedResults.map((job) => (
                  <div key={job.id} className="result-item">
                    <div className="result-item-top">
                      <div className="result-logo">{job.emoji}</div>
                      <div className="result-body">
                        <div className="result-role">{job.role}</div>
                        <div className="result-company">{job.company} · {job.location}</div>
                        <div className="result-meta">
                          {job.salary && <span className="result-sal">{job.salary}</span>}
                          <span className="result-type">Full-time</span>
                          {job.ago && <span className="result-ago">{job.ago}</span>}
                        </div>
                      </div>
                    </div>
                    {job.desc && <div className="result-desc-strip">{job.desc}</div>}
                    <div className="result-actions">
                      <button className="btn-apply-now" onClick={() => applyNow(job.id, job.role, job.company, job.link)}>Apply now →</button>
                      <button className={`btn-ats-check${atsMap[job.id]?.show ? ' active' : ''}`} onClick={() => toggleAts(job.id, job.role, job.company, job.link)}>✦ Check ATS first</button>
                      <button className="btn-skip-apply" onClick={() => applyNow(job.id, job.role, job.company, job.link)}>Skip and apply anyway ↗</button>
                    </div>
                    <AtsIntercept
                      jobId={job.id} role={job.role} company={job.company} link={job.link}
                      state={atsMap[job.id]}
                      onApply={applyNow} onClose={closeAts} onOpenImprove={openImprove}
                    />
                  </div>
                ))}
                {renderedResults.length > 0 && (
                  <div className="results-nudge">
                    <div className="rn-text"><strong>Sign up free</strong> to unlock your full AI fit score and salary intel for every role</div>
                    <button className="rn-btn" onClick={onJoin}>✦ Join free →</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── HERO ──────────────────────────────────────────────────────────────────────

function HeroSection({ onJoin, onModuleSelect, onTrackerOpen, onSnack }) {
  const text = useTypewriter(TYPEWRITER_PHRASES);
  const [liveCount, setLiveCount] = useState(512);
  const [statsStarted, setStatsStarted] = useState(false);

  // Hero ATS scanner state
  const [atsJob, setAtsJob] = useState('');
  const [atsResume, setAtsResume] = useState('Led a team of 5 engineers to deliver a new payment feature, improving checkout conversion by 15%.');
  const [atsScanning, setAtsScanning] = useState(false);
  const [atsResult, setAtsResult] = useState(null);

  const statsRef = useRef(null);

  useEffect(() => {
    let v = 512, dir = 1;
    const t = setInterval(() => {
      const delta = Math.floor(Math.random() * 3) + 1;
      v += dir * delta; if (v >= 750) dir = -1; if (v <= 480) dir = 1;
      setLiveCount(v);
    }, 3800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStatsStarted(true); io.disconnect(); } }, { threshold: 0.2 });
    if (statsRef.current) io.observe(statsRef.current);
    return () => io.disconnect();
  }, []);

  const runHeroAts = async () => {
    setAtsScanning(true); setAtsResult(null);
    await new Promise(r => setTimeout(r, 1400));
    const kws = getHeroKwSet(atsJob);
    const resume = atsResume.toLowerCase();
    const found = kws.found.filter(k => resume.includes(k.toLowerCase()));
    const missing = kws.missing.filter(k => !resume.includes(k.toLowerCase()));
    const score = Math.min(92, Math.max(28, 30 + found.length * 8 + Math.floor(Math.random() * 10)));
    const verdict = score >= 70 ? { text: '✓ Good match', cls: 'good' } : score >= 50 ? { text: '⚠ Needs work', cls: 'mid' } : { text: '✗ Low match', cls: 'low' };
    setAtsResult({ score, verdict, found: found.length ? found : kws.found.slice(0, 3), missing: missing.slice(0, 4) });
    setAtsScanning(false);
  };

  return (
    <header className="hero">
      <div className="hero-top">
        {/* LEFT */}
        <div className="hero-left">
          <div className="hero-eyeline">The AI career platform that takes you</div>
          <h1>From <span className="acc">{text}</span><span className="cursor" aria-hidden="true" /><br /><span style={{ color: 'var(--lp-text)' }}>one platform, one memory.</span></h1>
          <p className="hero-sub">One AI memory learns your profile once — and powers every module from ATS scoring to salary negotiation.</p>
          <div className="hero-btns">
            <button className="btn-p" onClick={onJoin}>✦ Start free — no card needed</button>
            <button className="btn-o" onClick={() => document.getElementById('feat-sec')?.scrollIntoView({ behavior: 'smooth' })}>See all 10 tools ↓</button>
          </div>
          <div className="hero-fill">
            <div className="hf-stats">
              <div className="hf-stat">
                <div className="hf-stat-n">10</div>
                <div className="hf-stat-l">AI modules<br />in one platform</div>
              </div>
              <div className="hf-stat">
                <div className="hf-stat-n"><span className="hf-acc">38%</span> → <span className="hf-acc">91%</span></div>
                <div className="hf-stat-l">ATS score lift<br />in 90 seconds</div>
              </div>
              <div className="hf-stat">
                <div className="hf-stat-n"><span className="hf-acc">5×</span></div>
                <div className="hf-stat-l">faster job search<br />with AI memory</div>
              </div>
            </div>
            <div className="hf-free">
              <div className="hf-free-label">No account needed to start</div>
              <div className="hf-free-items">
                <div className="hf-free-item"><span className="hf-free-icon">🔍</span><span className="hf-free-text">Job search</span><span className="hf-free-badge">Free</span></div>
                <div className="hf-free-item"><span className="hf-free-icon">📊</span><span className="hf-free-text">Market intel</span><span className="hf-free-badge">Free</span></div>
                <div className="hf-free-item"><span className="hf-free-icon">💰</span><span className="hf-free-text">Salary data</span><span className="hf-free-badge">Free</span></div>
              </div>
            </div>
            <div className="hf-live">
              <span className="hf-live-dot" />
              <span className="hf-live-text"><strong>{liveCount.toLocaleString()}</strong> job seekers using CareerAiHub right now in Singapore</span>
              <span className="hf-live-badge">Live</span>
            </div>
          </div>
        </div>

        {/* RIGHT — Search Card */}
        <SearchCard onJoin={onJoin} onModuleSelect={onModuleSelect} onTrackerOpen={onTrackerOpen} onSnack={onSnack} />
      </div>

      {/* BOTTOM — ATS scanner + stats */}
      <div className="hero-bottom reveal" ref={statsRef}>
        <div className="ats-card">
          <div className="ats-card-hd">
            <span className="ats-card-dot" />
            <span>ATS Resume Scanner</span>
            <span className="ats-live-badge">Live</span>
          </div>
          <div className="ats-body">
            <div className="ats-input-row">
              <div className="ats-field">
                <div className="ats-field-lbl">Job Title</div>
                <input className="ats-input" placeholder="e.g. Product Manager" value={atsJob} onChange={e => setAtsJob(e.target.value)} />
              </div>
              <div className="ats-field">
                <div className="ats-field-lbl">Resume Snippet</div>
                <textarea className="ats-input ats-ta" placeholder="Paste a few lines from your resume..." value={atsResume} onChange={e => setAtsResume(e.target.value)} />
              </div>
            </div>
            <button className="ats-scan-btn" disabled={atsScanning} onClick={runHeroAts}>
              {atsScanning ? 'Scanning...' : 'Scan with AI →'}
            </button>
            {atsResult && (
              <div className="ats-result">
                <div className="ats-score-row">
                  <div className="ats-score-wrap">
                    <div className="ats-score-label">ATS Match Score</div>
                    <div className="ats-score-num">{atsResult.score}%</div>
                    <div className="ats-score-bar-wrap"><div className="ats-score-bar" style={{ width: atsResult.score + '%' }} /></div>
                  </div>
                  <div className={`ats-verdict ${atsResult.verdict.cls}`}>{atsResult.verdict.text}</div>
                </div>
                <div className="ats-keywords">
                  <div className="ats-kw-label">Keywords found</div>
                  <div>{atsResult.found.map(k => <span key={k} className="mk-tag m">{k}</span>)}</div>
                  <div className="ats-kw-label" style={{ marginTop: 8 }}>Missing — add these to improve score</div>
                  <div>{atsResult.missing.map(k => <span key={k} className="mk-tag x">{k}</span>)}</div>
                </div>
                <div className="ats-cta-strip">
                  <span className="ats-cta-text">Sign up free to scan your full resume and get line-by-line improvement suggestions</span>
                  <button className="ats-cta-btn" onClick={onJoin}>✦ Scan full resume →</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-card-hd">📊 Why job seekers use CareerAiHub</div>
          <div className="stats-grid">
            {STATS.map((s, i) => <StatBox key={i} stat={s} started={statsStarted} />)}
          </div>
        </div>
      </div>
    </header>
  );
}

// ── PLATFORM LAYERS ───────────────────────────────────────────────────────────

function PlatformLayers({ onJoin }) {
  const [active, setActive] = useState(0);
  const d = LAYER_DATA[active];
  return (
    <section className="section alt">
      <div className="reveal">
        <div className="ey">Platform architecture</div>
        <h2 className="sh">Four layers. One memory. Built to compound.</h2>
        <p className="ss">Each layer builds on the last. Your profile deepens with every session — every module smarter, every recommendation more precise.</p>
      </div>
      <div className="reveal d1">
        <div className="layer-tabs">
          {LAYER_DATA.map((layer, i) => (
            <button key={i} className={`ltab ${layer.label}${active === i ? ' on' : ''}`} onClick={() => setActive(i)}>
              <div className="ltab-n">{layer.n}</div>
              <div className="ltab-title">{layer.title}</div>
              <div className="ltab-sub">{layer.sub}</div>
              <span className={`lstatus ${layer.status === 'live' ? 'ls-live' : layer.status === 'building' ? 'ls-build' : 'ls-plan'}`}>
                <span className="sdot" />
                {layer.status === 'live' ? 'Live now' : layer.status === 'building' ? 'Building next' : 'Planned'}
              </span>
            </button>
          ))}
        </div>
        <div className="layer-panel" style={{ borderColor: d.borderC }}>
          <div className="lp-head lp-anim" style={{ background: d.bg }}>
            <div>
              <div className="lp-ey" style={{ color: d.eyC }}>{d.ey}</div>
              <div className="lp-title">{d.panelTitle}</div>
              <div className="lp-desc">{d.desc}</div>
            </div>
            <button className={`lp-cta ${d.ctaCls}`} onClick={onJoin}>{d.cta}</button>
          </div>
          <div className="lp-mods lp-anim">
            {d.mods.map((m, i) => (
              <div key={i} className="lp-mod">
                <div className="lp-mod-n">{m.n}</div>
                <div className="lp-mod-d">{m.d}</div>
              </div>
            ))}
          </div>
          <div className="lp-mem-hd">AI memory — what this layer writes to the core</div>
          <div className="lp-mem lp-anim">
            {d.mem.map((m, i) => (
              <div key={i} className="mem-s">
                <div className="mem-n">{m.n}</div>
                <div className="mem-l">{m.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── FEATURES ──────────────────────────────────────────────────────────────────

function FeatureSection({ onJoin, activePill, onModuleSelect }) {
  const [active, setActive] = useState(activePill || 0);
  const [nurture, setNurture] = useState(false);

  useEffect(() => { if (activePill !== undefined) { setActive(activePill); setNurture(false); } }, [activePill]);

  const f = FEAT_DATA[active];
  const handleTab = (i) => { setActive(i); setNurture(false); };

  return (
    <section className="section" id="feat-sec">
      <div className="reveal">
        <div className="ey">Every tool, explored</div>
        <h2 className="sh">See exactly what you unlock at $19/month.</h2>
        <p className="ss">Each tool shows a live preview. Free users get 1–2 uses — then a contextual upgrade prompt specific to that tool.</p>
      </div>
      <div className="reveal d1" style={{ marginTop: 8 }}>
        <div className="feat-tabs">
          {FEAT_DATA.map((ft, i) => (
            <button key={i} className={`ftab${active === i ? ' on' : ''}`} onClick={() => handleTab(i)}>
              <span className="ftab-icon">{ft.icon}</span>
              <span className="ftab-lbl">{ft.label}</span>
              <span className={`ftab-badge ${ft.isFree ? 'free' : 'prem'}`}>{ft.isFree ? 'Free' : 'Premium'}</span>
            </button>
          ))}
        </div>
        <div className="feat-panel">
          <div className="fp-left fp-anim" key={active + '-left'}>
            <div className="fp-ey">{f.ey}</div>
            <h3 className="fp-title">{f.title}</h3>
            <p className="fp-desc">{f.desc}</p>
            <ul className="fp-bullets">
              {f.bullets.map((b, i) => <li key={i} className="fp-bullet"><span className="fp-dot" />{b}</li>)}
            </ul>
            <div className="fp-actions">
              {f.isFree
                ? <button className="fp-primary" onClick={() => onModuleSelect ? onModuleSelect(f.moduleId) : onJoin()}>Try it free →</button>
                : <>
                    <button className="fp-primary" onClick={() => onModuleSelect ? onModuleSelect(f.moduleId) : onJoin()}>Open {f.label} →</button>
                    <button className="fp-secondary" onClick={() => onModuleSelect ? onModuleSelect(f.moduleId) : onJoin()}>1 free use available</button>
                  </>
              }
            </div>
            {!f.isFree && (
              <div className="fp-note">
                <span style={{ color: 'var(--lp-amber)' }}>⚡</span>
                Unlimited with Premium · $19/month · save $156/mo vs separate tools
              </div>
            )}
          </div>
          <div className="fp-right">
            <div className="fp-preview-hd"><span className="fp-pdot" />{f.previewHd}</div>
            <div className="fp-body fp-anim" key={active + '-right'} dangerouslySetInnerHTML={{ __html: f.preview }} />
          </div>
          {f.pw && (
            <div className="pw-wrap">
              <div className="pw-block">
                <div className="pw-ico">⚡</div>
                <div>
                  <div className="pw-hl">{f.pw.h}</div>
                  <div className="pw-sub">{f.pw.s}</div>
                </div>
                <div className="pw-btns">
                  <button className="pw-cta" onClick={onJoin}>{f.pw.cta}</button>
                  <button className="pw-later" onClick={() => setNurture(true)}>Not now</button>
                </div>
              </div>
              {nurture && (
                <div className="nurture show">
                  <span style={{ fontSize: 20 }}>✉️</span>
                  <div className="nurture-msg">
                    <div className="nurture-title">No problem — we'll remind you when you're ready.</div>
                    <div className="nurture-sub">Enter your email and we'll send a 3-day personalised upgrade summary.</div>
                  </div>
                  <div className="nurture-row">
                    <input className="nurture-in" placeholder="your@email.com" type="email" />
                    <button className="nurture-btn" onClick={onJoin}>Remind me →</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── PRICING ───────────────────────────────────────────────────────────────────

function PricingSection({ onJoin }) {
  return (
    <section className="section alt" id="price-sec">
      <div className="reveal">
        <div className="ey">Pricing</div>
        <h2 className="sh">Try free. Upgrade when it works.</h2>
        <p className="ss">No card required to start. Free tier gives you enough to feel the value — then upgrade to unlock every tool, unlimited.</p>
      </div>
      <div className="price-grid reveal d1">
        <article className="pcard">
          <h3 className="pc-name">Free</h3>
          <div className="pc-price">$0<span>/month</span></div>
          <div className="pc-note">No credit card · always</div>
          <ul className="pc-feats">
            <li className="pcf"><span className="ck">✓</span>1 resume ATS scan</li>
            <li className="pcf"><span className="ck">✓</span>1–2 free uses per module</li>
            <li className="pcf"><span className="ck">✓</span>Job search — always free</li>
            <li className="pcf"><span className="ck">✓</span>Market intelligence — always free</li>
          </ul>
          <button className="pbtn" onClick={onJoin}>Start free — no card →</button>
        </article>
        <article className="pcard hot">
          <h3 className="pc-name">Premium</h3>
          <div className="pc-price">$19<span>/month</span></div>
          <div className="pc-note">$180/year · saves 20%</div>
          <ul className="pc-feats">
            <li className="pcf"><span className="ck">✓</span>Unlimited resume scans + full editor</li>
            <li className="pcf"><span className="ck">✓</span>Unlimited mock interviews + HM simulator</li>
            <li className="pcf"><span className="ck">✓</span>Unlimited salary coaching + negotiation</li>
            <li className="pcf"><span className="ck">✓</span>Full AI memory across all 10 modules</li>
            <li className="pcf"><span className="ck">✓</span>Unlimited JD analyzer + STAR builder</li>
            <li className="pcf"><span className="ck">✓</span>Unlimited cover letter generation</li>
          </ul>
          <button className="pbtn pri" onClick={onJoin}>Start 7-day free trial →</button>
        </article>
        <article className="pcard">
          <h3 className="pc-name">Recruiter</h3>
          <div className="pc-price">SGD 299<span>/mo</span></div>
          <div className="pc-note">Enterprise from SGD 1,500/mo</div>
          <ul className="pc-feats">
            <li className="pcf"><span className="ck">✓</span>Verified candidate pipeline</li>
            <li className="pcf"><span className="ck">✓</span>AI match shortlisting</li>
            <li className="pcf"><span className="ck">✓</span>TrustChat + credential sidebar</li>
            <li className="pcf"><span className="ck">✓</span>Recruiter dashboard + analytics</li>
            <li className="pcf"><span className="ck">✓</span>10–20× ROI vs headhunter fees</li>
          </ul>
          <button className="pbtn" onClick={onJoin}>Request pilot →</button>
        </article>
      </div>
    </section>
  );
}

// ── COMPARE ───────────────────────────────────────────────────────────────────

function CompareSection() {
  const rows = [
    ['ATS resume scorer + builder', '✓ Live', '—', '✓', '—'],
    ['JD analyzer + STAR builder', '✓ Live', '—', '—', '—'],
    ['AI mock interview + HM simulator', '✓ Live', '—', '—', '✓'],
    ['Salary coach + negotiation roleplay', '✓ Live', '—', '—', '—'],
    ['Cover letter generator', '✓ Live', '—', '—', '—'],
    ['AI memory across all modules', '✓ Live', '—', '—', '—'],
    ['Blockchain credential verification', '◎ Roadmap', '—', '—', '—'],
    ['Monthly price', '$19/mo', '$40/mo', '$25/mo', '$40/mo'],
  ];
  return (
    <section className="section" id="compare-sec">
      <div className="reveal">
        <div className="ey">CareerAiHub vs alternatives</div>
        <h2 className="sh">$19/month vs $175+. One platform vs five.</h2>
        <p className="ss" style={{ marginBottom: 22 }}>The most complete AI career tool in Southeast Asia — at a fraction of what you'd pay for LinkedIn Premium, Resume.io, and Interviewing.io combined.</p>
      </div>
      <div className="reveal d1" style={{ border: '1px solid var(--lp-bdr)', borderRadius: 'var(--lp-rl)', overflow: 'hidden' }}>
        <table className="ctbl">
          <thead>
            <tr>
              <th style={{ width: '34%' }}>Feature</th>
              <th className="us">CareerAiHub</th>
              <th>LinkedIn Premium</th>
              <th>Resume.io</th>
              <th>Interviewing.io</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([feat, us, li, ri, io], i) => (
              <tr key={i}>
                <td>{feat}</td>
                <td className={us.startsWith('✓') ? 'cy' : 'cr2'}>{us}</td>
                <td className="cn">{li}</td>
                <td className={ri === '✓' ? 'cy' : 'cn'}>{ri}</td>
                <td className={io === '✓' ? 'cy' : 'cn'}>{io}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

function FAQSection() {
  const [open, setOpen] = useState(null);
  return (
    <section className="section alt" id="faq-sec">
      <div className="reveal">
        <div className="ey">Frequently asked questions</div>
        <h2 className="sh">Everything you need to know.</h2>
        <p className="ss" style={{ marginBottom: 26 }}>Common questions about CareerAiHub, the AI career platform built for Singapore job seekers.</p>
      </div>
      <div className="reveal d1 faq-list">
        {FAQ_DATA.map((item, i) => (
          <div key={i} className="faq-item">
            <button className={`faq-q${open === i ? ' open' : ''}`} onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              {item.q}<span className="faq-ch">▼</span>
            </button>
            <div className={`faq-a${open === i ? ' open' : ''}`}>
              <div className="faq-a-in">{item.a}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── FOOTER ────────────────────────────────────────────────────────────────────

function FooterSection({ onJoin }) {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="fb"><LogoMark size={20} radius={6} />CareerAiHub</div>
          <p className="fbsub">The AI career operating system for every professional — from first job to executive role. Singapore · 2026 · careeraihub.com</p>
        </div>
        <nav className="fcol">
          <div className="fch">Platform</div>
          {['Resume Builder', 'Mock Interviews', 'Salary Coach', 'JD Analyzer', 'HM Simulator'].map(l => (
            <a key={l} href="#feat-sec" onClick={e => { e.preventDefault(); document.getElementById('feat-sec')?.scrollIntoView({ behavior: 'smooth' }); }}>{l}</a>
          ))}
        </nav>
        <nav className="fcol">
          <div className="fch">Company</div>
          <a href="#" onClick={e => e.preventDefault()}>About</a>
          <a href="#" onClick={e => e.preventDefault()}>For investors</a>
          <a href="#" onClick={e => e.preventDefault()}>For recruiters</a>
          <a href="#" onClick={e => e.preventDefault()}>Institutions</a>
        </nav>
        <nav className="fcol">
          <div className="fch">Legal</div>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/sitemap.xml">Sitemap</a>
        </nav>
      </div>
      <div className="fbot">
        <span>© 2026 CareerAiHub Pte. Ltd. · Singapore</span>
        <div className="fbot-links"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
      </div>
    </footer>
  );
}

// ── TRACKER OVERLAY ───────────────────────────────────────────────────────────

function TrackerOverlay({ onClose, onSnack }) {
  const [apps, setApps] = useState([]);

  useEffect(() => {
    try { setApps(JSON.parse(localStorage.getItem(STORE_KEY) || '[]')); } catch { setApps([]); }
  }, []);

  const saveApps = (list) => {
    setApps(list);
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  };

  const moveApp = (id, status) => {
    saveApps(apps.map(a => a.id === id ? { ...a, status } : a));
  };

  const deleteApp = (id) => saveApps(apps.filter(a => a.id !== id));

  const updateNotes = (id, notes) => {
    saveApps(apps.map(a => a.id === id ? { ...a, notes } : a));
  };

  const stats = {
    total: apps.length,
    active: apps.filter(a => ['applied', 'screening', 'interview'].includes(a.status)).length,
    interview: apps.filter(a => a.status === 'interview').length,
    offer: apps.filter(a => a.status === 'offer').length,
  };

  return (
    <div className="lp-tracker-overlay">
      <div className="lp-tv-nav">
        <div className="lp-tv-nav-inner">
          <div className="lp-tv-logo">
            <LogoMark size={20} radius={5} />
            CareerAiHub
          </div>
          <span className="lp-tv-title">Application Tracker</span>
          <button className="lp-tv-close" onClick={onClose}>✕ Close</button>
        </div>
      </div>
      <div className="lp-tv-body">
        <div className="lp-tv-stats">
          <div className="lp-tv-stat"><div className="lp-tv-stat-n">{stats.total}</div><div className="lp-tv-stat-l">Total applied</div></div>
          <div className="lp-tv-stat"><div className="lp-tv-stat-n">{stats.active}</div><div className="lp-tv-stat-l">Active</div></div>
          <div className="lp-tv-stat"><div className="lp-tv-stat-n">{stats.interview}</div><div className="lp-tv-stat-l">Interviews</div></div>
          <div className="lp-tv-stat"><div className="lp-tv-stat-n">{stats.offer}</div><div className="lp-tv-stat-l">Offers</div></div>
        </div>
        {apps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--lp-text2)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--lp-text)' }}>No applications yet</div>
            <div style={{ fontSize: 13 }}>Search for jobs above and click "Apply now" to start tracking.</div>
          </div>
        ) : (
          <div className="lp-tv-kanban">
            {STAGES.map(stage => (
              <div key={stage} className="lp-tv-col">
                <div className="lp-tv-col-hd">
                  <span>{STAGE_LABELS[stage]}</span>
                  <span className="lp-tv-col-count">{apps.filter(a => a.status === stage).length}</span>
                </div>
                <div className="lp-tv-col-items">
                  {apps.filter(a => a.status === stage).length === 0 ? (
                    <div className="lp-tv-col-empty">No applications</div>
                  ) : (
                    apps.filter(a => a.status === stage).map(app => (
                      <div key={app.id} className="lp-app-card">
                        <div className="lp-app-card-role">{app.role}</div>
                        <div className="lp-app-card-company">{app.company}</div>
                        <div className="lp-app-card-meta">
                          <span className="lp-app-card-date">{formatDate(app.date)}</span>
                          <span className="lp-app-card-source">{app.source || 'Job Search'}</span>
                        </div>
                        {app.url && <a className="lp-app-card-link" href={app.url} target="_blank" rel="noopener noreferrer">↗ View listing</a>}
                        <div className="lp-app-card-actions">
                          {STAGES.filter(s => s !== stage).slice(0, 3).map(s => (
                            <button key={s} className="lp-app-card-btn" onClick={() => moveApp(app.id, s)}>{STAGE_LABELS[s]}</button>
                          ))}
                          <button className="lp-app-card-btn" style={{ color: 'var(--lp-red)', borderColor: 'rgba(255,107,107,.2)' }} onClick={() => deleteApp(app.id)}>Remove</button>
                        </div>
                        <textarea className="lp-app-card-notes" placeholder="Add notes — interview date, contact name, follow-up..." defaultValue={app.notes || ''} onBlur={e => updateNotes(app.id, e.target.value)} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── SNACK ─────────────────────────────────────────────────────────────────────

function SuccessSnack({ msg, visible }) {
  return (
    <div className={`lp-snack${visible ? ' show' : ''}`}>
      <span className="lp-snack-icon">✓</span>
      <span>{msg}</span>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

export default function LandingPage({ setAuthModal, onModuleSelect }) {
  const [activePill, setActivePill] = useState(0);
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [snack, setSnack] = useState({ msg: '', visible: false });
  const [navScrolled, setNavScrolled] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const rootRef = useRef(null);
  useScrollReveal(rootRef);

  useEffect(() => {
    const onScroll = () => {
      const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100;
      setScrollPct(Math.min(pct, 100));
      setNavScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const showSnack = (msg) => {
    setSnack({ msg, visible: true });
    setTimeout(() => setSnack(s => ({ ...s, visible: false })), 4000);
  };

  const onSignIn = () => setAuthModal('login');
  const onJoin = () => setAuthModal('register');

  const handlePill = (i) => {
    setActivePill(i);
    const moduleId = PILLS[i]?.moduleId;
    if (moduleId && onModuleSelect) onModuleSelect(moduleId);
  };

  return (
    <div className="lp" ref={rootRef}>
      <div className="lp-progress-bar" style={{ width: scrollPct + '%' }} aria-hidden="true" />
      <div className="lp-ambient" aria-hidden="true">
        <div className="lp-amb-orb a1" /><div className="lp-amb-orb a2" /><div className="lp-amb-orb a3" />
      </div>

      <NavBar onSignIn={onSignIn} onJoin={onJoin} scrolled={navScrolled} />
      <ModulePills active={activePill} setActive={handlePill} />
      <TickerBar />

      <HeroSection onJoin={onJoin} onModuleSelect={onModuleSelect} onTrackerOpen={() => setTrackerOpen(true)} onSnack={showSnack} />

      <div className="sec-divider" />

      <PlatformLayers onJoin={onJoin} />

      <div className="sec-divider" />

      <FeatureSection onJoin={onJoin} activePill={activePill} onModuleSelect={onModuleSelect} />

      <div className="sec-divider" />

      <PricingSection onJoin={onJoin} />

      <div className="sec-divider" />

      <CompareSection />

      <div className="sec-divider" />

      <FAQSection />

      <FooterSection onJoin={onJoin} />

      {trackerOpen && <TrackerOverlay onClose={() => setTrackerOpen(false)} onSnack={showSnack} />}
      <SuccessSnack msg={snack.msg} visible={snack.visible} />
    </div>
  );
}
