import React, { useState, useEffect } from 'react';
import { sb } from '../../lib/supabase';

function SectionLabel({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--lp-text3)', fontFamily: 'var(--lp-ffm)', marginBottom: 10 }}>{children}</div>;
}

function AiBubble({ children }) {
  return (
    <div style={{ background: 'var(--lp-bg3)', border: '1px solid rgba(236,72,153,.18)', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, position: 'relative', overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top left,rgba(236,72,153,.04),transparent 60%)', pointerEvents: 'none' }} />
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#EC4899,#F59E0B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#000', flexShrink: 0 }}>AI</div>
      <div style={{ fontSize: 12.5, color: 'var(--lp-text)', lineHeight: 1.65, flex: 1 }}>{children}</div>
    </div>
  );
}

const STEP_COLORS = { done: '#00E5A0', active: '#EC4899', locked: '#4A5A7A' };

function RoadmapStep({ num, state, title, desc, cta, onCta, isLast }) {
  const color = STEP_COLORS[state];
  return (
    <div style={{ display: 'flex', gap: 14, paddingBottom: isLast ? 0 : 18, position: 'relative' }}>
      {/* Connector line */}
      {!isLast && (
        <div style={{ position: 'absolute', left: 15, top: 36, bottom: 0, width: 1, background: state === 'done' ? '#00E5A044' : 'var(--lp-bdr)' }} />
      )}
      {/* Step circle */}
      <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--lp-ffm)', fontSize: 11, fontWeight: 700, flexShrink: 0, position: 'relative', zIndex: 1, background: color + '18', border: `1px solid ${color}44`, color }}>
        {state === 'done' ? '✓' : num}
      </div>
      {/* Body */}
      <div style={{ flex: 1, paddingTop: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: state === 'locked' ? 'var(--lp-text3)' : 'var(--lp-text)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
          {title}
          {state === 'active' && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', background: 'rgba(236,72,153,.12)', color: 'var(--lp-teal)', border: '1px solid rgba(236,72,153,.2)', borderRadius: 20, padding: '2px 7px', fontFamily: 'var(--lp-ffm)' }}>In progress</span>}
        </div>
        <div style={{ fontSize: 12, color: state === 'locked' ? 'var(--lp-text3)' : 'var(--lp-text2)', lineHeight: 1.55, marginBottom: cta ? 8 : 0 }}>{desc}</div>
        {cta && (
          <button onClick={onCta} style={{ fontSize: 11, background: 'var(--lp-teal)', color: '#000', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--lp-ff)', fontWeight: 700 }}>
            {cta}
          </button>
        )}
      </div>
    </div>
  );
}

function MilestoneRow({ done, label, current, target }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--lp-bdr)' }}>
      <span style={{ fontSize: 14, color: done ? '#00E5A0' : 'var(--lp-text3)', flexShrink: 0 }}>{done ? '✓' : '○'}</span>
      <span style={{ fontSize: 12.5, color: done ? 'var(--lp-text)' : 'var(--lp-text2)', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: 'var(--lp-ffm)', color: done ? '#00E5A0' : 'var(--lp-text3)', flexShrink: 0, minWidth: 60, textAlign: 'right' }}>
        {done ? '✓ Done' : target > 0 ? `${current}/${target}` : '—'}
      </span>
    </div>
  );
}

export default function CareerRoadmap({ memory, form, user, setActiveModule, syncedAt }) {
  const [trustScore, setTrustScore] = useState(0);
  const [trustVisible, setTrustVisible] = useState(false);

  useEffect(() => {
    if (!user?.id || !user?.token) return;
    sb.select('candidate_trust_profiles', { user_id: `eq.${user.id}` }, user.token)
      .then(rows => {
        setTrustScore(rows?.[0]?.trust_score || 0);
        setTrustVisible(rows?.[0]?.is_visible || false);
      })
      .catch(() => {});
  }, [user, syncedAt]);

  // Step states derived from memory
  const readiness     = memory.mockSessions?.[0]?.avgScore ?? 0;
  const starCount     = memory.starBank?.length ?? 0;
  const hasResume     = !!memory.resumeText; // step 1 is "resume added": no scan score is recorded anywhere, so none can be required
  const hasSkillsGap  = !!memory.skillsGap?.result;
  const s1Done  = hasResume;
  const s2Done  = readiness >= 75 && starCount >= 5;
  const s3Done  = hasSkillsGap;
  const s4Done  = trustScore >= 65;
  const s5Done  = trustVisible;

  const stepsCompleted = [s1Done, s2Done, s3Done, s4Done, s5Done].filter(Boolean).length;
  const progressPct = Math.round((stepsCompleted / 5) * 100);

  function stepState(done, prevDone) {
    if (done) return 'done';
    if (prevDone || stepsCompleted === 0) return 'active';
    return 'locked';
  }


  const targetRole = form?.role || 'Senior role';
  const estimatedDays = stepsCompleted >= 4 ? '2–4 weeks' : stepsCompleted >= 3 ? '4–8 weeks' : stepsCompleted >= 2 ? '6–12 weeks' : stepsCompleted >= 1 ? '8–16 weeks' : '10–20 weeks';

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto', fontFamily: 'var(--lp-ff)', color: 'var(--lp-text)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontFamily: 'var(--lp-ff)', fontSize: 20, fontWeight: 800, color: 'var(--lp-text)', letterSpacing: '-.02em' }}>Career Roadmap</div>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', background: 'linear-gradient(90deg,rgba(236,72,153,.18),rgba(245,158,11,.12))', color: '#8B7CF6', border: '1px solid rgba(139,124,246,.22)', borderRadius: 20, padding: '2px 8px', fontFamily: 'var(--lp-ffm)' }}>New</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--lp-text2)' }}>
            Your personalised path to {targetRole} · {stepsCompleted}/5 steps complete · est. {estimatedDays}
          </div>
        </div>
      </div>

      {/* AI summary */}
      <AiBubble>
        Your goal: <strong style={{ color: 'var(--lp-text)' }}>{targetRole}</strong>
        {form?.market ? ` in ${form.market}` : ''}. You're <strong style={{ color: '#EC4899' }}>{progressPct}%</strong> of the way there.
        {stepsCompleted < 5 && (
          <> The next unlock: <strong style={{ color: '#F5B340' }}>{!s1Done ? 'add your resume' : !s2Done ? 'clear 75+ interview readiness with 5+ STAR stories' : !s3Done ? 'run skills gap analysis' : !s4Done ? 'raise your practice score to 65+ with interview and STAR practice' : 'activate TrustMatch visibility'}</strong>. Estimated offer timeline: {estimatedDays} at current pace.</>
        )}
        {stepsCompleted === 5 && <> All 5 steps complete — you're fully prepared. Activate TrustMatch to start receiving recruiter matches.</>}
      </AiBubble>

      <div className="rm-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Roadmap steps */}
        <div style={{ background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)', borderRadius: 10, padding: '18px 20px' }}>
          <SectionLabel>Your journey · Step {stepsCompleted + 1} of 5</SectionLabel>

          {/* Progress bar */}
          <div style={{ height: 4, background: 'var(--lp-bg4, #1A2540)', borderRadius: 2, marginBottom: 20, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg,#EC4899,#8B7CF6)', borderRadius: 2, transition: 'width .7s ease' }} />
          </div>

          <RoadmapStep num={1} state={stepState(s1Done, true)}
            title="Add your resume"
            desc={s1Done ? 'Your resume is added. ATS Builder shows what a reader finds in it and what to improve.' : 'Upload or paste your resume in ATS Builder. Every other step builds on it.'}
            cta={!s1Done ? 'Add resume →' : null}
            onCta={() => setActiveModule('ats')}
            isLast={false} />

          <RoadmapStep num={2} state={stepState(s2Done, s1Done)}
            title="Interview ready · readiness 75+ · 5 STAR stories"
            desc={s2Done ? `Readiness ${readiness}/100 · ${starCount} STAR stories banked — interview-ready.` : `Current: readiness ${readiness > 0 ? readiness + '/100' : '—'} · ${starCount} STAR ${starCount === 1 ? 'story' : 'stories'}. Run mock sessions and build your STAR bank.`}
            cta={!s2Done ? 'Start session →' : null}
            onCta={() => setActiveModule('simulate')}
            isLast={false} />

          <RoadmapStep num={3} state={stepState(s3Done, s2Done)}
            title="Skills gap closed · OKRs & domain signals added"
            desc={s3Done ? 'Skills gap analyzed — resume updated with market keywords.' : 'Run skills gap analysis to identify missing keywords, then fix your resume and cover letters.'}
            cta={!s3Done ? 'Analyze gaps →' : null}
            onCta={() => setActiveModule('skillsgap')}
            isLast={false} />

          <RoadmapStep num={4} state={stepState(s4Done, s3Done)}
            title="Practice score 65+"
            desc={s4Done ? `Practice score ${trustScore}/100.` : `Current practice score: ${trustScore}/100. It rises as you practise interview answers, refine STAR stories and scan your resume.`}
            cta={!s4Done ? 'Practise →' : null}
            onCta={() => setActiveModule('simulate')}
            isLast={false} />

          <RoadmapStep num={5} state={stepState(s5Done, s4Done)}
            title="TrustMatch active · salary negotiation unlocked"
            desc={s5Done ? 'Profile visible to recruiters. Salary negotiation module active.' : 'Activate recruiter matching and practice salary negotiation with AI roleplay.'}
            cta={!s5Done ? 'Activate now →' : null}
            onCta={() => setActiveModule('trustmatch')}
            isLast={true} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Salary: no market figures here. There is no salary data source, so the card points to Salary Prep, which works from the user's own numbers. */}
          <div style={{ background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)', borderRadius: 10, padding: '16px 18px' }}>
            <SectionLabel>Salary</SectionLabel>
            <div style={{ fontSize: 12, color: 'var(--lp-text2)', lineHeight: 1.6, marginBottom: 12 }}>
              We do not show market salary figures. When you have an offer, Salary Prep works out the gap to your target from the numbers you enter.
            </div>
            {setActiveModule && (
              <button onClick={() => setActiveModule('salary')} style={{ background: 'none', border: '1px solid var(--lp-bdr)', color: 'var(--lp-text)', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                Open Salary Prep →
              </button>
            )}
          </div>

          {/* Milestone tracker */}
          <div style={{ background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)', borderRadius: 10, padding: '16px 18px' }}>
            <SectionLabel>Milestone tracker</SectionLabel>
            <MilestoneRow done={hasResume} label="Resume added" current={0} target={0} />
            <MilestoneRow done={readiness >= 75} label="Interview readiness > 75" current={readiness} target={75} />
            <MilestoneRow done={starCount >= 5}  label="STAR bank 5+ stories"   current={starCount} target={5} />
            <MilestoneRow done={hasSkillsGap}    label="Skills gap analysis run" current={hasSkillsGap ? 1 : 0} target={1} />
            <MilestoneRow done={trustScore >= 65} label="Practice score 65+"     current={trustScore} target={65} />
            <MilestoneRow done={s5Done}           label="TrustMatch activated"   current={s5Done ? 1 : 0} target={1} />
          </div>

          {/* Upgrade nudge if not complete */}
          {stepsCompleted < 5 && (
            <div style={{ background: 'linear-gradient(90deg,rgba(236,72,153,.06),rgba(139,124,246,.06))', border: '1px solid rgba(236,72,153,.13)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18 }}>🗺️</span>
              <div style={{ fontSize: 12, color: 'var(--lp-text2)', flex: 1, lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--lp-text)' }}>Estimated offer timeline: {estimatedDays}</strong> at your current pace. Complete all 5 steps to unlock your Readiness Certificate.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
