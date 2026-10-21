import React, { useState } from 'react';
import './NewLanding.css';
import dashDark from './shots/dashboard-dark.png';
import dashLight from './shots/dashboard-light.png';
import resumeShot from './shots/resume-builder.png';
import voiceShot from './shots/voice-answer.png';
import feedbackShot from './shots/voice-feedback.png';
import salaryShot from './shots/salary-prep.png';

// The landing page (preview): what the owner gets from the product, shown with the real screens.
// Rules (ADR-015, proposed): no invented figures, no ratings or user counts, no partner logos, no "verified" before anything is verified.
// Every screen below is the real product with a synthetic account and made-up data, and says so. NewLanding.test.jsx keeps the claims out.
// Copy source: docs/product/LANDING-COPY-DECK-L2.md. Voice practice is described as rolling out, not as available to everyone.

const HERO = {
  headline: 'Your career operating system.',
  sub: 'Know what to fix. Practise before it counts. Always see your next step. One CV and one memory behind it all, from your first application to your next negotiation.',
};

const MOMENTS = [
  {
    id: 'apply', title: 'I am applying for jobs', sub: 'Know what to fix, and tailor each application.',
    headline: 'Send applications you have checked, not guessed at.',
    lead: 'See what a reader finds in your CV and what to fix first. Then make each application fit the role without starting over.',
    gets: [
      'See what a reader finds in your CV and what to fix first, by fixed rules, not guesses.',
      'See how your CV matches a job description: an AI estimate, with keywords and red flags.',
      'Draft a cover letter for each role from your real CV and the job description.',
      'Keep every application in one tracker.',
    ],
    stays: 'Your CV is saved once. Every other tool starts from it.',
    tools: 'Resume Builder, ATS Scanner, JD Analyzer, Cover Letter AI, Job Search.',
    shots: [{ key: 'resume', src: resumeShot, w: 1440, h: 900, alt: 'The Resume Builder showing three rule-based checks with the evidence for each', caption: 'Resume Builder: three checks by fixed rules, each with its evidence. "Email not found" is a fact about the file.' }],
  },
  {
    id: 'interview', title: 'I have an interview coming', sub: 'Practise before it counts.',
    headline: 'Say your answers once before the real thing.',
    lead: 'Practise on questions written for your role, get feedback on every answer, and keep your best stories ready to use again.',
    gets: [
      'A mock interview of five questions written for the role you enter.',
      'Feedback on every answer, untimed or against the clock, typed or spoken.',
      'For spoken answers: your pace, your pauses and a plain-language note on how you delivered it.',
      'Your best stories saved in STAR form, ready for next time.',
      'A view of your weak spots, built only from your own results. Where there is not enough evidence, it says so.',
    ],
    stays: 'Finished sessions and saved stories show up on your Dashboard and Roadmap.',
    tools: 'Interview Coach, STAR Bank, Weakness Radar.',
    shots: [
      { key: 'voice', src: voiceShot, w: 1440, h: 1150, alt: 'Voice answer with the transcript, speaking pace, speaking time, long pauses and a rhythm timeline', caption: 'Answer out loud and check the transcript. Speaking insights show your pace, your speaking time and your long pauses, measured on your device. Voice practice is rolling out.' },
      { key: 'delivery', src: feedbackShot, w: 1440, h: 1150, alt: 'Feedback on a spoken answer: what worked, what was missed, a tip and how it was delivered', caption: 'Feedback on what you said, and on how you delivered it, written from your own figures. It does not change your score.' },
    ],
  },
  {
    id: 'offer', title: 'I have an offer', sub: 'Go into the conversation with a plan.',
    headline: 'Know what you will say before you sit down.',
    lead: 'Practise the negotiation with an AI coach, and prepare your opening lines with your own numbers.',
    gets: [
      'Practise the conversation with an AI negotiation coach.',
      'Write anchoring scripts that you fill in with your own numbers.',
      'No invented market figures. You bring the numbers; we help you use them.',
    ],
    stays: 'Salary Prep starts from your saved CV, so the coach knows your background.',
    tools: 'Salary Prep.',
    shots: [{ key: 'salary', src: salaryShot, w: 1440, h: 900, alt: 'Salary Prep with an offer, a target and the calculated gap', caption: 'Salary Prep: the gap is calculated from the numbers you enter, not guessed by AI.' }],
  },
  {
    id: 'next', title: 'I am not sure what is next', sub: 'See where you stand and what to do.',
    headline: 'Always know your next step.',
    lead: 'Your week at a glance, a path to the role you want, and a coach that knows your profile.',
    gets: [
      'Your priority actions and your week at a glance on the Dashboard.',
      'A personal path to your target role, with next steps based on what you have actually done.',
      'Your skills reviewed against the role you are aiming for.',
      'An AI Career Coach that knows your profile, your sessions and your stories.',
    ],
    stays: 'It reads what you did in the other tools, so the advice is about you.',
    tools: 'Dashboard, Career Roadmap, Skills Gap, AI Career Coach.',
    shots: [{ key: 'dashboard', theme: true, w: 1440, h: 900, alt: 'The Dashboard with priority actions and a plan for the week', caption: 'Dashboard: priority actions and a plan for the week, drawn from what you have done.' }],
  },
];

const PILLARS = [
  { name: 'Never start from zero', text: 'Your CV and your sessions are saved, so each tool starts from what you already did.' },
  { name: 'Always know your next step', text: 'The Dashboard and the Roadmap point to what to do next, from your real activity.' },
  { name: 'See why, not just a verdict', text: 'The CV check follows fixed rules and shows its evidence. Where there is not enough evidence, we say so.' },
];

const STEPS = [
  { n: 1, name: 'Add your CV once', text: 'Upload it or paste it. It is saved to your account and becomes the starting point for every tool.' },
  { n: 2, name: 'Use any tool', text: 'Each one starts from your CV. Practice sessions and stories are saved as you go.' },
  { n: 3, name: 'Come back to your next step', text: 'The Dashboard and the Career Roadmap show what to do next, based on what you have done.' },
];

const PRINCIPLES = [
  { name: 'The numbers come from rules', text: 'The CV check follows fixed rules: the same CV gives the same result. AI writes the explanations and suggestions.' },
  { name: 'Evidence over assumptions', text: 'You can see what we read from your CV and why a point was raised. Where there is not enough evidence, we say so.' },
  { name: 'Proof over claims', text: 'There are no ratings, user counts or partner logos on this page, because we do not have evidence for them yet.' },
];

const LIMITS = [
  { text: 'We do not give you the score a recruiting system gives you. No major ATS publishes one universal score.', tag: 'By design' },
  { text: 'We do not predict interviews or hiring.', tag: 'By design' },
  { text: 'Employer matching is not available yet.', tag: 'Planned' },
  { text: 'Credential checks are in development.', tag: 'In development' },
  { text: 'Voice practice is not available to everyone yet.', tag: 'Limited' },
];

const prefersDark = () => {
  try { return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; }
};

export default function NewLanding({ onStart, onSignIn, onModuleSelect }) {
  const [theme, setTheme] = useState(() => (prefersDark() ? 'dark' : 'light'));
  const [sel, setSel] = useState('apply');
  const cur = MOMENTS.find(m => m.id === sel) || MOMENTS[0];
  const start = () => onStart && onStart();

  return (
    <div className="nl" data-theme={theme}>
      <header className="nl-wrap nl-nav">
        <a href="#top" className="nl-brand">
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="9" stroke="var(--nl-accent)" strokeWidth="2.2" /><circle cx="13" cy="13" r="3.2" fill="var(--nl-accent)" /><circle cx="21" cy="9" r="2.2" fill="var(--nl-ink)" /></svg>
          CareerAiHub
        </a>
        <nav aria-label="Page sections" className="nl-nav-links">
          <a href="#system">What you get</a>
          <a href="#approach">Our approach</a>
          <a href="#story">Our story</a>
        </nav>
        <div className="nl-nav-actions">
          <button type="button" className="nl-link-btn" aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>{theme === 'dark' ? 'Light' : 'Dark'}</button>
          <button type="button" className="nl-link-btn" onClick={() => onSignIn && onSignIn()}>Log in</button>
          <button type="button" className="nl-pill nl-pill-ink" onClick={start}>Start free</button>
        </div>
      </header>

      <main id="top">
        <section className="nl-wrap nl-hero">
          <div className="nl-eyebrow">Career operating system</div>
          <h1 className="nl-display nl-h1">{HERO.headline}</h1>
          <p className="nl-lead">{HERO.sub}</p>
          <div className="nl-cta-row">
            <button type="button" className="nl-pill nl-pill-accent nl-pill-lg" onClick={start}>Start free</button>
            <a className="nl-text-link" href="#system">See what you get &darr;</a>
            <span className="nl-muted nl-small">Free while we build. No card needed.</span>
          </div>
        </section>

        <section className="nl-wrap nl-product" aria-label="The product">
          <figure className="nl-window">
            <div className="nl-window-bar" aria-hidden="true"><i /><i /><i /><span>CareerAiHub &middot; Dashboard</span></div>
            <img src={theme === 'dark' ? dashDark : dashLight} width={1440} height={900} alt="The CareerAiHub Dashboard: the latest practice session, saved stories, priority actions and a plan for the week" decoding="async" />
          </figure>
          <p className="nl-small nl-muted">The real product, with a synthetic account and made-up data. AI estimates are labelled as estimates in the product.</p>
        </section>

        <section id="system" className="nl-wrap nl-moments">
          <h2 className="nl-display nl-h2">Where are you right now?</h2>
          <div role="group" aria-label="Where are you right now?" className="nl-moment-grid">
            {MOMENTS.map(m => (
              <button key={m.id} type="button" aria-pressed={m.id === sel} className="nl-moment" onClick={() => setSel(m.id)}>
                <span className="nl-display nl-moment-title">{m.title}</span>
                <span className="nl-moment-sub">{m.sub}</span>
              </button>
            ))}
          </div>
          <div className="nl-panel" key={cur.id} aria-live="polite">
            <div className="nl-panel-left">
              <div className="nl-kicker">What you get</div>
              <h3 className="nl-display nl-h3">{cur.headline}</h3>
              <p className="nl-panel-lead">{cur.lead}</p>
            </div>
            <div className="nl-panel-right">
              <ul className="nl-gets">
                {cur.gets.map(g => <li key={g}><span aria-hidden="true">&rarr;</span><span>{g}</span></li>)}
              </ul>
              <div className="nl-stays"><span className="nl-kicker">What stays with you</span><span>{cur.stays}</span></div>
              <div className="nl-small nl-panel-muted">Behind this: {cur.tools}</div>
            </div>
            <div className="nl-shots">
              {cur.shots.map(s => (
                <figure key={s.key} className="nl-shot">
                  <img src={s.theme ? (theme === 'dark' ? dashDark : dashLight) : s.src} width={s.w} height={s.h} alt={s.alt} loading="lazy" decoding="async" />
                  <figcaption>{s.caption}</figcaption>
                </figure>
              ))}
              <p className="nl-small nl-panel-muted nl-shots-note">Real product screens with a synthetic account and made-up data. AI estimates are labelled as estimates in the product.</p>
            </div>
          </div>
        </section>

        <section className="nl-band">
          <div className="nl-wrap nl-problem">
            <h2 className="nl-display nl-h2">Your career is connected. Your tools are not.</h2>
            <p>A CV is one part of the story. Preparing for an interview, telling your experience clearly, seeing where your skills fall short and deciding what to do next are linked, yet the tools for them are scattered. CareerAiHub is an early-stage product that puts these steps in one system and shares your CV between them, so you do not start from zero each time.</p>
          </div>
          <div className="nl-wrap nl-three">
            {PILLARS.map(p => <div key={p.name} className="nl-three-item nl-accent-top"><h3 className="nl-display">{p.name}</h3><p>{p.text}</p></div>)}
          </div>
        </section>

        <section id="how" className="nl-wrap nl-section">
          <h2 className="nl-display nl-h2">Start once. Every tool picks up from there.</h2>
          <div className="nl-three">
            {STEPS.map(s => <div key={s.n} className="nl-three-item nl-accent-top"><div className="nl-kicker">Step {s.n}</div><h3 className="nl-display nl-step-name">{s.name}</h3><p>{s.text}</p></div>)}
          </div>
        </section>

        <section id="approach" className="nl-wrap nl-section">
          <h2 className="nl-display nl-h2 nl-h2-xl">AI should help you move forward. It should not make the decision for you.</h2>
          <div className="nl-three">
            {PRINCIPLES.map(p => <div key={p.name} className="nl-three-item nl-rule-top"><h3 className="nl-display">{p.name}</h3><p>{p.text}</p></div>)}
          </div>
          <p className="nl-small nl-muted nl-narrow">Career outcomes depend on many things. Feedback here supports your preparation. It does not predict or guarantee a result.</p>
        </section>

        <section className="nl-wrap nl-section nl-limits">
          <h2 className="nl-display nl-h2">What we do not do.</h2>
          <ul className="nl-limit-list">
            {LIMITS.map(l => <li key={l.text}><span>{l.text}</span><span className="nl-tag">{l.tag}</span></li>)}
          </ul>
        </section>

        <section id="story" className="nl-wrap nl-section nl-story">
          <div className="nl-story-left">
            <h2 className="nl-display nl-h2">An early product, built step by step.</h2>
            <p className="nl-lead nl-lead-sm">CareerAiHub is at an early stage. We are building the tools, learning from people who try them, and fixing what does not work. We do not promise shortcuts or guaranteed outcomes.</p>
          </div>
          <div className="nl-story-right">
            <div className="nl-join">
              <h3 className="nl-display">Try it</h3>
              <p>Use the tools and tell us what is useful and what is not.</p>
              <button type="button" className="nl-text-link nl-btn-link" onClick={start}>Start free &rarr;</button>
            </div>
            <div className="nl-join">
              <h3 className="nl-display">Work with us</h3>
              <p>Interested in a pilot or in sharing expertise? Write to us.</p>
              <a className="nl-text-link" href="mailto:hello.careeraihub@gmail.com">hello.careeraihub@gmail.com &rarr;</a>
            </div>
          </div>
        </section>

        <section className="nl-close">
          <div className="nl-wrap nl-close-inner">
            <h2 className="nl-display">Start with one CV. Build from there.</h2>
            <button type="button" className="nl-pill nl-pill-light nl-pill-lg" onClick={start}>Start free</button>
          </div>
        </section>
      </main>

      <footer className="nl-wrap nl-footer">
        <div>
          <strong>CareerAiHub</strong>
          <p>AI feedback supports preparation. It does not guarantee employment or hiring outcomes.</p>
        </div>
        <div className="nl-footer-links">
          <button type="button" className="nl-link-btn" onClick={() => onModuleSelect && onModuleSelect('privacy')}>Privacy</button>
          <button type="button" className="nl-link-btn" onClick={() => onModuleSelect && onModuleSelect('terms')}>Terms</button>
          <a href="mailto:hello.careeraihub@gmail.com">Contact</a>
        </div>
      </footer>
    </div>
  );
}
