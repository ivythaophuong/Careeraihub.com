import React from 'react';
import { C } from '../../styles/theme';
import { Card, Badge } from '../../components/CommonUI';
import { GlowBar } from '../../components/OriginalFeatures';
import { GetReadyTabStrip } from '../Landing/LandingPage';
import '../../styles/featurePage.css';

// Only report a weakness where there is evidence for it. Every number here is a real average of the
// user's own results; when there isn't enough evidence we say so and point to the action that creates it.
// "Unknown" is never shown as "weak".
export const MIN_EVIDENCE = 2;

const average = (values) => {
  const nums = values.filter(v => Number.isFinite(v));
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
};
const levelOf = (score) => (score < 40 ? { label: 'Needs work', color: C.red } : score < 70 ? { label: 'Building', color: C.gold } : { label: 'Strong', color: C.green });

export function buildEvidence({ scanResult, memory }) {
  const latestScan = scanResult || memory?.scanHistory?.[0]?.result || null;
  const sessions = (memory?.mockSessions || []).slice(0, 5);
  const stories = (memory?.starBank || []).slice(0, 5);
  const issues = (latestScan?.issues || []).filter(i => i.severity === 'critical' || i.severity === 'warning');
  return {
    resume: { has: !!latestScan, issues },
    interview: { count: sessions.length, score: sessions.length >= MIN_EVIDENCE ? average(sessions.map(s => s.avgScore ?? s.score)) : null },
    star: { count: stories.length, score: stories.length >= MIN_EVIDENCE ? average(stories.map(s => s.score)) : null },
  };
}

function NotEnoughEvidence({ title, need, action, onAction }) {
  return (
    <Card>
      <div style={{ color: C.text, fontWeight: 800, fontSize: 14, marginBottom: 6 }}>{title}</div>
      <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>Not enough evidence yet. {need}</div>
      <button onClick={onAction} style={{ background: 'transparent', color: C.accent, border: `1px solid ${C.accent}66`, borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{action}</button>
    </Card>
  );
}

function ScoreCard({ title, score, basis, action, onAction }) {
  const { label, color } = levelOf(score);
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: C.text, fontWeight: 800, fontSize: 14 }}>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: C.muted, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{label}</span>
          <span style={{ color, fontSize: 14, fontWeight: 900, fontFamily: 'var(--font-mono)' }}>{score}%</span>
        </span>
      </div>
      <GlowBar score={score} color={color} delay={0} height={10} showLabel={false} />
      <div style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>{basis}</div>
      {score < 70 && (
        <button onClick={onAction} style={{ marginTop: 12, background: 'transparent', color: C.accent, border: `1px solid ${C.accent}66`, borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{action}</button>
      )}
    </Card>
  );
}

export default function WeaknessRadar({ scanResult, memory, setActiveModule, onStudyPlan, embedded }) {
  const ev = buildEvidence({ scanResult, memory });
  const go = (m) => () => setActiveModule?.(m);

  return (
    <div className="fp-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {!embedded && <GetReadyTabStrip activeModuleId="radar" onNavigate={setActiveModule} onStudyPlan={onStudyPlan || (() => {})} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div>
          <div style={{ color: C.text, fontWeight: 900, fontSize: 24 }}>Weakness Radar</div>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
            Built only from your own results. Where we don't have enough evidence yet, we say so instead of guessing.
          </div>
        </div>

        {ev.resume.has ? (
          <Card>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 14, marginBottom: 10 }}>
              Resume: {ev.resume.issues.length} issue{ev.resume.issues.length === 1 ? '' : 's'} found in your latest scan
            </div>
            {ev.resume.issues.length === 0 && <div style={{ color: C.muted, fontSize: 12 }}>No critical issues or warnings in the latest scan.</div>}
            {ev.resume.issues.slice(0, 5).map((issue, i) => (
              <div key={i} style={{ padding: '10px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <Badge label={issue.severity} color={issue.severity === 'critical' ? C.red : C.gold} />
                  <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{issue.type}</span>
                </div>
                {issue.original && <div style={{ color: C.muted, fontSize: 12, fontStyle: 'italic' }}>"{issue.original}"</div>}
                {issue.fix && <div style={{ color: C.text, fontSize: 12, marginTop: 4 }}>Fix: {issue.fix}</div>}
              </div>
            ))}
            <button onClick={go('ats')} style={{ marginTop: 12, background: 'transparent', color: C.accent, border: `1px solid ${C.accent}66`, borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Fix these in the ATS Builder</button>
          </Card>
        ) : (
          <NotEnoughEvidence title="Resume" need="Scan your resume to see specific issues quoted from it." action="Scan my resume" onAction={go('scan')} />
        )}

        {ev.interview.score != null ? (
          <ScoreCard title="Interview practice" score={ev.interview.score}
            basis={`Average of your last ${ev.interview.count} practice answers.`} action="Practice another answer" onAction={go('simulate')} />
        ) : (
          <NotEnoughEvidence title="Interview practice"
            need={`Answer at least ${MIN_EVIDENCE} practice questions (you have ${ev.interview.count}).`} action="Start a practice session" onAction={go('simulate')} />
        )}

        {ev.star.score != null ? (
          <ScoreCard title="STAR stories" score={ev.star.score}
            basis={`Average of your last ${ev.star.count} refined stories.`} action="Refine another story" onAction={go('star')} />
        ) : (
          <NotEnoughEvidence title="STAR stories"
            need={`Refine at least ${MIN_EVIDENCE} stories (you have ${ev.star.count}).`} action="Build a STAR story" onAction={go('star')} />
        )}
      </div>
    </div>
  );
}
