import React, { useState } from 'react';
import { callLLM, extractJSON } from '../../lib/ai.jsx';

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

const STATUS_META = {
  strong:      { color: '#00E5A0', label: 'Strong'      },
  good:        { color: '#00E5A0', label: 'Good'        },
  developing:  { color: '#F5B340', label: 'Developing'  },
  'best signal': { color: '#F5B340', label: 'Best signal' },
  gap:         { color: '#FF6B6B', label: 'Gap'         },
};

const LEVEL_PCT = { strong: 90, good: 70, basic: 35, missing: 0 };

function SkillRow({ name, yourLevel, status, cta, onCta }) {
  const meta   = STATUS_META[status] || STATUS_META.developing;
  const youPct = LEVEL_PCT[yourLevel] ?? 50;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--lp-bdr)' }}>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--lp-text)', width: 150, flexShrink: 0 }}>{name}</div>
      <div style={{ flex: 1 }}>
        {/* You bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: 'var(--lp-text3)', width: 58, flexShrink: 0, fontFamily: 'var(--lp-ffm)' }}>You: {yourLevel}</span>
          <div style={{ flex: 1, height: 4, background: 'var(--lp-bg4,#1A2540)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${youPct}%`, background: meta.color, borderRadius: 2, transition: 'width .5s' }} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: meta.color + '18', color: meta.color, border: `1px solid ${meta.color}33`, fontFamily: 'var(--lp-ffm)', whiteSpace: 'nowrap' }}>
          {meta.label}
        </span>
        {cta && (
          <button onClick={onCta} style={{ fontSize: 11, background: 'transparent', border: '1px solid var(--lp-bdr2)', color: 'var(--lp-teal)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontFamily: 'var(--lp-ff)', fontWeight: 600 }}>Fix →</button>
        )}
      </div>
    </div>
  );
}

export default function SkillsGap({ resumeText, form, memory, updateMemory, showToast, setActiveModule }) {
  const cached = memory.skillsGap;
  const [result, setResult] = useState(cached?.result || null);
  const [loading, setLoading] = useState(false);

  const resumeCtx = resumeText
    ? (typeof resumeText === 'string' ? resumeText : resumeText.content || '')
    : '';

  const analyze = async () => {
    if (!resumeCtx && !memory.scanHistory?.length) {
      showToast('Scan your resume first so AI has context', 'error');
      return;
    }
    setLoading(true);
    try {
      const scanCtx = memory.scanHistory?.[0]?.result?.summary || '';
      const raw = await callLLM([{ role: 'user', content: `You are a career market analyst for Southeast Asia tech roles.

Target role: ${form?.role || 'Software professional'}
Market: ${form?.market || 'Singapore'}
Level: ${form?.level || 'not stated'}
Resume summary: ${scanCtx || resumeCtx.slice(0, 800) || 'Not provided'}
Recent JDs analyzed: ${memory.jdAnalyses?.map(j => j.roleTitle).join(', ') || 'None'}

Assess the candidate's skills for their target role. Do not state any numbers about the job market, salaries or job counts: you have no data source for them. Return ONLY raw JSON (no markdown, start with {):
{
  "summary": "2-sentence summary of their skill position",
  "skills": [
    {"name":"skill name","yourLevel":"strong|good|basic|missing","status":"strong|developing|gap","cta":"resume|interview|null","ctaModule":"scan|simulate|star"}
  ],
  "recommendations": [
    {"priority":"high|medium","title":"action title","detail":"1-sentence detail","module":"scan|simulate|star|ats|cover"}
  ]
}
Include 6-9 skills. Be specific to their actual profile.` }], 1500);
      const parsed = extractJSON(raw);
      if (parsed.error) throw new Error(parsed.msg);
      setResult(parsed);
      updateMemory(m => ({ ...m, skillsGap: { result: parsed, forRole: form?.role, computedAt: new Date().toISOString() } }));
    } catch (e) {
      showToast('Analysis failed: ' + e.message, 'error');
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto', fontFamily: 'var(--lp-ff)', color: 'var(--lp-text)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontFamily: 'var(--lp-ff)', fontSize: 20, fontWeight: 800, color: 'var(--lp-text)', letterSpacing: '-.02em' }}>Skills Gap Analysis</div>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', background: 'linear-gradient(90deg,rgba(236,72,153,.18),rgba(245,158,11,.12))', color: '#8B7CF6', border: '1px solid rgba(139,124,246,.22)', borderRadius: 20, padding: '2px 8px', fontFamily: 'var(--lp-ffm)' }}>New</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--lp-text2)' }}>
            AI reviews your profile for {form?.role || 'your target'} roles
            {cached?.computedAt && ` · cached ${new Date(cached.computedAt).toLocaleDateString()}`}
          </div>
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          style={{ background: loading ? 'var(--lp-bg3)' : 'var(--lp-teal)', color: loading ? 'var(--lp-text3)' : '#000', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'var(--lp-ff)', display: 'flex', alignItems: 'center', gap: 7 }}
        >
          {loading ? (
            <><span style={{ display: 'inline-flex', gap: 3 }}>{[0,1,2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--lp-teal)', animation: `lp-pulse 1.2s ease ${i * 0.2}s infinite`, display: 'inline-block' }} />)}</span> Analyzing…</>
          ) : (result ? '↺ Refresh analysis' : '⚡ Analyze my gaps')}
        </button>
      </div>

      {!result && !loading && (
        <AiBubble>
          AI will review your resume and scan history for your target role. It does not compare against live job postings. Click <strong style={{ color: 'var(--lp-teal)' }}>Analyze my gaps</strong> to begin.
          {!resumeCtx && !memory.scanHistory?.length && (
            <> First <button onClick={() => setActiveModule('scan')} style={{ background: 'none', border: 'none', color: 'var(--lp-teal)', cursor: 'pointer', fontWeight: 700, fontSize: 12.5, padding: 0, textDecoration: 'underline', fontFamily: 'var(--lp-ff)' }}>scan your resume</button> so AI has context.</>
          )}
        </AiBubble>
      )}

      {result && (
        <>
          {/* Summary bubble */}
          <AiBubble>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lp-teal)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5, fontFamily: 'var(--lp-ffm)' }}>AI Analysis</div>
              {result.summary}
            </div>
          </AiBubble>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
            {/* Skills */}
            <div style={{ background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)', borderRadius: 10, padding: '16px 18px' }}>
              <SectionLabel>Your skills for this role (AI assessment)</SectionLabel>
              {(result.skills || []).map((s, i) => (
                <SkillRow key={i} name={s.name} yourLevel={s.yourLevel} status={s.status}
                  cta={s.cta && s.cta !== 'null'} onCta={() => setActiveModule(s.ctaModule || 'scan')} />
              ))}
              <div style={{ borderBottom: 'none', paddingTop: 4 }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Recommendations */}
              <div style={{ background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)', borderRadius: 10, padding: '16px 18px' }}>
                <SectionLabel>Recommended next steps</SectionLabel>
                {(result.recommendations || []).map((r, i) => {
                  const accent = r.priority === 'high' ? '#FF6B6B' : '#F5B340';
                  const ctaLabel = r.module === 'simulate' || r.module === 'star' ? 'Practice →' : 'Fix →';
                  return (
                    <div key={i} style={{ padding: '10px 12px', background: 'var(--lp-bg3)', borderRadius: 8, border: '1px solid var(--lp-bdr)', borderLeft: `3px solid ${accent}`, marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lp-text)', marginBottom: 3 }}>{r.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--lp-text2)', lineHeight: 1.5 }}>{r.detail}</div>
                      </div>
                      {r.module && (
                        <button onClick={() => setActiveModule(r.module)} style={{ fontSize: 11, background: 'transparent', border: '1px solid var(--lp-bdr2)', color: 'var(--lp-teal)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontFamily: 'var(--lp-ff)', fontWeight: 600, flexShrink: 0 }}>
                          {ctaLabel}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* No market numbers until there is a verified source (see docs/AI_ARCHITECTURE_CONTRACT.md) */}
              <div style={{ background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)', borderRadius: 10, padding: '16px 18px' }}>
                <SectionLabel>Market data · {form?.market || 'Singapore'} {form?.role || 'roles'}</SectionLabel>
                <div style={{ fontSize: 12.5, color: 'var(--lp-text2)', lineHeight: 1.5 }}>
                  Market intelligence is temporarily unavailable. Job counts, salary ranges and match-rate forecasts will appear here once they come from a verified source.
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
