import React, { useState, useEffect, useRef } from 'react';

// An interactive example of the Resume Builder result, for the landing page: the score ring fills, the bars move, Next shows the first issue and locks the rest behind sign-up.
// The figures are one sample CV run through the product's checks, supplied by the owner on 2026-10-21 (ADR-015: the owner approves every figure on the page).
// Nothing here is computed from the visitor's CV, and the page says so.
const SCORE = 83;
const STEPS = 45; // the count-up: 45 steps of 30 ms
const C = 2 * Math.PI * 52;
const BARS = [
  { name: 'Completeness', value: 75, chips: [['Name', true], ['Email not found', false], ['Experience or education', true], ['Skills', true]] },
  { name: 'Measurable impact', value: 78, note: '7 of 9 experience bullets contain a measurable number.' },
  { name: 'Date consistency', value: 100, note: '0 internal date contradiction(s) found across 3 checkable experience entries (overlapping entries are not penalised here).' },
];
const PROFILE = [['Target role', 'Growth Product Manager'], ['Experience', '4 years'], ['Market', 'Singapore / Southeast Asia'], ['ATS readiness', `${SCORE}/100`]];
const SKILLS = ['Growth & GTM', 'Analytics', 'Product Management', 'User Research', 'Retention Modeling', 'Cross-functional Collaboration'];
const STEPS_ROW = ['Add your resume', 'See what to improve', 'Improve', 'Choose a layout and download'];
const reducedMotion = () => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export default function ResumeDemo({ onStart }) {
  const reduced = useRef(reducedMotion()).current;
  const root = useRef(null);
  const [started, setStarted] = useState(false);
  const [run, setRun] = useState(0);
  const [go, setGo] = useState(reduced);
  const [score, setScore] = useState(reduced ? SCORE : 0);
  const [view, setView] = useState('score');

  useEffect(() => {
    if (reduced || typeof IntersectionObserver !== 'function') { setStarted(true); return undefined; }
    const io = new IntersectionObserver((entries) => { if (entries.some(e => e.isIntersecting)) { setStarted(true); io.disconnect(); } }, { threshold: 0.35 });
    if (root.current) io.observe(root.current);
    return () => io.disconnect();
  }, [reduced]);

  useEffect(() => {
    if (!started) return undefined;
    if (reduced) { setGo(true); setScore(SCORE); return undefined; }
    setGo(false); setScore(0);
    const t0 = setTimeout(() => setGo(true), 60);
    let n = 0;
    const iv = setInterval(() => { n += 1; const k = n / STEPS; setScore(Math.min(SCORE, Math.round(SCORE * (1 - Math.pow(1 - k, 3))))); if (n >= STEPS) clearInterval(iv); }, 30);
    return () => { clearTimeout(t0); clearInterval(iv); };
  }, [started, run, reduced]);

  const done = score === SCORE;
  const replay = () => { setView('score'); setRun(r => r + 1); };

  return (
    <div className="nl-demo" data-testid="resume-demo" ref={root}>
      <div className="nl-demo-head">
        <div><div className="nl-demo-title">Resume Builder</div><div className="nl-demo-sub">Upload your resume, build it with 5 templates, and save versions.</div></div>
        <button type="button" className="nl-demo-replay" onClick={replay}>Replay</button>
      </div>
      <ol className="nl-demo-steps" aria-label="The four steps of the Resume Builder">
        {STEPS_ROW.map((s, i) => <li key={s} className={i === 1 ? 'is-on' : undefined} aria-current={i === 1 ? 'step' : undefined}><span aria-hidden="true">{i === 0 ? '✓' : i + 1}</span>{s}</li>)}
      </ol>
      <div className="nl-demo-body">
        <div className="nl-demo-col">
          <div className="nl-demo-file"><b>✓ Sample CV</b><span>488 words · extracted</span></div>
          <div className="nl-demo-card">
            <div className="nl-demo-label">Profile extracted</div>
            {PROFILE.map(([k, v]) => <div className="nl-demo-row" key={k}><span>{k}</span><b>{v}</b></div>)}
            <div className="nl-demo-skills"><span>Top skills</span><div>{SKILLS.map(s => <i key={s}>{s}</i>)}</div></div>
          </div>
        </div>
        <div className="nl-demo-col">
          {view === 'score' ? (
            <>
              <div className="nl-demo-card nl-demo-ats">
                <div className="nl-demo-label">ATS readiness <em>Rule-based</em></div>
                <div className="nl-demo-ring-row">
                  <div className="nl-demo-ring" role="img" aria-label={`ATS readiness ${SCORE} out of 100`}>
                    <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" className="nl-demo-ring-track" /><circle cx="60" cy="60" r="52" className="nl-demo-ring-fill" style={{ strokeDasharray: C, strokeDashoffset: C * (1 - (go ? SCORE : 0) / 100) }} /></svg>
                    <span data-testid="demo-score">{score}</span>
                  </div>
                  <div className="nl-demo-ring-text"><span>out of 100</span><b>Based on 3 of 3 checks</b></div>
                </div>
              </div>
              <div className="nl-demo-card">
                <div className="nl-demo-label">Score breakdown</div>
                {BARS.map((b, i) => (
                  <div className="nl-demo-bar-row" key={b.name}>
                    <div className="nl-demo-bar-top"><span>{b.name}</span><b className={b.value >= 90 ? 'is-good' : 'is-mid'}>{go ? b.value : 0}</b></div>
                    <div className="nl-demo-track"><span data-testid="demo-bar" data-name={b.name} data-value={b.value} className={b.value >= 90 ? 'is-good' : 'is-mid'} style={{ width: `${go ? b.value : 0}%`, transitionDelay: `${0.25 + i * 0.25}s` }} /></div>
                    {b.chips && <div className="nl-demo-chips">{b.chips.map(([t, ok]) => <i key={t} className={ok ? 'is-ok' : 'is-bad'}>{ok ? '✓' : '✕'} {t}</i>)}</div>}
                    {b.note && <div className="nl-demo-note">{b.note}</div>}
                  </div>
                ))}
              </div>
              <button type="button" className={`nl-demo-next${done ? ' is-ready' : ''}`} onClick={() => setView('issues')}>Next: improve it →</button>
            </>
          ) : (
            <div className="nl-demo-card nl-demo-issues" data-testid="demo-issues">
              <div className="nl-demo-label">Issues to fix <em className="is-count">4 found</em></div>
              <div className="nl-demo-issue">
                <div className="nl-demo-issue-top"><b>Missing contact information</b><span>Critical</span></div>
                <p>The resume does not include an email address, phone number, or LinkedIn profile. Recruiters cannot reach the candidate quickly.</p>
              </div>
              {[2, 3, 4].map(n => (
                <div className="nl-demo-locked" data-testid="demo-locked" key={n}>
                  <span aria-hidden="true" className="nl-demo-lock-lines"><i /><i /></span>
                  <span>Issue {n} of 4, locked</span>
                </div>
              ))}
              <button type="button" className="nl-demo-signup" onClick={() => onStart && onStart()}>Create a free account to see all 4 issues and how to fix them</button>
              <button type="button" className="nl-demo-back" onClick={() => setView('score')}>Back to the score</button>
            </div>
          )}
        </div>
      </div>
      <div className="nl-demo-foot">Example run on a sample CV. Your own CV gives your own result.</div>
    </div>
  );
}
