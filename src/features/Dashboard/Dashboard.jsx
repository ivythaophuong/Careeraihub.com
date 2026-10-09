import React, { useState, useEffect, useMemo } from 'react';
import { sb } from '../../lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const s = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (s < 3600)  return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

const ACT_COLORS = { scan: '#EC4899', star: '#FFB800', jd: '#FF6B9D', mock: '#8B7CF6', cover: '#F5B340', salary: '#00E5A0' };

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--lp-text3)', fontFamily: 'var(--lp-ffm)', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function pill(color) {
  return { fontSize: 9, fontWeight: 700, color, background: color + '18', border: `1px solid ${color}33`, borderRadius: 20, padding: '2px 8px', fontFamily: 'var(--lp-ffm)', letterSpacing: '.06em', textTransform: 'uppercase' };
}

function ReadinessArc({ readiness, aiInsight, setActiveModule }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, readiness || 0);
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 70 ? '#00E5A0' : pct >= 40 ? '#FFB84D' : pct > 0 ? '#FF5A5A' : 'rgba(255,255,255,.1)';

  return (
    <div style={{ ...cardStyle, display: 'flex', alignItems: 'flex-start', gap: 18 }}>
      <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
        <svg width={80} height={80} viewBox="0 0 80 80">
          <circle cx={40} cy={40} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={8} />
          <circle cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform="rotate(-90 40 40)"
            style={{ transition: 'stroke-dashoffset 1.2s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontFamily: 'var(--lp-ff)', fontSize: 19, fontWeight: 800, color, lineHeight: 1 }}>{pct > 0 ? pct : '—'}</div>
          <div style={{ fontSize: 8, color: 'var(--lp-text3)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 2 }}>ready</div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text)', marginBottom: 5 }}>Interview Readiness</div>
        <div style={{ fontSize: 11.5, color: 'var(--lp-text2)', lineHeight: 1.65, marginBottom: 10 }}>{aiInsight}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {pct >= 70
            ? <span style={pill('#00E5A0')}>✓ Interview Ready</span>
            : pct > 0
              ? <span style={pill('#FFB84D')}>Building Readiness</span>
              : <span style={pill('#8B7CF6')}>Start first session</span>}
        </div>
        <button onClick={() => setActiveModule('simulate')} style={btnStyle('primary')}>Start session →</button>
      </div>
    </div>
  );
}

function StreakBar({ activities, topGap }) {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow === 0 ? 7 : dow) - 1));

  const actDates = new Set(activities.map(a => new Date(a.time).toDateString()));
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((lbl, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { lbl, active: actDates.has(d.toDateString()), isToday: d.toDateString() === today.toDateString() };
  });
  const count = activities.length;

  return (
    <div style={{ ...cardStyle, background: 'linear-gradient(135deg,rgba(236,72,153,.04),rgba(236,72,153,.03))' }}>
      <SectionLabel>This Week</SectionLabel>
      <div style={{ fontFamily: 'var(--lp-ff)', fontSize: 26, fontWeight: 800, color: count > 0 ? '#EC4899' : 'var(--lp-text3)', lineHeight: 1, marginBottom: 8 }}>
        {count} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--lp-text2)' }}>actions logged</span>
      </div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
        {days.map((d, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: d.active ? '#EC4899' : d.isToday ? 'rgba(236,72,153,.1)' : 'var(--lp-bg3)',
              border: `1px solid ${d.isToday ? 'rgba(236,72,153,.3)' : 'transparent'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: d.active ? '#000' : 'var(--lp-text3)' }}>
                {d.active ? '✓' : '·'}
              </span>
            </div>
            <div style={{ fontSize: 8, color: d.isToday ? 'var(--lp-teal)' : 'var(--lp-text3)', marginTop: 3, fontFamily: 'var(--lp-ffm)' }}>{d.lbl}</div>
          </div>
        ))}
      </div>
      <div style={{ height: 1, background: 'var(--lp-bdr)', marginBottom: 12 }} />
      <div style={{ fontSize: 11, color: 'var(--lp-text2)', lineHeight: 1.5, marginBottom: 10 }}>
        <span style={{ fontWeight: 600, color: 'var(--lp-text)' }}>Top action: </span>{topGap}
      </div>
    </div>
  );
}

function MilestoneStrip({ milestones }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
      {milestones.map((m, i) => (
        <div key={i} onClick={m.onClick} style={{
          background: 'var(--lp-bg2)', border: `1px solid ${m.color}22`, borderRadius: 10,
          padding: '12px 14px', cursor: 'pointer', overflow: 'hidden', transition: 'border-color .15s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = m.color + '55'}
          onMouseLeave={e => e.currentTarget.style.borderColor = m.color + '22'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
            <div style={{ fontSize: 9, fontWeight: 700, color: m.color, textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'var(--lp-ffm)' }}>{m.iconLabel}</div>
          </div>
          <div style={{ fontFamily: 'var(--lp-ff)', fontSize: 24, fontWeight: 800, color: m.color, lineHeight: 1, marginBottom: 2 }}>
            {m.value}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--lp-text2)', marginBottom: 4 }}>{m.label}</div>
          <div style={{ fontSize: 9.5, color: 'var(--lp-text3)', fontFamily: 'var(--lp-ffm)', marginBottom: 8 }}>{m.delta}</div>
          <div style={{ height: 3, background: 'var(--lp-bg4, rgba(255,255,255,.06))', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${m.pct}%`, background: m.color, borderRadius: 2, transition: 'width .9s ease' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AiMemoryPanel({ aiInsight, weeklyPlan, setActiveModule }) {
  return (
    <div style={{ ...cardStyle, borderLeft: '3px solid #8B7CF6', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#EC4899,#F59E0B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#000', flexShrink: 0 }}>AI</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#8B7CF6', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4, fontFamily: 'var(--lp-ffm)' }}>AI Memory · live</div>
          <div style={{ fontSize: 12, color: 'var(--lp-text)', lineHeight: 1.65 }}>{aiInsight}</div>
        </div>
      </div>
      <div style={{ background: 'rgba(139,124,246,.06)', border: '1px solid rgba(139,124,246,.14)', borderRadius: 8, padding: '12px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#8B7CF6', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, fontFamily: 'var(--lp-ffm)' }}>
          This week's plan
        </div>
        {weeklyPlan.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < weeklyPlan.length - 1 ? 8 : 0, alignItems: 'flex-start' }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(139,124,246,.2)', border: '1px solid rgba(139,124,246,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#8B7CF6', flexShrink: 0, marginTop: 1 }}>
              {i + 1}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--lp-text2)', lineHeight: 1.55 }}>{step}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => setActiveModule('simulate')} style={btnStyle('outline-sm')}>Start drill →</button>
        <button onClick={() => setActiveModule('aichat')} style={btnStyle('ghost-sm')}>Ask AI why</button>
      </div>
    </div>
  );
}

function ActionItems({ items, setActiveModule }) {
  return (
    <div style={cardStyle}>
      <SectionLabel>Priority Actions</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 12, color: '#00E5A0', padding: '10px 0' }}>✓ All priorities addressed — keep the momentum!</div>
        ) : items.map((item, i) => (
          <div key={i} onClick={() => setActiveModule(item.id)} style={{
            display: 'flex', alignItems: 'stretch', background: 'var(--lp-bg3)',
            border: '1px solid var(--lp-bdr)', borderRadius: 8, overflow: 'hidden',
            cursor: 'pointer', transition: 'border-color .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = item.color + '55'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--lp-bdr)'}
          >
            <div style={{ width: 4, background: item.color, flexShrink: 0 }} />
            <div style={{ flex: 1, padding: '10px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--lp-text)', marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 10.5, color: 'var(--lp-text3)', fontFamily: 'var(--lp-ffm)', lineHeight: 1.4 }}>{item.why}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingRight: 12, color: 'var(--lp-text3)', fontSize: 14 }}>→</div>
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          {[
            { label: 'Scan resume vs new JD',  id: 'scan'      },
            { label: 'Generate cover letter',   id: 'cover'     },
            { label: 'Check skills gap',        id: 'skillsgap' },
          ].map(a => (
            <button key={a.id} onClick={() => setActiveModule(a.id)} style={btnStyle('full-secondary')}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard({ memory, form, user, setActiveModule, resumeText, resumeProfile, profileLoading, syncedAt }) {
  const [trustScore, setTrustScore] = useState(0);

  useEffect(() => {
    if (!user?.id || !user?.token) return;
    sb.select('candidate_trust_profiles', { user_id: `eq.${user.id}` }, user.token)
      .then(rows => setTrustScore(rows?.[0]?.trust_score || 0))
      .catch(() => {});
  }, [user, syncedAt]);

  const validScans = (memory.scanHistory || []).filter(s => s.status !== 'failed' && s.score > 0);
  const atsScore   = validScans[0]?.score ?? 0;
  const prevAtsScore = validScans[1]?.score ?? null;
  const atsDelta   = prevAtsScore !== null ? atsScore - prevAtsScore : null;
  const readiness  = memory.mockSessions?.[0]?.avgScore ?? 0;
  const starCount  = memory.starBank?.length ?? 0;
  const jdCount    = memory.jdAnalyses?.length ?? 0;
  const coverCount = memory.coverLetters?.length ?? 0;

  const activities = useMemo(() => {
    const rows = [
      ...(memory.scanHistory?.slice(0, 3).map(s => ({ type: 'scan', time: s.date || s.created_at, label: `Resume scanned · ATS ${s.score ?? '—'}` })) || []),
      ...(memory.starBank?.slice(0, 2).map(s => ({ type: 'star', time: s.date || s.created_at, label: `STAR saved: ${s.bankAs || s.oneLiner?.slice(0, 36) || 'Story'}` })) || []),
      ...(memory.jdAnalyses?.slice(0, 2).map(j => ({ type: 'jd', time: j.date || j.created_at, label: `JD match: ${j.roleTitle || 'Role'} · ${j.matchScore ?? '—'}%` })) || []),
      ...(memory.mockSessions?.slice(0, 1).map(m => ({ type: 'mock', time: m.date || m.created_at, label: `Interview session · ${m.questionsCount ?? '—'} questions` })) || []),
      ...(memory.coverLetters?.slice(0, 1).map(c => ({ type: 'cover', time: c.date || c.created_at, label: `Cover letter: ${c.roleTitle || 'Role'}` })) || []),
    ];
    return rows.filter(r => r.time).sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 6);
  }, [memory]);

  const aiInsight = useMemo(() => {
    const gaps = [];
    if (atsScore < 70)   gaps.push(`ATS score ${atsScore}/100${atsDelta !== null ? ` (${atsDelta > 0 ? '+' : ''}${atsDelta} vs last scan)` : ''} — paste a JD to close keyword gaps`);
    if (starCount < 3)   gaps.push(`${starCount} STAR ${starCount === 1 ? 'story' : 'stories'} saved — aim for 8+`);
    if (readiness < 70)  gaps.push(`interview readiness ${readiness}/100 — run a mock session`);
    if (trustScore < 65) gaps.push(`practice score ${trustScore}/100 — practise interview answers and STAR stories`);
    if (gaps.length === 0) {
      if (atsDelta > 0) return `ATS score improved +${atsDelta} pts since last scan. Keep running mock sessions to stay sharp.`;
      return 'Profile looks strong. Keep running mock sessions to stay sharp.';
    }
    return `Top priority: ${gaps[0]}.${gaps[1] ? ` Also: ${gaps[1]}.` : ''}`;
  }, [atsScore, atsDelta, starCount, readiness, trustScore]);

  const weeklyPlan = useMemo(() => {
    const steps = [];
    if (atsScore < 70)   steps.push('Scan resume against your target JD — close keyword gaps');
    if (starCount < 8)   steps.push(`Add ${8 - starCount} STAR ${8 - starCount === 1 ? 'story' : 'stories'} to cover behavioral questions`);
    if (readiness < 80)  steps.push('Complete 2 mock interview sessions this week');
    if (trustScore < 65) steps.push('Raise your practice score with interview answers and STAR stories');
    steps.push('Review AI feedback and refine target role keywords');
    return steps.slice(0, 4);
  }, [atsScore, starCount, readiness, trustScore]);

  const actionItems = useMemo(() => [
    atsScore < 70   && { label: 'Improve ATS Score',  why: `Score ${atsScore}/100 — add missing keywords from your target JD`,         color: '#FF5A5A', id: 'scan'       },
    starCount < 5   && { label: 'Build STAR Bank',     why: `${starCount} of 8 stories saved — cover all behavioral categories`,         color: '#FFB84D', id: 'star'       },
    readiness < 70  && { label: 'Run Mock Interview',  why: `Readiness ${readiness}/100 — simulate to sharpen your answers`,             color: '#EC4899', id: 'simulate'   },
    trustScore < 65 && { label: 'Raise Practice Score', why: `Practice score ${trustScore}/100 — it builds from your interview and STAR practice`, color: '#8B7CF6', id: 'simulate' },
    jdCount < 3     && { label: 'Analyze More JDs',   why: `${jdCount} JD${jdCount !== 1 ? 's' : ''} scanned — tailor prep to each role`, color: '#00E5A0', id: 'jd'        },
  ].filter(Boolean).slice(0, 4), [atsScore, starCount, readiness, trustScore, jdCount]);

  const atsDeltaLabel = atsDelta !== null
    ? atsDelta > 0 ? `↑ +${atsDelta} since last scan` : atsDelta < 0 ? `↓ ${atsDelta} since last scan` : '→ no change'
    : atsScore >= 80 ? '✓ Strong' : atsScore > 0 ? 'Rescan to track progress' : 'No scans yet';

  const milestones = [
    { iconLabel: 'ATS Score',   value: atsScore > 0 ? atsScore : '—',    label: 'Resume ATS',        delta: atsDeltaLabel,              color: '#EC4899', pct: atsScore,                        onClick: () => setActiveModule('scan')       },
    { iconLabel: 'Readiness',   value: readiness > 0 ? readiness : '—',  label: 'Interview prep',    delta: readiness > 0 ? `${100 - readiness} pts to go` : 'Start a session',                      color: '#FFB84D', pct: readiness,                       onClick: () => setActiveModule('simulate')   },
    { iconLabel: 'STAR Bank',   value: starCount,                         label: 'Stories saved',     delta: starCount >= 8 ? '✓ Solid bank' : `target: 8`,                                            color: '#FFB800', pct: Math.min(100, starCount * 12.5), onClick: () => setActiveModule('star')       },
    { iconLabel: 'Practice Score', value: trustScore > 0 ? trustScore : '—', label: 'From your practice', delta: trustScore >= 65 ? '✓ Strong' : 'Practise to raise it',                                 color: trustScore >= 65 ? '#00E5A0' : '#FF5A5A', pct: trustScore, onClick: () => setActiveModule('trustmatch') },
    { iconLabel: 'JDs Scanned', value: jdCount,                           label: 'Roles analyzed',   delta: jdCount > 0 ? `${jdCount} role${jdCount !== 1 ? 's' : ''} analyzed` : 'Scan a JD →',     color: '#8B7CF6', pct: Math.min(100, jdCount * 20),   onClick: () => setActiveModule('jd')         },
  ];

  const topGap = actionItems[0]?.why || 'All good — keep the momentum!';
  const firstName = user?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto', fontFamily: 'var(--lp-ff)', color: 'var(--lp-text)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--lp-ff)', fontSize: 20, fontWeight: 800, color: 'var(--lp-text)', letterSpacing: '-.02em' }}>
            {greeting}, {firstName}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--lp-text2)', marginTop: 3 }}>
            {form?.role ? `Targeting ${form.role}` : 'Set your target role'}{form?.market ? ` · ${form.market}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setActiveModule('aichat')} style={btnStyle('secondary')}>Ask AI Coach</button>
          <button onClick={() => setActiveModule('simulate')} style={btnStyle('primary')}>Continue prep →</button>
        </div>
      </div>

      {/* No resume — upload CTA */}
      {!resumeText && atsScore === 0 && (
        <div style={{ marginBottom: 16, background: 'rgba(236,72,153,.05)', border: '1px solid rgba(236,72,153,.2)', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text)', marginBottom: 4 }}>Upload your resume to unlock everything</div>
            <div style={{ fontSize: 11.5, color: 'var(--lp-text2)', lineHeight: 1.5 }}>Your ATS score, skills gap, readiness, and AI coaching all activate after your first scan.</div>
          </div>
          <button onClick={() => setActiveModule('ats')} style={{ ...btnStyle('primary'), flexShrink: 0, padding: '9px 18px', fontSize: 13 }}>Scan my resume →</button>
        </div>
      )}

      {/* Resume exists, no scan yet — show profile or loading spinner */}
      {resumeText && atsScore === 0 && (
        <div style={{ marginBottom: 16, background: 'rgba(236,72,153,.04)', border: '1px solid rgba(236,72,153,.18)', borderRadius: 12, padding: '16px 20px' }}>
          {profileLoading ? (
            /* Loading state */
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(236,72,153,.15)', borderTopColor: '#EC4899', animation: 'spin 0.9s linear infinite', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text)', marginBottom: 2 }}>Analyzing your resume…</div>
                <div style={{ fontSize: 11.5, color: 'var(--lp-text2)' }}>Extracting your role, skills, and experience. Takes a few seconds.</div>
              </div>
            </div>
          ) : resumeProfile ? (
            /* Profile extracted */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#EC4899', fontFamily: 'var(--lp-ffm)' }}>📄 Resume analyzed</span>
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  {resumeProfile.currentRole && <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lp-text)', marginBottom: 3 }}>{resumeProfile.currentRole}</div>}
                  {resumeProfile.yearsExp > 0 && <div style={{ fontSize: 12, color: 'var(--lp-text2)', marginBottom: 8 }}>{resumeProfile.yearsExp} years experience</div>}
                  {resumeProfile.topSkills?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {resumeProfile.topSkills.slice(0, 8).map(s => (
                        <span key={s} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(236,72,153,.08)', border: '1px solid rgba(236,72,153,.2)', color: '#EC4899', fontFamily: 'var(--lp-ffm)', fontWeight: 600 }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => setActiveModule('ats')} style={{ ...btnStyle('primary'), flexShrink: 0, padding: '9px 18px', fontSize: 13, alignSelf: 'center' }}>Scan vs JD →</button>
              </div>
            </>
          ) : (
            /* Resume loaded, extract failed or skipped */
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 20 }}>📄</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text)', marginBottom: 2 }}>Resume uploaded</div>
                <div style={{ fontSize: 11.5, color: 'var(--lp-text2)' }}>Paste a job description into ATS Scanner to get your match score.</div>
              </div>
              <button onClick={() => setActiveModule('ats')} style={{ ...btnStyle('primary'), flexShrink: 0, padding: '9px 18px', fontSize: 13 }}>Scan now →</button>
            </div>
          )}
        </div>
      )}

      {/* Hero: Readiness Arc + Streak */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, marginBottom: 12 }}>
        <ReadinessArc readiness={readiness} aiInsight={aiInsight} setActiveModule={setActiveModule} />
        <StreakBar activities={activities} topGap={topGap} />
      </div>

      {/* Milestone strip */}
      <div style={{ marginBottom: 12 }}>
        <MilestoneStrip milestones={milestones} />
      </div>

      {/* AI Memory + Action items */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <AiMemoryPanel aiInsight={aiInsight} weeklyPlan={weeklyPlan} setActiveModule={setActiveModule} />
        <ActionItems items={actionItems} setActiveModule={setActiveModule} />
      </div>

      {/* Activity feed — 2-column */}
      <div style={cardStyle}>
        <SectionLabel>Recent Activity</SectionLabel>
        {activities.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--lp-text3)', padding: '12px 0' }}>
            No activity yet — start with a resume scan.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px' }}>
            {[activities.slice(0, 3), activities.slice(3)].map((col, ci) => (
              <div key={ci}>
                {col.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < col.length - 1 ? '1px solid var(--lp-bdr)' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACT_COLORS[a.type], flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1, fontSize: 12.5, color: 'var(--lp-text)', lineHeight: 1.4 }}>{a.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--lp-text3)', fontFamily: 'var(--lp-ffm)', flexShrink: 0, marginTop: 1 }}>{timeAgo(a.time)}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────
const cardStyle = {
  background: 'var(--lp-bg2)',
  border: '1px solid var(--lp-bdr)',
  borderRadius: 10,
  padding: '16px 18px',
};

function btnStyle(variant) {
  const base = { fontFamily: 'var(--lp-ff)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 7, fontWeight: 600, fontSize: 12, transition: 'all .14s', border: 'none', whiteSpace: 'nowrap' };
  if (variant === 'primary')        return { ...base, background: 'var(--lp-teal, #EC4899)', color: '#000', padding: '8px 16px' };
  if (variant === 'secondary')      return { ...base, background: 'var(--lp-bg3)', color: 'var(--lp-text)', border: '1px solid var(--lp-bdr2)', padding: '8px 14px' };
  if (variant === 'outline-sm')     return { ...base, background: 'transparent', color: 'var(--lp-teal)', border: '1px solid rgba(236,72,153,.25)', padding: '5px 12px', fontSize: 11 };
  if (variant === 'ghost-sm')       return { ...base, background: 'var(--lp-bg3)', color: 'var(--lp-text2)', border: '1px solid var(--lp-bdr)', padding: '5px 12px', fontSize: 11 };
  if (variant === 'full-secondary') return { ...base, background: 'var(--lp-bg3)', color: 'var(--lp-text2)', border: '1px solid var(--lp-bdr)', padding: '7px 12px', width: '100%', justifyContent: 'flex-start', fontSize: 12 };
  return base;
}
