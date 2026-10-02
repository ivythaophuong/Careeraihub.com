import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './landing.css';
import './landing-v10.css';
import './landing-v36.css';
import { OrbitMark } from '../../components/OrbitMark';
import { l1Html, l1HtmlHeight, l2Html, l2HtmlHeight, l3Html, l3HtmlHeight, l4Html, l4HtmlHeight } from './demoHtml';

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
    cta: 'See How It Works →', ctaCls: 'cta-t',
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
    cta: 'See How It Works →', ctaCls: 'cta-t',
    bg: 'var(--lp-violet-dim)', eyC: 'var(--lp-violet)', borderC: 'var(--lp-violet-b)',
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
    cta: 'See Demo →', ctaCls: 'cta-a',
    bg: 'var(--lp-amber-dim)', eyC: 'var(--lp-amber)', borderC: 'var(--lp-amber-b)',
    mods: [
      { n: 'School partnerships', d: "University partnerships with free student access via MOU. Institutions issue credentials directly onto your profile." },
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
    cta: 'See Demo →', ctaCls: 'cta-p',
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
    preview: `<div class="roast-toggle"><button class="roast-opt on">Professional</button><button class="roast-opt snarky">Snarky Roast</button></div>
      <div class="mk-lbl">ATS score vs Senior PM · Job description</div>
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
    previewHd: 'HM Simulator · choose your interviewer',
    preview: `<div class="archetype-row">
      <div class="archetype-chip active"><span class="archetype-chip-icon">📊</span><div><div class="archetype-chip-name">Metrics-Obsessed Head of Growth</div><div class="archetype-chip-focus">Focus: Hard numbers · SQL · conversion funnels</div></div></div>
      <div class="archetype-chip"><span class="archetype-chip-icon">🚀</span><div><div class="archetype-chip-name">Visionary Founder</div><div class="archetype-chip-focus">Focus: Culture fit · big picture · first principles</div></div></div>
      <div class="archetype-chip"><span class="archetype-chip-icon">🔥</span><div><div class="archetype-chip-name">Stress-Tester</div><div class="archetype-chip-focus">Focus: High-pressure · edge cases · failure modes</div></div></div>
    </div>
    <div class="mk-chat ai" style="margin-top:4px"><strong style="color:var(--teal)">HM:</strong> Walk me through the SQL query you used to identify the drop-off. What was your p-value?</div>`,
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

export const LogoMark = ({ size = 28 }) => (
  <OrbitMark size={size} animated duration={18} />
);

// ── NAV ───────────────────────────────────────────────────────────────────────

// Maps moduleId → FEAT_DATA tab index for the feature demo modal
export const NAV_FEAT_MAP = {
  jobs: 0, scan: 1, ats: 2, jd: 3, star: 4, simulate: 5,
  salary: 6, cover: 7, radar: 8, score: 9, market: 10, memory: 11,
};

export const NAV_CATEGORIES = [
  {
    icon: '🔍', label: 'Job Search', tag: 'Free',
    tools: [
      { icon: '🔎', label: 'Job Search',   sub: 'Browse & track open roles',      moduleId: 'jobs'   },
      { icon: '🌏', label: 'Market Intel',  sub: 'Salary & hiring demand data',    moduleId: 'market' },
    ],
  },
  {
    icon: '🎯', label: 'Get Seen',
    tools: [
      { icon: '⚡', label: 'Resume Scan',   sub: 'ATS score & issue flags',        moduleId: 'scan'  },
      { icon: '✨', label: 'ATS Builder',   sub: 'Rebuild resume for keywords',    moduleId: 'ats'   },
      { icon: '🔍', label: 'JD Analyzer',   sub: 'Decode any job description',     moduleId: 'jd'    },
      { icon: '📄', label: 'Cover Letter',  sub: 'AI-written, role-tailored',      moduleId: 'cover' },
    ],
  },
  {
    icon: '✅', label: 'Get Ready', tag: 'Pro',
    tools: [
      { icon: '📡', label: 'Weakness Radar',  sub: 'Find gaps before they do',       moduleId: 'radar'  },
      { icon: '🏆', label: 'Readiness Score', sub: 'How ready are you, really',      moduleId: 'score'  },
      { icon: '⭐', label: 'STAR Builder',    sub: 'Structure your stories',         moduleId: 'star'   },
      { icon: '🧬', label: 'AI Memory',       sub: 'Your career intelligence layer', moduleId: 'memory' },
    ],
  },
  {
    icon: '🏆', label: 'Get the Offer',
    tools: [
      { icon: '🧠', label: 'HM Simulator', sub: 'Mock hiring manager interview', moduleId: 'simulate' },
    ],
  },
  {
    icon: '💰', label: 'Get Paid',
    tools: [
      { icon: '💰', label: 'Salary Coach', sub: 'Negotiate what you deserve', moduleId: 'salary' },
    ],
  },
  {
    icon: '', label: 'TrustMatch', tag: 'New',
    tools: [
      { icon: '', label: 'TrustMatch', sub: 'Verified employer matching', moduleId: 'trustmatch' },
    ],
  },
];

// 3-column megamenu arrangement
const MEGA_COLS = [
  [NAV_CATEGORIES[0], NAV_CATEGORIES[3]], // Job Search + Get the Offer
  [NAV_CATEGORIES[1], NAV_CATEGORIES[4]], // Get Seen + Get Paid
  [NAV_CATEGORIES[2], NAV_CATEGORIES[5]], // Get Ready + TrustMatch
];

export function NavFeatMenu({ onFeatOpen }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div className="lp-ncd" ref={ref}>
      <button
        className={`lp-nl lp-ncd-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        Features
        <span className="lp-ncd-caret" />
      </button>
      {open && (
        <div className="lp-feat-mega">
          {MEGA_COLS.map((col, ci) => (
            <div key={ci} className="lp-feat-mega-col">
              {col.map((cat, gi) => (
                <div key={gi} className={`lp-feat-mega-group${gi > 0 ? ' lp-feat-mega-group-sep' : ''}`}>
                  <div className="lp-feat-mega-head">
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    {cat.tag && <span className={`lp-ncd-tag ${cat.tag === 'Free' ? 'free' : 'pro'}`}>{cat.tag}</span>}
                  </div>
                  {cat.tools.map((t, ti) => (
                    <button
                      key={ti}
                      className="lp-ncd-item"
                      onClick={() => { onFeatOpen(t.moduleId); setOpen(false); }}
                    >
                      <span className="lp-ncd-item-icon">{t.icon}</span>
                      <div>
                        <div className="lp-ncd-item-label">{t.label}</div>
                        {t.sub && <div className="lp-ncd-item-sub">{t.sub}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function NavCategoryDropdown({ cat, onNavigate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="lp-ncd" ref={ref}>
      <button
        className={`lp-nl lp-ncd-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        {cat.label}
        {cat.tag && <span className={`lp-ncd-tag ${cat.tag === 'Free' ? 'free' : 'pro'}`}>{cat.tag}</span>}
        <span className="lp-ncd-caret" />
      </button>
      {open && (
        <div className="lp-ncd-panel">
          <div className="lp-ncd-panel-head">{cat.icon} {cat.label}</div>
          {cat.tools.map((t, i) => (
            <button
              key={i}
              className="lp-ncd-item"
              onClick={() => { onNavigate(t.moduleId); setOpen(false); }}
            >
              <span className="lp-ncd-item-icon">{t.icon}</span>
              <div>
                <div className="lp-ncd-item-label">{t.label}</div>
                {t.sub && <div className="lp-ncd-item-sub">{t.sub}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavBar({ onSignIn, onJoin, scrolled, lightMode, onToggleLightMode, onFeatOpen }) {
  const ss = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <nav className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
      <button className="lp-nav-logo">
        <LogoMark />
        <span className="lp-wordmark">career<span className="lp-wordmark-ai">ai</span>hub</span>
      </button>
      <div className="lp-nav-center">
        <NavFeatMenu onFeatOpen={onFeatOpen} />
        <button className="lp-nl" onClick={() => ss('price-sec')}>Pricing</button>
        <button className="lp-nl" onClick={() => ss('faq-sec')}>FAQ</button>
      </div>
      <div className="lp-nav-r">
        <button className="lp-btn-lmode" onClick={onToggleLightMode} title={lightMode ? 'Switch to dark mode' : 'Switch to light mode'}>{lightMode ? '🌙' : '☀️'}</button>
        <button className="lp-btn-si" onClick={onSignIn}>Sign In</button>
        <button className="lp-btn-join" onClick={onJoin}>✦ Join Free</button>
      </div>
    </nav>
  );
}

export function GuestNav({ onSignIn, onJoin, onHome }) {
  return (
    <nav className="lp-nav scrolled">
      <button className="lp-nav-logo" onClick={onHome}>
        <LogoMark />
        <span className="lp-wordmark">career<span className="lp-wordmark-ai">ai</span>hub</span>
      </button>
      <div className="lp-nav-r">
        <button className="lp-btn-si" onClick={onSignIn}>Sign In</button>
        <button className="lp-btn-join" onClick={onJoin}>✦ Join Free</button>
      </div>
    </nav>
  );
}

// ── APP HUB NAV (same pill style as HubNav, with tool dropdowns) ──────────────

function AppHubPill({ cat, activeModule, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const isActive = cat.tools.some(t => t.moduleId === activeModule);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
    }
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        className={`lp-hub-pill${isActive ? ' on' : ''}${cat.tag === 'Pro' ? ' ready' : ''}`}
        onClick={handleOpen}
      >
        <span style={{ fontSize: 15 }}>{cat.icon}</span>
        <span className="lp-hub-pill-label">{cat.label}</span>
        {cat.tag === 'Free' && <span className="lp-hub-pill-sub">Always free</span>}
        {cat.tag === 'Pro'  && <span className="lp-hub-pill-badge">Pro</span>}
        {cat.tag === 'New'  && <span className="lp-hub-pill-badge" style={{ background: 'linear-gradient(135deg,#F59E0B,#EC4899)' }}>NEW</span>}
      </button>
      {open && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div
          ref={panelRef}
          className="lp-ncd-panel"
          style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-50%)', minWidth: 220, zIndex: 9999 }}
        >
          <div className="lp-ncd-panel-head">{cat.icon} {cat.label}</div>
          {cat.tools.map((t, i) => (
            <button
              key={i}
              className="lp-ncd-item"
              style={ t.moduleId === activeModule ? { background: 'rgba(236,72,153,.1)' } : {} }
              onClick={() => { onNavigate(t.moduleId); setOpen(false); }}
            >
              <span className="lp-ncd-item-icon">{t.icon}</span>
              <div>
                <div className="lp-ncd-item-label">{t.label}</div>
                {t.sub && <div className="lp-ncd-item-sub">{t.sub}</div>}
              </div>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

export function AppHubNav({ activeModule, onNavigate }) {
  return (
    <div className="lp-hub-nav">
      {NAV_CATEGORIES.map((cat, i) => (
        <AppHubPill key={i} cat={cat} activeModule={activeModule} onNavigate={onNavigate} />
      ))}
    </div>
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
  { icon: '🧬', label: 'AI Memory',      moduleId: 'memory'      },
  { icon: '',   label: 'TrustMatch',    moduleId: 'trustmatch'  },
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

// ── HUB NAV ───────────────────────────────────────────────────────────────────

const HUB_GROUPS = [
  { icon: '🎯', label: 'Get Seen', sub: 'Application layer', tools: [
    { icon: '⚡', label: 'Resume Scan', moduleId: 'scan' },
    { icon: '✦', label: 'ATS Builder', moduleId: 'ats' },
    { icon: '🔎', label: 'JD Analyzer', moduleId: 'jd' },
    { icon: '📄', label: 'Cover Letter', moduleId: 'cover' },
  ]},
  { icon: '🏆', label: 'Get the Offer', sub: 'Interview & prep', tools: [
    { icon: '⭐', label: 'STAR Builder', moduleId: 'star' },
    { icon: '🧠', label: 'HM Simulator', moduleId: 'simulate' },
  ]},
  { icon: '💰', label: 'Get Paid', sub: 'Negotiate & track', tools: [
    { icon: '💰', label: 'Salary Coach', moduleId: 'salary' },
    { icon: '📋', label: 'App Tracker', moduleId: '__tracker__' },
  ]},
];

const ALL_TOOLS_LIST = [
  { icon: '⚡', label: 'Resume Scan', moduleId: 'scan' },
  { icon: '✦', label: 'ATS Builder', moduleId: 'ats' },
  { icon: '🔎', label: 'JD Analyzer', moduleId: 'jd' },
  { icon: '⭐', label: 'STAR Builder', moduleId: 'star' },
  { icon: '🧠', label: 'HM Simulator', moduleId: 'simulate' },
  { icon: '💰', label: 'Salary Coach', moduleId: 'salary' },
  { icon: '📄', label: 'Cover Letter', moduleId: 'cover' },
  { icon: '📋', label: 'App Tracker', moduleId: '__tracker__' },
  { icon: '📡', label: 'Weakness Radar', moduleId: 'radar' },
  { icon: '🏆', label: 'Readiness Score', moduleId: 'score' },
  { icon: '🌏', label: 'Market Intel', moduleId: 'market' },
  { icon: '🧬', label: 'AI Memory', moduleId: 'memory' },
];

function LandingHubPill({ cat, activeIdx, myIdx, setActive, onFeatModal, onGetReady, onModuleSelect }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const isReady = cat.tag === 'Pro';
  const isFree  = cat.tag === 'Free';

  const handleClick = () => {
    if (isReady) { setActive(myIdx); onGetReady?.(); return; }
    if (isFree)  { setActive(myIdx); onModuleSelect?.('jobs'); return; }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
    }
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        className={`lp-hub-pill${activeIdx === myIdx ? ' on' : ''}${isReady ? ' ready' : ''}`}
        onClick={handleClick}
      >
        <span style={{ fontSize: 15 }}>{cat.icon}</span>
        <span className="lp-hub-pill-label">{cat.label}</span>
        {isFree  && <span className="lp-hub-pill-sub">Always free</span>}
        {isReady && <span className="lp-hub-pill-badge">Pro</span>}
      </button>
      {open && ReactDOM.createPortal(
        <div
          ref={panelRef}
          className="lp-ncd-panel"
          style={{ position:'fixed', top:pos.top, left:pos.left, transform:'translateX(-50%)', minWidth:220, zIndex:9999 }}
        >
          <div className="lp-ncd-panel-head">{cat.icon} {cat.label}</div>
          {cat.tools.map((t, i) => (
            <button
              key={i}
              className="lp-ncd-item"
              onClick={() => { onModuleSelect?.(t.moduleId); setOpen(false); setActive(myIdx); }}
            >
              <span className="lp-ncd-item-icon">{t.icon}</span>
              <div>
                <div className="lp-ncd-item-label">{t.label}</div>
                {t.sub && <div className="lp-ncd-item-sub">{t.sub}</div>}
              </div>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

export function HubNav({ onModuleSelect, onTrackerOpen, onGetReady, onFeatModal }) {
  const [active, setActive] = useState(0);

  return (
    <div className="lp-hub-nav">
      {NAV_CATEGORIES.map((cat, i) => (
        <LandingHubPill
          key={i}
          cat={cat}
          myIdx={i}
          activeIdx={active}
          setActive={setActive}
          onFeatModal={onFeatModal}
          onGetReady={onGetReady}
          onModuleSelect={onModuleSelect}
        />
      ))}
    </div>
  );
}

// ── TRANSIT BANNER ───────────────────────────────────────────────────────────

function TransitBanner() {
  return (
    <div className="lp-transit">
      <span className="lp-transit-pulse" />
      <span className="lp-transit-label">Career Market Signal</span>
      <span className="lp-transit-sep">·</span>
      <span className="lp-transit-phase">Current Phase: Expansion</span>
      <span className="lp-transit-sep">·</span>
      <span className="lp-transit-desc">Hiring Velocity High — Singapore tech roles up 18% YoY</span>
      <span className="lp-transit-sep">·</span>
      <span className="lp-transit-cta">Opportunity window: Apply now, market favours candidates</span>
    </div>
  );
}

// ── TICKER ────────────────────────────────────────────────────────────────────

const TICKER_ITEMS = ['✦ 10 AI modules active', 'Market Signal: Expansion Phase — Hiring velocity high in Tech & Fintech SG', 'Job search & market intel — always free', 'Premium — $19/month · save $156/mo vs separate tools', 'ATS resume scanner Singapore', 'AI mock interview coach'];

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

function SearchCard({ onJoin, onModuleSelect, onTrackerOpen, onSnack, onAgenticCta }) {
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
  const [liveCount, setLiveCount] = useState(512);

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

    const appId = import.meta.env.VITE_ADZUNA_APP_ID;
    const appKey = import.meta.env.VITE_ADZUNA_APP_KEY;
    const adzunaReady = appId && appId !== 'your_app_id';

    if (adzunaReady) {
      try {
        const country = loc.toLowerCase().includes('singapore') ? 'sg' : 'gb';
        const expMap = { 'Entry level': 1, 'Mid level': 3, 'Senior': 5, 'Director+': 10 };
        const minSal = expMap[exp] ? `&salary_min=${expMap[exp] * 12000}` : '';
        const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&what=${encodeURIComponent(title)}&where=${encodeURIComponent(loc)}&results_per_page=6&sort_by=date&content-type=application/json${minSal}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) throw new Error('adzuna ' + resp.status);
        const data = await resp.json();
        const jobs = data.results || [];
        if (!jobs.length) throw new Error('no results');
        setResCount(`${(data.count || 0).toLocaleString()} live results · Showing top ${jobs.length}`);
        setResults(jobs.map((j, i) => ({
          type: 'job', id: `job-${Date.now()}-${i}`,
          role: j.title || title,
          company: j.company?.display_name || 'Company',
          location: j.location?.display_name || loc,
          link: j.redirect_url || '#',
          salary: j.salary_min ? `SGD ${Math.round(j.salary_min / 12).toLocaleString()}–${Math.round(j.salary_max / 12).toLocaleString()}/mo` : '',
          ago: j.created ? timeAgo(new Date(j.created)) : '',
          desc: j.description ? j.description.replace(/<[^>]+>/g, '').slice(0, 120) + '...' : '',
          emoji: EMOJIS[i % EMOJIS.length],
        })));
      } catch {
        setResCount(`Results for "${title}" in ${loc}`);
        setResults([{ type: 'fallback', title, location: loc }]);
      }
    } else {
      await new Promise(r => setTimeout(r, 800));
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
        <div className="sc-live-bar">
          <span className="sc-live-dot" />
          <span className="sc-live-text"><strong>{liveCount.toLocaleString()}</strong> job seekers active · <strong>2,400+</strong> resumes analyzed</span>
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
                {results[0]?.type === 'fallback' && (
                  <div className="api-setup-hint">
                    <span className="api-hint-icon">⚡</span>
                    <span>Want inline AI-ranked results? <a href="https://developer.adzuna.com" target="_blank" rel="noopener noreferrer" className="api-hint-link">Get your free Adzuna API key</a> — takes 2 minutes.</span>
                  </div>
                )}
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

function HeroSection({ onJoin, onModuleSelect, onTrackerOpen, onSnack, onAgenticCta }) {
  const text = useTypewriter(TYPEWRITER_PHRASES);
  const [statsStarted, setStatsStarted] = useState(false);
  const statsRef = useRef(null);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStatsStarted(true); io.disconnect(); } }, { threshold: 0.2 });
    if (statsRef.current) io.observe(statsRef.current);
    return () => io.disconnect();
  }, []);

  return (
    <>
    <header className="hero">
      <div className="hero-top">
        {/* LEFT */}
        <div className="hero-left">
          <div className="hero-eyeline">The AI career platform that takes you</div>
          <h1>From <span className="acc">{text}</span><span className="cursor" aria-hidden="true" /><br /><span style={{ color: 'var(--lp-text)' }}>one platform, one memory.</span></h1>
          <p className="hero-sub">One AI memory learns your profile once — and powers every module from ATS scoring to salary negotiation.</p>
          <div className="hero-btns">
            <button className="btn-p" onClick={onJoin}>✦ Start free — no card needed</button>
          </div>
          <div className="cta-microcopy">Free to start · No credit card required · ATS results in 20 seconds</div>
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
          </div>
        </div>

        {/* RIGHT — Search Card + Agentic Card */}
        <SearchCard onJoin={onJoin} onModuleSelect={onModuleSelect} onTrackerOpen={onTrackerOpen} onSnack={onSnack} onAgenticCta={onAgenticCta} />
      </div>

    </header>

    {/* WHY SEEKERS BAND — full-width strip below hero */}
    <div className="why-band" ref={statsRef}>
      <div className="why-band-label">📊 Why job seekers use CareerAiHub</div>
      <div className="why-band-divider" />
      {STATS.map((s, i) => (
        <React.Fragment key={i}>
          <div className="why-band-stat">
            <span className={`why-band-n ${s.cls}`}>
              {statsStarted
                ? `${s.prefix || ''}${s.value}${s.suffix}`
                : `${s.prefix || ''}0${s.suffix}`}
            </span>
            <span className="why-band-l">{s.label}</span>
          </div>
          {i < STATS.length - 1 && <div className="why-band-divider" />}
        </React.Fragment>
      ))}
    </div>
    </>
  );
}

// ── LAYER DEMO PANELS ─────────────────────────────────────────────────────────

const DS = {
  bg:'#09090d', s1:'#111218', s2:'#161820', s3:'#1c1f2c',
  bdr:'rgba(255,255,255,0.06)', bdr2:'rgba(255,255,255,0.12)',
  text:'#e8eaf0', text2:'#8b92a8', text3:'#3d4560',
  teal:'#00d4aa', tdim:'rgba(0,212,170,0.1)', tb:'rgba(0,212,170,0.25)',
  cyan:'#00c8ff', cdim:'rgba(0,200,255,0.1)', cb:'rgba(0,200,255,0.25)',
  green:'#00e5a0', gdim:'rgba(0,229,160,0.1)', gb:'rgba(0,229,160,0.25)',
  gold:'#f5c842', goldim:'rgba(245,200,66,0.1)', goldb:'rgba(245,200,66,0.25)',
  red:'#ff5f6e', rdim:'rgba(255,95,110,0.1)',
  purple:'#F59E0B', pdim:'rgba(245,158,11,0.1)', pb:'rgba(245,158,11,0.25)',
};

function DemoShell({ label, accent, borderC, onClose, onNext, children }) {
  return (
    <div style={{ marginTop:20, borderRadius:12, overflow:'hidden', border:`1px solid ${borderC}`, boxShadow:`0 0 40px rgba(0,0,0,0.3)` }}>
      <div style={{ background:`rgba(9,9,13,0.97)`, borderBottom:`1px solid ${borderC}`, padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', backdropFilter:'blur(12px)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, fontFamily:'var(--lp-ffm)', color:accent }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:accent, boxShadow:`0 0 8px ${accent}`, display:'inline-block' }} />
          {label}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {onNext && <button onClick={onNext} style={{ background:`${accent}22`, border:`1px solid ${accent}55`, color:accent, cursor:'pointer', fontSize:11, fontFamily:'var(--lp-ffm)', padding:'4px 12px', borderRadius:6 }}>Explore next layer →</button>}
          <button onClick={onClose} style={{ background:'none', border:'none', color:DS.text3, cursor:'pointer', fontSize:11, fontFamily:'var(--lp-ffm)' }}>✕ Close</button>
        </div>
      </div>
      <div style={{ background:DS.bg, color:DS.text, fontFamily:'Inter, sans-serif', fontSize:13 }}>
        {children}
      </div>
    </div>
  );
}

function L1DemoPanel({ onClose, onNext }) {
  return (
    <DemoShell label="LAYER 01 — RESUME CREATION · LIVE DEMO" accent={DS.teal} borderC={DS.tb} onClose={onClose} onNext={onNext}>
      <iframe srcdoc={l1Html} style={{ width:'100%', height:l1HtmlHeight, border:'none', display:'block', background:'#09090d' }} title="Layer 01 Resume Creation Demo" />
    </DemoShell>
  );
}

function L2DemoPanel({ onClose, onNext }) {
  return (
    <DemoShell label="LAYER 02 — INTERVIEW + SALARY PREP · LIVE DEMO" accent={DS.cyan} borderC={DS.cb} onClose={onClose} onNext={onNext}>
      <iframe srcdoc={l2Html} style={{ width:'100%', height:l2HtmlHeight, border:'none', display:'block', background:'#09090d' }} title="Layer 02 Interview Salary Demo" />
    </DemoShell>
  );
}

function L3DemoPanel({ onClose, onNext }) {
  return (
    <DemoShell label="LAYER 03 LIVE DASHBOARD" accent={DS.green} borderC={DS.gb} onClose={onClose} onNext={onNext}>
      <iframe srcdoc={l3Html} style={{ width:'100%', height:l3HtmlHeight, border:'none', display:'block', background:'#0a0b0d' }} title="Layer 03 Verified Credentials Dashboard" />
    </DemoShell>
  );
}

function L4DemoPanel({ onClose, onNext }) {
  return (
    <DemoShell label="LAYER 04 AI MARKETPLACE — LIVE DEMO" accent={DS.purple} borderC={DS.pb} onClose={onClose} onNext={onNext}>
      <iframe srcdoc={l4Html} style={{ width:'100%', height:l4HtmlHeight, border:'none', display:'block', background:'#09090d' }} title="Layer 04 AI Marketplace Demo" />
    </DemoShell>
  );
}

// ── JOURNEY SECTION ──────────────────────────────────────────────────────────

const JOURNEY_STAGES = [
  {
    num: '01', label: 'Get Seen', color: '#1D9E75',
    problem: 'Your resume is filtered out before a human ever reads it.',
    pain: '"75% of resumes are rejected by ATS software — not people."',
    bullets: [
      'Resume Scan — ATS score & issue flags in 20 seconds',
      'ATS Builder — rebuild your resume for keywords & format',
      'JD Analyzer — decode any job description instantly',
      'Cover Letter — AI-written, role-tailored in seconds',
    ],
    outcome: '↑ ATS score 38→91 avg — in 20 seconds',
  },
  {
    num: '02', label: 'Get Ready', color: '#7F77DD',
    problem: 'Your personalized plan — built from your scores, not a template.',
    pain: '"Most people prep randomly. AI targets your exact weaknesses."',
    bullets: [
      'AI hiring managers in 8 archetypes — real pressure, real feedback',
      'STAR story builder & bank your best answers',
      'Scored on clarity, STAR structure, and relevance',
      'Get Ready plan — personalized study roadmap',
    ],
    outcome: '9 days avg. time to interview-ready',
  },
  {
    num: '03', label: 'Get the Offer', color: '#BA7517',
    problem: 'Negotiate with data, not hope.',
    pain: '"I always take the first number."',
    bullets: [
      'Salary Coach — market benchmarks & negotiation scripts',
      'Market Intel — salary + hiring demand live data',
      'Counter-offer scripts with position anchors',
      'Pushback simulation with AI playing the recruiter',
    ],
    outcome: '↑ SGD 4–12k more per month',
  },
  {
    num: '04', label: 'Get Found', color: '#D4537E',
    problem: 'Skip the black hole. Get found in 4 minutes.',
    pain: '"Applied to 60 roles. Heard back from 3."',
    bullets: [
      'AI Marketplace — dual-screen match engine',
      'Credential verify — Singpass, Credly, university',
      'TrustChat — recruiter ping with verified sidebar',
      'Trust Score built from your actual ATS + interview performance',
    ],
    outcome: '↑ 95% match · 4 min avg time-to-recruiter',
  },
];

// ── JOURNEY DECK CARD COMPONENTS ─────────────────────────────────────────────

function JnyCard({ step, title, statusCls, statusTxt, children }) {
  const sc = statusCls === 'done' ? 'jny-st-done' : statusCls === 'live' ? 'jny-st-live' : 'jny-st-run';
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div className="jny-dcard-top">
        <div className="jny-dct-dots"><div className="jny-dct-dot"/><div className="jny-dct-dot"/><div className="jny-dct-dot"/></div>
        <span className="jny-dct-step">{step}</span>
        <span className={`jny-dct-status ${sc}`}>{statusTxt}</span>
      </div>
      <div className="jny-dcard-body">
        <div className="jny-dcard-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

// Stage 0: Get Seen (teal)
function S0Card1({ color: c, active }) {
  const [upW, setUpW] = useState(0);
  const [upDone, setUpDone] = useState(false);
  const [score, setScore] = useState(38);
  const [scoreCol, setScoreCol] = useState('#ef4444');
  const [tagVis, setTagVis] = useState(false);
  const [b0, setB0] = useState({ cls:'', txt:'Helped drive product roadmap with teams' });
  const [b1, setB1] = useState({ cls:'', txt:'Was involved in major decisions' });
  const [b2, setB2] = useState({ cls:'', txt:'Worked with stakeholders on delivery' });
  const [kw, setKw] = useState([0,0,0,0,0,0]);
  useEffect(() => {
    if (!active) {
      setUpW(0); setUpDone(false); setScore(38); setScoreCol('#ef4444'); setTagVis(false);
      setB0({ cls:'', txt:'Helped drive product roadmap with teams' });
      setB1({ cls:'', txt:'Was involved in major decisions' });
      setB2({ cls:'', txt:'Worked with stakeholders on delivery' });
      setKw([0,0,0,0,0,0]); return;
    }
    const ids = [];
    const s = (ms, fn) => ids.push(setTimeout(fn, ms));
    const anim = (from, to, col) => {
      let cur = from;
      const iv = setInterval(() => { cur=Math.min(cur+1,to); setScore(cur); setScoreCol(col); if(cur>=to)clearInterval(iv); }, 28);
      ids.push(iv);
    };
    s(200, () => setUpW(100));
    s(900, () => setUpDone(true));
    s(1300, () => setB0(b=>({...b,cls:'bad'})));
    s(1680, () => { setB0({cls:'good',txt:'Led OKR-driven roadmap → cut time-to-market 30%'}); anim(38,58,'#f0a832'); });
    s(2530, () => setB1(b=>({...b,cls:'bad'})));
    s(2910, () => { setB1({cls:'good',txt:'Drove 3-team alignment — zero escalations Q3'}); anim(58,72,'#8b82f0'); });
    s(3760, () => setB2(b=>({...b,cls:'bad'})));
    s(4140, () => { setB2({cls:'good',txt:'Delivered $2.4M feature on schedule, 12 stakeholders'}); anim(72,90,c); });
    s(4600, () => setTagVis(true));
    [4700,4810,4920,5030,5140,5250].forEach((ms,i)=>s(ms,()=>setKw(v=>{const n=[...v];n[i]=1;return n;})));
    return () => ids.forEach(id => { clearTimeout(id); clearInterval(id); });
  }, [active]);
  return (
    <JnyCard step="Step 01" title="Upload → ATS scan → 38 to 91 in 90s" statusCls="run" statusTxt="⚡ Scanning">
      <div style={{display:'flex',alignItems:'center',gap:9,background:'rgba(30,201,138,.03)',border:'1px solid rgba(30,201,138,.12)',borderRadius:7,padding:'7px 10px'}}>
        <span style={{fontSize:14}}>📄</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:'monospace',fontSize:11,color:'rgba(255,255,255,.3)',marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>resume_ivy_chen_seniorAI.pdf</div>
          <div style={{height:2,background:'rgba(255,255,255,.08)',borderRadius:2,overflow:'hidden'}}>
            <div style={{height:2,width:`${upW}%`,background:c,borderRadius:2,transition:'width .6s steps(14,end)'}}/>
          </div>
        </div>
        <div style={{fontSize:11,color:upDone?c:'rgba(255,255,255,.3)',fontFamily:'monospace',whiteSpace:'nowrap',transition:'color .3s'}}>{upDone?'✓ Memory seeded':'uploading…'}</div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <div>
          <div style={{fontSize:10,fontFamily:'monospace',color:'rgba(255,255,255,.25)',letterSpacing:1,textTransform:'uppercase',marginBottom:2}}>ATS Score</div>
          <div style={{display:'flex',alignItems:'baseline',gap:3}}>
            <span style={{fontFamily:'monospace',fontSize:24,fontWeight:700,color:scoreCol,lineHeight:1,transition:'color .4s'}}>{score}</span>
            <span style={{fontSize:11,color:'rgba(255,255,255,.25)',fontFamily:'monospace'}}>/100</span>
          </div>
        </div>
        <div style={{flex:1,padding:'0 6px'}}>
          <div style={{height:5,background:'rgba(255,255,255,.06)',borderRadius:3,overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:3,background:scoreCol,width:`${score}%`,transition:'width .7s cubic-bezier(.22,1,.36,1),background .5s'}}/>
          </div>
        </div>
        <div style={{fontSize:10,fontFamily:'monospace',padding:'1px 6px',borderRadius:10,background:'rgba(30,201,138,.1)',color:c,border:'1px solid rgba(30,201,138,.22)',opacity:tagVis?1:0,transition:'opacity .3s',whiteSpace:'nowrap'}}>+52 pts</div>
      </div>
      {[b0,b1,b2].map((b,i)=>(
        <div key={i} className={`jny-ats-bullet${b.cls?' '+b.cls:''}`}>{b.txt}</div>
      ))}
      <div style={{display:'flex',flexWrap:'wrap',gap:3,marginTop:2}}>
        {[{t:'Agile',k:'exist'},{t:'Roadmap',k:'exist'},{t:'OKR-driven',k:'new'},{t:'cross-functional',k:'new'},{t:'P&L ownership',k:'new'},{t:'stakeholder mgmt',k:'new'}].map((kv,i)=>(
          <span key={i} className={`jny-ats-kw ${kv.k}${kw[i]?' vis':''}`}>{kv.t}</span>
        ))}
      </div>
    </JnyCard>
  );
}

function S0Card2({ color: c, active }) {
  const [bars, setBars] = useState([0,0,0,0]);
  const [vals, setVals] = useState([false,false,false,false]);
  const [pills, setPills] = useState([0,0,0,0,0]);
  const bCols = [c,'#8b82f0','#f0a832','#8b82f0'];
  const bLabels = ['Keywords','Seniority','Impact','Format'];
  const bPcts = [94,88,91,88];
  useEffect(() => {
    if (!active) { setBars([0,0,0,0]); setVals([false,false,false,false]); setPills([0,0,0,0,0]); return; }
    const ids=[];
    const s=(ms,fn)=>ids.push(setTimeout(fn,ms));
    bPcts.forEach((t,i)=>{
      s(i*150,()=>setBars(b=>{const n=[...b];n[i]=t;return n;}));
      s(620+i*150,()=>setVals(v=>{const n=[...v];n[i]=true;return n;}));
    });
    [0,1,2,3,4].forEach(i=>s(900+i*130,()=>setPills(p=>{const n=[...p];n[i]=1;return n;})));
    return()=>ids.forEach(id => { clearTimeout(id); clearInterval(id); });
  }, [active]);
  return (
    <JnyCard step="Step 02" title="JD Match · 94% — gap analysis" statusCls="run" statusTxt="⚡ 94%">
      <div style={{fontFamily:'monospace',fontSize:10,color:'rgba(255,255,255,.3)',letterSpacing:1,textTransform:'uppercase',marginBottom:6}}>Senior AI Engineer · Vertex AI Labs</div>
      <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:7}}>
        {bLabels.map((l,i)=>(
          <div key={i} className="jny-mbar-row">
            <span className="jny-mbar-label">{l}</span>
            <div className="jny-mbar-track"><div className="jny-mbar-fill" style={{width:`${bars[i]}%`,background:bCols[i]}}/></div>
            <span className="jny-mbar-val" style={{color:bCols[i]}}>{vals[i]?bPcts[i]+'%':'—'}</span>
          </div>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
        <span style={{fontSize:11,fontFamily:'monospace',color:'rgba(255,255,255,.3)',textTransform:'uppercase',letterSpacing:.5}}>Keyword gaps</span>
        <span style={{fontSize:11,fontFamily:'monospace',color:'rgba(255,255,255,.3)'}}>→ injected by AI</span>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
        {[{t:'✗ "LLM fine-tuning"',k:'gap'},{t:'✗ "MLOps pipeline"',k:'gap'},{t:'✓ AWS SageMaker',k:'match'},{t:'✓ Python / PyTorch',k:'match'},{t:'✓ cross-functional',k:'match'}].map((p,i)=>(
          <span key={i} className={`jny-kpill ${p.k}${pills[i]?' vis':''}`}>{p.t}</span>
        ))}
      </div>
    </JnyCard>
  );
}

function S0Card3({ color: c, active }) {
  const [text, setText] = useState('');
  const [pills, setPills] = useState([0,0,0,0]);
  const ivRef = useRef(null);
  const full = "Dear Vertex AI Labs — I'm applying for the Senior AI Engineer role. Having built LLM pipelines delivering 40% inference cost reduction and led MLOps rollouts across 3 markets, I align closely with your requirements. My NUS background and AWS credentials are verified on my CareerAiHub profile.";
  useEffect(() => {
    clearInterval(ivRef.current);
    if (!active) { setText(''); setPills([0,0,0,0]); return; }
    let i=0;
    ivRef.current=setInterval(()=>{
      if(i<=full.length){ setText(full.slice(0,i)); i++; }
      else { clearInterval(ivRef.current); [0,1,2,3].forEach(j=>setTimeout(()=>setPills(p=>{const n=[...p];n[j]=1;return n;}),j*150)); }
    },18);
    return()=>clearInterval(ivRef.current);
  }, [active]);
  return (
    <JnyCard step="Step 03" title="AI cover letter · memory-personalised" statusCls="done" statusTxt="✓ Ready">
      <div style={{fontFamily:'monospace',fontSize:10,color:'rgba(255,255,255,.3)',letterSpacing:1,textTransform:'uppercase',marginBottom:6}}>Auto-seeded from resume + JD match</div>
      <div style={{fontSize:11.5,lineHeight:1.68,color:'rgba(255,255,255,.5)',fontStyle:'italic',minHeight:80,flex:1}}>{text}</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>
        {['Role-matched','Memory-seeded','PDF ready','30 seconds'].map((t,i)=>(
          <span key={i} className={`jny-kpill match${pills[i]?' vis':''}`}>{t}</span>
        ))}
      </div>
    </JnyCard>
  );
}

// Stage 1: Get Ready (purple)
function S1Card1({ color: c, active }) {
  const [vals, setVals] = useState([0,0,0,0]);
  const [bars, setBars] = useState([0,0,0,0]);
  const [aiVis, setAiVis] = useState(false);
  const [aiText, setAiText] = useState('');
  const ivRef = useRef(null);
  const sc = [38,44,72,84];
  const cols = ['#ef4444',c,'#8b82f0','#1ec98a'];
  const aiMsg = 'Biggest gap: concrete examples 38/100. Plan targets this first. Once you clear 70 we move to STAR. Interview-ready in 9 days.';
  const dimNames=['Concrete examples','STAR structure','Clarity & delivery','Role knowledge'];
  useEffect(() => {
    clearInterval(ivRef.current);
    if (!active) { setVals([0,0,0,0]); setBars([0,0,0,0]); setAiVis(false); setAiText(''); return; }
    const ids=[];
    const s=(ms,fn)=>ids.push(setTimeout(fn,ms));
    sc.forEach((t,i)=>{
      s(i*220,()=>{
        setBars(b=>{const n=[...b];n[i]=t;return n;});
        let cur=0; const iv=setInterval(()=>{cur=Math.min(cur+1,t);setVals(v=>{const n=[...v];n[i]=cur;return n;});if(cur>=t)clearInterval(iv);},16);ids.push(iv);
      });
    });
    s(1200,()=>setAiVis(true));
    s(1300,()=>{ let j=0; ivRef.current=setInterval(()=>{if(j<=aiMsg.length){setAiText(aiMsg.slice(0,j));j++;}else clearInterval(ivRef.current);},14); });
    return()=>{ ids.forEach(id => { clearTimeout(id); clearInterval(id); }); clearInterval(ivRef.current); };
  }, [active]);
  return (
    <JnyCard step="Step 01" title="Personalised readiness plan" statusCls="done" statusTxt="✓ Plan ready">
      <div style={{fontFamily:'monospace',fontSize:10,color:'rgba(255,255,255,.3)',letterSpacing:1,textTransform:'uppercase',marginBottom:7}}>Your scores — built from last 2 sessions</div>
      <div className="jny-dim-grid">
        {[0,1,2,3].map(i=>(
          <div key={i} className="jny-dim-cell">
            <div className="jny-dim-val" style={{color:cols[i]}}>{vals[i]}</div>
            <div className="jny-dim-name">{dimNames[i]}</div>
            <div className="jny-dim-bar"><div className="jny-dim-bfill" style={{width:`${bars[i]}%`,background:cols[i]}}/></div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:7,alignItems:'flex-start',background:'rgba(139,130,240,.07)',border:'1px solid rgba(139,130,240,.18)',borderRadius:7,padding:'7px 9px',opacity:aiVis?1:0,transition:'opacity .5s'}}>
        <div style={{width:18,height:18,borderRadius:4,background:c,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#000',flexShrink:0}}>AI</div>
        <div style={{fontSize:11,color:'rgba(255,255,255,.55)',lineHeight:1.6}}>{aiText}</div>
      </div>
    </JnyCard>
  );
}

function S1Card2({ color: c, active }) {
  const [q, setQ] = useState('');
  const [scores, setScores] = useState([0,0,0,0]);
  const [fb, setFb] = useState('');
  const [fbVis, setFbVis] = useState(false);
  const qIvRef = useRef(null);
  const fbIvRef = useRef(null);
  const qTxt = 'Tell me about a time you delivered an AI feature under tight constraints. What was the outcome?';
  const fbTxt = 'AI feedback: Strong role fit. Missing concrete outcome number — add the % improvement or $ impact.';
  const sCols=['#ef4444','#f0a832',c,'#1ec98a'];
  const sLabels=['Examples','STAR','Clarity','Role fit'];
  const sVals=[62,55,78,80];
  useEffect(() => {
    clearInterval(qIvRef.current); clearInterval(fbIvRef.current);
    if (!active) { setQ(''); setScores([0,0,0,0]); setFb(''); setFbVis(false); return; }
    const ids=[];
    const s=(ms,fn)=>ids.push(setTimeout(fn,ms));
    let i=0; qIvRef.current=setInterval(()=>{if(i<=qTxt.length){setQ(qTxt.slice(0,i));i++;}else clearInterval(qIvRef.current);},16);
    s(1700,()=>{ sVals.forEach((t,idx)=>{ s(idx*180,()=>{ let cur=0; const iv=setInterval(()=>{cur=Math.min(cur+1,t);setScores(v=>{const n=[...v];n[idx]=cur;return n;});if(cur>=t)clearInterval(iv);},16); ids.push(iv); }); }); });
    s(2600,()=>setFbVis(true));
    s(2700,()=>{ let j=0; fbIvRef.current=setInterval(()=>{if(j<=fbTxt.length){setFb(fbTxt.slice(0,j));j++;}else clearInterval(fbIvRef.current);},14); });
    return()=>ids.forEach(id => { clearTimeout(id); clearInterval(id); });
  }, [active]);
  return (
    <JnyCard step="Step 02" title="HM Simulator — mock interview" statusCls="live" statusTxt="● Live">
      <div style={{fontFamily:'monospace',fontSize:10,color:'rgba(255,255,255,.3)',letterSpacing:1,textTransform:'uppercase',marginBottom:6}}>AI Hiring Manager · Senior AI Engineer</div>
      <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',borderRadius:7,padding:'8px 10px',fontSize:11.5,color:'rgba(255,255,255,.6)',lineHeight:1.6,marginBottom:6,minHeight:38}}>{q}</div>
      <div style={{display:'flex',gap:5,marginBottom:7}}>
        {[0,1,2,3].map(i=>(
          <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2,background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',borderRadius:6,padding:'6px 4px'}}>
            <div style={{fontFamily:'monospace',fontSize:15,fontWeight:700,color:sCols[i],lineHeight:1}}>{scores[i]||'–'}</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,.3)'}}>{sLabels[i]}</div>
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:'rgba(255,255,255,.4)',lineHeight:1.55,fontStyle:'italic',minHeight:22,opacity:fbVis?1:0,transition:'opacity .4s'}}>{fb}</div>
    </JnyCard>
  );
}

function S1Card3({ color: c, active }) {
  const [vis, setVis] = useState([0,0,0]);
  const stories=[
    {t:'LLM rollout · cut latency 40%',a:'RESULT ✓',ac:'#1ec98a'},
    {t:'Cross-team alignment · zero escalations',a:'IMPACT ✓',ac:c},
    {t:'$2.4M feature delivery — on schedule',a:'QUANTIFIED ✓',ac:'#f0a832'},
  ];
  useEffect(() => {
    if (!active) { setVis([0,0,0]); return; }
    const ids=[0,1,2].map(i=>setTimeout(()=>setVis(v=>{const n=[...v];n[i]=1;return n;}),300+i*380));
    return()=>ids.forEach(id => { clearTimeout(id); clearInterval(id); });
  }, [active]);
  return (
    <JnyCard step="Step 03" title="STAR builder — story bank" statusCls="done" statusTxt="✓ 3 stories">
      <div style={{fontFamily:'monospace',fontSize:10,color:'rgba(255,255,255,.3)',letterSpacing:1,textTransform:'uppercase',marginBottom:6}}>Story bank · grows with every session</div>
      <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:7}}>
        {stories.map((st,i)=>(
          <div key={i} className={`jny-story${vis[i]?' vis':''}`}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:2}}>
              <span style={{fontSize:11.5,fontWeight:600,color:'rgba(255,255,255,.8)'}}>{st.t}</span>
              <span style={{fontFamily:'monospace',fontSize:10,color:st.ac,background:st.ac+'18',padding:'1px 6px',borderRadius:10}}>{st.a}</span>
            </div>
            <div style={{fontSize:11,color:'rgba(255,255,255,.3)'}}>Situation · Task · Action · Result — AI-structured</div>
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:'rgba(255,255,255,.3)'}}><span style={{fontFamily:'monospace',fontSize:11,color:c,fontWeight:700}}>3</span> stories ready · reused in every interview question</div>
    </JnyCard>
  );
}

function S1Card4({ color: c, active }) {
  const [bars, setBars] = useState([0,0,0,0]);
  const [valVis, setValVis] = useState([0,0,0,0]);
  const [anchorVis, setAnchorVis] = useState(false);
  const pcts=[40,55,72,100];
  const bCols=['rgba(139,130,240,.5)','rgba(139,130,240,.65)','rgba(232,92,128,.55)',c];
  const labels=['P25','Median','P75','Top 10%'];
  const vals=['SGD 9k','SGD 12k','SGD 16k','SGD 22k'];
  const vCols=['rgba(255,255,255,.3)','rgba(255,255,255,.5)','#e85c80',c];
  useEffect(() => {
    if (!active) { setBars([0,0,0,0]); setValVis([0,0,0,0]); setAnchorVis(false); return; }
    const ids=[];
    const s=(ms,fn)=>ids.push(setTimeout(fn,ms));
    pcts.forEach((p,i)=>{ s(i*180,()=>setBars(b=>{const n=[...b];n[i]=p;return n;})); s(600+i*180,()=>setValVis(v=>{const n=[...v];n[i]=1;return n;})); });
    s(1500,()=>setAnchorVis(true));
    return()=>ids.forEach(id => { clearTimeout(id); clearInterval(id); });
  }, [active]);
  return (
    <JnyCard step="Step 04" title="Salary coach — SGD market benchmarks" statusCls="done" statusTxt="✓ Benchmarked">
      <div style={{fontFamily:'monospace',fontSize:10,color:'rgba(255,255,255,.3)',letterSpacing:1,textTransform:'uppercase',marginBottom:6}}>Market Intel · Senior AI Engineer · Singapore</div>
      <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:8}}>
        {labels.map((l,i)=>(
          <div key={i} className="jny-mbar-row">
            <span className="jny-mbar-label" style={{width:42,fontSize:11}}>{l}</span>
            <div className="jny-mbar-track"><div className="jny-mbar-fill smooth" style={{width:`${bars[i]}%`,background:bCols[i]}}/></div>
            <span className="jny-mbar-val" style={{color:vCols[i],width:42,opacity:valVis[i]?1:0}}>{vals[i]}</span>
          </div>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(240,168,50,.07)',border:'1px solid rgba(240,168,50,.22)',borderRadius:7,padding:'7px 10px',opacity:anchorVis?1:0,transition:'opacity .5s'}}>
        <div>
          <div style={{fontSize:10,fontFamily:'monospace',color:c,textTransform:'uppercase',letterSpacing:.5,marginBottom:2}}>AI anchor — P75 strategy</div>
          <div style={{fontSize:10,color:'rgba(255,255,255,.55)'}}>Open at <strong style={{color:'rgba(255,255,255,.9)'}}>SGD 16k</strong> · accept <strong style={{color:'#1ec98a'}}>≥ 14k</strong></div>
        </div>
        <div style={{fontFamily:'monospace',fontSize:13,fontWeight:700,color:c}}>+33%</div>
      </div>
    </JnyCard>
  );
}

// Stage 2: Get the Offer (gold)
function S2Card1({ color: c, active }) {
  const [bars, setBars] = useState([0,0,0,0]);
  const [offerVis, setOfferVis] = useState(false);
  const [ancNum, setAncNum] = useState(0);
  const pcts=[40,55,72,100];
  const bCols=['rgba(236,72,153,.5)','rgba(139,130,240,.6)','rgba(232,92,128,.55)',c];
  const labels=['P25','Median','P75','Top 10%'];
  useEffect(() => {
    if (!active) { setBars([0,0,0,0]); setOfferVis(false); setAncNum(0); return; }
    const ids=[];
    const s=(ms,fn)=>ids.push(setTimeout(fn,ms));
    pcts.forEach((p,i)=>s(i*160,()=>setBars(b=>{const n=[...b];n[i]=p;return n;})));
    s(800,()=>setOfferVis(true));
    s(900,()=>{ let cur=0; const iv=setInterval(()=>{ cur=Math.min(cur+200,14000); setAncNum(cur); if(cur>=14000)clearInterval(iv); },16); ids.push(iv); });
    return()=>ids.forEach(id => { clearTimeout(id); clearInterval(id); });
  }, [active]);
  return (
    <JnyCard step="Step 01" title="Offer received · market benchmark" statusCls="run" statusTxt="⚡ Analysing">
      <div style={{fontFamily:'monospace',fontSize:10,color:'rgba(255,255,255,.3)',letterSpacing:1,textTransform:'uppercase',marginBottom:7}}>Market Intel · Senior PM · Singapore</div>
      <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:8}}>
        {labels.map((l,i)=>(
          <div key={i} className="jny-mbar-row">
            <span className="jny-mbar-label" style={{width:40,fontSize:11}}>{l}</span>
            <div className="jny-mbar-track"><div className="jny-mbar-fill smooth" style={{width:`${bars[i]}%`,background:bCols[i]}}/></div>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,opacity:offerVis?1:0,transition:'opacity .5s'}}>
        <div style={{background:'rgba(239,68,68,.05)',border:'1px solid rgba(239,68,68,.18)',borderRadius:7,padding:'7px 9px'}}>
          <div style={{fontFamily:'monospace',fontSize:10,color:'rgba(239,68,68,.65)',textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>Their offer</div>
          <div style={{fontSize:16,fontWeight:700,color:'#ef4444',fontFamily:'monospace'}}>$10,500</div>
          <div style={{fontSize:11,color:'rgba(239,68,68,.45)'}}>P28 · below market</div>
        </div>
        <div style={{background:'rgba(240,168,50,.07)',border:'1px solid rgba(240,168,50,.25)',borderRadius:7,padding:'7px 9px'}}>
          <div style={{fontFamily:'monospace',fontSize:10,color:c,textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>AI anchor</div>
          <div style={{fontSize:16,fontWeight:700,color:c,fontFamily:'monospace'}}>${ancNum.toLocaleString()}</div>
          <div style={{fontSize:11,color:'rgba(240,168,50,.5)'}}>P75 · AI-set</div>
        </div>
      </div>
    </JnyCard>
  );
}

function S2Card2({ color: c, active }) {
  const [steps, setSteps] = useState(['','','','']);
  const stepsData=[
    {t:'Express gratitude, signal confidence',s:'"I\'m excited — let me share where I\'d need to land."'},
    {t:'Anchor at P75 with market data',s:'"Based on SG market data, my range is SGD 14–16k."'},
    {t:'Stay silent for 6 seconds',s:'Silence after anchoring wins more than any word.'},
    {t:'Close with a bridge',s:'"I can start immediately if we\'re aligned on that."'},
  ];
  useEffect(() => {
    if (!active) { setSteps(['','','','']); return; }
    const ids=[];
    const s=(ms,fn)=>ids.push(setTimeout(fn,ms));
    s(0,()=>setSteps(['act','','','']));
    s(1000,()=>setSteps(['done','act','','']));
    s(2000,()=>setSteps(['done','done','act','']));
    s(2900,()=>setSteps(['done','done','done','act']));
    s(3700,()=>setSteps(['done','done','done','done']));
    return()=>ids.forEach(id => { clearTimeout(id); clearInterval(id); });
  }, [active]);
  return (
    <JnyCard step="Step 02" title="4-step negotiation script" statusCls="run" statusTxt="⚡ Active">
      <div style={{fontFamily:'monospace',fontSize:10,color:'rgba(255,255,255,.3)',letterSpacing:1,textTransform:'uppercase',marginBottom:6}}>Word-for-word · ready to say or send</div>
      <div className="jny-neg-steps">
        {stepsData.map((st,i)=>(
          <div key={i} className={`jny-nstep${steps[i]?' '+steps[i]:''}`}>
            <div className="jny-nstep-num">{i+1}</div>
            <div>
              <div className="jny-nstep-text">{st.t}</div>
              <div className="jny-nstep-sub">{st.s}</div>
            </div>
          </div>
        ))}
      </div>
    </JnyCard>
  );
}

function S2Card3({ color: c, active }) {
  const [fade, setFade] = useState(false);
  const [label, setLabel] = useState('AI counter');
  const [uplift, setUplift] = useState(false);
  const [pills, setPills] = useState([0,0,0]);
  useEffect(() => {
    if (!active) { setFade(false); setLabel('AI counter'); setUplift(false); setPills([0,0,0]); return; }
    const ids=[];
    const s=(ms,fn)=>ids.push(setTimeout(fn,ms));
    s(900,()=>setFade(true));
    s(1250,()=>setLabel('✓ Accepted'));
    s(1630,()=>setUplift(true));
    [2230,2380,2530].forEach((ms,i)=>s(ms,()=>setPills(p=>{const n=[...p];n[i]=1;return n;})));
    return()=>ids.forEach(id => { clearTimeout(id); clearInterval(id); });
  }, [active]);
  return (
    <JnyCard step="Step 03" title="Deal closed · +SGD 3,500/mo" statusCls="done" statusTxt="✓ +33% uplift">
      <div className="jny-offer-compare">
        <div className={`jny-ob jny-ob-their${fade?' fade':''}`}>
          <div className="jny-ob-label" style={{color:'rgba(239,68,68,.65)'}}>Their offer</div>
          <div className="jny-ob-amount" style={{color:'#ef4444'}}>$10,500</div>
          <div className="jny-ob-sub" style={{color:'rgba(239,68,68,.45)'}}>P28 · below market</div>
        </div>
        <div className="jny-ob jny-ob-ours">
          <div className="jny-ob-label" style={{color:c}}>{label}</div>
          <div className="jny-ob-amount" style={{color:c}}>$14,000</div>
          <div className="jny-ob-sub" style={{color:'rgba(240,168,50,.5)'}}>P75 strategy</div>
        </div>
      </div>
      <div className={`jny-uplift-banner${uplift?' vis':''}`}>
        <span style={{fontSize:10.5,fontWeight:600,color:'#1ec98a'}}>✓ Deal closed · offer accepted</span>
        <span style={{fontFamily:'monospace',fontSize:10.5,color:'#1ec98a',fontWeight:700}}>+SGD 3,500/mo</span>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:7}}>
        {['Salary Coach','Market Intel','Negotiation Script'].map((t,i)=>(
          <span key={i} className={`jny-kpill match${pills[i]?' vis':''}`}>{t}</span>
        ))}
      </div>
    </JnyCard>
  );
}

// Stage 3: Get Found (pink)
function S3Card1({ color: c, active }) {
  const [chks, setChks] = useState([0,0,0,0]);
  const [bdgs, setBdgs] = useState([0,0,0,0]);
  const [cosVis, setCosVis] = useState(false);
  const [cosVal, setCosVal] = useState(0);
  const creds=['Singpass ID · Ivy Chen','NUS CS · OpenCerts','AWS Solutions Architect · Credly','7 yr AI Engineering · verified'];
  useEffect(() => {
    if (!active) { setChks([0,0,0,0]); setBdgs([0,0,0,0]); setCosVis(false); setCosVal(0); return; }
    const ids=[];
    const s=(ms,fn)=>ids.push(setTimeout(fn,ms));
    [0,1,2,3].forEach(i=>{ s(460+i*460,()=>{ setChks(v=>{const n=[...v];n[i]=1;return n;}); s(150,()=>setBdgs(v=>{const n=[...v];n[i]=1;return n;})); }); });
    s(2200,()=>{ setCosVis(true); let n=0; const iv=setInterval(()=>{n=Math.min(n+2,88);setCosVal(n);if(n>=88)clearInterval(iv);},28); ids.push(iv); });
    return()=>ids.forEach(id => { clearTimeout(id); clearInterval(id); });
  }, [active]);
  return (
    <JnyCard step="Step 01" title="Credential verify · blockchain-backed" statusCls="done" statusTxt="✓ All verified">
      <div style={{fontFamily:'monospace',fontSize:10,color:'rgba(255,255,255,.3)',letterSpacing:1,textTransform:'uppercase',marginBottom:7}}>Singpass · OpenCerts · Credly · Work history</div>
      <div className="jny-cred-list" style={{marginBottom:7}}>
        {creds.map((cr,i)=>(
          <div key={i} className="jny-cred-row">
            <div className={`jny-cred-chk${chks[i]?' ver':''}`}>{chks[i]?'✓':''}</div>
            <span className="jny-cred-name">{cr}</span>
            <span className={`jny-cred-badge${bdgs[i]?' vis':''}`}>✓ Blockchain</span>
          </div>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(232,92,128,.06)',border:'1px solid rgba(232,92,128,.18)',borderRadius:7,padding:'7px 10px',opacity:cosVis?1:0,transition:'opacity .5s'}}>
        <span style={{fontSize:11,color:'rgba(255,255,255,.5)'}}>Career OS Score</span>
        <span style={{fontFamily:'monospace',fontSize:16,fontWeight:700,color:c}}>{cosVal} / 100</span>
        <span style={{fontSize:11,padding:'2px 7px',background:'rgba(232,92,128,.09)',color:c,border:'1px solid rgba(232,92,128,.22)',borderRadius:20,fontFamily:'monospace'}}>Top 8%</span>
      </div>
    </JnyCard>
  );
}

function S3Card2({ color: c, active }) {
  const [scanTxt, setScanTxt] = useState('Scanning 0…');
  const [scanDone, setScanDone] = useState(false);
  const [ringPct, setRingPct] = useState(0);
  const [confVis, setConfVis] = useState(false);
  const [fBars, setFBars] = useState([0,0,0,0]);
  const [creds, setCreds] = useState([0,0,0,0]);
  const funnels=[{l:'Total pool',v:'2,714',bg:'#3d3875'},{l:'Skills match',v:'142',bg:'#5a54a8'},{l:'Verified creds',v:'31',bg:'#7F77DD'},{l:'95%+ match',v:'1',bg:c}];
  useEffect(() => {
    if (!active) { setScanTxt('Scanning 0…'); setScanDone(false); setRingPct(0); setConfVis(false); setFBars([0,0,0,0]); setCreds([0,0,0,0]); return; }
    const ids=[];
    let cn=0; const civ=setInterval(()=>{ cn=Math.min(cn+68,2714); setScanTxt('Scanning '+cn.toLocaleString()+'…'); if(cn>=2714){clearInterval(civ);setScanTxt('2,714 scanned ✓');setScanDone(true);} },40); ids.push(civ);
    let sc=0; const siv=setInterval(()=>{ sc=Math.min(sc+1.3,95); setRingPct(Math.round(sc)); if(sc>=95){clearInterval(siv);setConfVis(true);} },20); ids.push(siv);
    [100,50,20,5].forEach((tgt,i)=>ids.push(setTimeout(()=>setFBars(b=>{const n=[...b];n[i]=tgt;return n;}),i*280)));
    [0,1,2,3].forEach(i=>ids.push(setTimeout(()=>setCreds(v=>{const n=[...v];n[i]=1;return n;}),1200+i*200)));
    return()=>ids.forEach(id => { clearTimeout(id); clearInterval(id); });
  }, [active]);
  const deg=Math.round(ringPct/100*360);
  return (
    <JnyCard step="Step 02" title="TrustMatch engine · 2,714 scanned" statusCls="run" statusTxt="● Scanning">
      <div className="jny-mp-dark">
        <div className="jny-mp-hrow">
          <span className="jny-mp-badge">AI Match Engine</span>
          <span className={`jny-mp-scan${scanDone?' done':''}`}>{scanTxt}</span>
        </div>
        <div className="jny-mp-mrow">
          <div>
            <div className="jny-sring" style={{background:`conic-gradient(${c} 0deg,${c} ${deg}deg,rgba(26,21,48,.9) ${deg}deg)`}}>
              <div className="jny-sring-inner">
                <div className="jny-sring-num">{ringPct}%</div>
                <div className="jny-sring-lbl">MATCH</div>
              </div>
            </div>
            <div className={`jny-mp-confirm${confVis?' vis':''}`} style={{color:c}}>✓ 95% MATCH</div>
          </div>
          <div className="jny-funnels">
            {funnels.map((f,i)=>(
              <div key={i} className="jny-fn-row">
                <span className="jny-fn-lbl">{f.l}</span>
                <div className="jny-fn-track"><div className="jny-fn-fill" style={{width:`${fBars[i]}%`,background:f.bg}}/></div>
                <span className="jny-fn-val" style={{color:i===3?c:undefined}}>{f.v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="jny-mp-creds">
          {['Singpass','NUS CS','AWS SAA','7yr AI'].map((cr,i)=>(
            <span key={i} className={`jny-mp-cred${creds[i]?' vis':''}`}><span style={{color:'#7F77DD'}}>✓</span> {cr}</span>
          ))}
        </div>
      </div>
    </JnyCard>
  );
}

function S3Card3({ color: c, active }) {
  const [msg, setMsg] = useState('');
  const [timerW, setTimerW] = useState(100);
  const [secs, setSecs] = useState(240);
  const msgIvRef = useRef(null);
  const timerIvRef = useRef(null);
  const fullMsg='Hi Ivy — I can see your ✓NUS · ✓AWS · ✓Singpass credentials and your 95% match score. Impressive AI engineering background. Are you open to a 20-min call this Friday?';
  useEffect(() => {
    clearInterval(msgIvRef.current); clearInterval(timerIvRef.current);
    if (!active) { setMsg(''); setTimerW(100); setSecs(240); return; }
    let i=0;
    msgIvRef.current=setInterval(()=>{
      if(i<=fullMsg.length){ setMsg(fullMsg.slice(0,i)); i++; }
      else {
        clearInterval(msgIvRef.current);
        timerIvRef.current=setInterval(()=>{
          setSecs(s=>{ const ns=Math.max(0,s-4); if(ns<=0)clearInterval(timerIvRef.current); return ns; });
          setTimerW(w=>Math.max(0,w-4/240*100));
        },65);
      }
    },19);
    return()=>{ clearInterval(msgIvRef.current); clearInterval(timerIvRef.current); };
  }, [active]);
  const m=Math.floor(secs/60), s2=secs%60;
  return (
    <JnyCard step="Step 03" title="TrustChat recruiter ping · 3:42" statusCls="live" statusTxt="● Live">
      <div style={{background:'rgba(232,92,128,.06)',border:'1px solid rgba(232,92,128,.2)',borderRadius:9,padding:'10px 12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:6}}>
          <div style={{width:22,height:22,borderRadius:'50%',background:'rgba(232,92,128,.15)',border:'1px solid rgba(232,92,128,.28)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,flexShrink:0}}>👤</div>
          <div>
            <div style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,.85)'}}>Sarah L. · Head of Talent · Vertex AI Labs</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,.3)'}}>Senior AI Engineer · 95% match</div>
          </div>
        </div>
        <div style={{fontSize:10,lineHeight:1.58,color:'rgba(255,255,255,.6)',marginBottom:6,minHeight:48}}>{msg}</div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:6}}>
          {['✓ NUS CS','✓ AWS SAA','✓ Singpass'].map(t=>(
            <span key={t} style={{fontSize:11,padding:'1px 6px',borderRadius:10,background:'rgba(30,201,138,.08)',color:'#1ec98a',border:'1px solid rgba(30,201,138,.18)',fontFamily:'monospace'}}>{t}</span>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:5,fontFamily:'monospace',fontSize:11,color:c}}>
          <span>Response window</span>
          <div className="jny-rtbar"><div style={{height:'100%',borderRadius:2,background:c,width:`${timerW}%`,transition:'width 4s linear'}}/></div>
          <span>{m}:{s2<10?'0':''}{s2}</span>
        </div>
      </div>
    </JnyCard>
  );
}

function S3Card4({ color: c, active }) {
  const [tscore, setTscore] = useState(0);
  const [rows, setRows] = useState([0,0,0]);
  const [badges, setBadges] = useState([0,0,0,0]);
  const matches=[{co:'Vertex AI Labs',pct:'95%',col:'#1ec98a'},{co:'Grab',pct:'88%',col:c},{co:'Sea Group',pct:'81%',col:'#e85c80'}];
  const bdgTxt=['🔐 Identity & credentials blockchain-verified','🎯 95% match · TrustChat opened in 3:42','📅 Intro call scheduled — Friday 10am','🧠 AI memory profile active · all 4 stages'];
  useEffect(() => {
    if (!active) { setTscore(0); setRows([0,0,0]); setBadges([0,0,0,0]); return; }
    const ids=[];
    let n=0; const iv=setInterval(()=>{n=Math.min(n+2,88);setTscore(n);if(n>=88)clearInterval(iv);},22); ids.push(iv);
    [400,700,1000].forEach((ms,i)=>ids.push(setTimeout(()=>setRows(v=>{const nv=[...v];nv[i]=1;return nv;}),ms)));
    [0,1,2,3].forEach(i=>ids.push(setTimeout(()=>setBadges(v=>{const nv=[...v];nv[i]=1;return nv;}),1400+i*280)));
    return()=>ids.forEach(id => { clearTimeout(id); clearInterval(id); });
  }, [active]);
  return (
    <JnyCard step="Step 04" title="TrustMatch profile · Trust Score 88" statusCls="done" statusTxt="✓ Top 8%">
      <div style={{fontFamily:'monospace',fontSize:10,color:'rgba(255,255,255,.3)',letterSpacing:1,textTransform:'uppercase',marginBottom:6}}>Candidate view · Ivy Chen</div>
      <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:8}}>
        <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(232,92,128,.15)',border:'2px solid rgba(232,92,128,.35)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'rgba(255,255,255,.8)',flexShrink:0}}>IC</div>
        <div style={{flex:1}}>
          <div style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,.85)'}}>Ivy Chen · Senior AI Engineer</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,.3)'}}>Trust Score <span style={{fontFamily:'monospace',fontWeight:700,color:c}}>{tscore}</span>/100 · <span style={{color:'#1ec98a'}}>Top 8%</span></div>
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:7}}>
        {matches.map((m,i)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 9px',borderRadius:6,background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.06)',opacity:rows[i]?1:0,transform:rows[i]?'none':'translateX(6px)',transition:'opacity .4s,transform .4s'}}>
            <span style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,.8)'}}>{m.co}</span>
            <span style={{fontFamily:'monospace',fontSize:12,fontWeight:700,color:m.col}}>{m.pct}</span>
          </div>
        ))}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:3}}>
        {bdgTxt.map((t,i)=>(
          <div key={i} className={`jny-tbadge${badges[i]?' vis':''}`}>{t}<span style={{marginLeft:'auto',color:'#1ec98a',fontSize:11.5}}>✓</span></div>
        ))}
      </div>
    </JnyCard>
  );
}

function mkStage0Cards(color) {
  return [
    { Component: S0Card1, props: { color } },
    { Component: S0Card2, props: { color } },
    { Component: S0Card3, props: { color } },
  ];
}

function mkStage1Cards(color) {
  return [
    { Component: S1Card1, props: { color } },
    { Component: S1Card2, props: { color } },
    { Component: S1Card3, props: { color } },
    { Component: S1Card4, props: { color } },
  ];
}

function mkStage2Cards(color) {
  return [
    { Component: S2Card1, props: { color } },
    { Component: S2Card2, props: { color } },
    { Component: S2Card3, props: { color } },
  ];
}

function mkStage3Cards(color) {
  return [
    { Component: S3Card1, props: { color } },
    { Component: S3Card2, props: { color } },
    { Component: S3Card3, props: { color } },
    { Component: S3Card4, props: { color } },
  ];
}


function JourneyDeck({ cards, color }) {
  const [current, setCurrent] = useState(0);
  const [fanned, setFanned] = useState(false);
  const [hintVis, setHintVis] = useState(false);
  const wrapRef = useRef(null);
  const timerRef = useRef(null);
  const N = cards.length;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      timerRef.current = setInterval(() => setCurrent(c => (c + 1) % N), 3800);
      setTimeout(() => setHintVis(true), 2200);
      obs.disconnect();
    }, { threshold: 0.25 });
    obs.observe(el);
    return () => { obs.disconnect(); clearInterval(timerRef.current); };
  }, [N]);

  const goTo = (idx) => {
    setCurrent(idx);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCurrent(c => (c + 1) % N), 3800);
  };

  return (
    <div className="jny-deck-wrap" ref={wrapRef}>
      <div className="jny-steps">
        {cards.map((_, i) => {
          const isDone = i < current, isAct = i === current;
          return (
            <button key={i}
              className={`jny-step${isAct ? ' active' : isDone ? ' done' : ''}`}
              style={{ '--sc': color }}
              onClick={() => { setFanned(false); goTo(i); }}>
              {String(i + 1).padStart(2, '0')}
            </button>
          );
        })}
      </div>
      <div
        className={`jny-deck-stack${fanned ? ' fanned' : ''}`}
        onMouseEnter={() => setFanned(true)}
        onMouseLeave={() => setFanned(false)}>
        {cards.map((cardDef, i) => {
          const slot = (i - current + N) % N;
          const posProps = fanned ? { 'data-fan': slot } : { 'data-pos': slot };
          const { Component, props } = cardDef;
          return (
            <div key={i} className="jny-dcard" {...posProps}
              style={{ borderColor: slot === 0 ? color + '55' : undefined }}
              onClick={() => {
                if (!fanned) setFanned(true);
                else if (slot !== 0) { setFanned(false); goTo(i); }
                else setFanned(false);
              }}>
              <Component {...props} active={slot === 0} />
            </div>
          );
        })}
      </div>
      <div className={`jny-deck-hint${hintVis ? ' vis' : ''}`}>hover to explore · click to select</div>
    </div>
  );
}


function TrustChatSection({ onJoin }) {
  return (
    <section style={{ padding: '72px 24px 80px', background: 'var(--lp-bg)' }}>
      <style>{`
        @keyframes tsmPulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div className="ey">Trust Chat</div>
        <h2 className="sh" style={{ textAlign: 'center', maxWidth: 'none', margin: '0 0 10px' }}>Built for candidates and recruiters<br />
          <span style={{ background: 'var(--lp-grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            to connect through verified trust.
          </span>
        </h2>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, overflow: 'hidden' }}>

        {/* 3-panel demo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', padding: '28px 28px 24px' }}>

          {/* Left: Your profile — Ben Tan candidate card */}
          <div style={{ paddingRight: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>
              Your profile
            </div>
            <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '14px 14px' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #7F77DD, #D4537E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>BT</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text)' }}>Ben Tan <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#00e5a0', boxShadow: '0 0 4px rgba(0,229,160,.5)', marginLeft: 4, verticalAlign: 'middle' }} /></div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>ML Research Scientist · 6 yrs · NTU MSc CS</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {['NTU OpenCerts ✓', 'TensorFlow cert ✓'].map(v => <span key={v} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(236,72,153,.07)', border: '1px solid rgba(236,72,153,.2)', color: 'var(--lp-teal)' }}>{v}</span>)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ position: 'relative', width: 54, height: 54 }}>
                    <svg width="54" height="54" viewBox="0 0 54 54" style={{ position: 'absolute', inset: 0 }}>
                      <circle cx="27" cy="27" r="21" fill="none" stroke="rgba(236,72,153,.1)" strokeWidth="4"/>
                      <circle cx="27" cy="27" r="21" fill="none" stroke="#EC4899" strokeWidth="4" strokeDasharray="131.9" strokeDashoffset="23.7" strokeLinecap="round" transform="rotate(-90 27 27)"/>
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--lp-teal)', lineHeight: 1 }}>82</span>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,.4)' }}>trust</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#00e5a0' }}>High trust</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', lineHeight: 1.6, fontStyle: 'italic', marginBottom: 8, padding: '5px 8px', background: 'rgba(255,255,255,.03)', borderLeft: '2px solid rgba(255,255,255,.1)', borderRadius: '0 4px 4px 0' }}>
                "ML researcher focused on efficient inference. Published 2 papers at NeurIPS."
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 8 }}>
                {[['ATS', '84/100', 'var(--lp-teal)'], ['Interview', '79/100', '#7F77DD'], ['STAR', 'Good', '#00e5a0']].map(([l, v, c]) => (
                  <div key={l} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 6, padding: '5px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {['TensorFlow', 'CUDA', 'Python', 'Research'].map((s, i) => (
                  <span key={s} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,.03)', border: `1px solid ${i < 3 ? 'rgba(236,72,153,.2)' : 'rgba(255,255,255,.08)'}`, color: i < 3 ? 'rgba(236,72,153,.75)' : 'rgba(255,255,255,.4)' }}>{s}</span>
                ))}
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 800, color: 'var(--lp-teal)' }}>91% match</div>
            </div>
          </div>

          {/* Center atom bridge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>←</span>
              <OrbitMark size={64} animated duration={6} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>→</span>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textAlign: 'center', lineHeight: 1.55 }}>Verified trust<br/>matches the<br/>right opportunities</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[...Array(4)].map((_, i) => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(236,72,153,.4)', animation: `tsmPulse 2s ${i * 0.4}s infinite` }} />)}
            </div>
          </div>

          {/* Right: Jobs matching your profile */}
          <div style={{ paddingLeft: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>
              Jobs matching your profile
            </div>
            {[
              { logo: 'VA', logoClr: 'rgba(139,124,246,.2)', logoBdr: 'rgba(139,124,246,.3)', logoTxt: '#a89bf8', co: 'Vertex AI Labs', tag: 'verified employer', role: 'Senior AI Engineer · SGD 12–16k', pct: '95%', tags: ['Remote-first','Visa sponsorship','Equity'], active: true },
              { logo: 'GR', logoClr: 'rgba(0,229,160,.1)', logoBdr: 'rgba(0,229,160,.2)', logoTxt: '#00e5a0', co: 'Grab', tag: 'verified employer', role: 'ML Research Scientist · SGD 14–18k', pct: '88%', tags: ['Hybrid','L7 senior track','Stock options'], active: false },
            ].map((job, i) => (
              <div key={i} style={{ background: job.active ? 'rgba(236,72,153,.04)' : 'rgba(255,255,255,.02)', border: `1px solid ${job.active ? 'rgba(236,72,153,.18)' : 'rgba(255,255,255,.06)'}`, borderRadius: 12, padding: '12px 14px', marginBottom: i === 0 ? 10 : 0 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: job.logoClr, border: `1px solid ${job.logoBdr}`, color: job.logoTxt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{job.logo}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text)' }}>{job.co} <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--lp-teal)', background: 'rgba(236,72,153,.1)', borderRadius: 10, padding: '1px 6px', border: '1px solid rgba(236,72,153,.2)' }}>{job.tag}</span></div>
                    <div style={{ fontSize: 11, color: 'var(--lp-text2)' }}>{job.role}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--lp-teal)', fontFamily: 'var(--lp-ffm)', flexShrink: 0 }}>{job.pct}<span style={{ fontSize: 9, fontWeight: 400, color: 'rgba(255,255,255,.35)' }}>fit</span></div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {job.tags.map(t => <span key={t} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.5)' }}>{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}


function JourneyStage({ stage, cards, swapped, stageIdx, isLast }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVis(true); obs.disconnect(); }
    }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const copyPanel = (
    <div className="jny-tcard" style={{ borderColor: stage.color + '22' }}>
      <div className="jny-stage-badge" style={{ color: stage.color, background: stage.color + '12', border: `1px solid ${stage.color}30` }}>
        <span className="jny-badge-dot" style={{ background: stage.color }} />
        {stage.label}
      </div>
      <h3 className="jny-copy-h3">{stage.problem}</h3>
      <p className="jny-pain" style={{ borderLeftColor: stage.color + '44' }}>{stage.pain}</p>
      <div className="jny-feats">
        {stage.bullets.map((b, j) => (
          <div key={j} className="jny-feat">
            <span className="jny-feat-ic" style={{ background: stage.color + '18', color: stage.color }}>✦</span>
            <span>
              {b.includes(' — ')
                ? <><strong style={{ color: 'var(--lp-text)', fontWeight: 700 }}>{b.split(' — ')[0]}</strong>{' — '}{b.split(' — ').slice(1).join(' — ')}</>
                : b}
            </span>
          </div>
        ))}
      </div>
      <div className="jny-outcome" style={{ background: stage.color + '15', color: stage.color, border: `1px solid ${stage.color}30` }}>
        {stage.outcome}
      </div>
    </div>
  );

  const deckPanel = (
    <div className="jny-deck-side">
      <JourneyDeck cards={cards} color={stage.color} />
    </div>
  );

  const nodeContent = (
    <div className="jny-tnode-col">
      <div className="jny-tnode" style={{ borderColor: stage.color + '66', color: stage.color, boxShadow: `0 0 18px ${stage.color}22` }}>
        {stageIdx + 1}
      </div>
      {!isLast && <div className="jny-tconnector" />}
    </div>
  );

  return (
    <div ref={ref} className={`jny-tstage${vis ? ' vis' : ''}`}>
      {swapped ? deckPanel : copyPanel}
      {nodeContent}
      {swapped ? copyPanel : deckPanel}
    </div>
  );
}

function JourneySection({ onJoin }) {
  const DECK_FACTORIES = [mkStage0Cards, mkStage1Cards, mkStage2Cards, mkStage3Cards];
  const containerRef = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height - vh * 0.5;
      const pct = Math.max(0, Math.min(100, (-rect.top + vh * 0.25) / total * 100));
      setProgress(pct);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section style={{ background: 'var(--lp-bg)', padding: '80px 0 40px' }}>
      <div style={{ textAlign: 'center', padding: '0 24px 56px', maxWidth: 680, margin: '0 auto' }}>
        <div className="ey">Your career journey</div>
        <h2 className="sh" style={{ fontFamily: 'var(--lp-ffm)', fontSize: 'clamp(32px,4vw,52px)', fontWeight: 700, letterSpacing: '-1px', lineHeight: 1.08, maxWidth: 'none', margin: '0 0 16px' }}>
          From invisible<br />to{' '}
          <em style={{ fontStyle: 'italic', background: 'var(--lp-grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>hired.</em>
        </h2>
        <p className="ss">One AI memory powers four stages. Every tool knows who you are.</p>
      </div>
      <div className="jny-timeline" ref={containerRef}>
        <div className="jny-spine" />
        <div className="jny-progress-spine" style={{ height: progress + '%' }} />
        {JOURNEY_STAGES.map((stage, i) => (
          <JourneyStage key={i} stage={stage} cards={DECK_FACTORIES[i](stage.color)} swapped={i % 2 === 1} stageIdx={i} isLast={i === JOURNEY_STAGES.length - 1} />
        ))}
      </div>
      <div style={{ textAlign: 'center', padding: '40px 24px 20px' }}>
        <button className="lp-btn-join" onClick={onJoin}>✦ Start free — no card →</button>
      </div>
    </section>
  );
}


// ── PLATFORM LAYERS ───────────────────────────────────────────────────────────

function PlatformLayers({ onJoin }) {
  const [active, setActive] = useState(0);
  const [demoLayer, setDemoLayer] = useState(null);
  const sectionRef = useRef(null);
  const d = LAYER_DATA[active];
  const handleTab = (i) => { setActive(i); setDemoLayer(null); };
  const handleCta = () => {
    setDemoLayer(active);
    setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };
  const goNextLayer = () => {
    const next = (active + 1) % LAYER_DATA.length;
    setActive(next);
    setDemoLayer(next);
  };

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) setDemoLayer(null);
    }, { threshold: 0.05 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="section alt" ref={sectionRef}>
      <div className="reveal">
        <div className="ey">Platform architecture</div>
        <h2 className="sh">Four layers. One memory. Built to compound.</h2>
        <p className="ss">Each layer builds on the last. Your profile deepens with every session — every module smarter, every recommendation more precise.</p>
      </div>
      <div className="reveal d1">
        <div className="layer-tabs">
          {LAYER_DATA.map((layer, i) => (
            <button key={i} className={`ltab ${layer.label}${active === i ? ' on' : ''}`} onClick={() => handleTab(i)}>
              <div className="ltab-n">{layer.n}</div>
              <div className="ltab-title">{layer.title}</div>
              <div className="ltab-sub">{layer.sub}</div>
              {layer.status === 'live' && (
                <span className="lstatus ls-live">
                  <span className="sdot" />
                  Live now
                </span>
              )}
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
            <button className={`lp-cta ${d.ctaCls}`} onClick={handleCta}>{d.cta}</button>
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
          {demoLayer === 0 && <L1DemoPanel onClose={() => setDemoLayer(null)} onNext={goNextLayer} />}
          {demoLayer === 1 && <L2DemoPanel onClose={() => setDemoLayer(null)} onNext={goNextLayer} />}
          {demoLayer === 2 && <L3DemoPanel onClose={() => setDemoLayer(null)} onNext={goNextLayer} />}
          {demoLayer === 3 && <L4DemoPanel onClose={() => setDemoLayer(null)} onNext={goNextLayer} />}
        </div>
      </div>
    </section>
  );
}

// ── FUNNEL METRICS STRIP ──────────────────────────────────────────────────────

function FunnelStrip() {
  return (
    <div className="lp-funnel-strip">
      <div className="lp-funnel-live">
        <span className="lp-funnel-dot" />
        <span className="lp-funnel-label">Live today on CareerAiHub</span>
      </div>
      <div className="lp-funnel-stats">
        <div className="lp-funnel-stat"><span className="lp-funnel-n">47</span><span className="lp-funnel-s">resumes scanned</span></div>
        <span className="lp-funnel-sep">·</span>
        <div className="lp-funnel-stat"><span className="lp-funnel-n">31</span><span className="lp-funnel-s">accounts created</span></div>
        <span className="lp-funnel-sep">·</span>
        <div className="lp-funnel-stat"><span className="lp-funnel-n">12</span><span className="lp-funnel-s">upgrades today</span></div>
      </div>
    </div>
  );
}

// ── PLATFORM ARCH (FLAT) ──────────────────────────────────────────────────────

function PlatformArchSection() {
  const rows = [
    { icon:'🧠', acc:'var(--lp-teal-dim)', bdr:'var(--lp-teal-b)', title:'Data layer · AI Memory', desc:'Upload your resume once. AI reads, indexes, and retains your full professional history — seeding context into every module instantly. Every session writes back, compounding your profile over time.', lbl:'Layer 01', statusBg:'var(--lp-teal-dim)', statusC:'var(--lp-teal)', statusBdr:'var(--lp-teal-b)', statusTxt:'Live', dot:true },
    { icon:'⚡', acc:'var(--lp-teal-dim)', bdr:'var(--lp-teal-b)', title:'Intelligence layer · 10 AI Modules', desc:'ATS Scanner · ATS Builder · JD Analyzer · STAR Builder · HM Simulator · Mock Interview · Salary Coach · Cover Letter · Get Ready · Job Search — all powered by the same AI memory, all compounding with each session.', lbl:'Layer 02', statusBg:'var(--lp-teal-dim)', statusC:'var(--lp-teal)', statusBdr:'var(--lp-teal-b)', statusTxt:'Live', dot:true },
    { icon:'🏅', acc:'var(--lp-amber-dim)', bdr:'var(--lp-amber-b)', title:'Verification layer · Readiness Certificate', desc:"Candidates who hit 80/100 across all interview dimensions earn a shareable Readiness Certificate — blockchain-anchored, verifiable by employers. The credential that proves you didn't just prepare, you proved it.", lbl:'Layer 03', statusBg:'var(--lp-amber-dim)', statusC:'var(--lp-amber)', statusBdr:'var(--lp-amber-b)', statusTxt:'Building', dot:false, dim:true },
    { icon:'🌐', acc:'var(--lp-purple-dim)', bdr:'var(--lp-purple-b)', title:'Market layer · Live Singapore Data', desc:'Real-time salary benchmarks, hiring velocity signals, and role-level demand pulled from 20+ platforms. Powers every salary recommendation, job search rank, and market intelligence alert — live, not cached.', lbl:'Layer 04', statusBg:'var(--lp-purple-dim)', statusC:'var(--lp-purple)', statusBdr:'var(--lp-purple-b)', statusTxt:'Planned', dot:false, dim:true },
  ];
  return (
    <section className="section alt">
      <div className="reveal">
        <div className="ey">Platform architecture</div>
        <h2 className="sh">Four layers. One memory. Built to compound.</h2>
        <p className="ss">Each layer builds on the last. Your profile deepens with every session — every module smarter, every recommendation more precise.</p>
      </div>
      <div className="reveal d1">
        <div className="lp-arch-list">
          {rows.map((r, i) => (
            <div key={i} className="lp-arch-row" style={{ opacity: r.dim ? 0.85 : 1 }}>
              <div className="lp-arch-icon" style={{ background: r.acc, border: `1px solid ${r.bdr}` }}>{r.icon}</div>
              <div className="lp-arch-body">
                <div className="lp-arch-title">{r.title}</div>
                <div className="lp-arch-desc">{r.desc}</div>
              </div>
              <div className="lp-arch-lbl">{r.lbl}</div>
              <div className="lp-arch-status" style={{ background: r.statusBg, color: r.statusC, border: `1px solid ${r.statusBdr}` }}>
                {r.dot && <span className="lp-arch-dot" style={{ background: r.statusC }} />}
                {r.statusTxt}
              </div>
            </div>
          ))}
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

// ── TESTIMONIALS ──────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote: "I uploaded my resume and within 20 seconds could see exactly why I wasn't getting callbacks. The ATS score went from 41% to 88% after following the suggestions. Got a phone screen the following week.",
    name: 'James L.',
    role: 'Software Engineer · Singapore',
    initials: 'JL',
  },
  {
    quote: "The salary coach showed me I was asking for 18% below market rate. I practiced the negotiation roleplay three times before my offer call. Ended up with SGD 1,200 more per month than the initial offer.",
    name: 'Priya W.',
    role: 'Product Manager · Singapore',
    initials: 'PW',
  },
  {
    quote: "The HM Simulator is unlike anything I've used. It actually pushed back on my vague answers and made me quantify everything. My interview confidence went from 5/10 to 9/10 after four sessions.",
    name: 'Marcus T.',
    role: 'Marketing Manager · Singapore',
    initials: 'MT',
  },
];

function TestimonialsSection() {
  return (
    <section className="section lp-testi-section" id="testimonials">
      <div className="reveal">
        <div className="ey">Early users</div>
        <h2 className="sh">What beta users say.</h2>
        <p className="ss" style={{ marginBottom: 32 }}>Real feedback from our early beta group. We're collecting more every week.</p>
      </div>
      <div className="lp-testi-grid reveal d1">
        {TESTIMONIALS.map((t, i) => (
          <div key={i} className="lp-testi-card">
            <div className="lp-testi-stars">★★★★★</div>
            <p className="lp-testi-quote">{t.quote}</p>
            <div className="lp-testi-author">
              <div className="lp-testi-avatar">{t.initials}</div>
              <div>
                <div className="lp-testi-name">{t.name}</div>
                <div className="lp-testi-role">{t.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="lp-testi-proof reveal d2">
        <div className="lp-tsp-item"><span className="lp-tsp-n">500+</span><span className="lp-tsp-l">beta users analyzed</span></div>
        <div className="lp-tsp-div" />
        <div className="lp-tsp-item"><span className="lp-tsp-n">89%</span><span className="lp-tsp-l">saw ATS score improvement</span></div>
        <div className="lp-tsp-div" />
        <div className="lp-tsp-item"><span className="lp-tsp-n">4.8★</span><span className="lp-tsp-l">average rating</span></div>
        <div className="lp-tsp-div" />
        <div className="lp-tsp-item"><span className="lp-tsp-n">SGD 1,200</span><span className="lp-tsp-l">avg salary gain reported</span></div>
      </div>
    </section>
  );
}

// ── TRUST SECTION ─────────────────────────────────────────────────────────────

const TRUST_QA = [
  {
    q: 'Why CareerAiHub over five separate tools?',
    points: [
      'One AI memory powers every module — your resume data flows across all 10 tools without re-entering anything.',
      'Compounding intelligence: each session makes the next one smarter, unlike stateless tools that forget you.',
      'Singapore-specific: salary benchmarks, job boards, and market data tuned for SEA — not US-generic.',
      'All-in at $19/month vs $175+/month for LinkedIn Premium + Resume.io + Interviewing.io combined.',
    ],
  },
  {
    q: 'Is my resume data safe with you?',
    points: [
      'AES-256 encryption at rest, TLS 1.3 in transit — your resume is encrypted from the moment it lands.',
      'We never sell or share your data with recruiters, job boards, or any third party. Your data powers only your own modules.',
      'Delete anytime: request full deletion from account settings, processed within 24 hours and purged from backups within 30 days.',
      'PDPA compliant (Singapore) with GDPR compliance planned for our European expansion.',
    ],
  },
  {
    q: 'How is this different from just using ChatGPT?',
    points: [
      'ChatGPT has no memory of your resume, target role, or salary data — you re-explain yourself every session.',
      'CareerAiHub has structured modules purpose-built for hiring: ATS scoring, STAR frameworks, live salary benchmarks.',
      'We pull live Singapore job data and salary ranges — ChatGPT cannot access real-time market intelligence.',
      'Readiness Certificate and blockchain-verifiable credentials are not possible through a generic chat interface.',
    ],
  },
  {
    q: 'What happens after the free tier?',
    points: [
      'Free tier never expires: job search, market intelligence, and 1–2 uses per module stay free forever.',
      'Premium at $19/month unlocks unlimited use of all 10 tools with full AI memory — cancel anytime.',
      'Pro Get Ready adds the AI-built study plan and Readiness Certificate for interview-ready candidates.',
      '7-day free trial on all paid plans — no credit card required to start the trial.',
    ],
  },
];

function DataProtectedSection({ onPrivacy, onTerms }) {
  return (
    <section className="section lp-trust-section" id="trust">
      <div className="reveal">
        <div className="ey">Your data, protected</div>
        <h2 className="sh">Your resume is yours. Always.</h2>
        <p className="ss" style={{ marginBottom: 32 }}>We know you're uploading something personal. Here's exactly how we handle it.</p>
      </div>
      <div className="lp-trust-grid reveal d1">
        <div className="lp-trust-item">
          <div className="lp-trust-icon">🔒</div>
          <div className="lp-trust-title">Encrypted in transit and at rest</div>
          <div className="lp-trust-desc">Your resume is encrypted with AES-256 the moment it's uploaded. It travels over TLS 1.3 and is stored in encrypted form. Only you can access it.</div>
        </div>
        <div className="lp-trust-item">
          <div className="lp-trust-icon">🚫</div>
          <div className="lp-trust-title">Never sold. Never shared.</div>
          <div className="lp-trust-desc">We do not sell your data to recruiters, job boards, or third parties. Ever. Your resume is used only to power your own CareerAiHub modules — nothing else.</div>
        </div>
        <div className="lp-trust-item">
          <div className="lp-trust-icon">🗑️</div>
          <div className="lp-trust-title">Delete anytime</div>
          <div className="lp-trust-desc">Delete your resume, profile, and all data from account settings at any time. We process deletion within 24 hours and purge backups within 30 days.</div>
        </div>
        <div className="lp-trust-item">
          <div className="lp-trust-icon">🇸🇬</div>
          <div className="lp-trust-title">PDPA compliant · Singapore</div>
          <div className="lp-trust-desc">CareerAiHub is built to comply with Singapore's Personal Data Protection Act (PDPA). GDPR compliance planned for our European expansion.</div>
        </div>
      </div>
      <div className="lp-trust-links reveal d2">
        <button className="lp-trust-link" onClick={onPrivacy}>Privacy Policy ↗</button>
        <button className="lp-trust-link" onClick={onTerms}>Terms of Service ↗</button>
        <button className="lp-trust-link" onClick={() => fnRef.current.openLegal?.('security')}>Security Statement ↗</button>
        <button className="lp-trust-link" onClick={() => fnRef.current.openLegal?.('deletion')}>Data Deletion Request ↗</button>
      </div>
    </section>
  );
}

// ── GROWTH SECTION ────────────────────────────────────────────────────────────

function GrowthSection({ onJoin }) {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const copyRef = () => {
    navigator.clipboard?.writeText('careeraihub.com/ref/your-code').catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendGuide = () => {
    if (!email) return;
    setSent(true);
  };

  return (
    <section className="section alt lp-growth-section" id="growth">
      <div className="lp-growth-inner">
        <div className="reveal">
          <div className="ey">Refer a friend</div>
          <h2 className="sh" style={{ maxWidth: 380 }}>Give a friend a free ATS scan. Get one extra scan yourself.</h2>
          <p className="ss" style={{ marginBottom: 24 }}>Know someone in a job search? Share your referral link. When they complete their first scan, you both get a bonus free session.</p>
          <div className="lp-referral-box">
            <div className="lp-referral-link">careeraihub.com/ref/your-code</div>
            <button className="lp-referral-copy" onClick={copyRef}>{copied ? 'Copied!' : 'Copy link'}</button>
          </div>
          <div className="lp-referral-share">
            <button className="lp-ref-share-btn">Share on LinkedIn</button>
            <button className="lp-ref-share-btn">Share on Telegram</button>
          </div>
        </div>
        <div className="reveal d1">
          <div className="ey">Free resource</div>
          <h2 className="sh" style={{ maxWidth: 380 }}>Get the free guide: 7 resume mistakes that cost you interviews.</h2>
          <p className="ss" style={{ marginBottom: 20 }}>Downloaded by 500+ job seekers. Covers the ATS filters most candidates never know about.</p>
          {!sent ? (
            <>
              <div className="lp-lead-form">
                <input
                  className="lp-lead-input"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendGuide()}
                />
                <button className="lp-lead-btn" onClick={sendGuide}>Send me the guide →</button>
              </div>
              <div className="lp-lead-note">No spam. Unsubscribe anytime. PDPA compliant.</div>
            </>
          ) : (
            <div style={{ padding: '14px 18px', background: 'var(--lp-teal-dim)', border: '1px solid var(--lp-teal-b)', borderRadius: 'var(--lp-r)', fontSize: 13, color: 'var(--lp-teal)' }}>
              ✓ Guide sent! Check your inbox.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── HOW IT WORKS ─────────────────────────────────────────────────────────────

const HIW_STEPS = [
  { num:'01', tag:'Free', tagCls:'free', title:'Drop your resume', desc:'CareerAiHub reads your work history once and builds a persistent AI memory — every module knows your story instantly.', bullets: FEAT_DATA[11].bullets, outcome:'AI memory activated — all modules know your background', dotColor:'var(--lp-teal)' },
  { num:'02', tag:'Free · 1 scan', tagCls:'free', title:'Get your ATS score', desc:"Paste any job description. See your exact match %, missing keywords, and what to fix — before a recruiter sees your name.", bullets: FEAT_DATA[1].bullets, outcome:'Most users jump 20+ ATS points in a single session', dotColor:'var(--lp-teal)' },
  { num:'03', tag:'Free', tagCls:'free', title:'Apply in 5 minutes', desc:'AI memory powers a tailored application. Search 20+ live job boards. One-click apply with ATS score already checked.', bullets: FEAT_DATA[0].bullets, outcome:'329 open roles in Singapore · AI-ranked for you', dotColor:'var(--lp-teal)' },
  { num:'04', tag:'Premium', tagCls:'premium', title:'AI mock interviews', desc:'Practice with an AI that knows your resume and target role. Scored on clarity, STAR structure, and relevance.', bullets: FEAT_DATA[5].bullets, outcome:'Battle-ready before the real call', dotColor:'var(--lp-violet)' },
  { num:'05', tag:'Pro', tagCls:'pro', title:'Get Ready readiness plan', desc:'Scored across 5 interview dimensions. AI builds your personalized study plan targeting weakest areas first.', bullets: FEAT_DATA[9].bullets, outcome:'Hit 80/100 to earn a shareable Readiness Certificate', dotColor:'var(--lp-violet)' },
  { num:'06', tag:'Premium', tagCls:'premium', title:'Negotiate with market data', desc:'Live salary benchmarks for your exact role and level. Practice your counter-offer with AI — scripts, pushback simulations, data-backed anchoring.', bullets: FEAT_DATA[6].bullets, outcome:'Users average +$8K first-year comp', dotColor:'var(--lp-violet)' },
];

function HowItWorksSection({ onJoin, onSampleReport }) {
  const [expanded, setExpanded] = useState(null);
  const ss = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const isPremium = (s) => s.tagCls !== 'free';
  return (
    <section className="section lp-hiw-section" id="how-it-works">
      <div className="reveal">
        <div className="ey">How it works</div>
        <h2 className="sh" style={{whiteSpace:'nowrap'}}>Six steps. <span style={{background:'var(--lp-grad-primary)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>Zero guesswork.</span></h2>
        <p className="ss" style={{ marginBottom: 24 }}>From first upload to signed offer. Every step builds on the last.</p>
      </div>

      <div className="lp-hiw6-grid reveal d2">
        {HIW_STEPS.map((s, i) => (
          <div key={i} className={`lp-hiw6-step${isPremium(s) ? ' premium' : ''}`}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <span className={`lp-hiw6-tag ${s.tagCls}`}>{s.tag}</span>
            </div>
            <div className="lp-hiw6-step-title">{s.title}</div>
            <div className="lp-hiw6-step-desc">{s.desc}</div>
            <button
              className="lp-hiw6-toggle"
              onClick={() => setExpanded(expanded === i ? null : i)}
              aria-expanded={expanded === i}
            >
              {expanded === i ? 'Less detail ▲' : 'Show detail ▼'}
            </button>
            {expanded === i && (
              <ul className="lp-hiw6-bullets" style={{ marginTop:8 }}>
                {s.bullets.map((b, j) => <li key={j} className="lp-hiw6-bullet"><span className="lp-hiw6-bdot" />{b}</li>)}
              </ul>
            )}
            <div className="lp-hiw6-outcome" style={{ marginTop: expanded === i ? 10 : 8 }}>
              <span className="lp-hiw6-dot" style={{ background: s.dotColor, animation:'lp-pulse 2s infinite' }} />
              {s.outcome}
            </div>
          </div>
        ))}
      </div>

      <div className="lp-hiw6-divider reveal d2">
        <div style={{flex:1,height:1,background:'linear-gradient(90deg,transparent,rgba(245,158,11,.3))'}}/>
        <button onClick={() => ss('price-sec')} className="lp-hiw6-plans-btn">See pricing plans</button>
        <div style={{flex:1,height:1,background:'linear-gradient(90deg,rgba(245,158,11,.3),transparent)'}}/>
      </div>

      <div className="lp-hiw-sample reveal d2">
        <button className="lp-hiw-sample-btn" onClick={onSampleReport}>See a sample ATS report →</button>
        <span className="lp-hiw-sample-note">No signup · Opens in 2 seconds</span>
      </div>
    </section>
  );
}

// ── PRICING ───────────────────────────────────────────────────────────────────

function PricingSection({ onJoin, onGetReady }) {
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
          <div className="pc-note">No credit card · always free</div>
          <ul className="pc-feats">
            <li className="pcf"><span className="ck">✓</span>1 resume ATS scan</li>
            <li className="pcf"><span className="ck">✓</span>1–2 free uses per module</li>
            <li className="pcf"><span className="ck">✓</span>Job search — always free</li>
            <li className="pcf"><span className="ck">✓</span>Market intelligence — always free</li>
          </ul>
          <button className="pbtn" onClick={onJoin}>Start free — no card →</button>
        </article>

        <article className="pcard hot">
          <h3 className="pc-name">Premium · Pro</h3>
          <div className="pc-price">$22.99<span>/month</span></div>
          <div className="pc-note">$219/year · saves 20% · interview-ready in 9 days</div>
          <ul className="pc-feats">
            <li className="pcf"><span className="ck">✓</span>Unlimited resume scans + full editor</li>
            <li className="pcf"><span className="ck">✓</span>Unlimited Mock Interviews + HM Simulator</li>
            <li className="pcf"><span className="ck">✓</span>Unlimited Salary Coaching + negotiation</li>
            <li className="pcf"><span className="ck">✓</span>Full AI memory across all 10 modules</li>
            <li className="pcf"><span className="ck">✓</span>Unlimited JD analyzer + STAR builder</li>
            <li className="pcf"><span className="ck">✓</span>Unlimited Cover Letter generation</li>
            <li className="pcf"><span className="ck">✓</span><strong style={{ color: 'var(--lp-teal)' }}>Get Ready plan</strong> — AI-built from your scores + weak spots</li>
            <li className="pcf"><span className="ck">✓</span>Adaptive plan re-scored every 7 days as you improve</li>
            <li className="pcf"><span className="ck">✓</span><strong style={{ color: 'var(--lp-teal)' }}>Readiness Certificate</strong> — shareable with employers at 80+</li>
          </ul>
          <button className="pbtn pri" onClick={onGetReady}>Open Get Ready ✦</button>
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: 'var(--lp-text3)' }}>7-day free trial · cancel anytime</div>
        </article>

        <article className="pcard">
          <h3 className="pc-name">Recruiter</h3>
          <div className="pc-price">SGD 299<span>/mo</span></div>
          <div className="pc-note">Enterprise from SGD 1,500/mo</div>
          <ul className="pc-feats">
            <li className="pcf"><span className="ck">✓</span>Verified candidate pipeline</li>
            <li className="pcf"><span className="ck">✓</span>AI match shortlisting</li>
            <li className="pcf"><span className="ck">✓</span>TrustChat + credential sidebar</li>
            <li className="pcf"><span className="ck">✓</span>Recruiter Dashboard + analytics</li>
            <li className="pcf"><span className="ck">✓</span>10–20× ROI vs headhunter fees</li>
          </ul>
          <button className="pbtn" onClick={onJoin}>Request pilot →</button>
        </article>
      </div>

      <div className="reveal d2" style={{ marginTop: 22, background: 'linear-gradient(135deg,rgba(236,72,153,.06) 0%,rgba(245,158,11,.05) 100%)', border: '1px solid var(--lp-teal-b)', borderRadius: 'var(--lp-rl)', padding: '22px 28px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--lp-teal)', marginBottom: 6 }}>Included in Premium · Pro — Get Ready</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--lp-text)', marginBottom: 6, lineHeight: 1.3 }}>Interview-ready in 9 days.<br />AI builds your plan from your exact weaknesses.</div>
          <div style={{ fontSize: 12, color: 'var(--lp-text2)', lineHeight: 1.7 }}>After your mock interview, the AI scores you across 5 dimensions. It then creates a session-by-session study plan targeting your weakest areas first — and re-scores your plan every 7 days as you improve. When you hit 80+ on all dimensions, you earn a shareable Readiness Certificate.</div>
        </div>
        <button className="pbtn pri" style={{ width: 'auto', padding: '12px 28px', whiteSpace: 'nowrap', flexShrink: 0 }} onClick={onGetReady}>See Get Ready demo ✦</button>
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
    ['Get Ready — interview readiness plan', '✓ Pro only', '—', '—', '—'],
    ['Readiness Certificate at 80+ score', '✓ Pro only', '—', '—', '—'],
    ['AI memory across all modules', '✓ Live', '—', '—', '—'],
    ['Blockchain credential verification', '◎ Roadmap', '—', '—', '—'],
    ['Monthly price', '$24.99/mo', '$40/mo', '$25/mo', '$40/mo'],
  ];
  return (
    <section className="section" id="compare-sec">
      <div className="reveal">
        <div className="ey">CareerAiHub vs alternatives</div>
        <h2 className="sh">$24.99/month vs $175+. One platform vs five.</h2>
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

// ── WHY CAREERAIHUB (merged FAQ + trust Q&A) ─────────────────────────────────

const WHY_DATA = [
  ...FAQ_DATA.map(f => ({ q: f.q, body: f.a, type: 'text' })),
  ...TRUST_QA.map(t => ({ q: t.q, body: t.points, type: 'bullets' })),
];

function WhyCareerAiHubSection() {
  const [open, setOpen] = useState(null);
  return (
    <section className="section alt" id="faq-sec">
      <div className="reveal">
        <div className="ey">Why CareerAiHub</div>
        <h2 className="sh">Everything you need to know.</h2>
        <p className="ss" style={{ marginBottom: 26 }}>Common questions about CareerAiHub — the AI career platform built for Singapore job seekers.</p>
      </div>
      <div className="reveal d1 faq-list">
        {WHY_DATA.map((item, i) => (
          <div key={i} className="faq-item">
            <button className={`faq-q${open === i ? ' open' : ''}`} onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              {item.q}<span className="faq-ch">▼</span>
            </button>
            <div className={`faq-a${open === i ? ' open' : ''}`} style={{ maxHeight: open === i ? 600 : 0 }}>
              {item.type === 'bullets'
                ? <ul className="faq-a-in" style={{ paddingLeft: 0, margin: 0 }}>
                    {item.body.map((pt, j) => (
                      <li key={j} style={{ listStyle: 'none', display: 'flex', gap: 8, marginBottom: 6, fontSize: 13, color: 'var(--lp-text2)', lineHeight: 1.7 }}>
                        <span style={{ color: 'var(--lp-teal)', marginTop: 5, flexShrink: 0, fontSize: 6 }}>●</span>{pt}
                      </li>
                    ))}
                  </ul>
                : <div className="faq-a-in">{item.body}</div>
              }
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── FOOTER ────────────────────────────────────────────────────────────────────

function FooterSection({ onJoin, onPrivacy, onTerms }) {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="fb"><LogoMark size={22} /><span className="lp-wordmark">career<span className="lp-wordmark-ai">ai</span>hub</span></div>
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
          <button style={{background:'none',border:'none',color:'inherit',cursor:'pointer',padding:0,fontSize:'inherit',fontFamily:'inherit',textAlign:'left'}} onClick={onPrivacy}>Privacy Policy</button>
          <button style={{background:'none',border:'none',color:'inherit',cursor:'pointer',padding:0,fontSize:'inherit',fontFamily:'inherit',textAlign:'left'}} onClick={onTerms}>Terms of Service</button>
          <a href="/sitemap.xml">Sitemap</a>
        </nav>
      </div>
      <div className="fbot">
        <span>© 2026 CareerAiHub Pte. Ltd. · Singapore</span>
        <div className="fbot-links">
          <button style={{background:'none',border:'none',color:'inherit',cursor:'pointer',fontFamily:'inherit',fontSize:'inherit'}} onClick={onPrivacy}>Privacy</button>
          <button style={{background:'none',border:'none',color:'inherit',cursor:'pointer',fontFamily:'inherit',fontSize:'inherit'}} onClick={onTerms}>Terms</button>
        </div>
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
            <LogoMark size={20} /><span className="lp-wordmark">career<span className="lp-wordmark-ai">ai</span>hub</span>
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

// ── COVER LETTERS MODAL ───────────────────────────────────────────────────────

const SAMPLE_LETTERS = [
  {
    role: 'Senior Product Manager',
    company: 'Grab',
    preview: `Dear Hiring Team,\n\nI'm applying for the Senior PM role at Grab. In my previous role at Shopee, I led the checkout redesign that reduced abandonment by 34% and recovered SGD 2.1M in GMV within one quarter — directly aligned with Grab's focus on conversion and retention.\n\nI'd welcome the opportunity to bring that same rigour to Grab's payments and super-app experience.\n\nBest,\nAman Ashwin`,
    score: 91,
    status: 'Ready to send',
    statusColor: '#10B981',
  },
  {
    role: 'Head of Product',
    company: 'Carousell',
    preview: `Dear Hiring Team,\n\nYour recent expansion into financial services caught my attention — it maps closely to work I led at Shopee scaling cross-border payments across SEA. I drove a 3x increase in payment method coverage while reducing failed transaction rates by 18%.\n\nCarousell's trajectory from marketplace to fintech is exactly the kind of 0→1 challenge I thrive in.\n\nBest,\nAman Ashwin`,
    score: 87,
    status: 'Needs tailoring',
    statusColor: '#F59E0B',
  },
  {
    role: 'Product Lead, Growth',
    company: 'Stripe',
    preview: `Dear Hiring Team,\n\nStripe's developer-first philosophy resonates deeply — I've spent the past 4 years building products that make complex financial infrastructure invisible to end users. My work at Shopee reduced integration time for new payment partners from 6 weeks to 8 days through a self-serve API layer.\n\nI'd love to bring that mindset to Stripe's expansion in Southeast Asia.\n\nBest,\nAman Ashwin`,
    score: 83,
    status: 'Needs tailoring',
    statusColor: '#F59E0B',
  },
];

function CoverLetterModal({ onClose }) {
  const [active, setActive] = useState(0);
  const letter = SAMPLE_LETTERS[active];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div style={{ background: '#0F1219', border: '1px solid rgba(236,72,153,0.3)', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ color: '#EC4899', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Agentic Job Search</div>
            <div style={{ color: '#EDF1F8', fontWeight: 800, fontSize: 16 }}>Drafted Cover Letters · 3 matches found</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#8896AD', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {SAMPLE_LETTERS.map((l, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{
                flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer', background: active === i ? 'rgba(236,72,153,0.09)' : 'transparent',
                borderBottom: active === i ? '2px solid #EC4899' : '2px solid transparent',
                color: active === i ? '#EDF1F8' : '#8896AD', fontSize: 12, fontWeight: active === i ? 700 : 500,
                transition: 'all 0.18s', fontFamily: 'inherit', textAlign: 'center', lineHeight: 1.4
              }}
            >
              <div>{l.company}</div>
              <div style={{ fontSize: 10, marginTop: 2, color: active === i ? '#8896AD' : '#4F5C6E' }}>{l.role}</div>
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#EDF1F8' }}>{letter.role} · {letter.company}</div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: letter.statusColor + '18', color: letter.statusColor, border: `1px solid ${letter.statusColor}33` }}>{letter.status}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#EC4899', fontFamily: 'monospace' }}>ATS {letter.score}%</div>
            </div>
          </div>

          <div style={{ background: '#141A24', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '20px 22px', fontSize: 13, color: '#8896AD', lineHeight: 1.85, whiteSpace: 'pre-line', fontFamily: 'inherit' }}>
            {letter.preview}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button style={{ flex: 1, padding: '11px', background: '#EC4899', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Use This Letter →
          </button>
          <button onClick={onClose} style={{ padding: '11px 18px', background: 'transparent', color: '#8896AD', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── GET READY TAB DEFINITIONS ─────────────────────────────────────────────────

const GR_TABS_DEF = [
  { k: 'dashboard', label: 'Dashboard',       icon: '📊' },
  { k: 'modules',   label: 'Study Modules',   icon: '📚' },
  { k: 'radar',     label: 'Weakness Radar',  icon: '📡', moduleId: 'radar',  fi: 8  },
  { k: 'star',      label: 'STAR Builder',    icon: '⭐', moduleId: 'star',   fi: 4  },
  { k: 'score',     label: 'Readiness Score', icon: '🏆', moduleId: 'score',  fi: 9  },
  { k: 'memory',    label: 'AI Memory',       icon: '🧬', moduleId: 'memory', fi: 11 },
];

// ── GET READY TAB STRIP (used inside each Get Ready feature in the app) ───────

export function GetReadyTabStrip({ activeModuleId, onNavigate, onStudyPlan }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 20px', background:'rgba(236,72,153,.04)', borderBottom:'1px solid rgba(236,72,153,.1)', fontFamily:'var(--lp-ff)', overflowX:'auto', flexWrap:'nowrap', scrollbarWidth:'none' }}>
      <span style={{ fontSize:11, fontWeight:800, color:'var(--lp-teal)', textTransform:'uppercase', letterSpacing:'.12em', flexShrink:0, marginRight:6, whiteSpace:'nowrap' }}>✦ GET READY</span>
      <div style={{ width:1, height:16, background:'rgba(236,72,153,.15)', flexShrink:0, marginRight:2 }} />
      {GR_TABS_DEF.map(t => {
        const isActive = t.moduleId && t.moduleId === activeModuleId;
        return (
          <button
            key={t.k}
            style={{ padding:'4px 12px', borderRadius:6, fontSize:12, fontWeight:600, color: isActive ? 'var(--lp-teal)' : 'var(--lp-text2)', background: isActive ? 'var(--lp-teal-dim)' : 'transparent', border:`1px solid ${isActive ? 'var(--lp-teal-b)' : 'transparent'}`, cursor:'pointer', transition:'all .15s', fontFamily:'var(--lp-ff)', whiteSpace:'nowrap', flexShrink:0 }}
            onClick={() => t.moduleId ? onNavigate(t.moduleId) : onStudyPlan(t.k)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── STUDY PLAN MODAL ─────────────────────────────────────────────────────────

export function StudyPlanModal({ onClose, initialTab = 'dashboard', onModuleSelect }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <div className="lp-modal-overlay" onClick={onClose}>
      <div className="lp-sp-modal" style={{ maxWidth: 780 }} onClick={e => e.stopPropagation()}>
        <div className="lp-modal-hd">
          <div className="lp-modal-title">
            ✅ Get Ready
            <span className="lp-sp-modal-badge">Interview Readiness · Pro</span>
          </div>
          <button className="lp-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="lp-modal-body">
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
            {GR_TABS_DEF.map(t => (
              <button key={t.k} className={`lp-sp-tab${tab === t.k ? ' on' : ''}`} onClick={() => setTab(t.k)}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'dashboard' && (
            <div>
              <div className="lp-sp-score-strip">
                {[{n:38,l:'Concrete examples',c:'#FF4D6A'},{n:44,l:'STAR structure',c:'#FFD233'},{n:72,l:'Clarity',c:'#00E5A0'},{n:84,l:'Role knowledge',c:'#00E5A0'},{n:'61/100',l:'Overall readiness',c:'var(--lp-teal)',sm:true}].map((s,i)=>(
                  <div key={i} className="lp-sp-sc">
                    <div className="lp-sp-sc-num" style={{color:s.c,fontSize:s.sm?18:undefined}}>{s.n}</div>
                    <div className="lp-sp-sc-lbl">{s.l}</div>
                  </div>
                ))}
              </div>
              <div className="lp-sp-coach">
                <div className="lp-sp-coach-av">AI</div>
                <div className="lp-sp-coach-text"><strong>Based on your last 2 sessions,</strong> your biggest gap is concrete examples — you score 38/100. You describe situations generally without naming outcomes, numbers, or impact. Your readiness plan targets this first. Once you clear 70, we move to STAR structure. <strong>Estimated time to interview-ready: 9 days.</strong></div>
              </div>
              <div className="lp-sp-next">
                <div>
                  <div className="lp-sp-next-lbl">Recommended next · start now</div>
                  <div className="lp-sp-next-title">Concrete examples drill — behavioral questions</div>
                  <div className="lp-sp-next-meta">20 min · targets your weakest dimension · session 1 of 3</div>
                </div>
                <button className="lp-sp-start-btn" onClick={onClose}>Start session →</button>
              </div>
              <div className="lp-sp-section-lbl">Your readiness plan</div>
              <div className="lp-sp-mod-grid">
                {[
                  {title:'Concrete examples',badge:'Weakest',bc:'weak',pct:38,bg:'#FF4D6A',desc:'Anchor every answer with a specific number, outcome, or named result.',sessions:'3 sessions · unlocked · start today',active:true},
                  {title:'STAR structure',badge:'Gap',bc:'weak',pct:44,bg:'#FFD233',desc:'Situation · Task · Action · Result — every behavioral answer follows this arc.',sessions:'2 sessions · unlocks after concrete examples clears 70'},
                  {title:'Clarity + delivery',badge:'Good',bc:'ok',pct:72,bg:'#00E5A0',desc:'Maintenance sessions only — 1 drill/week to hold your score above 70.',sessions:'1 maintenance session/week'},
                  {title:'Salary negotiation roleplay',badge:'Locked',bc:'locked',pct:0,bg:'var(--lp-bdr)',desc:'Live AI roleplay · market data · pre-built scripts. Unlocks at readiness 75+.',sessions:'Unlocks when readiness reaches 75',locked:true},
                ].map((m,i)=>(
                  <div key={i} className={`lp-sp-mod${m.active?' sp-active':''}${m.locked?' sp-locked':''}`}>
                    <div className="lp-sp-mod-hd">
                      <span className="lp-sp-mod-title">{m.title}</span>
                      <span className={`lp-sp-mod-badge sp-badge-${m.bc}`}>{m.badge}</span>
                    </div>
                    <div className="lp-sp-bar-bg"><div className="lp-sp-bar" style={{width:m.pct+'%',background:m.bg}}/></div>
                    <div className="lp-sp-mod-desc">{m.desc}</div>
                    <div className="lp-sp-mod-sessions">{m.sessions}</div>
                  </div>
                ))}
              </div>
              <div className="lp-sp-upgrade-strip">
                <div className="lp-sp-upgrade-text"><strong>Get Ready · Pro — $24.99/month</strong> · This plan re-scores every 7 days. Once you hit 80+ on all 5 dimensions, we generate your shareable Readiness Certificate.</div>
                <button className="lp-sp-upgrade-btn" onClick={onClose}>Upgrade to Pro ✦</button>
              </div>
            </div>
          )}

          {tab === 'modules' && (
            <div>
              <div className="lp-sp-section-lbl">Get Ready modules — AI-sequenced for you</div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[
                  {n:'1',title:'Concrete examples drill',badge:'Active — session 1/3',bc:'weak',pct:38,bg:'#FF4D6A',desc:"You'll practice 6 behavioral questions. For each, AI coaches you to replace vague language with a specific number, outcome, or named result. Score must reach 70 before module 2 unlocks.",active:true},
                  {n:'2',title:'STAR structure mastery',badge:'Unlocks after module 1',bc:'',pct:44,bg:'#FFD233',desc:'2-session deep dive on Situation, Task, Action, Result framing. AI gives real-time feedback on each section of your answer.'},
                  {n:'3',title:'Clarity + filler word reduction',badge:'Maintenance',bc:'ok',pct:72,bg:'#00E5A0',desc:'You\'re already strong here. 1 drill per week keeps you above 70. AI tracks "um", "like", and hedging language across every session.'},
                  {n:'4',title:'Salary negotiation roleplay',badge:'Premium · locked',bc:'locked',pct:0,bg:'var(--lp-bdr)',desc:'AI plays the hiring manager. Practice counter-offer language with live Singapore market data for your target role. Most users gain SGD 800–1,200/month after 3 sessions.',locked:true},
                  {n:'5',title:'Weakness framing',badge:'Premium · locked',bc:'locked',pct:0,bg:'var(--lp-bdr)',desc:'The most-failed question type. Pre-built frameworks, AI scores your framing, practice until it sounds natural — not rehearsed.',locked:true},
                ].map((m,i)=>(
                  <div key={i} className={`lp-sp-mod${m.active?' sp-active':''}${m.locked?' sp-locked':''}`} style={{borderRadius:'var(--lp-r)'}}>
                    <div className="lp-sp-mod-hd">
                      <span className="lp-sp-mod-title">{m.n} · {m.title}</span>
                      <span className={`lp-sp-mod-badge${m.bc?' sp-badge-'+m.bc:''}`} style={!m.bc?{background:'var(--lp-bg5)',color:'var(--lp-text3)'}:{}}>{m.badge}</span>
                    </div>
                    <div className="lp-sp-bar-bg"><div className="lp-sp-bar" style={{width:m.pct+'%',background:m.bg}}/></div>
                    <div className="lp-sp-mod-desc">{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {['radar','star','score','memory'].includes(tab) && (() => {
            const tDef = GR_TABS_DEF.find(t => t.k === tab);
            const f = FEAT_DATA[tDef.fi];
            return (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lp-teal)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>{f.ey}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--lp-text)', marginBottom: 8, letterSpacing: '-.3px' }}>{f.title}</div>
                  <p style={{ fontSize: 13, color: 'var(--lp-text2)', lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
                </div>
                <div className="lp" style={{ background: 'transparent', minHeight: 'unset', overflow: 'visible' }}>
                  <div style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 'var(--lp-r)', padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lp-text3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>{f.previewHd}</div>
                    <div dangerouslySetInnerHTML={{ __html: f.preview }} />
                  </div>
                </div>
                <ul style={{ margin: '0 0 20px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {f.bullets.map((b, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--lp-text2)', lineHeight: 1.55 }}>
                      <span style={{ color: 'var(--lp-teal)', flexShrink: 0, marginTop: 1 }}>✓</span>{b}
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {onModuleSelect ? (
                    <button className="lp-sp-start-btn" onClick={() => { onModuleSelect(tab); onClose(); }}>
                      Open {f.label} →
                    </button>
                  ) : (
                    <button className="lp-sp-upgrade-btn">Upgrade to Pro — $24.99/mo ✦</button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ── SAMPLE REPORT MODAL ───────────────────────────────────────────────────────

function SampleReportModal({ onClose }) {
  return (
    <div className="lp-modal-overlay" onClick={onClose}>
      <div className="lp-modal-box" onClick={e => e.stopPropagation()}>
        <div className="lp-modal-hd">
          <div className="lp-modal-title">Sample ATS Report — Senior Product Manager</div>
          <button className="lp-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="lp-modal-body">
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'var(--lp-amber-dim)',border:'1px solid var(--lp-amber-b)',borderRadius:'var(--lp-rs)',marginBottom:20,fontSize:11,color:'var(--lp-amber)'}}>
            <span>👁</span><strong>Demo mode</strong> — real analysis from an anonymised beta user. Your report will be personalised to your actual resume.
          </div>
          <div style={{display:'flex',alignItems:'center',gap:16,padding:16,background:'var(--lp-bg3)',borderRadius:'var(--lp-r)',border:'1px solid var(--lp-bdr)',marginBottom:16}}>
            <div style={{textAlign:'center',flexShrink:0}}>
              <div style={{fontSize:44,fontWeight:800,color:'var(--lp-amber)',fontFamily:'var(--lp-ffm)',letterSpacing:-1.5,lineHeight:1}}>74%</div>
              <div style={{fontSize:10,color:'var(--lp-text3)',marginTop:3}}>ATS Match</div>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--lp-amber)',marginBottom:6}}>3 gaps found — fixing them could push to 91%+</div>
              <div style={{height:6,borderRadius:3,background:'var(--lp-bg4)',overflow:'hidden',marginBottom:8}}><div style={{width:'74%',height:'100%',background:'var(--lp-amber)',borderRadius:3}}/></div>
              <div style={{fontSize:11,color:'var(--lp-text2)'}}>Passing 5 of 8 ATS filters. Three critical keywords missing.</div>
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--lp-text3)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:10}}>Findings — grouped by severity</div>
            <div style={{padding:'12px 14px',background:'var(--lp-red-dim)',border:'1px solid rgba(255,107,107,.2)',borderRadius:'var(--lp-rs)',marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--lp-red)',marginBottom:5}}>High — Missing critical keywords</div>
              <div style={{fontSize:12,color:'var(--lp-text2)',marginBottom:8}}>These appear in 78% of Senior PM job descriptions but are absent from this resume.</div>
              <div><span className="mk-tag x">OKR framework</span><span className="mk-tag x">go-to-market</span></div>
            </div>
            <div style={{padding:'12px 14px',background:'var(--lp-amber-dim)',border:'1px solid var(--lp-amber-b)',borderRadius:'var(--lp-rs)',marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--lp-amber)',marginBottom:5}}>Medium — Weak impact language</div>
              <div style={{fontSize:12,color:'var(--lp-text2)'}}>3 bullets use passive voice. ATS and recruiters favour active, quantified verbs.</div>
            </div>
            <div style={{padding:'12px 14px',background:'var(--lp-teal-dim)',border:'1px solid var(--lp-teal-b)',borderRadius:'var(--lp-rs)'}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--lp-teal)',marginBottom:5}}>Passing — Strong keywords found</div>
              <div><span className="mk-tag m">product strategy</span><span className="mk-tag m">roadmap</span><span className="mk-tag m">agile</span><span className="mk-tag m">data-driven</span></div>
            </div>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--lp-text3)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>Before → After — one bullet rewritten</div>
            <div className="lp-ats-diff-row">
              <div className="lp-ats-diff-panel before"><div className="lp-ats-diff-lbl">Before</div><div className="lp-ats-diff-text">Helped drive product roadmap for checkout feature, working with engineering team.</div></div>
              <div className="lp-ats-diff-arrow">→</div>
              <div className="lp-ats-diff-panel after"><div className="lp-ats-diff-lbl">After</div><div className="lp-ats-diff-text">Spearheaded go-to-market strategy for checkout redesign, applying OKR framework to reduce abandonment 34% with 8-person engineering team.</div></div>
            </div>
          </div>
          <div style={{padding:16,background:'var(--lp-teal-dim)',border:'1px solid var(--lp-teal-b)',borderRadius:'var(--lp-r)'}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--lp-teal)',marginBottom:4}}>Your real report is personalised to your resume and target role.</div>
            <div style={{fontSize:12,color:'var(--lp-text2)',marginBottom:14}}>Paste your resume snippet above to see your actual ATS score, specific gaps, and line-by-line rewrites.</div>
            <button className="lp-sp-start-btn" onClick={onClose}>Get my real score — free</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PRIVACY MODAL ─────────────────────────────────────────────────────────────

function PrivacyModal({ onClose }) {
  return (
    <div className="lp-modal-overlay" onClick={onClose}>
      <div className="lp-modal-box" onClick={e => e.stopPropagation()}>
        <div className="lp-modal-hd">
          <div className="lp-modal-title">Privacy Policy — CareerAiHub</div>
          <button className="lp-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="lp-modal-body">
          <div className="lp-legal-content">
            <p style={{fontSize:11,color:'var(--lp-text3)',marginBottom:16}}>Last updated: April 2026 · CareerAiHub Pte. Ltd. · Singapore</p>
            <h3>1. What data we collect</h3>
            <p>We collect your resume file (PDF or DOCX), your email address when you create an account, and your usage data within the platform (modules used, scores generated, sessions completed). We do not collect payment card data directly — this is handled by our payment processor.</p>
            <h3>2. How we use your data</h3>
            <p>Your resume is used solely to power your CareerAiHub modules — ATS scoring, cover letter generation, interview coaching, and salary benchmarking. It is never shared with recruiters, employers, or third-party advertisers without your explicit consent.</p>
            <h3>3. Data storage and security</h3>
            <p>All data is encrypted at rest (AES-256) and in transit (TLS 1.3). Your resume is stored on secure cloud infrastructure in Singapore. We conduct regular security audits and access is restricted to essential engineering staff only.</p>
            <h3>4. Your rights (PDPA)</h3>
            <ul>
              <li>Access your personal data at any time from your account settings</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data — processed within 24 hours</li>
              <li>Withdraw consent for data processing at any time</li>
            </ul>
            <h3>5. Cookies</h3>
            <p>We use essential cookies for session management and optional analytics cookies (Google Analytics 4) to understand platform usage. You can decline optional cookies via the consent banner.</p>
            <h3>6. Contact</h3>
            <p>For any privacy questions: privacy@careeraihub.com · CareerAiHub Pte. Ltd. · Singapore</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TERMS OF SERVICE MODAL ────────────────────────────────────────────────────

function ToSModal({ onClose }) {
  return (
    <div className="lp-modal-overlay" onClick={onClose}>
      <div className="lp-modal-box" onClick={e => e.stopPropagation()}>
        <div className="lp-modal-hd">
          <div className="lp-modal-title">Terms of Service — CareerAiHub</div>
          <button className="lp-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="lp-modal-body">
          <div className="lp-legal-content">
            <p style={{fontSize:11,color:'var(--lp-text3)',marginBottom:16}}>Last updated: April 2026 · CareerAiHub Pte. Ltd. · Singapore</p>
            <h3>1. Acceptance of terms</h3>
            <p>By using CareerAiHub, you agree to these Terms of Service. If you do not agree, please do not use the platform.</p>
            <h3>2. Service description</h3>
            <p>CareerAiHub provides AI-powered career tools including resume scanning, ATS scoring, mock interview coaching, salary benchmarking, and related services. Features marked "Building next" or "Planned" are roadmap items and not currently available.</p>
            <h3>3. User obligations</h3>
            <ul>
              <li>You must be 18 years or older to use the platform</li>
              <li>You may only upload resumes and documents you have the right to share</li>
              <li>You may not use the platform for any unlawful purpose</li>
              <li>You may not attempt to reverse-engineer or copy the platform</li>
            </ul>
            <h3>4. Subscription and billing</h3>
            <p>Premium subscriptions are billed monthly at $19 USD (Premium) or $24.99 USD (Pro · Get Ready), or annually at $180 USD / $239 USD respectively. You may cancel at any time. Refunds are available within 7 days of initial purchase if you are unsatisfied.</p>
            <h3>5. Limitation of liability</h3>
            <p>CareerAiHub provides career guidance tools, not guaranteed employment outcomes. AI-generated scores and suggestions are for informational purposes. We are not liable for employment decisions made by third parties.</p>
            <h3>6. Governing law</h3>
            <p>These terms are governed by the laws of Singapore. Disputes shall be resolved in Singapore courts.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── COOKIE BANNER ─────────────────────────────────────────────────────────────

function CookieBanner({ onPrivacy, onTerms }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem('lp_cookie_consent')) setVisible(true);
  }, []);
  if (!visible) return null;
  const accept = () => { localStorage.setItem('lp_cookie_consent', '1'); setVisible(false); };
  const decline = () => { localStorage.setItem('lp_cookie_consent', 'declined'); setVisible(false); };
  return (
    <div className="lp-cookie-banner show">
      <div className="lp-cookie-text">
        We use cookies to improve your experience and analyze platform usage. Your resume data is encrypted and never sold.{' '}
        <button onClick={onPrivacy}>Privacy Policy</button> · <button onClick={onTerms}>Terms of Service</button>
      </div>
      <button className="lp-cookie-decline" onClick={decline}>Decline optional</button>
      <button className="lp-cookie-accept" onClick={accept}>Accept &amp; continue</button>
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

/* ── legal content ── */
const LEGAL_CONTENT = {
  privacy: { title: 'Privacy Policy', body: 'CareerAiHub collects only the data necessary to provide the platform. We never sell personal data. Data is encrypted at rest and in transit. You can request deletion at any time by emailing hello.careeraihub@gmail.com.' },
  tos: { title: 'Terms of Service', body: 'By using CareerAiHub you agree to use the platform for lawful purposes only. You retain ownership of your uploaded content. We may terminate accounts that violate these terms. Full terms available at careeraihub.com/terms.' },
  security: { title: 'Security', body: 'We use industry-standard TLS encryption, SOC 2-aligned practices, and regular penetration testing. Credentials are stored using bcrypt hashing. API keys are never logged or exposed to the client.' },
  deletion: { title: 'Data Deletion', body: 'To permanently delete your account and all associated data, email hello.careeraihub@gmail.com with subject "Data Deletion Request". We process requests within 30 days in compliance with PDPA.' },
};

const ATS_STEPS = [
  { num: 'STEP 01', title: 'Upload your resume', desc: 'Drop a PDF or Word file. Our engine parses 50+ fields including experience, skills, education, and certifications in under 5 seconds.', status: 'DONE' },
  { num: 'STEP 02', title: 'ATS gap analysis', desc: 'We compare your resume against the job description and identify missing keywords, weak phrasing, and formatting issues that ATS systems penalise.', status: 'RUNNING' },
  { num: 'STEP 03', title: 'Optimised resume output', desc: 'Download a fully ATS-optimised resume with a score of 90+. Keywords inserted, structure fixed, quantified achievements surfaced.', status: 'LIVE' },
];

const INT_STEPS = [
  { num: 'STEP 01', title: 'AI assesses your profile', desc: 'We analyse your background to identify the 4 key dimensions: Situation framing, Task clarity, Action depth, and Result quantification.' },
  { num: 'STEP 02', title: 'Adaptive question bank', desc: 'Questions are generated based on your target role and seniority. The AI targets your weakest dimension first, not a generic script.' },
  { num: 'STEP 03', title: 'Real-time coaching', desc: 'Each answer gets a score, specific improvement suggestions, and a better phrasing example. Your STAR stories are saved and refined over time.' },
  { num: 'STEP 04', title: 'Track your progress', desc: 'Interview Score rises from 6.2 → 8.5 over a week of daily 20-min sessions. Recruiters see your improvement trajectory.' },
];

export default function LandingPage({ setAuthModal, onModuleSelect }) {
  const [atsOpen, setAtsOpen] = useState(false);
  const [intOpen, setIntOpen] = useState(false);
  const [legalModal, setLegalModal] = useState({ open: false, type: null });
  const [faqExpanded, setFaqExpanded] = useState(false);


  useEffect(() => {
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap';
    document.head.appendChild(fontLink);
    document.documentElement.style.scrollBehavior = 'smooth';
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    setTimeout(() => {
      document.querySelectorAll('.v36-page .reveal').forEach(e => io.observe(e));
    }, 100);
    return () => {
      io.disconnect();
      if (document.head.contains(fontLink)) document.head.removeChild(fontLink);
    };
  }, []);

  const join = () => setAuthModal?.('register');
  const login = () => setAuthModal?.('login');
  const openLegal = (type) => setLegalModal({ open: true, type });
  const closeLegal = () => setLegalModal({ open: false, type: null });
  const legal = legalModal.type ? LEGAL_CONTENT[legalModal.type] : null;

  return (
    <div className="v36-page">

      {/* ── NAV ── */}
      <nav className="v36-nav">
        <a className="v36-nav-logo" href="#" onClick={e => e.preventDefault()}>
          <OrbitMark size={26} animated duration={18} />
          <div className="v36-nav-logo-text">
            <span className="v36-nav-wordmark"><span>career</span><span className="v36-nav-wm-ai">ai</span><span>hub</span></span>
            <span className="v36-nav-tagline">Build. Verified. Connect.</span>
          </div>
        </a>
        <ul className="v36-nav-links">
          <li><a href="#v36-platform">Platform</a></li>
          <li><a href="#v36-future">For Recruiters</a></li>
          <li><a href="#v36-faq">Resources</a></li>
          <li><a href="#v36-pricing">Pricing</a></li>
        </ul>
        <div className="v36-nav-right">
          <button className="v36-btn-ghost" onClick={login}>Log in</button>
          <button className="v36-btn-primary" onClick={join}>Get Started Free</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div className="v36-hero-wrap">
        <div className="v36-hero">

          {/* LEFT */}
          <div className="v36-hero-left reveal visible">
            {/* Eyebrow */}
            <div style={{display:'inline-flex',alignItems:'center',gap:7,background:'rgba(236,72,153,0.08)',border:'1px solid rgba(236,72,153,0.2)',borderRadius:100,padding:'5px 14px',marginBottom:28,width:'fit-content'}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'#ec4899',boxShadow:'0 0 8px rgba(236,72,153,0.8)',flexShrink:0,animation:'v36blink 2s ease-in-out infinite',display:'inline-block'}}></span>
              <span style={{fontSize:12,fontWeight:500,color:'rgba(160,174,192,0.75)',letterSpacing:'0.02em'}}>Singapore's verified career platform</span>
            </div>
            {/* Headline */}
            <h1 style={{fontSize:58,fontWeight:700,lineHeight:1.08,letterSpacing:'-0.025em',margin:'0 0 20px',fontFamily:"'Inter',sans-serif"}}>
              <span style={{display:'block',color:'#ffffff'}}>From Invisible</span>
              <span style={{display:'block',background:'linear-gradient(100deg,#ec4899 0%,#8b5cf6 55%,#f59e0b 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>To Get Hired.</span>
            </h1>
            {/* Sub */}
            <p style={{fontSize:16,color:'rgba(160,174,192,0.6)',lineHeight:1.65,margin:'0 0 36px',maxWidth:420,fontWeight:400,letterSpacing:'-0.01em'}}>
              Build a verified profile, practice with AI, and get discovered by top Singapore recruiters.
            </p>
            {/* CTAs */}
            <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:40,flexWrap:'wrap'}}>
              <button onClick={join} style={{display:'inline-flex',alignItems:'center',gap:8,background:'#ec4899',color:'#fff',border:'none',fontSize:15,fontWeight:600,padding:'15px 32px',borderRadius:100,cursor:'pointer',fontFamily:"'Inter',sans-serif",letterSpacing:'-0.02em',boxShadow:'0 0 40px rgba(236,72,153,0.4),0 1px 0 rgba(255,255,255,0.12) inset'}}>
                Build My Profile Free &nbsp;→
              </button>
              <button onClick={join} style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.04)',color:'rgba(200,215,235,0.85)',border:'1px solid rgba(255,255,255,0.14)',fontSize:14,fontWeight:500,padding:'13px 22px',borderRadius:100,cursor:'pointer',fontFamily:"'Inter',sans-serif",letterSpacing:'-0.01em'}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Scan My Resume Free
              </button>
              <a href="/culture-quiz?utm_source=landing&utm_medium=hero" style={{color:'rgba(200,215,235,0.7)',fontSize:13,fontWeight:500,textDecoration:'none',borderBottom:'1px solid rgba(255,255,255,0.18)',paddingBottom:1,fontFamily:"'Inter',sans-serif"}}>
                Free culture quiz →
              </a>
            </div>
            {/* Social proof */}
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:13,color:'#fbbf24',letterSpacing:1}}>★★★★★</span>
                <span style={{fontSize:12,color:'rgba(74,86,104,0.9)',letterSpacing:'-0.01em'}}><strong style={{color:'rgba(160,174,192,0.7)',fontWeight:600}}>Free to start</strong> · No credit card · Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* RIGHT — Dashboard card */}
          <div className="v36-hero-right reveal visible">
            <div className="ndc-wrap">
              <div className="ndc-topbar">
                <span className="ndc-verified">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#29c492" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  TRUSTMATCH VERIFIED
                </span>
                <span className="ndc-live"><span className="ndc-live-dot"></span>Live</span>
              </div>
              <div className="ndc-body">
                {/* LEFT column */}
                <div className="ndc-left">
                  <div className="ndc-profile">
                    <div className="ndc-avatar">
                      <img src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=120&h=120&fit=crop&crop=face&auto=format" alt="Sarah Tan" />
                    </div>
                    <div className="ndc-pinfo">
                      <div className="ndc-pname">Sarah Tan</div>
                      <div className="ndc-prole">Product Manager</div>
                      <div className="ndc-ploc">Singapore</div>
                    </div>
                  </div>
                  <div className="ndc-id-badges">
                    <span className="ndc-idbadge ndc-idb-green">Verified Identity</span>
                    <span className="ndc-idbadge ndc-idb-teal">AI Memory Active</span>
                  </div>
                  <div className="ndc-divider"></div>
                  <div>
                    <div className="ndc-trust-label">TRUST SCORE</div>
                    <div className="ndc-trust-row">
                      <div className="ndc-trust-num">87</div>
                      <div className="ndc-trust-denom">/100</div>
                      <div className="ndc-trust-excellent">● Excellent</div>
                    </div>
                    <div className="ndc-trust-ring-row">
                      <div className="ndc-ring">
                        <svg width="52" height="52" viewBox="0 0 52 52">
                          <circle cx="26" cy="26" r="21" fill="none" stroke="rgba(41,196,146,0.15)" strokeWidth="4"/>
                          <circle cx="26" cy="26" r="21" fill="none" stroke="#29c492" strokeWidth="4" strokeLinecap="round" strokeDasharray="131.9" strokeDashoffset="131.9" className="ndc-ring-animated"/>
                        </svg>
                      </div>
                      <div className="ndc-trust-note">Top <strong>8%</strong> verified<br />profiles in Singapore</div>
                    </div>
                  </div>
                  <div className="ndc-divider"></div>
                  <div>
                    <div className="ndc-strength-row">
                      <span className="ndc-strength-label">PROFILE STRENGTH</span>
                      <span className="ndc-strength-pct">87%</span>
                    </div>
                    <div className="ndc-strength-bar-wrap"><div className="ndc-strength-bar"></div></div>
                  </div>
                  <div className="ndc-divider"></div>
                  <div className="ndc-skills-block">
                    <div className="ndc-skills-label">TOP SKILLS</div>
                    <div className="ndc-skills-wrap">
                      <span className="ndc-skill">Product Strategy</span>
                      <span className="ndc-skill">Agile</span>
                      <span className="ndc-skill">Data Analytics</span>
                      <span className="ndc-skill">Roadmapping</span>
                    </div>
                  </div>
                </div>
                {/* RIGHT column */}
                <div className="ndc-right">
                  <div className="ndc-panel ndc-recruiter">
                    <div className="ndc-panel-header">
                      <span className="ndc-panel-title">RECRUITER INTEREST</span>
                      <span className="ndc-panel-link">View all</span>
                    </div>
                    <div className="ndc-msg-row">
                      <div className="ndc-msg-avatar">
                        <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face&auto=format" alt="Rachel Chen" />
                      </div>
                      <div className="ndc-msg-bubble">
                        <div className="ndc-msg-text">Hi Sarah,<br />I can see your credentials and your strong product background. We have a PM role that matches your profile. Are you open to a quick call this week?</div>
                        <div className="ndc-msg-meta">
                          <span className="ndc-msg-sender">Rachel Chen</span>
                          <span className="ndc-msg-role">· Talent Lead @ Grab</span>
                          <span className="ndc-msg-time">3:42 PM</span>
                          <span className="ndc-msg-dot"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="ndc-panel ndc-matches">
                    <div className="ndc-panel-header">
                      <span className="ndc-panel-title">YOUR MATCHES</span>
                      <span className="ndc-panel-link">See all</span>
                    </div>
                    <div className="ndc-match-row">
                      <div className="ndc-match-logo">
                        <svg width="32" height="32" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="#00B14F"/><text x="50%" y="58%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="14" fontWeight="800" fontFamily="sans-serif">G</text></svg>
                      </div>
                      <div className="ndc-match-info">
                        <div className="ndc-match-title">Product Manager</div>
                        <div className="ndc-match-company">Grab · Singapore</div>
                      </div>
                      <span className="ndc-match-pct ndc-pct-green">95% Match</span>
                    </div>
                    <div className="ndc-match-row">
                      <div className="ndc-match-logo">
                        <svg width="32" height="32" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="#96BF48"/><text x="50%" y="58%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="14" fontWeight="800" fontFamily="sans-serif">S</text></svg>
                      </div>
                      <div className="ndc-match-info">
                        <div className="ndc-match-title">Senior Product Manager</div>
                        <div className="ndc-match-company">Shopify · Remote</div>
                      </div>
                      <span className="ndc-match-pct ndc-pct-teal">92% Match</span>
                    </div>
                    <div className="ndc-match-row">
                      <div className="ndc-match-logo">
                        <svg width="32" height="32" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="#0a66c2"/><text x="50%" y="58%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="14" fontWeight="800" fontFamily="sans-serif">in</text></svg>
                      </div>
                      <div className="ndc-match-info">
                        <div className="ndc-match-title">Head of Product</div>
                        <div className="ndc-match-company">Gojek · Hybrid</div>
                      </div>
                      <span className="ndc-match-pct ndc-pct-purple">88% Match</span>
                    </div>
                    <div className="ndc-matches-cta">View all 12 matches →</div>
                  </div>
                  <div className="ndc-stats-row">
                    <div className="ndc-stat-item">
                      <div className="ndc-stat-icon" style={{color:'#8b5cf6'}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </div>
                      <div><div className="ndc-stat-num">3</div><div className="ndc-stat-lbl">Recruiters<br />Viewed</div></div>
                    </div>
                    <div className="ndc-stat-item">
                      <div className="ndc-stat-icon" style={{color:'#f59e0b'}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                      </div>
                      <div><div className="ndc-stat-num">12</div><div className="ndc-stat-lbl">Opportunities<br />Matched</div></div>
                    </div>
                    <div className="ndc-stat-item">
                      <div className="ndc-stat-icon" style={{color:'#06b6d4'}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      </div>
                      <div><div className="ndc-stat-num">7</div><div className="ndc-stat-lbl">Interviews<br />This Month</div></div>
                    </div>
                    <div className="ndc-stat-item">
                      <div className="ndc-stat-icon" style={{color:'#f59e0b'}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                      </div>
                      <div><div className="ndc-stat-num" style={{color:'#f59e0b'}}>High</div><div className="ndc-stat-lbl">Interview<br />Confidence</div></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS TICKER ── */}
      <div className="v36-stats-ticker-wrap">
        <div className="v36-stats-ticker-track">
          {[
            { color:'#fbbf24', val:'4.9★', label:'User Rating' },
            { color:'#10b981', val:'95%', label:'ATS Match Rate' },
            { color:'#5b6ef5', val:'50+', label:'Hiring Partners' },
            { color:'#8b5cf6', val:'2,714+', label:'Verified Profiles' },
            { color:'#06b6d4', val:'9 Days', label:'Avg. to Shortlist' },
            { color:'#f59e0b', val:'SGD 4–12k', label:'Salary Uplift' },
            { color:'#fbbf24', val:'4.9★', label:'User Rating' },
            { color:'#10b981', val:'95%', label:'ATS Match Rate' },
            { color:'#5b6ef5', val:'50+', label:'Hiring Partners' },
            { color:'#8b5cf6', val:'2,714+', label:'Verified Profiles' },
            { color:'#06b6d4', val:'9 Days', label:'Avg. to Shortlist' },
            { color:'#f59e0b', val:'SGD 4–12k', label:'Salary Uplift' },
          ].map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="v36-stats-tick-sep">·</span>}
              <div className="v36-stats-tick-item">
                <span className="v36-stats-tick-dot" style={{background:item.color}}></span>
                <span className="v36-stats-tick-val" style={{color:item.color}}>{item.val}</span>
                <span className="v36-stats-tick-label">{item.label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── CULTURE QUIZ (free lead magnet) ── */}
      <div className="v36-section" id="v36-culture">
        <div className="v36-section-inner">
          <div className="reveal" style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:28,background:'rgba(236,72,153,0.06)',border:'1px solid rgba(236,72,153,0.25)',borderRadius:20,padding:'40px 36px'}}>
            <div style={{flex:'1 1 380px'}}>
              <div style={{fontSize:12,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'#ec4899',marginBottom:10}}>Free · 2 minutes · No signup</div>
              <h2 className="v36-s-title" style={{margin:'0 0 10px'}}>What is your work culture persona?</h2>
              <p className="v36-s-sub" style={{margin:0,maxWidth:520}}>Answer 10 quick questions to find the kind of workplace where you do your best work, and what to look for in your next role.</p>
            </div>
            <a href="/culture-quiz?utm_source=landing&utm_medium=section" style={{display:'inline-flex',alignItems:'center',gap:8,background:'#ec4899',color:'#fff',textDecoration:'none',fontSize:15,fontWeight:600,padding:'15px 32px',borderRadius:100,whiteSpace:'nowrap',fontFamily:"'Inter',sans-serif",boxShadow:'0 0 40px rgba(236,72,153,0.35)'}}>
              Take the free quiz &nbsp;→
            </a>
          </div>
        </div>
      </div>

      {/* ── AI MEMORY ── */}
      <div className="v36-section v36-mem-section">
        <div className="v36-section-inner">
          <div style={{textAlign:'center',marginBottom:48}} className="reveal">
            <h2 className="v36-s-title">Your career intelligence compounds over time.</h2>
            <p className="v36-s-sub" style={{maxWidth:500,margin:'10px auto 0'}}>Every resume scan, interview practice, and credential verification makes your profile stronger. CareerAIHub remembers everything.</p>
          </div>
          <div className="v36-mem-timeline reveal">
            {[
              { day:'Day 1', title:'Upload your resume', desc:'AI scans and scores your resume. ATS match calculated instantly.', metric:'ATS Score: 72 → optimised to 95', color:'#EC4899', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.75" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
              { day:'Week 1', title:'Practice interviews', desc:'AI coaches your answers, remembers your STAR stories, tracks improvement.', metric:'Interview Score: 6.2 → 8.5 / 10', color:'#EC4899', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.75" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
              { day:'Week 2', title:'Verify credentials', desc:'Connect OpenCerts, Credly, Singpass. Trust Score rises with every verification.', metric:'Trust Score: 61 → 87 / 100', color:'#EC4899', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.75" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg> },
              { day:'Week 3+', title:'Get discovered', desc:'Recruiters find your verified profile. TrustChat connects you to the right roles.', metric:'3 recruiter messages · 95% role match', color:'#EC4899', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.75" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
            ].map((step, i) => (
              <div className="v36-mem-tl-item" key={i}>
                <div className="v36-mem-tl-node">{step.icon}</div>
                {i < 3 && <div className="v36-mem-tl-line"></div>}
                <div className="v36-mem-tl-card">
                  <div className="v36-mem-tl-day">{step.day}</div>
                  <div className="v36-mem-tl-title">{step.title}</div>
                  <div className="v36-mem-tl-metric" style={{color:step.color}}>{step.metric}</div>
                  <div className="v36-mem-tl-desc">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PLATFORM ── */}
      <div className="v36-section" id="v36-platform">
        <div className="v36-section-inner">
          <div className="reveal" style={{textAlign:'center',marginBottom:48}}>
            <div className="v36-tag">OUR PLATFORM</div>
            <h2 className="v36-s-title">Four layers. One unified identity.</h2>
          </div>
          <div className="v36-plat-grid reveal">
            {/* Card 1 */}
            <div className="v36-plat-card rd1">
              <div className="v36-plat-title">Resume &amp; ATS</div>
              <ul className="v36-plat-feats">
                <li><span className="v36-feat-check">✓</span> AI Resume Builder</li>
                <li><span className="v36-feat-check">✓</span> ATS Scanner &amp; Score</li>
                <li><span className="v36-feat-check">✓</span> Keyword Optimization</li>
                <li><span className="v36-feat-check">✓</span> Persistent AI Profile</li>
              </ul>
              <div className="v36-plat-divider"></div>
              <div className="v36-plat-mock">
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{position:'relative',width:64,height:64,flexShrink:0}}>
                    <svg viewBox="0 0 64 64" style={{transform:'rotate(-90deg)',width:64,height:64}}>
                      <defs><linearGradient id="atsGradV36" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#29c492"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient></defs>
                      <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5"/>
                      <circle cx="32" cy="32" r="27" fill="none" stroke="url(#atsGradV36)" strokeWidth="5" strokeLinecap="round" strokeDasharray="169.6" strokeDashoffset="25"/>
                    </svg>
                    <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                      <div style={{fontSize:16,fontWeight:800,color:'#fff',lineHeight:1,letterSpacing:'-0.04em'}}>92</div>
                      <div style={{fontSize:10,color:'#29c492',fontWeight:600,letterSpacing:'0.04em'}}>Excellent</div>
                    </div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:'#4a5568',marginBottom:5,fontWeight:500}}>Top Keywords</div>
                    <div style={{height:4,background:'linear-gradient(90deg,#8b5cf6,#ec4899)',borderRadius:2,width:'90%',marginBottom:4}}></div>
                    <div style={{display:'inline-block',background:'rgba(236,72,153,0.15)',border:'1px solid rgba(236,72,153,0.3)',borderRadius:4,padding:'2px 7px',fontSize:11,color:'#818cf8',fontWeight:600,marginBottom:4}}>Product Strategy</div>
                  </div>
                </div>
              </div>
              <button className="v36-plat-cta-btn v36-plat-cta-ats" onClick={() => setAtsOpen(true)}>
                <span className="v36-plat-cta-icon">⚡</span>
                <span>See how it works</span>
                <span className="v36-plat-cta-arrow">→</span>
              </button>
            </div>
            {/* Card 2 */}
            <div className="v36-plat-card rd2">
              <div className="v36-plat-title">Interview Intelligence</div>
              <ul className="v36-plat-feats">
                <li><span className="v36-feat-check">✓</span> AI Mock Interviews</li>
                <li><span className="v36-feat-check">✓</span> Real-time Feedback</li>
                <li><span className="v36-feat-check">✓</span> STAR Bank</li>
                <li><span className="v36-feat-check">✓</span> Salary Negotiator</li>
              </ul>
              <div className="v36-plat-divider"></div>
              <div className="v36-plat-mock">
                <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,overflow:'hidden',position:'relative'}}>
                  <div style={{height:90,background:'linear-gradient(135deg,rgba(139,92,246,0.12),rgba(236,72,153,0.06))',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <div style={{width:44,height:44,borderRadius:'50%',background:'linear-gradient(135deg,#f59e0b,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,boxShadow:'0 4px 20px rgba(139,92,246,0.4)'}}>👤</div>
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:7,padding:'7px 10px',marginTop:6}}>
                  <span style={{fontSize:'11px',color:'#4a5568',fontWeight:500}}>Feedback</span>
                  <span style={{fontSize:'11px',color:'#29c492',fontWeight:600}}>Great structure!</span>
                  <span style={{background:'rgba(41,196,146,0.15)',border:'1px solid rgba(41,196,146,0.3)',borderRadius:4,padding:'2px 6px',fontSize:11,color:'#29c492',fontWeight:700}}>8.5/10</span>
                </div>
              </div>
              <button className="v36-plat-cta-btn v36-plat-cta-int" onClick={() => setIntOpen(true)}>
                <span className="v36-plat-cta-icon">▶</span>
                <span>Watch demo</span>
                <span className="v36-plat-cta-arrow">→</span>
              </button>
            </div>
            {/* Card 3 */}
            <div className="v36-plat-card rd3">
              <div className="v36-plat-title">Verification Engine</div>
              <ul className="v36-plat-feats">
                <li><span className="v36-feat-check">✓</span> Credential Verification</li>
                <li><span className="v36-feat-check">✓</span> OpenCerts &amp; W3C VC</li>
                <li><span className="v36-feat-check">✓</span> Trust Score Algorithm</li>
                <li><span className="v36-feat-check">✓</span> Verified Badge</li>
              </ul>
              <div className="v36-plat-divider"></div>
              <div className="v36-plat-mock">
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {[{icon:'🏅',name:'AWS Certified',sub:'Solutions Architect'},{icon:'🛡️',name:'OpenCerts',sub:'Blockchain anchored'}].map((c,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 8px',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:7}}>
                      <span style={{fontSize:13}}>{c.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,fontWeight:700,color:'#e2e8f0',lineHeight:1.2}}>{c.name} <span style={{color:'#4a5568',fontWeight:400}}>· {c.sub}</span></div>
                      </div>
                      <span style={{fontSize:'10px',fontWeight:600,color:'#29c492',background:'rgba(41,196,146,0.1)',border:'1px solid rgba(41,196,146,0.22)',borderRadius:3,padding:'1px 5px',whiteSpace:'nowrap'}}>✓ Verified</span>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:8,paddingTop:7,borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                  <div style={{fontSize:11,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'#2e3d52',marginBottom:5}}>Supported by</div>
                  <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                    <span className="v36-verif-logo-pill vl-singpass">🇸🇬 Singpass</span>
                    <span className="v36-verif-logo-pill vl-opencerts">🎓 OpenCerts</span>
                    <span className="v36-verif-logo-pill vl-credly">🏅 Credly</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Card 4 */}
            <div className="v36-plat-card" style={{transitionDelay:'.24s'}}>
              <div className="v36-plat-title">TrustMatch Marketplace</div>
              <ul className="v36-plat-feats">
                <li><span className="v36-feat-check">✓</span> AI Matching Engine</li>
                <li><span className="v36-feat-check">✓</span> Verified Candidates</li>
                <li><span className="v36-feat-check">✓</span> Recruiter Discovery</li>
                <li><span className="v36-feat-check">✓</span> Outcomes Dashboard</li>
              </ul>
              <div className="v36-plat-divider"></div>
              <div className="v36-plat-mock">
                <div style={{fontSize:11,color:'#4a5568',marginBottom:6,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase'}}>Top Match</div>
                <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:9,padding:'11px 12px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:8}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:'#e2e8f0',lineHeight:1.2}}>Product Manager</div>
                      <div style={{fontSize:'11px',color:'#4a5568',marginTop:2}}>ByteTech Pte. Ltd. · Singapore</div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0,marginLeft:8}}>
                      <div style={{fontSize:14,fontWeight:800,color:'#ec4899',letterSpacing:'-0.04em',lineHeight:1}}>94%</div>
                      <div style={{fontSize:11,color:'#4a5568',fontWeight:500}}>Match</div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
                    {['B2B SaaS','Series B','SGD 8-12k'].map(t=>(
                      <span key={t} style={{background:'rgba(236,72,153,0.1)',border:'1px solid rgba(236,72,153,0.2)',borderRadius:3,padding:'1px 5px',fontSize:11,color:'#818cf8'}}>{t}</span>
                    ))}
                  </div>
                  <button onClick={join} style={{background:'#ec4899',borderRadius:5,padding:5,textAlign:'center',fontSize:11,color:'#fff',fontWeight:600,cursor:'pointer',border:'none',width:'100%'}}>View Opportunity</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PRICING ── */}
      <div id="v36-pricing" className="v36-pricing">
        <div className="v36-pricing-inner">
          <div className="reveal" style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:40,gap:32,flexWrap:'wrap'}}>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--blue)',marginBottom:12,display:'flex',alignItems:'center',gap:8}}><span style={{width:20,height:1,background:'rgba(91,110,245,.4)',display:'block'}}></span>Pricing</div>
              <h2 style={{fontFamily:"'Inter',sans-serif",fontSize:'clamp(26px,3.5vw,38px)',fontWeight:800,letterSpacing:'-.03em',lineHeight:1.1,color:'var(--text)',margin:0}}>Free to start.<br /><span style={{background:'linear-gradient(95deg,#ec4899,#8b5cf6,#f59e0b)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>Proven to pay off.</span></h2>
            </div>
            <p style={{fontSize:13,color:'var(--text3)',fontWeight:300,lineHeight:1.7,maxWidth:300,margin:0}}>Try everything free. Upgrade when you're ready to be found by the right recruiters.</p>
          </div>
          <div className="reveal" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:1,background:'var(--border)',borderRadius:16,overflow:'hidden',border:'1px solid var(--border)'}}>
            {/* Free */}
            <div style={{background:'var(--bg2)',padding:'28px 24px',display:'flex',flexDirection:'column',gap:0}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:'.14em',textTransform:'uppercase',color:'var(--text3)',marginBottom:20}}>Free</div>
              <div style={{display:'flex',alignItems:'baseline',gap:6,marginBottom:4}}>
                <span style={{fontFamily:"'Inter',sans-serif",fontSize:36,fontWeight:800,letterSpacing:'-.04em',color:'var(--text)',lineHeight:1}}>$0</span>
                <span style={{fontSize:12,color:'var(--text3)'}}>forever</span>
              </div>
              <div style={{fontSize:11,color:'var(--text3)',marginBottom:24,paddingBottom:24,borderBottom:'1px solid var(--border)'}}>No credit card required</div>
              <div style={{display:'flex',flexDirection:'column',gap:10,flex:1,marginBottom:24}}>
                {['2 resume scans + ATS keyword fixes','JD gap analysis','1 AI cover letter','3 interview prep sessions','Basic Trust Score'].map(f=>(
                  <div key={f} style={{display:'flex',alignItems:'center',gap:9,fontSize:12,color:'var(--text2)'}}>
                    <span style={{width:14,height:14,borderRadius:'50%',background:'rgba(16,185,129,.1)',border:'1px solid rgba(16,185,129,.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'#10b981',flexShrink:0}}>✓</span>{f}
                  </div>
                ))}
                {['TrustMatch marketplace','Salary coach'].map(f=>(
                  <div key={f} style={{display:'flex',alignItems:'center',gap:9,fontSize:12,color:'var(--text3)'}}>
                    <span style={{width:14,height:14,borderRadius:'50%',background:'rgba(255,255,255,.03)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'var(--text3)',flexShrink:0}}>—</span>{f}
                  </div>
                ))}
              </div>
              <button onClick={join} style={{display:'block',textAlign:'center',padding:10,borderRadius:8,border:'1px solid var(--border2)',fontSize:'12.5px',fontWeight:600,color:'var(--text2)',background:'transparent',cursor:'pointer',fontFamily:"'Inter',sans-serif",letterSpacing:'-.01em'}}>Get started free</button>
            </div>
            {/* Pro */}
            <div style={{background:'var(--card)',padding:'28px 24px',display:'flex',flexDirection:'column',position:'relative'}}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:'linear-gradient(90deg,#ec4899,#f59e0b)'}}></div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:'.14em',textTransform:'uppercase',color:'#818cf8'}}>Pro</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,padding:'3px 8px',borderRadius:20,background:'rgba(236,72,153,.1)',color:'#818cf8',border:'1px solid rgba(236,72,153,.22)'}}>Most popular</div>
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:6,marginBottom:4}}>
                <span style={{fontFamily:"'Inter',sans-serif",fontSize:36,fontWeight:800,letterSpacing:'-.04em',color:'var(--text)',lineHeight:1}}>SGD 19.90</span>
                <span style={{fontSize:12,color:'var(--text3)'}}>/mo</span>
              </div>
              <div style={{fontSize:11,color:'var(--text3)',marginBottom:8}}>after 7-day trial · cancel anytime</div>
              <div style={{fontSize:11,color:'#818cf8',background:'rgba(236,72,153,.07)',border:'1px solid rgba(236,72,153,.15)',borderRadius:6,padding:'7px 10px',marginBottom:20}}>🎯 Start with 7 days full access — SGD 8.99</div>
              <div style={{height:1,background:'var(--border)',marginBottom:20}}></div>
              <div style={{display:'flex',flexDirection:'column',gap:10,flex:1,marginBottom:24}}>
                {['Everything in Free','Unlimited scans, letters, verifications','TrustMatch marketplace — recruiter discovery','Salary coach + P75 negotiation scripts','HM Simulator · all 4 pressure personas','AI Memory Dashboard — full adaptive profile'].map(f=>(
                  <div key={f} style={{display:'flex',alignItems:'center',gap:9,fontSize:12,color:'var(--text2)'}}>
                    <span style={{width:14,height:14,borderRadius:'50%',background:'rgba(236,72,153,.15)',border:'1px solid rgba(236,72,153,.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'#818cf8',flexShrink:0}}>✓</span>
                    <span dangerouslySetInnerHTML={{__html: f.replace('Unlimited','<strong style="color:var(--text);font-weight:500">Unlimited</strong>')}}></span>
                  </div>
                ))}
              </div>
              <button onClick={join} style={{display:'block',textAlign:'center',padding:11,borderRadius:8,background:'linear-gradient(110deg,#7c3aed,#db2777)',fontSize:'12.5px',fontWeight:700,color:'#fff',cursor:'pointer',border:'none',fontFamily:"'Inter',sans-serif",letterSpacing:'-.01em',boxShadow:'0 0 28px rgba(236,72,153,.25)'}}>Start free trial · SGD 8.99 →</button>
            </div>
            {/* Recruiter */}
            <div style={{background:'var(--bg2)',padding:'28px 24px',display:'flex',flexDirection:'column'}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:'.14em',textTransform:'uppercase',color:'var(--cyan)',marginBottom:20}}>Recruiter</div>
              <div style={{display:'flex',alignItems:'baseline',gap:6,marginBottom:4}}>
                <span style={{fontFamily:"'Inter',sans-serif",fontSize:28,fontWeight:800,letterSpacing:'-.04em',color:'var(--text)',lineHeight:1}}>Custom</span>
              </div>
              <div style={{fontSize:11,color:'var(--text3)',marginBottom:24,paddingBottom:24,borderBottom:'1px solid var(--border)'}}>Per seat · billed annually</div>
              <div style={{display:'flex',flexDirection:'column',gap:10,flex:1,marginBottom:24}}>
                {['Full verified candidate pool','TrustMatch + TrustChat direct messaging','AI-ranked shortlists in minutes','Zero fake credentials — blockchain-verified','ATS integration + CSV export','Dedicated account manager'].map(f=>(
                  <div key={f} style={{display:'flex',alignItems:'center',gap:9,fontSize:12,color:'var(--text2)'}}>
                    <span style={{width:14,height:14,borderRadius:'50%',background:'rgba(6,182,212,.1)',border:'1px solid rgba(6,182,212,.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'var(--cyan)',flexShrink:0}}>✓</span>{f}
                  </div>
                ))}
              </div>
              <a href="mailto:hello.careeraihub@gmail.com" style={{display:'block',textAlign:'center',padding:10,borderRadius:8,border:'1px solid rgba(6,182,212,.3)',fontSize:'12.5px',fontWeight:600,color:'var(--cyan)',textDecoration:'none',letterSpacing:'-.01em'}}>Contact us →</a>
            </div>
          </div>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="v36-section" id="v36-faq" style={{borderTop:'1px solid var(--border)'}}>
        <div className="v36-section-inner" style={{maxWidth:900}}>
          <div style={{display:'grid',gridTemplateColumns:'1.8fr 1fr',gap:64,alignItems:'flex-start'}}>
            <div className="reveal">
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {[
                  {q:'Is my data shared with recruiters without my consent?',a:'No. You control exactly what\'s visible. Recruiters see only your verified Trust Score and the credential badges you choose to publish. Raw data and personal identifiers are never shared without your explicit opt-in.'},
                  {q:'How does credential verification work?',a:'We connect directly to institutional sources — Singpass for identity, OpenCerts for academic credentials, Credly for professional certifications. Every check is real-time. Nothing is self-reported.'},
                  {q:'How is CareerAiHub different from LinkedIn?',a:'LinkedIn is built on self-reported claims. We\'re a trust infrastructure — every signal is verified against an external source. We\'re also not ad-supported, so we have no incentive to show you irrelevant jobs.'},
                ].map((faq, i) => (
                  <details key={i} style={{background:'var(--card)',border:'1px solid var(--border2)',borderRadius:12,padding:'18px 20px',cursor:'pointer'}}>
                    <summary style={{fontSize:'13.5px',fontWeight:600,color:'var(--text)',listStyle:'none',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>{faq.q}<span className="v36-faq-plus">+</span></summary>
                    <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.75,marginTop:12,fontWeight:300}}>{faq.a}</p>
                  </details>
                ))}
              </div>
              {faqExpanded && (
                <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:4}}>
                  {[
                    {q:'What is a Trust Score and how is it calculated?',a:'A 100-point index across four weighted dimensions: identity verification (25%), credential depth (35%), platform activity (20%), and engagement signals (20%). Cannot be gamed by self-reporting.'},
                    {q:'I\'m actively employed. Can I stay private?',a:'Yes. Use all AI tools in complete privacy without appearing in TrustMatch. You choose when to go "discoverable," and you can turn it off instantly.'},
                    {q:'Which countries are supported?',a:'Live in Singapore with Singpass and OpenCerts integration. Malaysia, Hong Kong, and Australia are on our 2027 roadmap. International candidates can use all AI tools and Credly-based verification from day one.'},
                    {q:'What can I do on the free tier?',a:'Free includes 2 resume scans + ATS fixes, JD gap analysis, 1 cover letter, 3 interview prep sessions, and basic Trust Score. TrustMatch requires Pro (SGD 19.90/mo after 7-day trial at SGD 8.99).'},
                  ].map((faq, i) => (
                    <details key={i} style={{background:'var(--card)',border:'1px solid var(--border2)',borderRadius:12,padding:'18px 20px',cursor:'pointer'}}>
                      <summary style={{fontSize:'13.5px',fontWeight:600,color:'var(--text)',listStyle:'none',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>{faq.q}<span className="v36-faq-plus">+</span></summary>
                      <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.75,marginTop:12,fontWeight:300}}>{faq.a}</p>
                    </details>
                  ))}
                </div>
              )}
              <button onClick={() => setFaqExpanded(v => !v)} style={{display:'inline-flex',alignItems:'center',gap:7,marginTop:12,background:'transparent',border:'1px solid var(--border2)',color:'var(--text2)',padding:'9px 16px',borderRadius:100,fontSize:12,cursor:'pointer',fontFamily:"'Inter',sans-serif"}}>
                <span>{faqExpanded ? 'Show fewer' : 'Show more questions'}</span>
                <span style={{fontSize:11,transition:'transform .3s',transform:faqExpanded?'rotate(180deg)':'none'}}>↓</span>
              </button>
            </div>
            <div className="reveal" style={{position:'sticky',top:80}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:'.16em',textTransform:'uppercase',color:'#f59e0b',marginBottom:14}}>FAQ</div>
              <h2 className="v36-s-title" style={{fontSize:26,textAlign:'left',marginBottom:12,lineHeight:1.12}}>Questions,<br /><em style={{color:'#f59e0b',fontStyle:'italic'}}>answered.</em></h2>
              <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.7,fontWeight:300,marginBottom:20}}>Everything you need to know before signing up.</p>
              <a href="mailto:hello.careeraihub@gmail.com" style={{fontSize:12,color:'var(--blue)',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:5,opacity:.8}}>Still curious? Email us →</a>
            </div>
          </div>
        </div>
      </div>

      {/* ── FUTURE OF HIRING ── */}
      <div id="v36-future" className="v36-future-section">
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 70% 60% at 50% 60%,rgba(236,72,153,.07),transparent 65%)',pointerEvents:'none'}}></div>
        <div className="v36-future-inner">
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:'.16em',textTransform:'uppercase',color:'#818cf8',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
            <span style={{width:24,height:1,background:'rgba(236,72,153,.3)',display:'block'}}></span>
            The future of hiring
            <span style={{width:24,height:1,background:'rgba(236,72,153,.3)',display:'block'}}></span>
          </div>
          <h2 style={{fontFamily:"'Inter',sans-serif",fontSize:'clamp(40px,6vw,68px)',fontWeight:800,letterSpacing:'-.04em',lineHeight:.96,marginBottom:20,color:'var(--text)'}}>The future of hiring is<br /><span style={{background:'linear-gradient(95deg,#ec4899,#8b5cf6,#f59e0b)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',fontStyle:'italic'}}>proof,</span> not keywords.</h2>
          <p style={{fontSize:15,color:'var(--text2)',marginBottom:44,maxWidth:440,marginLeft:'auto',marginRight:'auto',fontWeight:300,lineHeight:1.7}}>CareerAiHub is building the trust infrastructure for modern hiring. Join 2,714 verified candidates and forward-thinking companies already on the platform.</p>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:14,flexWrap:'wrap',marginBottom:22}}>
            <button onClick={join} className="v36-btn-cta">Get Started Free →</button>
            <button onClick={join} className="v36-btn-outline">Create Recruiter Account ↗</button>
          </div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'var(--text3)',letterSpacing:'.04em'}}>Free forever · No card required · 10 AI modules unlocked instantly</div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="v36-footer">
        <div className="v36-footer-inner">
          <div className="v36-footer-grid">
            <div>
              <a href="#" onClick={e=>e.preventDefault()} style={{display:'inline-flex',alignItems:'center',gap:9,textDecoration:'none',marginBottom:14}}>
                <OrbitMark size={26} animated duration={18} />
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:'var(--text)',letterSpacing:'-.02em'}}>CareerAiHub</div>
                  <div style={{fontSize:'11px',color:'var(--text3)',fontFamily:"'Inter',sans-serif",letterSpacing:'.08em',textTransform:'uppercase',marginTop:1}}>Proof over claims.</div>
                </div>
              </a>
              <p style={{fontSize:12,color:'var(--text3)',lineHeight:1.7,maxWidth:220,fontWeight:300,marginBottom:18}}>The trust infrastructure for modern hiring. Built in Singapore.</p>
              <div style={{display:'flex',gap:7}}>
                {['in','𝕏','⌨'].map((icon,i)=>(
                  <a key={i} href="#" onClick={e=>e.preventDefault()} style={{width:30,height:30,borderRadius:7,border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,textDecoration:'none',color:'var(--text3)'}}>{icon}</a>
                ))}
              </div>
            </div>
            <div>
              <div className="v36-footer-col-label">Product</div>
              <div className="v36-footer-links">
                {['ATS Builder','AI Interview Coach','Salary Coach','TrustMatch','Pricing'].map(l=>(
                  <button key={l} onClick={join}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="v36-footer-col-label">Company</div>
              <div className="v36-footer-links">
                {['About','Blog','Careers','Press'].map(l=>(
                  <a key={l} href="#" onClick={e=>e.preventDefault()}>{l}</a>
                ))}
                <a href="mailto:hello.careeraihub@gmail.com">Contact</a>
              </div>
            </div>
            <div>
              <div className="v36-footer-col-label">Legal</div>
              <div className="v36-footer-links">
                <button onClick={() => openLegal('privacy')}>Privacy Policy</button>
                <button onClick={() => openLegal('tos')}>Terms of Service</button>
                <button onClick={() => openLegal('security')}>Security</button>
                <button onClick={() => openLegal('deletion')}>Data Deletion</button>
                <a href="#v36-faq">FAQ</a>
              </div>
            </div>
          </div>
          <div className="v36-footer-bottom">
            <div style={{fontSize:11,color:'var(--text3)',fontFamily:"'DM Mono',monospace"}}>© 2026 CareerAiHub Pte. Ltd. · Singapore</div>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:11,color:'var(--text3)',display:'flex',alignItems:'center',gap:5}}><span style={{width:5,height:5,borderRadius:'50%',background:'#10b981',display:'inline-block',boxShadow:'0 0 5px rgba(16,185,129,.6)'}}></span>All systems operational</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'11px',padding:'2px 8px',borderRadius:20,background:'rgba(16,185,129,.06)',color:'#10b981',border:'1px solid rgba(16,185,129,.15)'}}>PDPA Compliant</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── ATS DECK MODAL ── */}
      <div className={`v36-deck-modal-bg${atsOpen?' open':''}`} onClick={e=>{if(e.target===e.currentTarget)setAtsOpen(false);}}>
        <div className="v36-deck-modal v36-dm-ats">
          <div className="v36-deck-modal-bar">
            <div>
              <div className="v36-dm-bar-title">ATS · Data Engine</div>
              <div className="v36-dm-bar-sub">How CareerAiHub rebuilds your resume in 90 seconds</div>
            </div>
            <button className="v36-dm-close" onClick={()=>setAtsOpen(false)}>✕</button>
          </div>
          <div className="v36-deck-modal-body">
            {ATS_STEPS.map((step, i) => (
              <div key={i} className="v36-dm-step-card">
                <div className="v36-dm-step-num" style={{color:'var(--c1)'}}><span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'rgba(30,201,138,.09)',border:'1px solid rgba(30,201,138,.22)',color:'var(--c1)'}}>{step.status}</span></div>
                <div className="v36-dm-step-title">{step.title}</div>
                <div className="v36-dm-step-desc">{step.desc}</div>
              </div>
            ))}
            <button onClick={join} style={{alignSelf:'center',background:'var(--c1)',color:'#000',fontWeight:700,fontSize:13,padding:'12px 28px',borderRadius:100,border:'none',cursor:'pointer',fontFamily:"'Inter',sans-serif"}}>Build My ATS Resume Free →</button>
          </div>
        </div>
      </div>

      {/* ── INTERVIEW DECK MODAL ── */}
      <div className={`v36-deck-modal-bg${intOpen?' open':''}`} onClick={e=>{if(e.target===e.currentTarget)setIntOpen(false);}}>
        <div className="v36-deck-modal v36-dm-int">
          <div className="v36-deck-modal-bar">
            <div>
              <div className="v36-dm-bar-title">Interview · AI Coach</div>
              <div className="v36-dm-bar-sub">4-dimension coaching that targets your weakest gap first</div>
            </div>
            <button className="v36-dm-close" onClick={()=>setIntOpen(false)}>✕</button>
          </div>
          <div className="v36-deck-modal-body">
            {INT_STEPS.map((step, i) => (
              <div key={i} className="v36-dm-step-card">
                <div className="v36-dm-step-title">{step.title}</div>
                <div className="v36-dm-step-desc">{step.desc}</div>
              </div>
            ))}
            <button onClick={join} style={{alignSelf:'center',background:'var(--c2)',color:'#fff',fontWeight:700,fontSize:13,padding:'12px 28px',borderRadius:100,border:'none',cursor:'pointer',fontFamily:"'Inter',sans-serif"}}>Start AI Interview Practice Free →</button>
          </div>
        </div>
      </div>

      {/* ── LEGAL MODAL ── */}
      <div className={`v36-legal-modal-bg${legalModal.open?' open':''}`} onClick={e=>{if(e.target===e.currentTarget)closeLegal();}}>
        <div className={`v36-legal-sheet${legalModal.open?' open':''}`}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 24px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:18,fontWeight:700,letterSpacing:'-.02em',color:'var(--text)'}}>{legal?.title}</div>
            <button onClick={closeLegal} style={{width:30,height:30,borderRadius:'50%',background:'var(--card3)',border:'1px solid var(--border2)',color:'var(--text2)',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
          </div>
          <div style={{overflowY:'auto',padding:24,fontSize:13,color:'var(--text2)',lineHeight:1.8,fontWeight:300}}>{legal?.body}</div>
        </div>
      </div>

    </div>
  );
}
