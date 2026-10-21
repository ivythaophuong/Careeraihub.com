import React, { useState, useEffect, useRef } from 'react';
import './NewLanding.css';
import ResumeDemo from './ResumeDemo';
import { OrbitMark } from '../../components/OrbitMark';
import dashCrop from './shots/dashboard-crop.png';
import templatesShot from './shots/resume-templates.png';
import recordingShot from './shots/voice-recording.png';
import insightsShot from './shots/speaking-insights.png';
import deliveryShot from './shots/delivery-feedback.png';
import salaryShot from './shots/salary-gap.png';

// The landing page (preview): what a person gets from the product, shown with the real screens.
// Rules (ADR-015, proposed): no invented figures, no ratings or user counts, no partner logos, no "verified" before anything is verified.
// Every screen says what it is: the real product with a synthetic account, or a real screen with personal details blurred.
// NewLanding.test.jsx keeps the claims out. Copy source: docs/product/LANDING-COPY-DECK-L2.md and the owner's brief.
// The founder photo and the founder's own note stay empty until the owner supplies them: nothing here invents a person.

const FOUNDER_PHOTO = null;
const MAIL = 'hello.careeraihub@gmail.com';

const I = {
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h5M9.5 15.5h5',
  chat: 'M4 5h16v11H9l-5 4zM8.5 9.5h7M8.5 12.5h4',
  chart: 'M5 20V10M12 20V4M19 20v-7',
  target: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 16.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zM12 12h.01',
  rules: 'M5 6h14M5 12h14M5 18h9M17 17l2 2 3-4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  proof: 'M12 3l7 3v6c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6zM9 12l2.2 2.2L15.5 10',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 6.3a3.2 3.2 0 0 1 0 6.2M18 14.8c1.9.7 3.1 2.4 3.5 5.2',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
};
const Icon = ({ name, size = 22 }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={I[name]} /></svg>
);

const NAV = [
  { label: 'Tools', href: '#tools' },
  { label: 'Our Approach', href: '#approach' },
  { label: 'Our Story', href: '#story' },
  { label: 'Partnership', href: '#partner' },
];

const TOOLS = [
  { id: 'ats', icon: 'doc', tone: 'pink', title: 'Build a stronger resume', text: 'Get feedback from fixed rules, with the evidence, and AI help to reword weak lines.', cta: 'Explore Resume Tools' },
  { id: 'simulate', icon: 'chat', tone: 'teal', title: 'Practise with purpose', text: 'Practise interview questions written for your role and get feedback on every answer.', cta: 'Explore Interview Practice' },
  { id: 'skillsgap', icon: 'chart', tone: 'amber', title: 'See your skills gap', text: 'Compare your profile with the role you are aiming for and see where it falls short.', cta: 'Explore Skills Gap' },
  { id: 'roadmap', icon: 'target', tone: 'purple', title: 'Plan your next move', text: 'Turn what you have done into a practical path to your target role.', cta: 'Explore Career Roadmap' },
];

const MOMENTS = [
  {
    id: 'apply', title: 'I am applying for jobs', sub: 'Improve your resume and application materials.',
    headline: 'Send applications you have checked, not guessed at.',
    gets: ['See what a reader finds in your CV and what to fix first, by fixed rules.', 'Compare your CV with a job description, with keywords and red flags.', 'Draft a cover letter for each role, and keep every application in one tracker.'],
    stays: 'Your CV is saved once. Every other tool starts from it.',
    tools: 'Resume Builder, ATS Scanner, JD Analyzer, Cover Letter AI, Job Search.',
    shots: [{ key: 'templates', src: templatesShot, w: 732, h: 850, chip: 'Five layouts', alt: 'The Resume Builder layout step: a list of resume templates (Modern Professional and Creative) with a small preview of each', caption: 'Pick a layout and keep your content. A real screen with a synthetic account and made-up data.' }],
  },
  {
    id: 'interview', title: 'I have an interview coming', sub: 'Practise, get feedback, prepare with more confidence.',
    headline: 'Say your answers once before the real thing.',
    gets: ['A mock interview of five questions written for your role, with feedback on every answer.', 'Answer out loud and see your pace, your pauses and a plain-language note on how you delivered it.', 'Keep your best stories in STAR form, and see your weak spots from your own results.'],
    stays: 'Finished sessions and saved stories show up on your Dashboard and Roadmap.',
    tools: 'Interview Coach, STAR Bank, Weakness Radar.',
    shots: [
      { key: 'recording', src: recordingShot, w: 1440, h: 1286, chip: 'Colour follows your voice', alt: 'Voice recording in progress: a live waveform and a rhythm timeline coloured by how loud each stretch was, with a pause of a second or more picked out', caption: 'While you speak, each stretch is coloured by how loud it is compared with your own voice: softer, steady or louder. It is not a grade. Voice practice is rolling out. Synthetic account and made-up data.' },
      { key: 'voice', src: insightsShot, w: 1440, h: 816, chip: 'Measured on your device', alt: 'Speaking insights for a voice answer: pace, speaking time, long pauses, the pace on one scale, the pauses listed with their times and the rhythm timeline', caption: 'Your pace, your pauses and your rhythm, with no target and no score. Synthetic account and made-up data.' },
      { key: 'delivery', src: deliveryShot, w: 1440, h: 946, chip: 'Does not change your score', alt: 'Feedback on a spoken answer: what worked, what was missed, a tip and how it was delivered', caption: 'What worked, what was missed, and how you delivered it, written from your own figures. Synthetic account and made-up data.' },
    ],
  },
  {
    id: 'offer', title: 'I have an offer', sub: 'Go into the conversation with a plan.',
    headline: 'Know what you will say before you sit down.',
    gets: ['Practise the conversation with an AI negotiation coach.', 'Write anchoring scripts that you fill in with your own numbers.', 'No invented market figures. You bring the numbers; we help you use them.'],
    stays: 'Salary Prep starts from your saved CV, so the coach knows your background.',
    tools: 'Salary Prep.',
    shots: [{ key: 'salary', src: salaryShot, w: 1104, h: 1326, chip: 'Calculated, not guessed', alt: 'Salary Prep with an offer, a target and the calculated gap', caption: 'The gap comes from the numbers you enter, not from AI. Synthetic account and made-up data.' }],
  },
  {
    id: 'next', title: 'I am not sure what is next', sub: 'Get guidance and see what to focus on.',
    headline: 'Always know your next step.',
    gets: ['Your priority actions and your week at a glance on the Dashboard.', 'A path to your target role, with next steps based on what you have done.', 'An AI Career Coach that knows your profile, your sessions and your stories.'],
    stays: 'It reads what you did in the other tools, so the advice is about you.',
    tools: 'Dashboard, Career Roadmap, Skills Gap, AI Career Coach.',
    shots: [{ key: 'dashboard', src: dashCrop, w: 2424, h: 1000, chip: 'From your own activity', alt: 'The Dashboard with the plan for the week and priority actions', caption: 'Priority actions and a plan for the week. Synthetic account and made-up data.' }],
  },
];

// Who does what. The wording follows ADR-011: the number a user sees is computed by code, and the model explains but never sets it.
const FLOW = [
  { tag: 'Deterministic', title: 'The same input, the same result.', text: 'Rules we wrote and test decide your result. It stays consistent, and each part shows its evidence.',
    art: <svg viewBox="0 0 120 56" width="120" height="56" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="8" width="26" height="34" rx="4" /><path d="M12 18h14M12 25h14M12 32h9" /><path d="M42 20h14M42 30h14" /><rect x="64" y="8" width="26" height="34" rx="4" /><path d="M70 18h14M70 25h14M70 32h9" /><path d="M98 25l6 6 11-12" /></svg> },
  { tag: 'AI', title: 'Explains and suggests.', text: 'It helps you understand the result and how to improve it. It never sets your score.',
    art: <svg viewBox="0 0 120 56" width="120" height="56" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 8h66a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H34l-12 10V36h-12a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z" transform="translate(4 0)" /><path d="M24 18h38M24 26h24" /><path d="M96 10l2.4 6.6L105 19l-6.6 2.4L96 28l-2.4-6.6L87 19l6.6-2.4z" /></svg> },
  { tag: 'You', title: 'Decide what to do.', text: 'Always. You choose what to keep, change or leave.',
    art: <svg viewBox="0 0 120 56" width="120" height="56" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="10" width="32" height="14" rx="7" /><path d="M16 17l4 4 8-8" /><rect x="44" y="10" width="32" height="14" rx="7" strokeDasharray="3 4" /><rect x="82" y="10" width="32" height="14" rx="7" strokeDasharray="3 4" /><path d="M10 40h100" /><circle cx="22" cy="40" r="5" fill="currentColor" /></svg> },
];

const FAQ = [
  { q: 'Is CareerAiHub free?', a: 'Yes, while we build. No card is needed, and no paid plan has been announced. Some AI tools may be slow or limited at busy times.' },
  { q: 'How is the ATS readiness result calculated?', a: 'By fixed rules: whether the basics are there (name, email, experience or education, skills), how many of your bullets contain a measurable number, and whether your dates contradict each other. The same CV gives the same result, and each part shows its evidence. It is not the score any recruiting system gives you, and no major ATS publishes one universal score.' },
  { q: 'Does AI write or change my CV?', a: 'AI can point out weak lines and suggest how to reword them. You decide what to keep. AI does not change the result of the check.' },
  { q: 'Do you predict whether I will get an interview or a job?', a: 'No. Career outcomes depend on many things. Feedback here supports your preparation. It does not predict or guarantee a result.' },
  { q: 'What happens to my CV and my practice answers?', a: 'They are saved to your account so each tool can start from what you already did. Voice recordings are sent to a speech provider to be turned into text, and we do not keep them. Read the Privacy Policy for the details.' },
  { q: 'Can I practise out loud?', a: 'Voice practice is rolling out and is not available to everyone yet. It is in English. You see your transcript and can correct it before it is graded, and the notes on delivery come from figures measured on your device.' },
  { q: 'Do you match me with employers or check my credentials?', a: 'Not yet. Employer matching is planned and credential checks are in development. Neither is available today, and we will not describe either as live before it is.' },
];

const PARTNER = [
  { icon: 'users', title: 'Early users', text: 'Try the available tools, share feedback and help us improve.' },
  { icon: 'cube', title: 'Partners and organizations', text: 'Explore pilot opportunities and industry collaboration.' },
  { icon: 'spark', title: 'Experts and educators', text: 'Share your insights and help shape the future of career development.' },
];

// The tools of the app's own sidebar (src/components/AppSidebar.jsx) with their badges. Verify Creds (in development) and TrustMatch (planned) are not drawn; the caption says more are on the way.
// x and y are positions on the 520 x 400 drawing, round the logo at (260, 200).
// The example questions of the AI Career Coach in the app (src/features/AICoach/AICoach.jsx, QUICK_PROMPTS), the first three of them in the same words.
const COACH_QUESTIONS = ['What should I focus on this week?', 'How do I answer the biggest weakness question?', 'How do I negotiate salary before I have an offer?'];
const ORBIT_TOOLS = [
  { name: 'Resume Builder', badge: 'Live', icon: 'doc', x: 260, y: 66 },
  { name: 'ATS Scanner', badge: 'Live', icon: 'rules', x: 382, y: 108 },
  { name: 'Cover Letter AI', badge: 'New', icon: 'spark', x: 432, y: 200 },
  { name: 'Interview Coach', badge: 'Live', icon: 'chat', x: 382, y: 292 },
  { name: 'Salary Prep', badge: 'Live', icon: 'chart', x: 260, y: 334 },
  { name: 'Skills Gap', badge: 'New', icon: 'target', x: 138, y: 292 },
  { name: 'Career Roadmap', badge: 'New', icon: 'cube', x: 88, y: 200 },
  { name: 'AI Career Coach', badge: 'New', icon: 'users', x: 138, y: 108 },
];
const toolPath = (t) => `M${t.x} ${t.y}L260 200`; // from the tool into the middle: every tool feeds the one CV and one memory
const toolPathOut = (t) => `M260 200L${t.x} ${t.y}`; // and from the middle back out: every tool starts from the same CV and memory
const prefersReducedMotion = () => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const Logo = ({ size = 28, animated = false }) => <OrbitMark size={size} animated={animated} duration={8} />; // the brand mark of the app (the pink orbit shown while the app loads)


export default function NewLanding({ onStart, onSignIn, onModuleSelect }) {
  const [sel, setSel] = useState('apply');
  const [menuOpen, setMenuOpen] = useState(false);
  const [paused, setPaused] = useState(false); // WCAG 2.2.2: motion that starts by itself and lasts more than five seconds can be paused
  const rootRef = useRef(null);
  const cur = MOMENTS.find(m => m.id === sel) || MOMENTS[0];
  const start = () => { setMenuOpen(false); onStart && onStart(); };
  const signIn = () => { setMenuOpen(false); onSignIn && onSignIn(); };
  const openTool = (id) => onModuleSelect && onModuleSelect(id);

  // The CSS animations are stopped by the data-motion rule in the stylesheet; the SVG ones (the moving dots, the satellites of the logo) are stopped through the SVG element.
  useEffect(() => {
    rootRef.current?.querySelectorAll('svg').forEach((svg) => { try { if (paused) svg.pauseAnimations?.(); else svg.unpauseAnimations?.(); } catch { /* an SVG without a timeline has nothing to stop */ } });
  }, [paused]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="nl" ref={rootRef} data-motion={paused ? 'paused' : 'on'}>
      <header className="nl-header">
        <div className="nl-wrap nl-nav">
          <a href="#top" className="nl-brand"><Logo />CareerAiHub</a>
          <nav aria-label="Page sections" className="nl-nav-links">
            {NAV.map(n => <a key={n.href} href={n.href}>{n.label}</a>)}
          </nav>
          <div className="nl-nav-actions">
            <button type="button" className="nl-link-btn nl-hide-sm" onClick={signIn}>Log in</button>
            <button type="button" className="nl-btn nl-btn-grad nl-btn-sm" onClick={start}>Get Started</button>
            <button type="button" className="nl-menu-btn" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="nl-menu" onClick={() => setMenuOpen(o => !o)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
          </div>
        </div>
        {menuOpen && (
          <div id="nl-menu" className="nl-menu">
            {NAV.map(n => <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)}>{n.label}</a>)}
            <button type="button" className="nl-link-btn" onClick={signIn}>Log in</button>
          </div>
        )}
      </header>

      <main id="top">
        <section className="nl-hero">
          <div className="nl-wrap nl-hero-grid">
            <div className="nl-hero-copy">
              <div className="nl-eyebrow">Your career operating system</div>
              <h1 className="nl-h1"><span>Know what to improve.</span>{' '}<span>Practice what matters.</span>{' '}<span>Move forward <em className="nl-grad-text">with clarity.</em></span></h1>
              <p className="nl-lead">CareerAiHub brings together practical AI-powered career tools to help you understand your strengths, build your skills and build your confidence for your next step, with feedback that shows its evidence.</p>
              <div className="nl-cta-row">
                <a className="nl-btn nl-btn-grad" href="#tools">Explore Career Tools <Icon name="arrow" size={18} /></a>
                <a className="nl-btn nl-btn-ghost" href="#system">See How It Works <Icon name="arrow" size={18} /></a>
              </div>
              <ul className="nl-caps">
                {['Resume feedback', 'Interview practice', 'Skills and next steps'].map(c => <li key={c}><span aria-hidden="true"><Icon name="check" size={14} /></span>{c}</li>)}
              </ul>
              <p className="nl-small nl-subtle">Free while we build. No card needed.</p>
            </div>
            <figure className="nl-hero-shot">
              <ResumeDemo onStart={start} />
              <figcaption>Try it: the score fills, then press Next to see what a sample CV needs to fix. Your own CV gives your own result.</figcaption>
            </figure>
          </div>
        </section>

        <section className="nl-section nl-challenge">
          <div className="nl-wrap nl-split">
            <div className="nl-copy">
              <div className="nl-eyebrow">The challenge</div>
              <h2 className="nl-h2">Your career is connected. Your tools are not.</h2>
              <p className="nl-point">Your CV, interviews, skills and next move <strong>depend on each other</strong>.</p>
              <p className="nl-point">The tools for them are usually scattered, so you <strong>start over every time</strong>.</p>
              <p className="nl-point">CareerAiHub is being built as one place: <strong>one CV and one memory behind every tool</strong>.</p>
            </div>
            <div className="nl-orb-wrap">
              <div className="nl-orb" role="img" aria-label="The CareerAiHub logo in the middle, connected to the tools of the platform: Resume Builder, ATS Scanner, Cover Letter AI, Interview Coach, Salary Prep, Skills Gap, Career Roadmap and AI Career Coach">
                <svg className="nl-orb-lines" aria-hidden="true" viewBox="0 0 520 400" preserveAspectRatio="xMidYMid meet">
                  {ORBIT_TOOLS.map(t => <path key={t.name} className="nl-line" d={toolPathOut(t)} />)}
                  {ORBIT_TOOLS.map((t, i) => <path key={`f-${t.name}`} className="nl-flow-line" d={toolPathOut(t)} pathLength="100" style={{ animationDelay: `${i * -0.6}s` }} />)}
                  {ORBIT_TOOLS.map((t, i) => [0, 1, 2].map(k => <circle key={`in-${t.name}-${k}`} className="nl-pulse" data-dir="in" r="3"><animateMotion dur="5s" begin={`${(i * 0.35 + k * 5 / 3).toFixed(2)}s`} repeatCount="indefinite" path={toolPath(t)} /></circle>))}
                  {ORBIT_TOOLS.map((t, i) => [0, 1, 2].map(k => <circle key={`out-${t.name}-${k}`} className="nl-pulse" data-dir="out" r="3"><animateMotion dur="5s" begin={`${(i * 0.35 + k * 5 / 3 + 0.8).toFixed(2)}s`} repeatCount="indefinite" path={toolPathOut(t)} /></circle>))}
                </svg>
                <div className="nl-orb-ring" aria-hidden="true" /><div className="nl-orb-ring nl-orb-ring2" aria-hidden="true" />
                <div className="nl-orb-core"><OrbitMark size={132} animated={!prefersReducedMotion()} duration={6} /></div>
                {ORBIT_TOOLS.map((t, i) => (
                  <div key={t.name} className="nl-orb-card" style={{ left: `${t.x / 5.2}%`, top: `${t.y / 4}%`, animationDelay: `${i * -0.7}s` }}>
                    <Icon name={t.icon} size={16} /><span className="nl-orb-name">{t.name}</span><span className={`nl-orb-badge nl-orb-badge-${t.badge.toLowerCase()}`}>{t.badge}</span>
                  </div>
                ))}
              </div>
              <p className="nl-orb-caption"><strong>Every tool starts from the same CV and memory.</strong> More tools are in development.</p>
              <button type="button" className="nl-motion-btn" aria-pressed={paused} onClick={() => setPaused(p => !p)}>{paused ? 'Play motion' : 'Pause motion'}</button>
            </div>
          </div>
        </section>

        <section id="tools" className="nl-section nl-tools">
          <div className="nl-wrap nl-split nl-split-tools">
            <div className="nl-copy">
              <div className="nl-eyebrow">What you can do</div>
              <h2 className="nl-h2">Practical tools for your next career move.</h2>
              <p>Everything you need to prepare, practise and decide, in one place.</p>
              <button type="button" className="nl-btn nl-btn-grad" onClick={start}>Explore All Tools <Icon name="arrow" size={18} /></button>
            </div>
            <ul className="nl-cards">
              {TOOLS.map(t => (
                <li key={t.id} className="nl-card">
                  <span className={`nl-icon nl-tone-${t.tone}`}><Icon name={t.icon} /></span>
                  <h3>{t.title}</h3>
                  <p>{t.text}</p>
                  <button type="button" className="nl-card-link" onClick={() => openTool(t.id)} aria-label={t.cta}>{t.cta} <Icon name="arrow" size={16} /></button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="system" className="nl-light">
          <div className="nl-wrap nl-moments">
            <div className="nl-eyebrow nl-eyebrow-light">See it here</div>
            <h2 className="nl-h2">Where are you right now?</h2>
            <p className="nl-light-lead">Choose your situation and see what you get. The goal is the same in each: to build your confidence for the next step.</p>
            <div role="group" aria-label="Where are you right now?" className="nl-moment-grid">
              {MOMENTS.map(m => (
                <button key={m.id} type="button" aria-pressed={m.id === sel} className="nl-moment" onClick={() => setSel(m.id)}>
                  <span className="nl-moment-title">{m.title}</span>
                  <span className="nl-moment-sub">{m.sub}</span>
                </button>
              ))}
            </div>
            <div className="nl-panel" key={cur.id} aria-live="polite">
              <div className="nl-panel-left">
                <div className="nl-kicker">What you get</div>
                <h3 className="nl-h3">{cur.headline}</h3>
                <ul className="nl-gets">
                  {cur.gets.map(g => <li key={g}><span aria-hidden="true"><Icon name="arrow" size={16} /></span><span>{g}</span></li>)}
                </ul>
                <div className="nl-stays"><span className="nl-kicker">What stays with you</span><span>{cur.stays}</span></div>
                <div className="nl-small nl-panel-muted">Behind this: {cur.tools}</div>
              </div>
              <div className="nl-panel-right">
                {cur.shots.map(s => (
                  <figure key={s.key} className="nl-shot">
                    <div className="nl-shot-frame"><img src={s.src} width={s.w} height={s.h} alt={s.alt} loading="lazy" decoding="async" /></div>
                    <figcaption><span className="nl-chip">{s.chip}</span>{s.caption}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="coach" className="nl-section nl-coach-sec">
          <div className="nl-wrap nl-coach">
            <div className="nl-coach-copy">
              <div className="nl-eyebrow">Your coach</div>
              <h2 className="nl-h2">Ask your AI Career Coach</h2>
              <p>Ask about your next move, interviews, salary or applications.</p>
              <p className="nl-coach-note">It knows your target role, level, market and a short summary of your activity. It does not read your CV.</p>
            </div>
            <div className="nl-chat" role="group" aria-label="An example of asking the AI Career Coach">
              <div className="nl-chat-head"><OrbitMark size={30} /><b>AI Career Coach</b><span className="nl-orb-badge nl-orb-badge-new">New</span></div>
              <div className="nl-chat-body">
                <ul className="nl-coach-q">{COACH_QUESTIONS.map((q, i) => <li key={q} style={{ animationDelay: `${i * 0.15}s` }}><button type="button" onClick={() => openTool('aichat')}>{q}</button></li>)}</ul>
                <div className="nl-coach-typing" aria-hidden="true"><i /><i /><i /></div>
              </div>
              <button type="button" className="nl-chat-input" onClick={() => openTool('aichat')}><span>Ask your career coach anything…</span><span className="nl-chat-send" aria-hidden="true"><Icon name="arrow" size={16} /></span></button>
            </div>
          </div>
        </section>

        <section id="approach" className="nl-section nl-approach">
          <div className="nl-wrap">
            <div className="nl-copy nl-approach-intro">
              <div className="nl-eyebrow">Our approach</div>
              <h2 className="nl-h2">AI should help you move forward. It should not make the decision for you.</h2>
              <p>We believe career technology should be useful, transparent and grounded in evidence. Here is who does what.</p>
            </div>
            <ol className="nl-flow">
              {FLOW.map((f, i) => (
                <React.Fragment key={f.tag}>
                  <li className="nl-flow-step">
                    <span className="nl-flow-art" aria-hidden="true">{f.art}</span>
                    <span className="nl-flow-tag">{f.tag}</span>
                    <h3>{f.title}</h3>
                    <p>{f.text}</p>
                  </li>
                  {i < FLOW.length - 1 && <li className="nl-flow-arrow" aria-hidden="true"><i /><i /><i /></li>}
                </React.Fragment>
              ))}
            </ol>
            <div className="nl-flow-foot">
              <span>Every point shows its evidence.</span>
              <span>No ratings, user counts or partner logos here, because we do not have evidence for them yet.</span>
              <span><strong>We cannot promise a result. We can help you walk in prepared.</strong></span>
            </div>
            <a className="nl-text-link" href="#faq">Read the questions people ask <Icon name="arrow" size={16} /></a>
          </div>
        </section>

        <section id="faq" className="nl-section nl-faq">
          <div className="nl-wrap nl-split nl-split-faq">
            <div className="nl-copy">
              <div className="nl-eyebrow">Questions</div>
              <h2 className="nl-h2">Questions, answered.</h2>
              <p>What the product does, what it does not do, and what happens to your information.</p>
              <a className="nl-text-link" href={`mailto:${MAIL}`}>Ask us something else <Icon name="arrow" size={16} /></a>
            </div>
            <div className="nl-faq-list">
              {FAQ.map(f => (
                <details key={f.q} className="nl-qa">
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="story" className="nl-section nl-story">
          <div className={`nl-wrap nl-split${FOUNDER_PHOTO ? '' : ' nl-single'}`}>
            <div className="nl-copy">
              <div className="nl-eyebrow">Our story</div>
              <h2 className="nl-h2">Why we built CareerAiHub.</h2>
              <p>Career development involves more than writing a resume. It means learning how to communicate your experience, preparing for interviews, recognising gaps and deciding what to work on next.</p>
              <p>CareerAiHub began with a simple question: what if people had one place to understand where they stand, practise essential skills and walk into what comes next with confidence?</p>
              <p className="nl-muted">CareerAiHub is an early-stage AI startup exploring how connected, practical tools can make career development more accessible and actionable. We are building, testing and learning from real user needs, with a long-term ambition to create a more connected career operating system.</p>
              <a className="nl-text-link" href={`mailto:${MAIL}`}>Get in touch <Icon name="arrow" size={16} /></a>
            </div>
            {FOUNDER_PHOTO && <figure className="nl-founder"><img src={FOUNDER_PHOTO} alt="The founder of CareerAiHub" loading="lazy" decoding="async" /></figure>}
          </div>
        </section>

        <section id="partner" className="nl-section nl-partner">
          <div className="nl-wrap nl-split nl-split-partner">
            <div className="nl-copy">
              <div className="nl-eyebrow">Partner with us</div>
              <h2 className="nl-h2">Let us build a stronger career ecosystem.</h2>
              <p>We are looking to connect with individuals and organisations who share our vision and want to explore practical collaborations, pilots or expert contributions.</p>
              <a className="nl-btn nl-btn-grad" href={`mailto:${MAIL}?subject=Partnership`}>Explore Partnership <Icon name="arrow" size={18} /></a>
            </div>
            <ul className="nl-partner-cols">
              {PARTNER.map(p => <li key={p.title}><span className="nl-icon nl-tone-pink"><Icon name={p.icon} /></span><h3>{p.title}</h3><p>{p.text}</p></li>)}
            </ul>
          </div>
        </section>
      </main>

      <footer className="nl-footer">
        <div className="nl-wrap nl-footer-grid">
          <div className="nl-footer-brand">
            <a href="#top" className="nl-brand"><Logo />CareerAiHub</a>
            <p>Your Career Operating System. Built for Every Next Chapter.</p>
          </div>
          <div className="nl-footer-links">
            <div><h3>Product</h3><a href="#tools">Tools</a><a href="#approach">Our Approach</a><a href="#story">Our Story</a></div>
            <div><h3>Company</h3><a href="#partner">Partnership</a><a href={`mailto:${MAIL}`}>Contact</a></div>
            <div><h3>Legal</h3>
              <button type="button" className="nl-link-btn" onClick={() => onModuleSelect && onModuleSelect('privacy')}>Privacy</button>
              <button type="button" className="nl-link-btn" onClick={() => onModuleSelect && onModuleSelect('terms')}>Terms</button>
            </div>
          </div>
        </div>
        <div className="nl-wrap nl-footer-note">
          <p>Career outcomes depend on individual circumstances. AI-generated feedback is intended to support preparation and decision-making, not guarantee employment or hiring outcomes.</p>
          <p>&copy; {new Date().getFullYear()} CareerAiHub</p>
        </div>
      </footer>
    </div>
  );
}
