import React, { useState, useEffect, useRef } from 'react';
import { reducedMotion } from './motion';

// An example of the ATS Scanner result: the score and three bars, the missing keywords, the AI's note and the first fix suggestion.
// The structure follows the product's result screen. The content is a sample CV against a sample job description, and the page says so.
// The bars are coloured by where each figure comes from (code counts the keywords, the AI estimates the other two), never by how high it is:
// the product does not grade its bars by value (ResumeScan.jsx: barColor), and an AI estimate must not look like a verdict.
// Figures: 82, 85 and 90 are the ones of the owner's screenshot (2026-10-22); 60 is an example figure for the keyword bar.
const SCORE = 82;
const STEPS = 80;
const BARS = [
  { name: 'Keywords matched', value: 60, source: 'code' },
  { name: 'Skills alignment', value: 85, source: 'ai' },
  { name: 'Format score', value: 90, source: 'ai' },
];
const MISSING = ['funnel analysis', 'dashboards', 'cohort analysis', 'experiment design', 'payments', 'e-commerce', 'Figma'];

export default function ScanDemo({ onStart }) {
  const reduced = useRef(reducedMotion()).current;
  const root = useRef(null);
  const [started, setStarted] = useState(false);
  const [go, setGo] = useState(reduced);
  const [score, setScore] = useState(reduced ? SCORE : 0);

  useEffect(() => {
    if (reduced || typeof IntersectionObserver !== 'function') { setStarted(true); return undefined; }
    const io = new IntersectionObserver((entries) => { if (entries.some(e => e.isIntersecting)) { setStarted(true); io.disconnect(); } }, { threshold: 0.3 });
    if (root.current) io.observe(root.current);
    return () => io.disconnect();
  }, [reduced]);

  useEffect(() => {
    if (!started) return undefined;
    if (reduced) { setGo(true); setScore(SCORE); return undefined; }
    const t0 = setTimeout(() => setGo(true), 60);
    let n = 0;
    const iv = setInterval(() => { n += 1; const k = n / STEPS; setScore(Math.min(SCORE, Math.round(SCORE * (1 - Math.pow(1 - k, 3))))); if (n >= STEPS) clearInterval(iv); }, 30);
    return () => { clearTimeout(t0); clearInterval(iv); };
  }, [started, reduced]);

  return (
    <div className="nl-scan" ref={root} data-testid="scan-demo">
      <div className="nl-scan-top">
        <span className="nl-scan-back">&larr; New scan</span>
        <span className="nl-scan-vs"><b>Resume</b> vs <b>Product Analyst</b></span>
        <ol className="nl-scan-steps" aria-label="Scan, fix, edit, export"><li className="is-done">Scan</li><li className="is-on">Fix</li><li>Edit</li><li>Export</li></ol>
      </div>

      <div className="nl-scan-card nl-scan-score">
        <div className="nl-scan-num"><span data-testid="scan-score">{score}</span><small>/100 &middot; AI estimate of the match</small></div>
        <div className="nl-scan-bars">
          <div className="nl-scan-verdict">Strong match, but SQL and experiment evidence is limited</div>
          {BARS.map((b, i) => (
            <div className="nl-scan-bar-row" key={b.name}>
              <span className="nl-scan-bar-name">{b.name}</span>
              <span className="nl-scan-track"><span data-testid="scan-bar" data-name={b.name} data-value={b.value} data-source={b.source} className={`is-${b.source}`} style={{ width: `${go ? b.value : 0}%`, transitionDelay: `${0.2 + i * 0.2}s` }} /></span>
              <b className="nl-scan-bar-val">{go ? b.value : 0}</b>
            </div>
          ))}
          <div className="nl-scan-legend"><span><i className="is-code" />Counted by code</span><span><i className="is-ai" />AI estimate</span></div>
          <div className="nl-scan-small">These bars are AI estimates, except the keyword bar: code counts those in your resume.</div>
        </div>
      </div>

      <div className="nl-scan-card">
        <div className="nl-scan-label">Missing keywords</div>
        <div className="nl-scan-chips">{MISSING.map(k => <i className="nl-scan-chip" key={k}>{k}</i>)}</div>
      </div>

      <div className="nl-scan-ai"><span className="nl-scan-ai-badge" aria-hidden="true">AI</span><p>Your checkout migration and the drop in support tickets show real product ownership. The resume does not show funnel analysis, cohort analysis or experiment design; add these only if they reflect your work.</p></div>

      <div className="nl-scan-card">
        <div className="nl-scan-label">Fix suggestions &middot; <span>4 found</span></div>
        <div className="nl-scan-fix-head"><i>Warning</i><span>Vague Bullet</span></div>
        <blockquote>&ldquo;improved the checkout experience&rdquo;</blockquote>
        <p className="nl-scan-fix">Cut checkout support tickets by about a third by leading a three-team migration, tracked by the weekly ticket count.</p>
        <p className="nl-scan-small">AI draft: check it matches what you actually did before applying.</p>
        <button type="button" className="nl-scan-apply" onClick={() => onStart && onStart()}>Apply fix &rarr;</button>
      </div>

      <div className="nl-scan-foot">Example run on a sample CV and a sample job description. Your own CV gives your own result.</div>
    </div>
  );
}
