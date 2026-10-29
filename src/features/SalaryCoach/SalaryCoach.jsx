import React, { useState, useEffect } from 'react';
import { C } from '../../styles/theme';
import { callLLM, extractJSON } from '../../lib/ai.jsx';
import { OrbitSpinner } from '../../components/OrbitMark';
import { userLevelIndex, isCacheCurrent, MARKET_CACHE_VERSION } from './salaryLevel';
import '../../styles/featurePage.css';

// ── Shared helpers ────────────────────────────────────────────────────────────
function SLabel({ children }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--lp-text3)', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function AiBubble({ children }) {
  return (
    <div style={{
      background: 'var(--lp-bg3)', border: '1px solid rgba(236,72,153,.18)',
      borderLeft: '4px solid var(--lp-teal)',
      borderRadius: 10, padding: '14px 16px',
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: 'linear-gradient(135deg,#EC4899,#F59E0B)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 900, color: '#000', flexShrink: 0,
      }}>AI</div>
      <div style={{ fontSize: 12.5, color: 'var(--lp-text)', lineHeight: 1.65, flex: 1 }}>{children}</div>
    </div>
  );
}

// ── Market Data Tab ───────────────────────────────────────────────────────────
const CURRENCY = { Singapore: 'SGD', 'Southeast Asia': 'USD', Global: 'USD' };

function MarketDataTab({ form, memory, updateMemory, setForm }) {
  const role   = form?.role   || '';
  const level  = form?.level  || '';
  const market = form?.market || 'Singapore';
  const cur    = CURRENCY[market] || 'USD';
  const ctx    = { role, level, market };
  const cached = memory?.salaryMarket;
  const fresh  = isCacheCurrent(cached, ctx);

  const [data, setData]             = useState(fresh ? cached.data : null);
  const [computedAt, setComputedAt] = useState(fresh ? cached.computedAt : null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    if (!role) return;
    if (isCacheCurrent(memory?.salaryMarket, ctx)) {
      setData(memory.salaryMarket.data); setComputedAt(memory.salaryMarket.computedAt);
    } else {
      loadMarket();
    }
    // eslint-disable-next-line
  }, [role, level, market]);

  const loadMarket = async () => {
    setLoading(true); setError('');
    try {
      const raw = await callLLM([{ role: 'user', content:
        `You are a compensation analyst for ${market} tech roles.
Give approximate MONTHLY BASE salary ranges in ${cur} for the role family "${role}" at five levels. These are market estimates, not figures from a salary survey, and they say nothing about any individual candidate. Do not name specific employers.

Return ONLY raw JSON (no markdown, start with {):
{
  "levels": [
    {"label":"Junior","range":"<low>–<high>K","pct":0-100},
    {"label":"Mid","range":"<low>–<high>K","pct":0-100},
    {"label":"Senior","range":"<low>–<high>K","pct":0-100},
    {"label":"Principal","range":"<low>–<high>K","pct":0-100},
    {"label":"VP / Head","range":"<low>K+","pct":0-100}
  ],
  "employerTypes": [
    {"name":"Top tech co.","p50":"${cur} <n>K","p75":"${cur} <n>K"},
    {"name":"Regional tech","p50":"${cur} <n>K","p75":"${cur} <n>K"},
    {"name":"Startup","p50":"${cur} <n>K","p75":"${cur} <n>K"},
    {"name":"MNC","p50":"${cur} <n>K","p75":"${cur} <n>K"},
    {"name":"Scale-up","p50":"${cur} <n>K","p75":"${cur} <n>K"}
  ],${level ? `
  "totalComp": {"base":"${cur} <low>–<high>K / mo","bonus":"<low>–<high>% of base","equity":"typical equity at larger tech employers, or varies"},` : ''}
  "aiInsight": "2 sentences about pay for this role family in this market. Do not mention the candidate's level, current salary or equity."
}
${level ? `The totalComp values are typical for the ${level} level, not for any specific person.` : ''}` }], 900);
      const parsed = extractJSON(raw);
      if (parsed.error) throw new Error(parsed.msg);
      if (!Array.isArray(parsed.levels) || parsed.levels.length === 0) throw new Error('The market data came back incomplete.');
      const at = new Date().toISOString();
      setData(parsed); setComputedAt(at);
      if (updateMemory) updateMemory(m => ({ ...m, salaryMarket: { data: parsed, v: MARKET_CACHE_VERSION, forRole: role, forLevel: level, forMarket: market, computedAt: at } }));
    } catch {
      // No invented numbers as a fallback: say it failed and let the user retry.
      setData(null);
      setError('Market data is temporarily unavailable. Nothing was saved. Try again.');
    }
    setLoading(false);
  };

  if (!role) {
    return <div style={{ padding: 24, color: 'var(--lp-text3)', fontSize: 13 }}>Set your target role in your profile to see market ranges.</div>;
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
        <OrbitSpinner size={40} />
        <div style={{ color: 'var(--lp-text3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Estimating market ranges…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ color: 'var(--lp-text2)', fontSize: 13 }}>{error || 'No market data yet.'}</div>
        <button onClick={loadMarket} style={{ padding: '8px 18px', background: 'var(--lp-teal)', color: '#000', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Try again</button>
      </div>
    );
  }

  const userIdx = userLevelIndex(level);
  const generated = computedAt ? new Date(computedAt).toLocaleDateString() : null;

  return (
    <div style={{ padding: 24 }}>
      <div className="sal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* Left: salary range bars */}
        <div>
          <div style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
            <SLabel>{market} {role} monthly base · AI estimate</SLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(data.levels || []).map((lv, i) => {
                const isUser = i === userIdx;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 140, fontSize: 12.5, color: isUser ? 'var(--lp-teal)' : 'var(--lp-text2)', fontWeight: isUser ? 700 : 400, flexShrink: 0 }}>
                      {lv.label}{isUser ? ' — your level' : ''}
                    </div>
                    <div style={{ flex: 1, height: 8, background: 'var(--lp-bg2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${lv.pct}%`, borderRadius: 4,
                        background: isUser ? 'linear-gradient(90deg,var(--lp-teal),#00E5A0)' : 'rgba(255,255,255,.12)',
                        transition: 'width .6s',
                      }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: isUser ? 700 : 400, color: isUser ? 'var(--lp-teal)' : 'var(--lp-text3)', width: 56, textAlign: 'right', flexShrink: 0 }}>
                      {lv.range}
                    </div>
                  </div>
                );
              })}
            </div>
            {userIdx < 0 && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--lp-bdr)' }}>
                <div style={{ fontSize: 12, color: 'var(--lp-text3)', marginBottom: 8 }}>
                  {level === 'Intern' ? 'Internships are not covered by these ranges.' : 'You haven\'t told us your level, so no row is highlighted. Which one are you?'}
                </div>
                {setForm && level !== 'Intern' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[['Junior', 'Junior'], ['Mid', 'Mid'], ['Senior', 'Senior'], ['Lead / Staff', 'Principal'], ['Director+', 'VP / Head']].map(([val, lbl]) => (
                      <button key={val} onClick={() => setForm(p => ({ ...p, level: val }))} style={{
                        background: 'transparent', border: '1px solid var(--lp-bdr)', color: 'var(--lp-text2)',
                        borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                      }}>{lbl}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI bubble */}
          <AiBubble>
            {data.aiInsight}
          </AiBubble>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--lp-text3)', lineHeight: 1.5 }}>
            AI-generated estimate, not from a salary survey or employer data{generated ? ` · generated ${generated}` : ''}. Check it against real job listings before you rely on it.
          </div>
        </div>

        {/* Right: employer types + total comp */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 12, padding: '18px 20px' }}>
            <SLabel>By employer type · AI estimate</SLabel>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--lp-bdr)' }}>
                  {['Employer type', 'P50', 'P75'].map(h => (
                    <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--lp-text3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.employerTypes || []).map((co, i, arr) => (
                  <tr key={i} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--lp-bdr)' : 'none' }}>
                    <td style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, color: 'var(--lp-text)' }}>{co.name}</td>
                    <td style={{ padding: '10px 8px', fontSize: 12, color: 'var(--lp-text2)' }}>{co.p50}</td>
                    <td style={{ padding: '10px 8px', fontSize: 12, color: 'var(--lp-text2)' }}>{co.p75}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {userIdx >= 0 && data.totalComp && (
            <div style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 12, padding: '18px 20px' }}>
              <SLabel>Typical total comp at {level} level · AI estimate</SLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { k: 'Base salary', v: data.totalComp.base },
                  { k: 'Annual bonus', v: data.totalComp.bonus },
                  { k: 'Equity (RSUs / options)', v: data.totalComp.equity },
                ].map(({ k, v }) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--lp-text2)' }}>{k}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--lp-text)', fontWeight: 600, textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--lp-text3)' }}>
                This is a market pattern, not your compensation. Add your own numbers in Negotiation roleplay.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Negotiation Roleplay Tab ──────────────────────────────────────────────────
function NegotiationTab({ form, resumeText, showToast }) {
  const [offer, setOffer]   = useState('');
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [stage, setStage]     = useState('received_offer');

  const STAGES = [
    { id: 'received_offer', label: 'Got an Offer'      },
    { id: 'pre_interview',  label: 'Before Interviews' },
    { id: 'negotiating',    label: 'Mid-Negotiation'   },
    { id: 'counter_offer',  label: 'Counter Offer'     },
  ];

  const analyze = async () => {
    if (!offer.trim()) { showToast('Describe your current offer or situation', 'error'); return; }
    setLoading(true); setResult(null);
    try {
      const resumeCtx = resumeText
        ? (typeof resumeText === 'string' ? resumeText : resumeText.content || '') : '';
      const raw = await callLLM([{ role: 'user', content:
        `You are a salary negotiation coach for ${form?.market || 'global'} tech.
Role: ${form?.role || 'Not specified'} · Stage: ${stage}
Situation: ${offer}
Target: ${target || 'Not specified'}
Resume: ${resumeCtx.slice(0, 600) || 'Not provided'}
Use only what the candidate wrote above. Do not assume their current salary, level, equity or employer; if something is missing, say it is missing. Market figures are estimates.
Return ONLY raw JSON (start with {):
{"marketMin":"$X","marketMid":"$X","marketMax":"$X","assessment":"2-3 sentence honest market position","scripts":[{"label":"Opening Move","text":"ready-to-say script"},{"label":"When They Push Back","text":"counter script"},{"label":"Closing Strong","text":"closing script"}],"leverage":["point 1","point 2","point 3"],"winCondition":"what success looks like"}
Be specific. Scripts must be ready to say out loud.` }], 1200);
      const parsed = extractJSON(raw);
      if (parsed.error) throw new Error(parsed.msg);
      setResult(parsed);
    } catch (e) { showToast('Analysis failed: ' + e.message, 'error'); }
    setLoading(false);
  };

  const inp = {
    width: '100%', background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)',
    borderRadius: 8, color: 'var(--lp-text)', padding: '10px 12px',
    fontSize: 13, outline: 'none', boxSizing: 'border-box', lineHeight: 1.6,
  };

  return (
    <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
      {/* Left: input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Stage tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STAGES.map(s => (
            <button key={s.id} onClick={() => setStage(s.id)} style={{
              background: stage === s.id ? 'rgba(236,72,153,.12)' : 'transparent',
              border: `1px solid ${stage === s.id ? 'var(--lp-teal)' : 'var(--lp-bdr)'}`,
              color: stage === s.id ? 'var(--lp-teal)' : 'var(--lp-text3)',
              borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{s.label}</button>
          ))}
        </div>

        <div>
          <SLabel>Current offer / situation</SLabel>
          <textarea value={offer} onChange={e => setOffer(e.target.value)}
            placeholder={`e.g. "I got an offer for $95k base + 10% bonus for a ${form?.role || 'Software Engineer'} role at a mid-sized tech firm."`}
            style={{ ...inp, minHeight: 110, resize: 'vertical' }}
          />
        </div>

        <div>
          <SLabel>Your target (optional)</SLabel>
          <input value={target} onChange={e => setTarget(e.target.value)}
            placeholder="e.g. $115k minimum" style={inp} />
        </div>

        <button onClick={analyze} disabled={loading || !offer.trim()} style={{
          width: '100%', padding: '12px 0',
          background: loading ? 'var(--lp-bdr)' : 'var(--lp-teal)',
          color: loading ? 'var(--lp-text3)' : '#000',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800,
          cursor: loading || !offer.trim() ? 'default' : 'pointer',
        }}>
          {loading ? 'Analyzing…' : 'Get negotiation strategy →'}
        </button>
      </div>

      {/* Right: results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!result && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: 'var(--lp-text3)', fontSize: 13, opacity: .5, textAlign: 'center' }}>
            Fill in your situation and click Get strategy to see your scripts and market position.
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 12 }}>
            <OrbitSpinner size={36} />
            <div style={{ color: 'var(--lp-text3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Analyzing market position…</div>
          </div>
        )}

        {result && (
          <>
            {/* Market range */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Market min', v: result.marketMin, color: 'var(--lp-text3)' },
                { label: 'Median',     v: result.marketMid, color: '#FFB84D' },
                { label: 'Max',        v: result.marketMax, color: '#00E5A0' },
              ].map(m => (
                <div key={m.label} style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--lp-text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: m.color }}>{m.v}</div>
                </div>
              ))}
            </div>

            {/* Assessment */}
            <AiBubble>{result.assessment}</AiBubble>

            {/* Scripts */}
            {result.scripts?.map((s, i) => (
              <div key={i} style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#FFB84D', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 13, color: 'var(--lp-text)', lineHeight: 1.75, fontStyle: 'italic', borderLeft: '3px solid var(--lp-teal)', paddingLeft: 12 }}>"{s.text}"</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Your Strategy Tab ─────────────────────────────────────────────────────────
function StrategyTab({ form }) {
  const role   = form?.role   || 'your target role';
  const market = form?.market || 'Singapore';

  const scripts = [
    {
      title: 'Anchor high — first number wins',
      body: `"Based on my research into ${market} market rates for ${role} and my ${form?.level ? form.level.toLowerCase() + '-level ' : ''}experience, I'm targeting a base of [X]. I'm excited about this role and I believe we can find a number that works."`,
      color: 'var(--lp-teal)',
    },
    {
      title: 'When they ask your current salary',
      body: `"I'd prefer to keep that private, but I can tell you that I'm looking for compensation in line with market rates for this level — which based on my research is [range]. Does that work for your budget?"`,
      color: '#FFB84D',
    },
    {
      title: 'Closing on total comp',
      body: `"The base works for me. Can we talk about the equity component? I've seen similar roles at [competitor] include [X RSUs] over 4 years — is there flexibility there?"`,
      color: '#00E5A0',
    },
  ];

  const checklist = [
    'Research P50 and P75 for your exact level + company',
    'Know your BATNA (best alternative to a negotiated agreement)',
    'Never accept on the spot — ask for time to review',
    'Negotiate base, bonus, RSUs, and start date separately',
    'Get the final offer in writing before giving notice',
    'Counter at least once — employers often expect a counter',
  ];

  return (
    <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
      {/* Left: script cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SLabel>Word-for-word scripts</SLabel>
        {scripts.map((s, i) => (
          <div key={i} style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderLeft: `4px solid ${s.color}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text)', marginBottom: 10 }}>{s.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--lp-text2)', lineHeight: 1.75, fontStyle: 'italic' }}>{s.body}</div>
          </div>
        ))}
      </div>

      {/* Right: checklist */}
      <div style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 12, padding: '18px 20px' }}>
        <SLabel>Negotiation checklist</SLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {checklist.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, border: '1.5px solid var(--lp-bdr2, rgba(255,255,255,.12))', flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12.5, color: 'var(--lp-text2)', lineHeight: 1.5 }}>{item}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'market',    label: 'Market data'         },
  { id: 'roleplay',  label: 'Negotiation roleplay' },
  { id: 'strategy',  label: 'Your strategy'        },
];

export default function SalaryCoach({ resumeText, form, setForm, memory, updateMemory, showToast }) {
  const [tab, setTab] = useState('market');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--lp-ff)' }}>
      {/* Header */}
      <div style={{ padding: '18px 24px 0', borderBottom: '1px solid var(--lp-bdr)' }}>
        <div style={{ color: 'var(--lp-text)', fontWeight: 900, fontSize: 22, marginBottom: 2 }}>Salary Prep</div>
        <div style={{ color: 'var(--lp-text3)', fontSize: 13, marginBottom: 0 }}>
          {form?.market || 'Singapore'} {form?.role || 'PM'} market estimates, AI negotiation roleplay, and anchoring scripts you fill in with your own numbers.
        </div>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, marginTop: 14 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '10px 18px', fontSize: 13,
              fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? 'var(--lp-teal)' : 'var(--lp-text3)',
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${tab === t.id ? 'var(--lp-teal)' : 'transparent'}`,
              cursor: 'pointer', fontFamily: 'var(--lp-ff)', whiteSpace: 'nowrap',
              transition: 'all .15s',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab === 'market'   && <MarketDataTab   form={form} setForm={setForm} memory={memory} updateMemory={updateMemory} />}
      {tab === 'roleplay' && <NegotiationTab  form={form} resumeText={resumeText} showToast={showToast} />}
      {tab === 'strategy' && <StrategyTab     form={form} />}
    </div>
  );
}
